-- Fase 9 — Vendedor revendedor.
-- O revendedor (com CNPJ) compra do dono por venda PJ e revende, ficando com o dinheiro das vendas.
-- Convive com o modelo atual (consignado): todos os vendedores continuam consignados até o dono trocar.
--
-- Regras:
-- * vendedores.modelo_venda: consignado (padrão) | revendedor; cliente_pj_id = cadastro PJ do revendedor.
-- * Preço de compra do revendedor: cesta = soma de preco_unt × quantidade da composição (o "X");
--   avulso = preco_unt. O preço da cesta (produtos.preco, o "Y") é só o sugerido de revenda.
-- * A venda PJ ao revendedor baixa o estoque geral (como toda venda PJ) e credita o estoque dele no app.
-- * Liberação (entregas_cestas_vendedor / entregas_avulsas) é recusada para revendedor.
-- * entregas.revenda marca, na criação, que o dinheiro da entrega é do revendedor. Essas entregas e seus
--   pagamentos saem do faturamento e da comissão do dono.

-- 1. Colunas -----------------------------------------------------------------------------------------

alter table public.vendedores
  add column if not exists modelo_venda text not null default 'consignado',
  add column if not exists cliente_pj_id uuid references public.clientes(id) on delete set null;

alter table public.vendedores drop constraint if exists vendedores_modelo_venda_check;
alter table public.vendedores
  add constraint vendedores_modelo_venda_check check (modelo_venda in ('consignado', 'revendedor'));

create index if not exists idx_vendedores_cliente_pj_id on public.vendedores(cliente_pj_id)
  where cliente_pj_id is not null;

alter table public.entregas
  add column if not exists revenda boolean not null default false;

alter table public.vendas_atacado
  add column if not exists para_revendedor boolean not null default false;

-- 2. Preços próprios do revendedor ---------------------------------------------------------------------

create table if not exists public.precos_revendedor (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  administrador_id uuid not null references public.administradores(id) on delete cascade,
  cesta_id uuid references public.produtos(id) on delete cascade,
  produto_cadastrado_id uuid references public.produtos_cadastrado(id) on delete cascade,
  preco numeric(12, 2) not null check (preco >= 0),
  updated_at timestamptz not null default now(),
  constraint precos_revendedor_um_alvo check (num_nonnulls(cesta_id, produto_cadastrado_id) = 1)
);

create unique index if not exists uq_precos_revendedor_cesta
  on public.precos_revendedor(vendedor_id, cesta_id) where cesta_id is not null;
create unique index if not exists uq_precos_revendedor_item
  on public.precos_revendedor(vendedor_id, produto_cadastrado_id) where produto_cadastrado_id is not null;
create index if not exists idx_precos_revendedor_admin on public.precos_revendedor(administrador_id);
create index if not exists idx_precos_revendedor_cesta on public.precos_revendedor(cesta_id) where cesta_id is not null;
create index if not exists idx_precos_revendedor_produto on public.precos_revendedor(produto_cadastrado_id)
  where produto_cadastrado_id is not null;

alter table public.precos_revendedor enable row level security;

drop policy if exists precos_revendedor_select on public.precos_revendedor;
create policy precos_revendedor_select on public.precos_revendedor
  for select to authenticated
  using (administrador_id = (select public.get_user_admin_id()) or (select public.is_super_admin()));

-- 3. Preço de compra da cesta (o "X") --------------------------------------------------------------------

