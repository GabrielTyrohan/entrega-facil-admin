-- =====================================================================
-- Fase 7 — Superadmin com controle total e auditoria do desenvolvedor
--
-- 1. Auditoria automática: qualquer INSERT/UPDATE/DELETE feito com o login
--    de um desenvolvedor (is_super_admin) nas tabelas principais vai para
--    auditoria_acoes (usuario_tipo 'desenvolvedor'), com o que mudou.
--    Vale para as telas antigas do superadmin, que gravam direto.
-- 2. Ações do dev, sempre com motivo e registradas:
--    dev_atualizar_funcionario  — bloquear/liberar e permissões
--    dev_ajustar_estoque        — ajuste/inventário do estoque geral
--    dev_encerrar_pedido        — recusar/cancelar pedido pendente
--    dev_desfazer_devolucao     — devolução feita por engano volta a entregue
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Movimentação de estoque pode ser lançada pelo desenvolvedor
-- ---------------------------------------------------------------------
alter table public.movimentacoes_estoque drop constraint if exists movimentacoes_estoque_usuario_tipo_check;
alter table public.movimentacoes_estoque add constraint movimentacoes_estoque_usuario_tipo_check
  check (usuario_tipo = any (array['admin', 'funcionario', 'vendedor', 'desenvolvedor']));


