-- =====================================================================
-- Assinatura do dono: um só cálculo no banco
--
-- 1) _calculo_assinatura_admin: cálculo interno (sem checagem de usuário), usado pela
--    função pública calcular_valor_assinatura_admin e pelo gatilho de vendedores.
-- 2) recalcular_valor_assinatura (gatilho): antes gravava 180 + 100 × TODOS os vendedores
--    ativos (contava autônomos e usava valores fixos). Agora usa o cálculo oficial e também
--    dispara quando muda o tipo de vínculo.
-- 3) alterar_tipo_vinculo_vendedor: troca representado/autônomo pelo banco (o site deixa de
--    gravar direto na tabela) e devolve o novo valor da assinatura.
-- 4) Acerta uma vez o valor_assinatura de todos os donos.
-- =====================================================================

create or replace function public._calculo_assinatura_admin(p_administrador_id uuid)
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

revoke all on function public._calculo_assinatura_admin(uuid) from public, anon, authenticated;
grant execute on function public._calculo_assinatura_admin(uuid) to service_role;

comment on function public._calculo_assinatura_admin(uuid) is
  'Uso interno: cálculo da assinatura do dono sem checagem de usuário. Use calcular_valor_assinatura_admin.';


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
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and auth.uid() is distinct from p_administrador_id
     and not public.is_super_admin() then
    raise exception 'Sem permissão para consultar a assinatura deste administrador'
      using errcode = '42501';
  end if;

  return query select * from public._calculo_assinatura_admin(p_administrador_id);
end;
$$;

revoke all on function public.calcular_valor_assinatura_admin(uuid) from public, anon;
grant execute on function public.calcular_valor_assinatura_admin(uuid) to authenticated, service_role;


-- Gatilho em vendedores: mantém administradores.valor_assinatura e quantidade_vendedores
create or replace function public.recalcular_valor_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  foreach v_admin in array array[
    case when tg_op in ('UPDATE', 'DELETE') then old.administrador_id end,
    case when tg_op in ('INSERT', 'UPDATE') then new.administrador_id end
  ]
  loop
    continue when v_admin is null;

    update public.administradores a
    set quantidade_vendedores = c.vendedores_representados + c.vendedores_autonomos,
        valor_assinatura = c.valor_total
    from public._calculo_assinatura_admin(v_admin) c
    where a.id = v_admin
      and (a.valor_assinatura is distinct from c.valor_total
           or a.quantidade_vendedores is distinct from c.vendedores_representados + c.vendedores_autonomos);
  end loop;

  return coalesce(new, old);
end;
$$;

revoke all on function public.recalcular_valor_assinatura() from public, anon;

drop trigger if exists trg_recalcular_valor_assinatura on public.vendedores;
create trigger trg_recalcular_valor_assinatura
  after insert or delete or update of ativo, tipo_vinculo, administrador_id
  on public.vendedores
  for each row execute function public.recalcular_valor_assinatura();


-- Troca do tipo de vínculo pelo banco
create or replace function public.alterar_tipo_vinculo_vendedor(
  p_vendedor_id uuid,
  p_tipo_vinculo text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendedor record;
  v_admin uuid;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Faça login para continuar' using errcode = '42501';
  end if;

  if p_tipo_vinculo is null or p_tipo_vinculo not in ('representado', 'autonomo') then
    raise exception 'Tipo de vínculo inválido: use representado ou autônomo' using errcode = '22023';
  end if;

  if not public.can_manage_vendedores() then
    raise exception 'Sem permissão para alterar vendedores' using errcode = '42501';
  end if;

  select id, administrador_id, tipo_vinculo into v_vendedor
  from public.vendedores
  where id = p_vendedor_id;

  if not found then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;

  v_admin := public.get_user_admin_id();
  if not public.is_super_admin()
     and (v_admin is null or v_vendedor.administrador_id is distinct from v_admin) then
    raise exception 'Sem permissão para alterar vendedores de outra empresa' using errcode = '42501';
  end if;

  if v_vendedor.tipo_vinculo is distinct from p_tipo_vinculo then
    update public.vendedores
    set tipo_vinculo = p_tipo_vinculo
    where id = p_vendedor_id;
  end if;

  select c.valor_total into v_total
  from public._calculo_assinatura_admin(v_vendedor.administrador_id) c;

  return v_total;
end;
$$;

revoke all on function public.alterar_tipo_vinculo_vendedor(uuid, text) from public, anon;
grant execute on function public.alterar_tipo_vinculo_vendedor(uuid, text) to authenticated, service_role;

comment on function public.alterar_tipo_vinculo_vendedor(uuid, text) is
  'Troca o vendedor entre representado e autônomo (dono ou funcionária com permissão de vendedores) e devolve o novo valor da assinatura do dono.';


-- Acerto único dos valores já gravados
update public.administradores a
set quantidade_vendedores = c.vendedores_representados + c.vendedores_autonomos,
    valor_assinatura = c.valor_total
from public.administradores a2
cross join lateral public._calculo_assinatura_admin(a2.id) c
where a.id = a2.id
  and (a.valor_assinatura is distinct from c.valor_total
       or a.quantidade_vendedores is distinct from c.vendedores_representados + c.vendedores_autonomos);