create or replace function public.preco_revendedor_cesta(p_cesta_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(coalesce(sum(n.quantidade * coalesce(pc.preco_unt, 0)), 0), 2)
  from public.produtos_na_cesta n
  join public.produtos_cadastrado pc on pc.id = n.produto_cadastrado_id
  where n.cesta_id = p_cesta_id;
$$;

revoke all on function public.preco_revendedor_cesta(uuid) from public, anon;
grant execute on function public.preco_revendedor_cesta(uuid) to authenticated, service_role;

-- Cesta equivalente do revendedor: a mesma cesta (ou uma cesta com a mesma cesta base) cadastrada para ele.
-- Se ele ainda não tem, cria uma cópia com a composição da cesta de origem.
create or replace function public._cesta_do_revendedor(p_cesta_id uuid, p_vendedor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem public.produtos%rowtype;
  v_id uuid;
begin
  select * into v_origem from public.produtos where id = p_cesta_id;
  if not found then
    raise exception 'Cesta não encontrada' using errcode = 'P0002';
  end if;
  if v_origem.vendedor_id = p_vendedor_id then
    return v_origem.id;
  end if;

  if v_origem.cesta_base_id is not null then
    select p.id into v_id from public.produtos p
    where p.vendedor_id = p_vendedor_id and p.cesta_base_id = v_origem.cesta_base_id
    order by p.ativo desc, p.created_at
    limit 1;
  end if;
  if v_id is null then
    select p.id into v_id from public.produtos p
    where p.vendedor_id = p_vendedor_id and p.cesta_base_id is null
      and lower(btrim(p.nome)) = lower(btrim(v_origem.nome))
    order by p.ativo desc, p.created_at
    limit 1;
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.produtos (vendedor_id, nome, preco, descricao, ativo, cesta_base_id)
  values (p_vendedor_id, v_origem.nome, v_origem.preco, v_origem.descricao, true, v_origem.cesta_base_id)
  returning id into v_id;

  insert into public.produtos_na_cesta (cesta_id, produto_cadastrado_id, quantidade)
  select v_id, n.produto_cadastrado_id, n.quantidade
  from public.produtos_na_cesta n where n.cesta_id = p_cesta_id;

  return v_id;
end;
$$;

revoke all on function public._cesta_do_revendedor(uuid, uuid) from public, anon, authenticated;
grant execute on function public._cesta_do_revendedor(uuid, uuid) to service_role;

-- 4. Entrega nova guarda de quem é o dinheiro -------------------------------------------------------------

create or replace function public.fn_entrega_set_revenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.revenda := exists (
    select 1 from public.vendedores v
    where v.id = new.vendedor_id and v.modelo_venda = 'revendedor'
  );
  return new;
end;
$$;

revoke all on function public.fn_entrega_set_revenda() from public, anon;

drop trigger if exists trg_entrega_set_revenda on public.entregas;
create trigger trg_entrega_set_revenda
  before insert on public.entregas
  for each row execute function public.fn_entrega_set_revenda();

-- 5. Liberação recusada para revendedor -------------------------------------------------------------------

create or replace function public.fn_recusar_liberacao_revendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.vendedores v
    where v.id = new.vendedor_id and v.modelo_venda = 'revendedor'
  ) then
    raise exception 'Este vendedor é revendedor e compra as mercadorias. Use Venda PJ ou atenda o pedido como venda.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_recusar_liberacao_revendedor() from public, anon;

drop trigger if exists trg_recusar_liberacao_revendedor on public.entregas_cestas_vendedor;
create trigger trg_recusar_liberacao_revendedor
  before insert on public.entregas_cestas_vendedor
  for each row execute function public.fn_recusar_liberacao_revendedor();

drop trigger if exists trg_recusar_liberacao_revendedor on public.entregas_avulsas;
create trigger trg_recusar_liberacao_revendedor
  before insert on public.entregas_avulsas
  for each row execute function public.fn_recusar_liberacao_revendedor();

-- 6. Trocar o modelo de um vendedor (só o dono) ------------------------------------------------------------

create or replace function public.definir_modelo_vendedor(
  p_vendedor_id uuid,
  p_modelo text,
  p_cliente_pj_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vend public.vendedores%rowtype;
  v_cestas integer;
  v_itens integer;
  v_cliente record;
begin
  if auth.uid() is null then
    raise exception 'Faça login para continuar' using errcode = '42501';
  end if;
  if p_modelo is null or p_modelo not in ('consignado', 'revendedor') then
    raise exception 'Modelo inválido: use consignado ou revendedor' using errcode = '22023';
  end if;

  select * into v_vend from public.vendedores where id = p_vendedor_id for update;
  if not found then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;
  if auth.uid() is distinct from v_vend.administrador_id and not public.is_super_admin() then
    raise exception 'Somente o dono da empresa muda o modelo de venda do vendedor' using errcode = '42501';
  end if;

  if p_modelo = 'revendedor' then
    if p_cliente_pj_id is null then
      raise exception 'Escolha o cadastro PJ (CNPJ) do revendedor' using errcode = '22023';
    end if;
    select c.id, c.tipo_pessoa, c.cnpj, c.vendedor_id,
           coalesce(c.administrador_id, cv.administrador_id) as admin_id
      into v_cliente
    from public.clientes c
    left join public.vendedores cv on cv.id = c.vendedor_id
    where c.id = p_cliente_pj_id;
    if v_cliente.id is null or v_cliente.admin_id is distinct from v_vend.administrador_id then
      raise exception 'Cadastro PJ não encontrado nesta empresa' using errcode = 'P0002';
    end if;
    if v_cliente.tipo_pessoa is distinct from 'PJ' or nullif(btrim(coalesce(v_cliente.cnpj, '')), '') is null then
      raise exception 'O cadastro escolhido precisa ser de pessoa jurídica, com CNPJ' using errcode = '22023';
    end if;
    if v_cliente.vendedor_id = p_vendedor_id then
      raise exception 'O cadastro PJ do revendedor não pode estar na carteira dele. Cadastre-o em outro vendedor (ex.: o do escritório).'
        using errcode = '22023';
    end if;
    if exists (
      select 1 from public.vendedores o
      where o.cliente_pj_id = p_cliente_pj_id and o.id <> p_vendedor_id and o.modelo_venda = 'revendedor'
    ) then
      raise exception 'Este CNPJ já está ligado a outro revendedor' using errcode = '22023';
    end if;
  end if;

  if v_vend.modelo_venda is distinct from p_modelo then
    select coalesce(sum(greatest(quantidade_disponivel, 0)), 0) into v_cestas
    from public.estoque_vendedor where vendedor_id = p_vendedor_id;
    select coalesce(sum(greatest(quantidade, 0)), 0) into v_itens
    from public.estoque_vendedor_itens where vendedor_id = p_vendedor_id;
    if v_cestas > 0 or v_itens > 0 then
      raise exception 'O vendedor ainda tem % cesta(s) e % item(ns) em estoque. Zere o estoque dele (venda ou devolução) antes de trocar o modelo.',
        v_cestas, v_itens using errcode = '22023';
    end if;
  end if;

  update public.vendedores
     set modelo_venda = p_modelo,
         cliente_pj_id = case when p_modelo = 'revendedor' then p_cliente_pj_id else cliente_pj_id end,
         updated_at = now()
   where id = p_vendedor_id;

  -- O revendedor paga a própria assinatura do app.
  if p_modelo = 'revendedor' and v_vend.tipo_vinculo is distinct from 'autonomo' then
    perform public.alterar_tipo_vinculo_vendedor(p_vendedor_id, 'autonomo');
  end if;

  return jsonb_build_object(
    'vendedor_id', p_vendedor_id,
    'modelo_venda', p_modelo,
    'cliente_pj_id', case when p_modelo = 'revendedor' then p_cliente_pj_id else v_vend.cliente_pj_id end
  );
end;
$$;

revoke all on function public.definir_modelo_vendedor(uuid, text, uuid) from public, anon;
grant execute on function public.definir_modelo_vendedor(uuid, text, uuid) to authenticated, service_role;

-- 7. Venda PJ: quando o cliente é o CNPJ de um revendedor -----------------------------------------------------

create or replace function public.criar_venda_atacado_segura(p_venda jsonb, p_itens jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_admin_id uuid;
  v_usuario_tipo text;
  v_usuario_nome text;
  v_vendedor_id uuid;
  v_cliente_id uuid;
  v_revendedor_id uuid;
  v_item jsonb;
  v_id uuid;
  v_qtd numeric;
  v_preco numeric;
  v_nome text;
  v_tipo text;
  v_linhas jsonb := '[]'::jsonb;
  v_necessidade jsonb := '[]'::jsonb;
  v_falta record;
  v_comp record;
  v_total numeric := 0;
  v_qtd_total numeric := 0;
  v_venda_id uuid;
  v_numero integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select a.id, coalesce(a.nome, 'Administrador') into v_admin_id, v_usuario_nome
  from public.administradores a where a.id = auth.uid();
  if v_admin_id is not null then
    v_usuario_tipo := 'admin';
  else
    select f.administrador_id, f.nome into v_admin_id, v_usuario_nome
    from public.funcionarios f
    where f.auth_user_id = auth.uid()
      and f.ativo = true
      and coalesce(f.bloqueado, false) = false
      and coalesce((f.permissoes->>'vendas_atacado')::boolean, false) = true
    limit 1;
    v_usuario_tipo := 'funcionario';
  end if;
  if v_admin_id is null then
    raise exception 'Sem permissão para registrar venda atacado' using errcode = '42501';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa ter pelo menos 1 item' using errcode = '22023';
  end if;

  v_vendedor_id := nullif(p_venda->>'vendedor_id', '')::uuid;
  if v_vendedor_id is not null and not exists (
    select 1 from public.vendedores v where v.id = v_vendedor_id and v.administrador_id = v_admin_id
  ) then
    raise exception 'Vendedor não pertence a esta empresa' using errcode = '42501';
  end if;

  v_cliente_id := nullif(p_venda->>'cliente_id', '')::uuid;
  if v_cliente_id is null then
    raise exception 'Cliente é obrigatório' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clientes c
    left join public.vendedores v on v.id = c.vendedor_id
    where c.id = v_cliente_id
      and (c.administrador_id = v_admin_id or v.administrador_id = v_admin_id)
  ) then
    raise exception 'Cliente não pertence a esta empresa' using errcode = '42501';
  end if;

  -- Venda ao revendedor: o cliente é o cadastro PJ de um revendedor desta empresa.
  select v.id into v_revendedor_id
  from public.vendedores v
  where v.cliente_pj_id = v_cliente_id
    and v.modelo_venda = 'revendedor'
    and v.administrador_id = v_admin_id
  limit 1;
  if v_revendedor_id is not null then
    if v_vendedor_id is not null and v_vendedor_id <> v_revendedor_id then
      raise exception 'Este cliente é o CNPJ de um revendedor: a venda fica no nome dele, não de outro vendedor'
        using errcode = '22023';
    end if;
    v_vendedor_id := v_revendedor_id;
    if exists (
      select 1 from public.vendedores v
      where v.id = v_revendedor_id and (not coalesce(v.ativo, true) or coalesce(v.bloqueado, false))
    ) then
      raise exception 'O revendedor está inativo ou bloqueado (assinatura vencida). Regularize antes de vender para ele.'
        using errcode = '22023';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    begin
      v_id := nullif(v_item->>'produto_cadastrado_id', '')::uuid;
      v_qtd := (v_item->>'quantidade')::numeric;
      v_preco := (v_item->>'preco_unitario')::numeric;
    exception when others then
      raise exception 'Item inválido na venda' using errcode = '22023';
    end;

    if v_id is null then
      raise exception 'Todo item precisa estar ligado a uma cesta ou produto' using errcode = '22023';
    end if;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida na venda' using errcode = '22023';
    end if;
    if v_revendedor_id is null and (v_preco is null or v_preco < 0) then
      raise exception 'Preço inválido na venda' using errcode = '22023';
    end if;
    if v_revendedor_id is not null and v_qtd <> trunc(v_qtd) then
      raise exception 'Na venda ao revendedor as quantidades precisam ser números inteiros' using errcode = '22023';
    end if;

    v_tipo := null;

    select p.nome into v_nome
    from public.produtos p
    join public.vendedores v on v.id = p.vendedor_id
    where p.id = v_id and v.administrador_id = v_admin_id;

    if found then
      v_tipo := 'cesta';
      if not exists (select 1 from public.produtos_na_cesta n where n.cesta_id = v_id) then
        raise exception 'A cesta "%" não tem itens cadastrados. Cadastre a composição antes de vender.', v_nome
          using errcode = '22023';
      end if;
      if v_revendedor_id is not null then
        -- A cesta vai para o estoque do revendedor: usa a cesta dele (cria se ainda não tiver).
        v_id := public._cesta_do_revendedor(v_id, v_revendedor_id);
        select p.nome into v_nome from public.produtos p where p.id = v_id;
        if not exists (select 1 from public.produtos_na_cesta n where n.cesta_id = v_id) then
          raise exception 'A cesta "%" do revendedor não tem itens cadastrados. Cadastre a composição antes de vender.', v_nome
            using errcode = '22023';
        end if;
        v_preco := public.preco_revendedor_cesta(v_id);
      end if;
      select v_necessidade || coalesce(jsonb_agg(jsonb_build_object(
               'produto_cadastrado_id', n.produto_cadastrado_id,
               'quantidade', n.quantidade * v_qtd)), '[]'::jsonb)
        into v_necessidade
      from public.produtos_na_cesta n
      where n.cesta_id = v_id;
    else
      select pc.produto_nome, case when v_revendedor_id is not null then pc.preco_unt else v_preco end
        into v_nome, v_preco
      from public.produtos_cadastrado pc
      where pc.id = v_id and pc.administrador_id = v_admin_id;

      if not found then
        raise exception 'Cesta ou produto não encontrado nesta empresa' using errcode = 'P0002';
      end if;
      if v_revendedor_id is not null and v_preco is null then
        raise exception 'O produto "%" está sem preço de venda. Cadastre o preço antes de vender ao revendedor.', v_nome
          using errcode = '22023';
      end if;
      v_tipo := 'produto';
      v_necessidade := v_necessidade || jsonb_build_array(jsonb_build_object(
        'produto_cadastrado_id', v_id, 'quantidade', v_qtd));
    end if;

    v_linhas := v_linhas || jsonb_build_array(jsonb_build_object(
      'tipo', v_tipo,
      'id', v_id,
      'descricao', coalesce(nullif(v_item->>'descricao', ''), v_nome),
      'quantidade', v_qtd,
      'preco_unitario', v_preco,
      'subtotal', round(v_qtd * v_preco, 2)
    ));
    v_total := v_total + round(v_qtd * v_preco, 2);
    v_qtd_total := v_qtd_total + v_qtd;
  end loop;

  for v_falta in
    with nec as (
      select (x->>'produto_cadastrado_id')::uuid as produto_id, sum((x->>'quantidade')::numeric) as qtd
      from jsonb_array_elements(v_necessidade) x
      group by 1
    )
    select pc.produto_nome, coalesce(pc.qtd_estoque, 0) as disponivel, nec.qtd as necessario
    from nec
    join public.produtos_cadastrado pc on pc.id = nec.produto_id
    where coalesce(pc.qtd_estoque, 0) < nec.qtd
    order by pc.produto_nome
    limit 1
  loop
    raise exception 'Estoque insuficiente para "%". Disponível: %, necessário: %',
      v_falta.produto_nome, v_falta.disponivel, v_falta.necessario
      using errcode = '22023';
  end loop;

  perform 1
  from public.produtos_cadastrado pc
  where pc.id in (select (x->>'produto_cadastrado_id')::uuid from jsonb_array_elements(v_necessidade) x)
  for update;

  insert into public.vendas_atacado (
    administrador_id, vendedor_id, cliente_id, data_entrega, data_pagamento,
    forma_pagamento, valor_pago, status_pagamento, valor_total, pago,
    numero_produto, itens, quantidade_total, nome_cliente_cache, observacoes, para_revendedor
  )
  values (
    v_admin_id,
    v_vendedor_id,
    v_cliente_id,
    coalesce(nullif(p_venda->>'data_entrega', '')::date, current_date),
    nullif(p_venda->>'data_pagamento', '')::date,
    nullif(p_venda->>'forma_pagamento', ''),
    coalesce((p_venda->>'valor_pago')::numeric, 0),
    coalesce(nullif(p_venda->>'status_pagamento', ''), 'pendente'),
    v_total,
    coalesce((p_venda->>'pago')::boolean, false),
    (select array_agg(x->>'id') from jsonb_array_elements(v_linhas) x),
    (select jsonb_agg(jsonb_build_object(
        'produto_cadastrado_id', x->>'id',
        'descricao', x->>'descricao',
        'quantidade', (x->>'quantidade')::numeric,
        'preco_unitario', (x->>'preco_unitario')::numeric,
        'subtotal', (x->>'subtotal')::numeric,
        'tipo', x->>'tipo'))
     from jsonb_array_elements(v_linhas) x),
    round(v_qtd_total)::integer,
    nullif(p_venda->>'nome_cliente_cache', ''),
    nullif(p_venda->>'observacoes', ''),
    v_revendedor_id is not null
  )
  returning id, numero_pedido into v_venda_id, v_numero;

  insert into public.vendas_atacado_itens (
    venda_atacado_id, produto_cadastrado_id, descricao, quantidade, preco_unitario, subtotal, sincronizado
  )
  select
    v_venda_id,
    case when x->>'tipo' = 'produto' then (x->>'id')::uuid end,
    x->>'descricao',
    (x->>'quantidade')::numeric,
    (x->>'preco_unitario')::numeric,
    (x->>'subtotal')::numeric,
    false
  from jsonb_array_elements(v_linhas) x;

  for v_comp in
    select n.produto_cadastrado_id, sum(n.quantidade * (x->>'quantidade')::numeric) as qtd,
           string_agg(distinct x->>'descricao', ', ') as cestas
    from jsonb_array_elements(v_linhas) x
    join public.produtos_na_cesta n on n.cesta_id = (x->>'id')::uuid
    where x->>'tipo' = 'cesta'
    group by n.produto_cadastrado_id
  loop
    insert into public.movimentacoes_estoque (
      administrador_id, produto_cadastrado_id, tipo_movimentacao, quantidade,
      quantidade_anterior, quantidade_nova, referencia_tipo, referencia_id,
      usuario_id, usuario_tipo, usuario_nome, motivo, observacoes, created_at
    )
    values (
      v_admin_id, v_comp.produto_cadastrado_id, 'saida_venda', v_comp.qtd,
      0, 0, 'venda_atacado', v_venda_id,
      auth.uid(), v_usuario_tipo, coalesce(v_usuario_nome, 'Usuário'),
      'Venda atacado de cesta',
      format('Venda atacado #%s — %s', v_numero, v_comp.cestas),
      now()
    );
  end loop;

  -- A mercadoria comprada pelo revendedor entra no estoque dele (app).
  if v_revendedor_id is not null then
    insert into public.estoque_vendedor (vendedor_id, produto_id, quantidade_disponivel, administrador_id, updated_at)
    select v_revendedor_id, (x->>'id')::uuid, sum((x->>'quantidade')::numeric)::integer, v_admin_id, now()
    from jsonb_array_elements(v_linhas) x
    where x->>'tipo' = 'cesta'
    group by (x->>'id')::uuid
    on conflict (vendedor_id, produto_id) do update
      set quantidade_disponivel = public.estoque_vendedor.quantidade_disponivel + excluded.quantidade_disponivel,
          updated_at = now();

    insert into public.estoque_vendedor_itens (vendedor_id, produto_cadastrado_id, administrador_id, quantidade, updated_at)
    select v_revendedor_id, (x->>'id')::uuid, v_admin_id, sum((x->>'quantidade')::numeric)::integer, now()
    from jsonb_array_elements(v_linhas) x
    where x->>'tipo' = 'produto'
    group by (x->>'id')::uuid
    on conflict (vendedor_id, produto_cadastrado_id) do update
      set quantidade = public.estoque_vendedor_itens.quantidade + excluded.quantidade,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'id', v_venda_id,
    'numero_pedido', v_numero,
    'valor_total', v_total,
    'para_revendedor', v_revendedor_id is not null,
    'vendedor_id', v_vendedor_id
  );
end;
$function$;

revoke all on function public.criar_venda_atacado_segura(jsonb, jsonb) from public, anon;
grant execute on function public.criar_venda_atacado_segura(jsonb, jsonb) to authenticated, service_role;

-- 8. Pedido do revendedor vira venda PJ ------------------------------------------------------------------------

create or replace function public.atender_pedido_revendedor(
  p_pedido_id uuid,
  p_itens jsonb,
  p_venda jsonb default '{}'::jsonb,
  p_resposta text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos_vendedor%rowtype;
  v_vend public.vendedores%rowtype;
  v_item record;
  v_qtd numeric;
  v_itens_venda jsonb := '[]'::jsonb;
  v_total_solicitado numeric := 0;
  v_total_atendido numeric := 0;
  v_status text;
  v_nome text;
  v_res jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select * into v_pedido from public.pedidos_vendedor where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if not public.can_operate_cestas(v_pedido.administrador_id) then
    raise exception 'Sem permissão para atender pedidos desta empresa' using errcode = '42501';
  end if;
  if v_pedido.status <> 'pendente' then
    raise exception 'Este pedido já foi %', v_pedido.status using errcode = '22023';
  end if;

  select * into v_vend from public.vendedores where id = v_pedido.vendedor_id;
  if v_vend.modelo_venda is distinct from 'revendedor' then
    raise exception 'Este vendedor não é revendedor: atenda o pedido pela liberação normal' using errcode = '22023';
  end if;
  if v_vend.cliente_pj_id is null then
    raise exception 'O revendedor está sem cadastro PJ. Ligue o CNPJ dele no cadastro do vendedor.' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Informe as quantidades atendidas' using errcode = '22023';
  end if;

  for v_item in
    select i.*, coalesce((
      select (x->>'quantidade')::numeric
      from jsonb_array_elements(p_itens) x
      where (x->>'item_id')::uuid = i.id
      limit 1
    ), 0) as qtd_informada
    from public.pedidos_vendedor_itens i
    where i.pedido_id = p_pedido_id
    order by i.created_at
  loop
    v_qtd := v_item.qtd_informada;
    if v_qtd < 0 or v_qtd > v_item.quantidade_solicitada then
      raise exception 'Quantidade atendida de "%" deve ficar entre 0 e %', v_item.descricao, v_item.quantidade_solicitada
        using errcode = '22023';
    end if;
    if v_qtd <> trunc(v_qtd) then
      raise exception 'A quantidade de "%" precisa ser um número inteiro', v_item.descricao using errcode = '22023';
    end if;

    v_total_solicitado := v_total_solicitado + v_item.quantidade_solicitada;
    v_total_atendido := v_total_atendido + v_qtd;

    if v_qtd > 0 then
      if v_item.tipo = 'cesta' and v_item.cesta_id is null then
        raise exception 'A cesta "%" não existe mais', v_item.descricao using errcode = 'P0002';
      end if;
      if v_item.tipo <> 'cesta' and v_item.produto_cadastrado_id is null then
        raise exception 'O produto "%" não existe mais', v_item.descricao using errcode = 'P0002';
      end if;
      -- O preço é calculado pela venda (X da cesta ou preço do produto).
      v_itens_venda := v_itens_venda || jsonb_build_array(jsonb_build_object(
        'produto_cadastrado_id', case when v_item.tipo = 'cesta' then v_item.cesta_id else v_item.produto_cadastrado_id end,
        'descricao', v_item.descricao,
        'quantidade', v_qtd,
        'preco_unitario', 0));
    end if;

    update public.pedidos_vendedor_itens set quantidade_atendida = v_qtd where id = v_item.id;
  end loop;

  if v_total_atendido = 0 then
    raise exception 'Nenhuma quantidade informada. Para não atender, use Recusar.' using errcode = '22023';
  end if;

  v_res := public.criar_venda_atacado_segura(
    coalesce(p_venda, '{}'::jsonb) || jsonb_build_object(
      'cliente_id', v_vend.cliente_pj_id,
      'vendedor_id', v_vend.id,
      'nome_cliente_cache', coalesce(nullif(p_venda->>'nome_cliente_cache', ''), v_vend.nome_empresa, v_vend.nome),
      'observacoes', coalesce(nullif(p_venda->>'observacoes', ''), format('Pedido #%s do revendedor', v_pedido.numero))
    ),
    v_itens_venda
  );

  v_status := case when v_total_atendido >= v_total_solicitado then 'aprovado' else 'parcial' end;

  select a.nome into v_nome from public.administradores a where a.id = auth.uid();
  if v_nome is null then
    select f.nome into v_nome from public.funcionarios f where f.auth_user_id = auth.uid() limit 1;
  end if;
  if v_nome is null then
    select d.nome into v_nome from public.desenvolvedores d where d.user_id = auth.uid() limit 1;
  end if;

  update public.pedidos_vendedor
  set status = v_status,
      resposta = nullif(btrim(coalesce(p_resposta, '')), ''),
      atendido_por = auth.uid(),
      atendido_por_nome = v_nome,
      atendido_em = now(),
      updated_at = now()
  where id = p_pedido_id;

  return jsonb_build_object('id', p_pedido_id, 'status', v_status, 'venda', v_res);
end;
$$;

revoke all on function public.atender_pedido_revendedor(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.atender_pedido_revendedor(uuid, jsonb, jsonb, text) to authenticated, service_role;

-- Prévia de preço para o desktop: X das cestas e preço dos avulsos de um pedido ou de uma lista.
create or replace function public.precos_compra_revendedor(p_vendedor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  select administrador_id into v_admin from public.vendedores where id = p_vendedor_id;
  if v_admin is null then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_super_admin()
     and (select public.get_user_admin_id()) is distinct from v_admin then
    raise exception 'Sem permissão para ver este vendedor' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'cestas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cesta_id', p.id,
        'nome', p.nome,
        'preco_sugerido', p.preco,
        'preco_compra', public.preco_revendedor_cesta(p.id),
        'preco_proprio', pr.preco,
        'tem_composicao', exists (select 1 from public.produtos_na_cesta n where n.cesta_id = p.id)
      ) order by p.nome)
      from public.produtos p
      left join public.precos_revendedor pr on pr.vendedor_id = p_vendedor_id and pr.cesta_id = p.id
      where p.vendedor_id = p_vendedor_id and coalesce(p.ativo, true)
    ), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'produto_cadastrado_id', pr.produto_cadastrado_id,
        'preco_proprio', pr.preco
      ))
      from public.precos_revendedor pr
      where pr.vendedor_id = p_vendedor_id and pr.produto_cadastrado_id is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.precos_compra_revendedor(uuid) from public, anon;
