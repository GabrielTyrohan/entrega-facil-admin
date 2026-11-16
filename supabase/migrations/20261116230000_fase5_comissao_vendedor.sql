-- =====================================================================
-- Fase 5 — Janela de cobrança e comissão do vendedor
--
-- Regras (decisões D1/D2 do planejamento):
--   * Janela do vendedor: do dia de fechamento até o dia anterior do mês
--     seguinte (ex.: fechamento 10 → 10/10 a 09/11), sempre pelo banco.
--   * Comissão = comissao_percentual do vendedor × soma dos PAGAMENTOS
--     recebidos (data do pagamento) dentro da janela.
--   * Efetivado e autônomo só mudam o percentual; tipo_contrato é informativo
--     e separado de tipo_vinculo (que diz quem paga a assinatura do app).
--   * Fechar o período congela o valor: cada pagamento contado fica ligado
--     ao fechamento. Pagamento lançado depois com data de um período já
--     fechado entra como AJUSTE no próximo fechamento.
--   * Só o dono (e o superadmin) vê e fecha comissões.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Cadastro do vendedor
-- ---------------------------------------------------------------------
alter table public.vendedores
  add column if not exists comissao_percentual numeric(5,2) not null default 0,
  add column if not exists tipo_contrato text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendedores_comissao_percentual_check') then
    alter table public.vendedores add constraint vendedores_comissao_percentual_check
      check (comissao_percentual >= 0 and comissao_percentual <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vendedores_tipo_contrato_check') then
    alter table public.vendedores add constraint vendedores_tipo_contrato_check
      check (tipo_contrato is null or tipo_contrato in ('efetivado', 'autonomo'));
  end if;
end;
$$;

comment on column public.vendedores.comissao_percentual is
  'Percentual de comissão sobre o total recebido na janela de cobrança (definido pelo dono).';
comment on column public.vendedores.tipo_contrato is
  'efetivado | autonomo — vínculo de trabalho (informativo). Diferente de tipo_vinculo, que diz quem paga a assinatura do app.';


-- ---------------------------------------------------------------------
-- 2. Janela única do vendedor
-- ---------------------------------------------------------------------
create or replace function public.periodo_vendedor_em(p_dia_fechamento integer, p_data date)
returns table (inicio date, fim date)
language sql
immutable
as $$
  select
    public.get_periodo_fechamento(p_data, coalesce(nullif(p_dia_fechamento, 0), 1)),
    (public.get_periodo_fechamento(p_data, coalesce(nullif(p_dia_fechamento, 0), 1))
      + interval '1 month' - interval '1 day')::date;
$$;

grant execute on function public.periodo_vendedor_em(integer, date) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3. Fechamentos
-- ---------------------------------------------------------------------
create table if not exists public.fechamentos_vendedor (
  id uuid primary key default gen_random_uuid(),
  administrador_id uuid not null references public.administradores(id) on delete cascade,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  total_recebido numeric(12,2) not null default 0,
  qtd_pagamentos integer not null default 0,
  ajustes numeric(12,2) not null default 0,
  qtd_ajustes integer not null default 0,
  base_calculo numeric(12,2) not null default 0,
  percentual numeric(5,2) not null,
  valor_comissao numeric(12,2) not null,
  status text not null default 'fechado' check (status in ('fechado', 'pago')),
  fechado_por uuid,
  fechado_por_nome text,
  fechado_em timestamptz not null default now(),
  pago_por uuid,
  pago_por_nome text,
  pago_em timestamptz,
  observacao text,
  unique (vendedor_id, periodo_inicio)
);

create table if not exists public.fechamentos_vendedor_pagamentos (
  fechamento_id uuid not null references public.fechamentos_vendedor(id) on delete cascade,
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  valor numeric(12,2) not null,
  eh_ajuste boolean not null default false,
  primary key (pagamento_id)
);

create index if not exists idx_fechamentos_vendedor_admin
  on public.fechamentos_vendedor (administrador_id, periodo_inicio desc);
create index if not exists idx_fechamentos_pag_fechamento
  on public.fechamentos_vendedor_pagamentos (fechamento_id);

alter table public.fechamentos_vendedor enable row level security;
alter table public.fechamentos_vendedor_pagamentos enable row level security;

drop policy if exists fechamentos_vendedor_leitura on public.fechamentos_vendedor;
create policy fechamentos_vendedor_leitura on public.fechamentos_vendedor
  for select to authenticated
  using (public.is_super_admin() or administrador_id = auth.uid());

drop policy if exists fechamentos_vendedor_pag_leitura on public.fechamentos_vendedor_pagamentos;
create policy fechamentos_vendedor_pag_leitura on public.fechamentos_vendedor_pagamentos
  for select to authenticated
  using (exists (
    select 1 from public.fechamentos_vendedor f
    where f.id = fechamentos_vendedor_pagamentos.fechamento_id
      and (public.is_super_admin() or f.administrador_id = auth.uid())
  ));


-- ---------------------------------------------------------------------
-- 4. Cálculo (prévia) — usado pelo admin e pelo app
-- ---------------------------------------------------------------------
create or replace function public.calcular_comissao_vendedor(
  p_vendedor_id uuid,
  p_data_referencia date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vend record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inicio date;
  v_fim date;
  v_fech public.fechamentos_vendedor%rowtype;
  v_primeiro_fechado date;
  v_total numeric := 0;
  v_qtd integer := 0;
  v_ajustes numeric := 0;
  v_qtd_ajustes integer := 0;
begin
  select v.id, v.administrador_id, v.dia_fechamento, v.comissao_percentual
    into v_vend
  from public.vendedores v where v.id = p_vendedor_id;
  if v_vend.id is null then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_super_admin()
     and auth.uid() is distinct from v_vend.administrador_id then
    raise exception 'Somente o dono da empresa vê as comissões' using errcode = '42501';
  end if;

  select p.inicio, p.fim into v_inicio, v_fim
  from public.periodo_vendedor_em(v_vend.dia_fechamento, coalesce(p_data_referencia, v_hoje)) p;

  -- Período já fechado: devolve o valor congelado
  select * into v_fech from public.fechamentos_vendedor
  where vendedor_id = p_vendedor_id and periodo_inicio = v_inicio;
  if found then
    return jsonb_build_object(
      'vendedor_id', p_vendedor_id,
      'periodo_inicio', v_fech.periodo_inicio,
      'periodo_fim', v_fech.periodo_fim,
      'total_recebido', v_fech.total_recebido,
      'qtd_pagamentos', v_fech.qtd_pagamentos,
      'ajustes', v_fech.ajustes,
      'qtd_ajustes', v_fech.qtd_ajustes,
      'base_calculo', v_fech.base_calculo,
      'percentual', v_fech.percentual,
      'valor_comissao', v_fech.valor_comissao,
      'encerrado', true,
      'fechamento_id', v_fech.id,
      'status', v_fech.status
    );
  end if;

  select coalesce(sum(p.valor), 0), count(*)
    into v_total, v_qtd
  from public.pagamentos p
  join public.entregas e on e.id = p.entrega_id
  where e.vendedor_id = p_vendedor_id
    and (p.data_pagamento at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
    and not exists (select 1 from public.fechamentos_vendedor_pagamentos fp where fp.pagamento_id = p.id);

  -- Ajustes: pagamentos de períodos JÁ FECHADOS lançados depois do fechamento
  select min(periodo_inicio) into v_primeiro_fechado
  from public.fechamentos_vendedor where vendedor_id = p_vendedor_id;

  if v_primeiro_fechado is not null then
    select coalesce(sum(p.valor), 0), count(*)
      into v_ajustes, v_qtd_ajustes
    from public.pagamentos p
    join public.entregas e on e.id = p.entrega_id
    where e.vendedor_id = p_vendedor_id
      and (p.data_pagamento at time zone 'America/Sao_Paulo')::date >= v_primeiro_fechado
      and (p.data_pagamento at time zone 'America/Sao_Paulo')::date < v_inicio
      and not exists (select 1 from public.fechamentos_vendedor_pagamentos fp where fp.pagamento_id = p.id);
  end if;

  return jsonb_build_object(
    'vendedor_id', p_vendedor_id,
    'periodo_inicio', v_inicio,
    'periodo_fim', v_fim,
    'total_recebido', round(v_total, 2),
    'qtd_pagamentos', v_qtd,
    'ajustes', round(v_ajustes, 2),
    'qtd_ajustes', v_qtd_ajustes,
    'base_calculo', round(v_total + v_ajustes, 2),
    'percentual', v_vend.comissao_percentual,
    'valor_comissao', round((v_total + v_ajustes) * v_vend.comissao_percentual / 100, 2),
    'encerrado', v_fim < v_hoje,
    'fechamento_id', null,
    'status', 'aberto'
  );
end;
$$;

revoke all on function public.calcular_comissao_vendedor(uuid, date) from public, anon;
grant execute on function public.calcular_comissao_vendedor(uuid, date) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 5. Fechar período (congela) e marcar como paga
-- ---------------------------------------------------------------------
create or replace function public.fechar_periodo_vendedor(
  p_vendedor_id uuid,
  p_periodo_inicio date,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vend record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inicio date;
  v_fim date;
  v_calc jsonb;
  v_id uuid;
  v_nome text;
  v_primeiro_fechado date;
begin
  select v.id, v.administrador_id, v.dia_fechamento, v.comissao_percentual
    into v_vend
  from public.vendedores v where v.id = p_vendedor_id for update;
  if v_vend.id is null then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;

  if not public.is_super_admin() and auth.uid() is distinct from v_vend.administrador_id then
    raise exception 'Somente o dono da empresa fecha comissões' using errcode = '42501';
  end if;

  select p.inicio, p.fim into v_inicio, v_fim
  from public.periodo_vendedor_em(v_vend.dia_fechamento, p_periodo_inicio) p;

  if v_inicio is distinct from p_periodo_inicio then
    raise exception 'Data inicial não corresponde a uma janela deste vendedor (início esperado: %)', v_inicio
      using errcode = '22023';
  end if;
  if v_fim >= v_hoje then
    raise exception 'O período só pode ser fechado depois de terminar (termina em %)', to_char(v_fim, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if exists (select 1 from public.fechamentos_vendedor where vendedor_id = p_vendedor_id and periodo_inicio = v_inicio) then
    raise exception 'Este período já foi fechado' using errcode = '22023';
  end if;

  v_calc := public.calcular_comissao_vendedor(p_vendedor_id, v_inicio);

  select a.nome into v_nome from public.administradores a where a.id = auth.uid();
  if v_nome is null then
    select d.nome into v_nome from public.desenvolvedores d where d.user_id = auth.uid() limit 1;
  end if;

  insert into public.fechamentos_vendedor (
    administrador_id, vendedor_id, periodo_inicio, periodo_fim,
    total_recebido, qtd_pagamentos, ajustes, qtd_ajustes, base_calculo,
    percentual, valor_comissao, fechado_por, fechado_por_nome, observacao
  )
  values (
    v_vend.administrador_id, p_vendedor_id, v_inicio, v_fim,
    (v_calc->>'total_recebido')::numeric, (v_calc->>'qtd_pagamentos')::integer,
    (v_calc->>'ajustes')::numeric, (v_calc->>'qtd_ajustes')::integer,
    (v_calc->>'base_calculo')::numeric, (v_calc->>'percentual')::numeric,
    (v_calc->>'valor_comissao')::numeric, auth.uid(), v_nome,
    nullif(btrim(coalesce(p_observacao, '')), '')
  )
  returning id into v_id;

  -- Liga os pagamentos contados (os mesmos critérios da prévia)
  select min(periodo_inicio) into v_primeiro_fechado
  from public.fechamentos_vendedor where vendedor_id = p_vendedor_id;

  insert into public.fechamentos_vendedor_pagamentos (fechamento_id, pagamento_id, valor, eh_ajuste)
  select v_id, p.id, p.valor,
         (p.data_pagamento at time zone 'America/Sao_Paulo')::date < v_inicio
  from public.pagamentos p
  join public.entregas e on e.id = p.entrega_id
  where e.vendedor_id = p_vendedor_id
    and not exists (select 1 from public.fechamentos_vendedor_pagamentos fp where fp.pagamento_id = p.id)
    and (
      (p.data_pagamento at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
      or (
        v_primeiro_fechado < v_inicio
        and (p.data_pagamento at time zone 'America/Sao_Paulo')::date >= v_primeiro_fechado
        and (p.data_pagamento at time zone 'America/Sao_Paulo')::date < v_inicio
      )
    );

  return v_calc || jsonb_build_object('fechamento_id', v_id, 'status', 'fechado', 'encerrado', true);
end;
$$;

revoke all on function public.fechar_periodo_vendedor(uuid, date, text) from public, anon;
grant execute on function public.fechar_periodo_vendedor(uuid, date, text) to authenticated, service_role;


create or replace function public.marcar_comissao_paga(p_fechamento_id uuid, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fech public.fechamentos_vendedor%rowtype;
  v_nome text;
begin
  select * into v_fech from public.fechamentos_vendedor where id = p_fechamento_id for update;
  if not found then
    raise exception 'Fechamento não encontrado' using errcode = 'P0002';
  end if;
  if not public.is_super_admin() and auth.uid() is distinct from v_fech.administrador_id then
    raise exception 'Somente o dono da empresa marca comissões como pagas' using errcode = '42501';
  end if;
  if v_fech.status = 'pago' then
    raise exception 'Esta comissão já está marcada como paga' using errcode = '22023';
  end if;

  select a.nome into v_nome from public.administradores a where a.id = auth.uid();
  if v_nome is null then
    select d.nome into v_nome from public.desenvolvedores d where d.user_id = auth.uid() limit 1;
  end if;

  update public.fechamentos_vendedor
  set status = 'pago', pago_por = auth.uid(), pago_por_nome = v_nome, pago_em = now(),
      observacao = coalesce(nullif(btrim(coalesce(p_observacao, '')), ''), observacao)
  where id = p_fechamento_id;

  return jsonb_build_object('id', p_fechamento_id, 'status', 'pago');
end;
$$;

revoke all on function public.marcar_comissao_paga(uuid, text) from public, anon;
grant execute on function public.marcar_comissao_paga(uuid, text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 6. Extrato para o app do vendedor (via Edge Function)
-- ---------------------------------------------------------------------
create or replace function public.extrato_comissao_vendedor(p_vendedor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Uso exclusivo do servidor' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'atual', public.calcular_comissao_vendedor(p_vendedor_id, null),
    'fechamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'periodo_inicio', f.periodo_inicio,
        'periodo_fim', f.periodo_fim,
        'base_calculo', f.base_calculo,
        'percentual', f.percentual,
        'valor_comissao', f.valor_comissao,
        'status', f.status,
        'pago_em', f.pago_em
      ) order by f.periodo_inicio desc)
      from (
        select * from public.fechamentos_vendedor
        where vendedor_id = p_vendedor_id
        order by periodo_inicio desc
        limit 6
      ) f
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.extrato_comissao_vendedor(uuid) from public, anon, authenticated;
grant execute on function public.extrato_comissao_vendedor(uuid) to service_role;