-- ---------------------------------------------------------------------
-- 1. Auditoria automática do desenvolvedor
-- ---------------------------------------------------------------------
create or replace function public.dev_registrar_auditoria(
  p_administrador_id uuid,
  p_acao text,
  p_entidade text,
  p_entidade_id uuid,
  p_anteriores jsonb,
  p_novos jsonb,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dev record;
begin
  select d.nome, d.email into v_dev from public.desenvolvedores d where d.user_id = auth.uid() and d.ativo = true;
  insert into public.auditoria_acoes (
    administrador_id, usuario_id, usuario_tipo, usuario_nome, usuario_email,
    acao, entidade, entidade_id, dados_anteriores, dados_novos, observacao
  ) values (
    p_administrador_id, auth.uid(), 'desenvolvedor', coalesce(v_dev.nome, 'Desenvolvedor'), v_dev.email,
    p_acao, p_entidade, p_entidade_id, p_anteriores, p_novos, p_observacao
  );
end;
$$;

revoke all on function public.dev_registrar_auditoria(uuid, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.dev_registrar_auditoria(uuid, text, text, uuid, jsonb, jsonb, text) to service_role;

create or replace function public.fn_auditoria_dev()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_admin uuid;
  v_ant jsonb;
  v_nov jsonb;
begin
  if auth.uid() is null or not public.is_super_admin() then
    return null;
  end if;

  begin
    -- Empresa da linha: administrador_id, ou o dono do vendedor, ou a própria empresa
    v_admin := case
      when tg_table_name = 'administradores' then (v_row->>'id')::uuid
      when v_row ? 'administrador_id' and nullif(v_row->>'administrador_id', '') is not null then (v_row->>'administrador_id')::uuid
      when v_row ? 'vendedor_id' then (select v.administrador_id from public.vendedores v where v.id = (v_row->>'vendedor_id')::uuid)
      when v_row ? 'entrega_id' then (select v.administrador_id from public.entregas e join public.vendedores v on v.id = e.vendedor_id where e.id = (v_row->>'entrega_id')::uuid)
    end;

    if tg_op = 'UPDATE' then
      -- Só o que mudou (sem updated_at/senhas)
      select coalesce(jsonb_object_agg(k, v_old->k), '{}'::jsonb), coalesce(jsonb_object_agg(k, v_new->k), '{}'::jsonb)
        into v_ant, v_nov
      from jsonb_object_keys(v_new) k
      where (v_old->k) is distinct from (v_new->k)
        and k not in ('updated_at', 'senha_hash', 'senha', 'password');
      if v_nov = '{}'::jsonb then
        return null;
      end if;
    else
      v_ant := v_old - 'senha_hash' - 'senha';
      v_nov := v_new - 'senha_hash' - 'senha';
    end if;

    perform public.dev_registrar_auditoria(
      v_admin, lower(tg_op), tg_table_name, nullif(v_row->>'id', '')::uuid, v_ant, v_nov, null);
  exception when others then
    -- A auditoria nunca impede a alteração; o erro vai para o log
    begin
      insert into public.logs_sistema (tipo, servico, mensagem, timestamp)
      values ('warning', 'fn_auditoria_dev', left(format('%s em %s: %s', tg_op, tg_table_name, sqlerrm), 1000), now());
    exception when others then null;
    end;
  end;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'administradores', 'vendedores', 'clientes', 'entregas', 'itens_entrega', 'pagamentos',
    'produtos', 'produtos_cadastrado', 'funcionarios', 'estoque_vendedor', 'estoque_vendedor_itens',
    'pedidos_vendedor', 'vendas_atacado', 'notas_fiscais', 'orcamentos_pj', 'compras'
  ]
  loop
    execute format('drop trigger if exists trg_auditoria_dev on public.%I', t);
    execute format(
      'create trigger trg_auditoria_dev after insert or update or delete on public.%I
         for each row execute function public.fn_auditoria_dev()', t);
  end loop;
end $$;


-- Helper comum das ações do dev
create or replace function public.dev_exigir(p_motivo text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Somente o desenvolvedor pode fazer esta ação' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo (fica na auditoria)' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.dev_exigir(text) from public, anon;
grant execute on function public.dev_exigir(text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2a. Funcionária: bloquear/liberar e permissões
-- ---------------------------------------------------------------------
create or replace function public.dev_atualizar_funcionario(
  p_funcionario_id uuid,
  p_bloqueado boolean default null,
  p_permissoes jsonb default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.funcionarios%rowtype;
  v_claims text;
  v_perm jsonb;
begin
  perform public.dev_exigir(p_motivo);

  select * into v_f from public.funcionarios where id = p_funcionario_id for update;
  if not found then
    raise exception 'Funcionária não encontrada' using errcode = 'P0002';
  end if;
  if p_bloqueado is null and p_permissoes is null then
    raise exception 'Nada para alterar' using errcode = '22023';
  end if;
  if p_permissoes is not null and jsonb_typeof(p_permissoes) <> 'object' then
    raise exception 'Permissões inválidas' using errcode = '22023';
  end if;

  -- Só chaves de permissão em true/false, mescladas com as atuais
  v_perm := coalesce(v_f.permissoes, '{}'::jsonb) || coalesce((
    select jsonb_object_agg(k, to_jsonb((p_permissoes->>k)::boolean))
    from jsonb_object_keys(coalesce(p_permissoes, '{}'::jsonb)) k
    where jsonb_typeof(p_permissoes->k) = 'boolean'
  ), '{}'::jsonb);

  -- guard_funcionario_self_update só deixa o próprio dono/servidor; age como servidor
  v_claims := current_setting('request.jwt.claims', true);
  perform public.dev_registrar_auditoria(
    v_f.administrador_id, 'dev_atualizar_funcionario', 'funcionarios', v_f.id,
    jsonb_build_object('bloqueado', v_f.bloqueado, 'permissoes', v_f.permissoes),
    jsonb_build_object('bloqueado', coalesce(p_bloqueado, v_f.bloqueado), 'permissoes', v_perm),
    btrim(p_motivo));

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.funcionarios
     set bloqueado = coalesce(p_bloqueado, bloqueado),
         permissoes = v_perm,
         updated_at = now()
   where id = v_f.id;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);

  return jsonb_build_object('id', v_f.id, 'bloqueado', coalesce(p_bloqueado, v_f.bloqueado), 'permissoes', v_perm);
end;
$$;

revoke all on function public.dev_atualizar_funcionario(uuid, boolean, jsonb, text) from public, anon;
grant execute on function public.dev_atualizar_funcionario(uuid, boolean, jsonb, text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2b. Ajuste/inventário do estoque geral (leva o saldo ao valor contado)
-- ---------------------------------------------------------------------
create or replace function public.dev_ajustar_estoque(
  p_produto_id uuid,
  p_quantidade_contada numeric,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_dev text;
  v_delta numeric;
  v_tipo text;
begin
  perform public.dev_exigir(p_motivo);
  if p_quantidade_contada is null or p_quantidade_contada < 0 then
    raise exception 'Quantidade contada inválida' using errcode = '22023';
  end if;

  select id, administrador_id, produto_nome, coalesce(qtd_estoque, 0) as qtd into v_p
  from public.produtos_cadastrado where id = p_produto_id for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;

  v_delta := p_quantidade_contada - v_p.qtd;
  if v_delta = 0 then
    return jsonb_build_object('produto_id', v_p.id, 'anterior', v_p.qtd, 'nova', v_p.qtd, 'ajuste', 0);
  end if;
  v_tipo := case when v_delta > 0 then 'entrada_ajuste' else 'saida_ajuste' end;

  select coalesce(nome, 'Desenvolvedor') into v_dev from public.desenvolvedores where user_id = auth.uid();

  insert into public.movimentacoes_estoque (
    administrador_id, produto_cadastrado_id, tipo_movimentacao, quantidade,
    quantidade_anterior, quantidade_nova, referencia_tipo, usuario_id, usuario_tipo, usuario_nome,
    motivo, observacoes, created_at
  ) values (
    v_p.administrador_id, v_p.id, v_tipo, abs(v_delta),
    v_p.qtd, p_quantidade_contada, 'inventario', auth.uid(), 'desenvolvedor', v_dev,
    'Inventário pelo desenvolvedor', btrim(p_motivo), now()
  );

  perform public.dev_registrar_auditoria(
    v_p.administrador_id, 'dev_ajustar_estoque', 'produtos_cadastrado', v_p.id,
    jsonb_build_object('qtd_estoque', v_p.qtd), jsonb_build_object('qtd_estoque', p_quantidade_contada),
    btrim(p_motivo));

  return jsonb_build_object('produto_id', v_p.id, 'anterior', v_p.qtd, 'nova', p_quantidade_contada, 'ajuste', v_delta);
end;
$$;

revoke all on function public.dev_ajustar_estoque(uuid, numeric, text) from public, anon;
grant execute on function public.dev_ajustar_estoque(uuid, numeric, text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2c. Recusar ou cancelar pedido pendente
-- ---------------------------------------------------------------------
create or replace function public.dev_encerrar_pedido(p_pedido_id uuid, p_status text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.pedidos_vendedor%rowtype;
  v_dev text;
begin
  perform public.dev_exigir(p_motivo);
  if p_status not in ('recusado', 'cancelado') then
    raise exception 'Use recusado ou cancelado' using errcode = '22023';
  end if;

  select * into v_p from public.pedidos_vendedor where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_p.status <> 'pendente' then
    raise exception 'Só pedido pendente pode ser encerrado (este está %)', v_p.status using errcode = '22023';
  end if;

  select coalesce(nome, 'Desenvolvedor') into v_dev from public.desenvolvedores where user_id = auth.uid();

  update public.pedidos_vendedor
     set status = p_status,
         resposta = btrim(p_motivo),
         atendido_por = auth.uid(),
         atendido_por_nome = v_dev || ' (suporte)',
         atendido_em = now(),
         updated_at = now()
   where id = v_p.id;

  perform public.dev_registrar_auditoria(
    v_p.administrador_id, 'dev_encerrar_pedido', 'pedidos_vendedor', v_p.id,
    jsonb_build_object('status', v_p.status), jsonb_build_object('status', p_status), btrim(p_motivo));

  return jsonb_build_object('id', v_p.id, 'status', p_status);
end;
$$;

revoke all on function public.dev_encerrar_pedido(uuid, text, text) from public, anon;
grant execute on function public.dev_encerrar_pedido(uuid, text, text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2d. Desfazer devolução feita por engano
-- ---------------------------------------------------------------------
create or replace function public.dev_desfazer_devolucao(p_entrega_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e public.entregas%rowtype;
  v_admin uuid;
  v_res jsonb;
begin
  perform public.dev_exigir(p_motivo);

  select * into v_e from public.entregas where id = p_entrega_id for update;
  if not found then
    raise exception 'Entrega não encontrada' using errcode = 'P0002';
  end if;
  if v_e.status_entrega is distinct from 'devolução' then
    raise exception 'Esta entrega não está devolvida' using errcode = '22023';
  end if;
  if exists (select 1 from public.entregas t where t.entrega_origem_id = v_e.id) then
    raise exception 'Esta devolução já virou troca; corrija a entrega nova em vez de desfazer' using errcode = '22023';
  end if;

  select administrador_id into v_admin from public.vendedores where id = v_e.vendedor_id;

  -- Volta a entregue e passa a controlar o estoque (inclusive entrega antiga),
  -- para o banco tirar de novo do vendedor o que tinha voltado.
  update public.entregas
     set status_entrega = 'entregue',
         estoque_controle = true,
         updated_at = now()
   where id = v_e.id;

  v_res := public.reconciliar_estoque_entregas(v_e.vendedor_id, array[v_e.id]);

  perform public.dev_registrar_auditoria(
    v_admin, 'dev_desfazer_devolucao', 'entregas', v_e.id,
    jsonb_build_object('status_entrega', v_e.status_entrega, 'devolvida_em', v_e.devolvida_em),
    jsonb_build_object('status_entrega', 'entregue'), btrim(p_motivo));

  return jsonb_build_object('id', v_e.id, 'status_entrega', 'entregue', 'estoque', v_res);
end;
$$;

revoke all on function public.dev_desfazer_devolucao(uuid, text) from public, anon;
grant execute on function public.dev_desfazer_devolucao(uuid, text) to authenticated, service_role;
