-- =====================================================================
-- Fase 2 (correção) — Venda PJ de CESTAS
--
-- A tela de venda atacado vende cestas (tabela produtos) e também pode
-- vender produtos avulsos (produtos_cadastrado). Regras:
--   * Produto avulso: baixa o próprio produto do estoque geral
--     (trigger registrar_saida_venda_atacado).
--   * Cesta: baixa do estoque geral cada item da composição
--     (produtos_na_cesta) × quantidade de cestas vendidas.
--   * Cesta sem composição cadastrada é recusada.
--   * O estoque é conferido somando tudo o que a venda precisa de cada
--     produto (uma cesta + o mesmo produto avulso, por exemplo).
-- =====================================================================

-- O trigger de saída só trata linhas ligadas a produto avulso.
create or replace function public.registrar_saida_venda_atacado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estoque_atual numeric;
  v_admin_id uuid;
  v_vendedor_id uuid;
  v_vendedor_nome text;
  v_venda_id uuid;
begin
  -- Linha de cesta: a baixa dos componentes é feita por criar_venda_atacado_segura.
  if new.produto_cadastrado_id is null then
    return new;
  end if;

  select p.qtd_estoque, p.administrador_id, v.vendedor_id, v.id
    into v_estoque_atual, v_admin_id, v_vendedor_id, v_venda_id
  from public.produtos_cadastrado p
  join public.vendas_atacado v on v.id = new.venda_atacado_id
  where p.id = new.produto_cadastrado_id;

  if v_vendedor_id is not null then
    select nome into v_vendedor_nome from public.vendedores where id = v_vendedor_id;
  else
    v_vendedor_nome := 'Sistema';
  end if;

  insert into public.movimentacoes_estoque (
    administrador_id, produto_cadastrado_id, tipo_movimentacao, quantidade,
    quantidade_anterior, quantidade_nova, custo_unitario, valor_total,
    referencia_tipo, referencia_id, usuario_id, usuario_tipo, usuario_nome, observacoes
  ) values (
    v_admin_id, new.produto_cadastrado_id, 'saida_venda', new.quantidade,
    v_estoque_atual, v_estoque_atual - new.quantidade, new.preco_unitario, new.subtotal,
    'venda_atacado', v_venda_id,
    coalesce(v_vendedor_id, auth.uid()),
    case when v_vendedor_id is not null then 'vendedor' else 'admin' end,
    coalesce(v_vendedor_nome, 'Sistema'),
    'Saída automática por venda atacado #' || new.venda_atacado_id::text
  );

  return new;
end;
$$;


create or replace function public.criar_venda_atacado_segura(p_venda jsonb, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_usuario_tipo text;
  v_usuario_nome text;
  v_vendedor_id uuid;
  v_cliente_id uuid;
  v_item jsonb;
  v_id uuid;
  v_qtd numeric;
  v_preco numeric;
  v_nome text;
  v_tipo text;
  v_linhas jsonb := '[]'::jsonb;       -- linhas da venda (cesta ou avulso)
  v_necessidade jsonb := '[]'::jsonb;  -- {produto_cadastrado_id, quantidade} por componente
  v_cesta_vazia text;
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

  -- Quem vende: o dono ou funcionária com permissão de vendas atacado
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

  -- 1. Classifica cada item (cesta ou produto avulso) e monta a necessidade de estoque
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
    if v_preco is null or v_preco < 0 then
      raise exception 'Preço inválido na venda' using errcode = '22023';
    end if;

    v_tipo := null;

    -- Cesta da empresa?
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
      select v_necessidade || coalesce(jsonb_agg(jsonb_build_object(
               'produto_cadastrado_id', n.produto_cadastrado_id,
               'quantidade', n.quantidade * v_qtd)), '[]'::jsonb)
        into v_necessidade
      from public.produtos_na_cesta n
      where n.cesta_id = v_id;
    else
      -- Produto avulso da empresa?
      select pc.produto_nome into v_nome
      from public.produtos_cadastrado pc
      where pc.id = v_id and pc.administrador_id = v_admin_id;

      if not found then
        raise exception 'Cesta ou produto não encontrado nesta empresa' using errcode = 'P0002';
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

  -- 2. Confere o estoque somando tudo o que a venda precisa de cada produto
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

  -- Trava as linhas dos produtos envolvidos
  perform 1
  from public.produtos_cadastrado pc
  where pc.id in (select (x->>'produto_cadastrado_id')::uuid from jsonb_array_elements(v_necessidade) x)
  for update;

  -- 3. Grava a venda
  insert into public.vendas_atacado (
    administrador_id, vendedor_id, cliente_id, data_entrega, data_pagamento,
    forma_pagamento, valor_pago, status_pagamento, valor_total, pago,
    numero_produto, itens, quantidade_total, nome_cliente_cache, observacoes
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
    nullif(p_venda->>'observacoes', '')
  )
  returning id, numero_pedido into v_venda_id, v_numero;

  -- 4. Linhas da venda. Avulso: o trigger baixa o produto. Cesta: produto nulo.
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

  -- 5. Baixa dos componentes das cestas vendidas
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

  return jsonb_build_object('id', v_venda_id, 'numero_pedido', v_numero, 'valor_total', v_total);
end;
$$;

revoke all on function public.criar_venda_atacado_segura(jsonb, jsonb) from public, anon;
grant execute on function public.criar_venda_atacado_segura(jsonb, jsonb) to authenticated, service_role;
