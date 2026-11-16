-- =====================================================================
-- Fase 3 — Autoria, permissões das funcionárias e percentual do vendedor
--
-- 1. Quem fez: vendas_atacado, orcamentos_pj e acertos_diarios passam a
--    guardar criado_por / criado_por_nome, preenchidos pelo banco a partir
--    do usuário logado (o front não precisa enviar nada).
-- 2. Permissões novas das funcionárias:
--      cobranca        → Clientes, Entregas, Pagamentos e Devedores
--      cestas_vendedor → liberar cestas e produtos avulsos aos vendedores
--    Funcionárias existentes recebem cobranca = true (mantém o acesso que
--    já tinham) e cestas_vendedor = false (o dono decide quem libera).
-- 3. Percentual mínimo: o vendedor altera no app e o valor é gravado no
--    banco pela Edge Function (função de uso exclusivo do servidor).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Autoria
-- ---------------------------------------------------------------------
alter table public.vendas_atacado
  add column if not exists criado_por uuid,
  add column if not exists criado_por_nome text;

alter table public.orcamentos_pj
  add column if not exists criado_por uuid,
  add column if not exists criado_por_nome text;

alter table public.acertos_diarios
  add column if not exists criado_por uuid,
  add column if not exists criado_por_nome text;

create or replace function public.preencher_criado_por()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
begin
  if v_uid is null then
    return new;
  end if;

  if new.criado_por is null then
    new.criado_por := v_uid;
  end if;

  if new.criado_por_nome is null then
    select a.nome into v_nome from public.administradores a where a.id = v_uid;
    if v_nome is null then
      select f.nome into v_nome from public.funcionarios f where f.auth_user_id = v_uid limit 1;
    end if;
    if v_nome is null then
      select d.nome into v_nome from public.desenvolvedores d where d.user_id = v_uid limit 1;
    end if;
    new.criado_por_nome := v_nome;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_criado_por on public.vendas_atacado;
create trigger trg_criado_por before insert on public.vendas_atacado
  for each row execute function public.preencher_criado_por();

drop trigger if exists trg_criado_por on public.orcamentos_pj;
create trigger trg_criado_por before insert on public.orcamentos_pj
  for each row execute function public.preencher_criado_por();

drop trigger if exists trg_criado_por on public.acertos_diarios;
create trigger trg_criado_por before insert on public.acertos_diarios
  for each row execute function public.preencher_criado_por();


-- ---------------------------------------------------------------------
-- 2. Permissões das funcionárias
-- ---------------------------------------------------------------------
-- O trigger guard_funcionario_self_update só aceita alterações de permissão
-- feitas pelo serviço/admin/dev. A migração roda como serviço, só nesta transação.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.funcionarios
set permissoes = coalesce(permissoes, '{}'::jsonb)
  || jsonb_build_object('cobranca', not coalesce((permissoes->>'expedicao')::boolean, false))
where not (coalesce(permissoes, '{}'::jsonb) ? 'cobranca');

update public.funcionarios
set permissoes = coalesce(permissoes, '{}'::jsonb) || jsonb_build_object('cestas_vendedor', false)
where not (coalesce(permissoes, '{}'::jsonb) ? 'cestas_vendedor');

select set_config('request.jwt.claims', '', true);