grant execute on function public.precos_compra_revendedor(uuid) to authenticated, service_role;

-- 9. Preços próprios salvos pelo app (via Edge, com service_role) ----------------------------------------------

create or replace function public.definir_precos_revendedor(p_vendedor_id uuid, p_precos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vend public.vendedores%rowtype;
  v_p jsonb;
  v_tipo text;
  v_id uuid;
  v_preco numeric;
  v_n integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_super_admin() then
    raise exception 'Acesso restrito ao sistema' using errcode = '42501';
  end if;
  select * into v_vend from public.vendedores where id = p_vendedor_id;
  if not found then
    raise exception 'Vendedor não encontrado' using errcode = 'P0002';
  end if;
  if v_vend.modelo_venda is distinct from 'revendedor' then
    raise exception 'Só o revendedor define os próprios preços' using errcode = '42501';
  end if;
  if p_precos is null or jsonb_typeof(p_precos) <> 'array' then
    raise exception 'Lista de preços inválida' using errcode = '22023';
  end if;

  for v_p in select value from jsonb_array_elements(p_precos)
  loop
    v_tipo := v_p->>'tipo';
    begin
      v_id := (v_p->>'id')::uuid;
      v_preco := nullif(v_p->>'preco', '')::numeric;
    exception when others then
      raise exception 'Preço inválido' using errcode = '22023';
    end;
    if v_preco is not null and v_preco < 0 then
      raise exception 'O preço não pode ser negativo' using errcode = '22023';
    end if;

    if v_tipo = 'cesta' then
      if not exists (select 1 from public.produtos p where p.id = v_id and p.vendedor_id = p_vendedor_id) then
        raise exception 'Cesta não encontrada no estoque do revendedor' using errcode = 'P0002';
      end if;
      if v_preco is null then
        delete from public.precos_revendedor where vendedor_id = p_vendedor_id and cesta_id = v_id;
      else
        insert into public.precos_revendedor (vendedor_id, administrador_id, cesta_id, preco, updated_at)
        values (p_vendedor_id, v_vend.administrador_id, v_id, round(v_preco, 2), now())
        on conflict (vendedor_id, cesta_id) where cesta_id is not null
        do update set preco = excluded.preco, updated_at = now();
      end if;
    elsif v_tipo = 'item' then
      if not exists (
        select 1 from public.produtos_cadastrado pc where pc.id = v_id and pc.administrador_id = v_vend.administrador_id
      ) then
        raise exception 'Produto não encontrado nesta empresa' using errcode = 'P0002';
      end if;
      if v_preco is null then
        delete from public.precos_revendedor where vendedor_id = p_vendedor_id and produto_cadastrado_id = v_id;
      else
        insert into public.precos_revendedor (vendedor_id, administrador_id, produto_cadastrado_id, preco, updated_at)
        values (p_vendedor_id, v_vend.administrador_id, v_id, round(v_preco, 2), now())
        on conflict (vendedor_id, produto_cadastrado_id) where produto_cadastrado_id is not null
        do update set preco = excluded.preco, updated_at = now();
      end if;
    else
      raise exception 'Tipo de preço inválido: use cesta ou item' using errcode = '22023';
    end if;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.definir_precos_revendedor(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.definir_precos_revendedor(uuid, jsonb) to service_role;

-- 10. Faturamento e comissão do dono ignoram as vendas do revendedor --------------------------------------------

create or replace function public.get_dashboard_core_por_periodo(p_admin_id uuid)
 returns table(faturamento_atual numeric, faturamento_anterior numeric, entregas_atual bigint, entregas_anterior bigint, periodo_inicio date, periodo_fim date)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  WITH autorizado AS (
    SELECT public.is_super_admin() OR p_admin_id = public.get_user_admin_id() AS ok
  ),
  periodos AS (
    SELECT
      vendedor_id,
      periodo_inicio                                AS p_ini,
      periodo_fim                                   AS p_fim,
      (periodo_inicio - INTERVAL '1 month')::date   AS p_ant_ini,
      (periodo_inicio - INTERVAL '1 day')::date     AS p_ant_fim
    FROM public.v_periodos_ativos
    WHERE administrador_id = p_admin_id
      AND (SELECT ok FROM autorizado)
  ),
  fat_entregas AS (
    SELECT
      SUM(CASE WHEN e.data_entrega BETWEEN p.p_ini     AND p.p_fim     THEN e.valor ELSE 0 END) AS atual,
      SUM(CASE WHEN e.data_entrega BETWEEN p.p_ant_ini AND p.p_ant_fim THEN e.valor ELSE 0 END) AS anterior,
      COUNT(CASE WHEN e.data_entrega BETWEEN p.p_ini     AND p.p_fim     THEN 1 END)             AS qtd_atual,
      COUNT(CASE WHEN e.data_entrega BETWEEN p.p_ant_ini AND p.p_ant_fim THEN 1 END)             AS qtd_anterior
    FROM periodos p
    LEFT JOIN public.entregas e ON e.vendedor_id = p.vendedor_id AND NOT e.revenda
  ),
  fat_atacado AS (
    SELECT
      SUM(CASE WHEN va.created_at::date BETWEEN p.p_ini     AND p.p_fim     THEN va.valor_total ELSE 0 END) AS atual,
      SUM(CASE WHEN va.created_at::date BETWEEN p.p_ant_ini AND p.p_ant_fim THEN va.valor_total ELSE 0 END) AS anterior,
      COUNT(CASE WHEN va.created_at::date BETWEEN p.p_ini     AND p.p_fim     THEN 1 END)                    AS qtd_atual,
      COUNT(CASE WHEN va.created_at::date BETWEEN p.p_ant_ini AND p.p_ant_fim THEN 1 END)                    AS qtd_anterior
    FROM periodos p
    LEFT JOIN public.vendas_atacado va
      ON va.vendedor_id = p.vendedor_id
     AND va.administrador_id = p_admin_id
  ),
  datas AS (
    SELECT MIN(p_ini) AS periodo_inicio, MAX(p_fim) AS periodo_fim
    FROM periodos
  )
  SELECT
    COALESCE(fe.atual,    0) + COALESCE(fa.atual,    0),
    COALESCE(fe.anterior, 0) + COALESCE(fa.anterior, 0),
    COALESCE(fe.qtd_atual,    0) + COALESCE(fa.qtd_atual,    0),
    COALESCE(fe.qtd_anterior, 0) + COALESCE(fa.qtd_anterior, 0),
    d.periodo_inicio,
    d.periodo_fim
  FROM fat_entregas fe
  CROSS JOIN fat_atacado fa
  CROSS JOIN datas d;
$function$;

create or replace function public.get_faturamento_12_periodos_por_admin(p_admin_id uuid)
 returns table(periodo_inicio date, periodo_fim date, label text, valor numeric)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (public.is_super_admin() or p_admin_id = public.get_user_admin_id()) then
    raise exception 'Acesso negado ao tenant solicitado' using errcode = '42501';
  end if;

  return query
  with
  meses as (
    select
      date_trunc('month', current_date - (n || ' months')::interval)::date as m_ini,
      (date_trunc('month', current_date - (n || ' months')::interval) + interval '1 month' - interval '1 day')::date as m_fim
    from generate_series(0, 11) as n
  ),
  vends as (
    select id from public.vendedores
    where administrador_id = p_admin_id and ativo = true
  ),
  fat_e as (
    select
      m.m_ini as periodo_inicio,
      coalesce(sum(pg.valor), 0) as total
    from meses m
    left join public.pagamentos pg on pg.data_pagamento::date between m.m_ini and m.m_fim
    left join public.entregas ent on ent.id = pg.entrega_id
    where (ent.vendedor_id in (select id from vends) and not ent.revenda) or ent.id is null
    group by m.m_ini
  ),
  fat_a as (
    select
      m.m_ini as periodo_inicio,
      coalesce(sum(va.valor_total), 0) as total
    from meses m
    left join public.vendas_atacado va
      on va.administrador_id = p_admin_id
      and va.created_at::date between m.m_ini and m.m_fim
    group by m.m_ini
  )
  select
    m.m_ini,
    m.m_fim,
    to_char(m.m_ini, 'MM/YY'),
    coalesce(fe.total, 0) + coalesce(fa.total, 0)
  from meses m
  left join fat_e fe on fe.periodo_inicio = m.m_ini
  left join fat_a fa on fa.periodo_inicio = m.m_ini
  order by m.m_ini asc;
end;
$function$;

create or replace function public.calcular_comissao_vendedor(p_vendedor_id uuid, p_data_referencia date default null::date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
    and not e.revenda
    and (p.data_pagamento at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
    and not exists (select 1 from public.fechamentos_vendedor_pagamentos fp where fp.pagamento_id = p.id);

  select min(periodo_inicio) into v_primeiro_fechado
  from public.fechamentos_vendedor where vendedor_id = p_vendedor_id;

  if v_primeiro_fechado is not null then
    select coalesce(sum(p.valor), 0), count(*)
      into v_ajustes, v_qtd_ajustes
    from public.pagamentos p
    join public.entregas e on e.id = p.entrega_id
    where e.vendedor_id = p_vendedor_id
      and not e.revenda
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
$function$;

create or replace function public.fechar_periodo_vendedor(p_vendedor_id uuid, p_periodo_inicio date, p_observacao text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  select min(periodo_inicio) into v_primeiro_fechado
  from public.fechamentos_vendedor where vendedor_id = p_vendedor_id;

  insert into public.fechamentos_vendedor_pagamentos (fechamento_id, pagamento_id, valor, eh_ajuste)
  select v_id, p.id, p.valor,
         (p.data_pagamento at time zone 'America/Sao_Paulo')::date < v_inicio
  from public.pagamentos p
  join public.entregas e on e.id = p.entrega_id
  where e.vendedor_id = p_vendedor_id
    and not e.revenda
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
$function$;

-- 11. Resumo dos revendedores (consulta do dono e das funcionárias) ---------------------------------------------

create or replace function public.resumo_revendedores(p_inicio date, p_fim date)
returns table(
  vendedor_id uuid,
  nome text,
  cliente_pj_id uuid,
  compras_periodo numeric,
  qtd_compras_periodo bigint,
  saldo_devedor numeric,
  vendas_clientes_periodo numeric,
  qtd_entregas_periodo bigint,
  recebido_clientes_periodo numeric,
  estoque_cestas bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.get_user_admin_id();
begin
  if v_admin is null and not public.is_super_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  return query
  select
    v.id,
    v.nome,
    v.cliente_pj_id,
    coalesce((select sum(va.valor_total) from public.vendas_atacado va
              where va.vendedor_id = v.id and va.para_revendedor
                and coalesce(va.status_pagamento, '') <> 'cancelado'
                and va.created_at::date between p_inicio and p_fim), 0),
    (select count(*) from public.vendas_atacado va
      where va.vendedor_id = v.id and va.para_revendedor
        and coalesce(va.status_pagamento, '') <> 'cancelado'
        and va.created_at::date between p_inicio and p_fim),
    coalesce((select sum(greatest(va.valor_total - coalesce(va.valor_pago, 0), 0)) from public.vendas_atacado va
              where va.vendedor_id = v.id and va.para_revendedor
                and coalesce(va.status_pagamento, '') not in ('pago', 'cancelado')), 0),
    coalesce((select sum(e.valor) from public.entregas e
              where e.vendedor_id = v.id and e.revenda
                and coalesce(e.status_entrega, '') <> 'devolução'
                and e.data_entrega::date between p_inicio and p_fim), 0),
    (select count(*) from public.entregas e
      where e.vendedor_id = v.id and e.revenda
        and coalesce(e.status_entrega, '') <> 'devolução'
        and e.data_entrega::date between p_inicio and p_fim),
    coalesce((select sum(pg.valor) from public.pagamentos pg
              join public.entregas e on e.id = pg.entrega_id
              where e.vendedor_id = v.id and e.revenda
                and (pg.data_pagamento at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim), 0),
    coalesce((select sum(greatest(ev.quantidade_disponivel, 0)) from public.estoque_vendedor ev
              where ev.vendedor_id = v.id), 0)::bigint
  from public.vendedores v
  where v.modelo_venda = 'revendedor'
    and (v.administrador_id = v_admin or public.is_super_admin())
  order by v.nome;
end;
$$;

revoke all on function public.resumo_revendedores(date, date) from public, anon;
grant execute on function public.resumo_revendedores(date, date) to authenticated, service_role;
