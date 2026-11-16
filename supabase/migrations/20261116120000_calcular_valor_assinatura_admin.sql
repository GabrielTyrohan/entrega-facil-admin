-- =====================================================================
-- Fase 1 — Cobrança correta da assinatura e relatório de faturamento
--
-- Regra: dono paga valor_base_admin + valor_por_vendedor × vendedores
-- REPRESENTADOS ativos. Vendedores autônomos pagam a própria assinatura
-- (valor_autonomo) e NÃO entram na conta do dono.
-- Os valores vêm de public.configuracoes_plano (nada fixo no código).
-- =====================================================================

create or replace function public.calcular_valor_assinatura_admin(p_administrador_id uuid)
returns table (
  valor_base numeric,
  valor_por_vendedor numeric,
  vendedores_representados integer,
  vendedores_autonomos integer,
  valor_total numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base numeric;
  v_por_vendedor numeric;
  v_representados integer;
  v_autonomos integer;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is distinct from p_administrador_id
     and not public.is_super_admin() then
    raise exception 'Sem permissão para consultar a assinatura deste administrador'
      using errcode = '42501';
  end if;

  select c.valor into v_base
  from public.configuracoes_plano c
  where c.chave = 'valor_base_admin';

  select c.valor into v_por_vendedor
  from public.configuracoes_plano c
  where c.chave = 'valor_por_vendedor';

  if v_base is null or v_por_vendedor is null then
    raise exception 'configuracoes_plano sem valor_base_admin/valor_por_vendedor';
  end if;

  select
    count(*) filter (where coalesce(v.tipo_vinculo, 'representado') <> 'autonomo'),
    count(*) filter (where v.tipo_vinculo = 'autonomo')
  into v_representados, v_autonomos
  from public.vendedores v
  where v.administrador_id = p_administrador_id
    and v.ativo = true;

  return query
  select v_base,
         v_por_vendedor,
         v_representados,
         v_autonomos,
         v_base + (v_por_vendedor * v_representados);
end;
$$;

revoke all on function public.calcular_valor_assinatura_admin(uuid) from public, anon;
grant execute on function public.calcular_valor_assinatura_admin(uuid) to authenticated, service_role;

comment on function public.calcular_valor_assinatura_admin(uuid) is
  'Valor mensal do administrador: valor_base_admin + valor_por_vendedor × vendedores representados ativos. Autônomos não entram.';


-- ---------------------------------------------------------------------
-- Relatório de faturamento do superadmin (dono e autônomos), por período
-- p_inicio / p_fim: datas inclusivas no fuso America/Sao_Paulo.
-- ---------------------------------------------------------------------
create or replace function public.relatorio_faturamento(p_inicio date, p_fim date)
returns table (
  id uuid,
  data_referencia timestamptz,
  tipo_pagador text,
  administrador_id uuid,
  empresa text,
  vendedor_id uuid,
  vendedor_nome text,
  valor numeric,
  status text,
  metodo_pagamento text,
  mp_payment_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito ao superadmin' using errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido';
  end if;

  return query
  select
    h.id,
    coalesce(h.data_pagamento, h.created_at) as data_referencia,
    case when h.vendedor_id is not null then 'autonomo' else 'administrador' end as tipo_pagador,
    coalesce(h.administrador_id, v.administrador_id) as administrador_id,
    coalesce(a.nome_empresa, a.razao_social, a.nome) as empresa,
    h.vendedor_id,
    v.nome as vendedor_nome,
    coalesce(h.valor_cobrado, 0) as valor,
    h.status,
    h.metodo_pagamento,
    h.mp_payment_id
  from public.historico_pagamentos h
  left join public.vendedores v on v.id = h.vendedor_id
  left join public.administradores a on a.id = coalesce(h.administrador_id, v.administrador_id)
  where (coalesce(h.data_pagamento, h.created_at) at time zone 'America/Sao_Paulo')::date
        between p_inicio and p_fim
  order by coalesce(h.data_pagamento, h.created_at) desc;
end;
$$;

revoke all on function public.relatorio_faturamento(date, date) from public, anon;
grant execute on function public.relatorio_faturamento(date, date) to authenticated, service_role;

comment on function public.relatorio_faturamento(date, date) is
  'Pagamentos de assinatura (donos e autônomos) no período, para o superadmin.';
