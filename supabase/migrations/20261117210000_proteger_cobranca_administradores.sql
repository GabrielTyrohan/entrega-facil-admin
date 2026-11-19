-- =====================================================================
-- Protege as colunas de cobrança do cadastro do dono (public.administradores)
--
-- Problema: as políticas "admins" e "Admin acessa próprio perfil" deixam o dono logado
-- alterar qualquer coluna da própria linha pela API (chave anon). Assim ele conseguia
-- marcar a assinatura como paga, mudar o vencimento/valor ou trocar o status_permissao,
-- e o gatilho fn_sync_representado_pagamento ainda desbloqueava os representados.
--
-- Regra: as colunas de cobrança só mudam por
--   * service_role (Edge Functions criar-assinatura, atualizar-assinatura, mercadopago-webhook);
--   * superadmin (is_super_admin(), painel do desenvolvedor, auditado por fn_auditoria_dev);
--   * funções SECURITY DEFINER e rotinas do banco (cron, recalcular_valor_assinatura,
--     criar_vendedor_com_hash), que rodam com o dono das funções e não como authenticated.
-- O dono continua editando os dados cadastrais (nome, empresa, telefone, endereço etc.).
--
-- INSERT feito pelo front (cadastro do site): os campos de cobrança são definidos pelo
-- banco, nunca pelo que o navegador mandou: status 'pendente', 30 dias de vencimento,
-- valor oficial (calcular_valor_assinatura_admin), sem ids do Mercado Pago, permissão 'admin'.
-- =====================================================================

create or replace function public.fn_proteger_cobranca_administrador()
returns trigger
language plpgsql
security invoker  -- precisa enxergar o papel real de quem chama (authenticated/anon)
set search_path = public
as $$
declare
  v_valor numeric;
begin
  -- Sistema (service_role), rotinas do banco e funções SECURITY DEFINER passam direto.
  if current_user not in ('authenticated', 'anon')
     or coalesce(auth.role(), '') = 'service_role'
     or public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select c.valor_total into v_valor
    from public.calcular_valor_assinatura_admin(new.id) c;

    new.status_pagamento      := 'pendente';
    new.data_vencimento       := current_date + 30;
    new.valor_assinatura      := coalesce(v_valor, 180);
    new.quantidade_vendedores := 0;
    new.mp_preapproval_id     := null;
    new.mp_payer_email        := null;
    new.ultima_cobranca       := null;
    new.status_permissao      := 'admin';
    return new;
  end if;

  if new.status_pagamento  is distinct from old.status_pagamento
     or new.data_vencimento   is distinct from old.data_vencimento
     or new.valor_assinatura  is distinct from old.valor_assinatura
     or new.mp_preapproval_id is distinct from old.mp_preapproval_id
     or new.mp_payer_email    is distinct from old.mp_payer_email
     or new.ultima_cobranca   is distinct from old.ultima_cobranca
     or new.status_permissao  is distinct from old.status_permissao then
    raise exception 'A situação da assinatura (pagamento, vencimento e valor) só é alterada pelo sistema de pagamento. Seus dados cadastrais continuam podendo ser editados.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_proteger_cobranca_administrador() from public, anon;
grant execute on function public.fn_proteger_cobranca_administrador() to authenticated, service_role;

comment on function public.fn_proteger_cobranca_administrador() is
  'Gatilho: impede o dono de alterar status_pagamento, data_vencimento, valor_assinatura, mp_*, ultima_cobranca e status_permissao; no INSERT pelo front, o banco define esses campos.';

drop trigger if exists trg_proteger_cobranca_administrador on public.administradores;
create trigger trg_proteger_cobranca_administrador
  before insert or update on public.administradores
  for each row execute function public.fn_proteger_cobranca_administrador();