-- Liberar cestas/avulsos: produtos, expedição ou a nova permissão cestas_vendedor
create or replace function public.can_operate_cestas(p_administrador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'service_role'
    or public.is_super_admin()
    or auth.uid() = p_administrador_id
    or exists (
      select 1
      from public.funcionarios f
      where f.auth_user_id = auth.uid()
        and f.administrador_id = p_administrador_id
        and f.ativo = true
        and coalesce(f.bloqueado, false) = false
        and (
          coalesce((f.permissoes ->> 'produtos')::boolean, false) = true
          or coalesce((f.permissoes ->> 'expedicao')::boolean, false) = true
          or coalesce((f.permissoes ->> 'cestas_vendedor')::boolean, false) = true
        )
    );
$$;

-- Cobrança: clientes, entregas ao cliente, pagamentos e devedores
create or replace function public.can_operate_cobranca(p_administrador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'service_role'
    or public.is_super_admin()
    or auth.uid() = p_administrador_id
    or exists (
      select 1
      from public.funcionarios f
      where f.auth_user_id = auth.uid()
        and f.administrador_id = p_administrador_id
        and f.ativo = true
        and coalesce(f.bloqueado, false) = false
        and coalesce((f.permissoes ->> 'cobranca')::boolean, false) = true
    );
$$;

revoke all on function public.can_operate_cobranca(uuid) from public, anon;
grant execute on function public.can_operate_cobranca(uuid) to authenticated, service_role;

-- Entrega ao cliente feita pelo admin: aceita quem cuida da cobrança ou das cestas
create or replace function public.criar_entrega_cliente_segura(
  p_vendedor_id uuid,
  p_cliente_id uuid,
  p_cesta_id uuid,
  p_itens jsonb,
  p_valor numeric default null,
  p_data_entrega timestamptz default null,
  p_data_retorno date default null,
  p_status_entrega text default 'entregue'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_entrega_id uuid;
  v_soma numeric := 0;
  v_invalidos integer;
begin
  select v.administrador_id into v_admin_id
  from public.vendedores v
  where v.id = p_vendedor_id and coalesce(v.ativo, true) = true;

  if v_admin_id is null then
    raise exception 'Vendedor não encontrado ou inativo' using errcode = 'P0002';
  end if;

  if not (public.can_operate_cobranca(v_admin_id) or public.can_operate_cestas(v_admin_id)) then
    raise exception 'Sem permissão para registrar entrega nesta empresa' using errcode = '42501';
  end if;

  if not exists (select 1 from public.produtos p where p.id = p_cesta_id and p.vendedor_id = p_vendedor_id) then
    raise exception 'A cesta não pertence a este vendedor' using errcode = '42501';
  end if;

  if not exists (select 1 from public.clientes c where c.id = p_cliente_id and c.vendedor_id = p_vendedor_id) then
    raise exception 'O cliente não pertence a este vendedor' using errcode = '42501';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A entrega precisa ter pelo menos 1 item' using errcode = '22023';
  end if;

  select count(*) into v_invalidos
  from jsonb_array_elements(p_itens) i
  where nullif(i->>'produto_cadastrado_id', '') is null
     or coalesce((i->>'quantidade')::numeric, 0) <= 0
     or not exists (
       select 1 from public.produtos_cadastrado pc
       where pc.id = (i->>'produto_cadastrado_id')::uuid and pc.administrador_id = v_admin_id
     );
  if v_invalidos > 0 then
    raise exception 'Itens inválidos na entrega' using errcode = '22023';
  end if;

  update public.estoque_vendedor ev
  set quantidade_disponivel = ev.quantidade_disponivel - 1,
      updated_at = now()
  where ev.vendedor_id = p_vendedor_id
    and ev.produto_id = p_cesta_id
    and ev.quantidade_disponivel > 0;

  if not found then
    raise exception 'O vendedor não tem esta cesta em estoque' using errcode = '22023';
  end if;

  select coalesce(sum(round(
           coalesce((i->>'preco_unitario')::numeric, 0) * (i->>'quantidade')::numeric, 2)), 0)
    into v_soma
  from jsonb_array_elements(p_itens) i;

  insert into public.entregas (
    vendedor_id, cliente_id, produto_id, valor, data_entrega, "dataRetorno",
    mes_cobranca, status_entrega, status_pagamento, pago, sincronizado, estoque_debitado
  )
  values (
    p_vendedor_id,
    p_cliente_id,
    p_cesta_id,
    round(coalesce(p_valor, v_soma), 2),
    coalesce(p_data_entrega, now()),
    p_data_retorno,
    case when p_data_retorno is not null then date_trunc('month', p_data_retorno)::date end,
    coalesce(nullif(p_status_entrega, ''), 'entregue'),
    'pendente',
    false,
    false,
    true
  )
  returning id into v_entrega_id;

  insert into public.itens_entrega (entrega_id, produto_cadastrado_id, quantidade, preco_unitario, subtotal)
  select
    v_entrega_id,
    (i->>'produto_cadastrado_id')::uuid,
    (i->>'quantidade')::numeric,
    coalesce((i->>'preco_unitario')::numeric, 0),
    round(coalesce((i->>'preco_unitario')::numeric, 0) * (i->>'quantidade')::numeric, 2)
  from jsonb_array_elements(p_itens) i;

  return jsonb_build_object('id', v_entrega_id);
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Percentual mínimo alterado pelo vendedor no app
-- ---------------------------------------------------------------------
create or replace function public.atualizar_percentual_minimo_vendedor(p_vendedor_id uuid, p_percentual numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Uso exclusivo do servidor' using errcode = '42501';
  end if;

  if p_percentual is null or p_percentual < 0 or p_percentual > 100 then
    raise exception 'Percentual deve ser entre 0 e 100' using errcode = '22023';
  end if;

  select percentual_minimo into v_anterior from public.vendedores where id = p_vendedor_id and ativo = true for update;
  if not found then
    raise exception 'Vendedor não encontrado ou inativo' using errcode = 'P0002';
  end if;

  update public.vendedores
  set percentual_minimo = round(p_percentual, 2)
  where id = p_vendedor_id;

  return jsonb_build_object(
    'percentual_minimo', round(p_percentual, 2),
    'percentual_anterior', v_anterior
  );
end;
$$;

revoke all on function public.atualizar_percentual_minimo_vendedor(uuid, numeric) from public, anon, authenticated;
grant execute on function public.atualizar_percentual_minimo_vendedor(uuid, numeric) to service_role;
