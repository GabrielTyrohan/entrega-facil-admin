-- =====================================================================
-- Fase 2 — Estoque correto
--
-- Modelo de estoque (como o sistema já funciona hoje):
--   * Estoque GERAL (produtos_cadastrado.qtd_estoque): sai quando a
--     funcionária libera cestas/avulsos ao vendedor
--     (registrar_entrega_cestas → saida_transferencia) e na venda PJ.
--   * Estoque do VENDEDOR (estoque_vendedor, por cesta): sobe na
--     liberação e desce 1 a cada entrega ao cliente
--     (decrementar_estoque_vendedor_apos_sync / app).
--
-- Correções:
--   1. A venda do vendedor ao cliente NÃO baixa mais o estoque geral
--      (era a baixa em dobro).
--   2. sincronizar_upload_vendedor: o upload do app grava tudo ou nada.
--   3. criar_venda_atacado_segura: venda PJ + itens + baixa numa transação.
--   4. criar_entrega_cliente_segura: entrega criada pelo admin/superadmin
--      baixa o estoque do vendedor (não o geral).
--   5. excluir_entrega_segura (superadmin): exclui e devolve a cesta ao
--      estoque do vendedor, com auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Fim da baixa em dobro
-- ---------------------------------------------------------------------
drop trigger if exists trigger_saida_entrega on public.itens_entrega;

comment on function public.registrar_saida_entrega() is
  'DESATIVADA na Fase 2 (2026-11-16): a venda do vendedor ao cliente não baixa o estoque geral; '
  'os itens já saíram na liberação ao vendedor (saida_transferencia). Mantida só para histórico/rollback.';


-- ---------------------------------------------------------------------
-- 2. Upload do app do vendedor numa única transação
--    Uso exclusivo da Edge Function sync-vendedor-seguro (service_role).
-- ---------------------------------------------------------------------
create or replace function public.sincronizar_upload_vendedor(
  p_vendedor_id uuid,
  p_clientes jsonb default null,
  p_entregas jsonb default null,
  p_pagamentos jsonb default null,
  p_itens jsonb default null,
  p_deltas jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_invalidos integer;
  v_delta jsonb;
  v_produto_id uuid;
  v_valor_delta integer;
  v_res jsonb;
  v_estoque jsonb := '[]'::jsonb;
  v_pag_ids jsonb := '[]'::jsonb;
  v_item_ids jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Uso exclusivo do servidor' using errcode = '42501';
  end if;

  select v.administrador_id into v_admin_id
  from public.vendedores v
  where v.id = p_vendedor_id and v.ativo = true;

  if v_admin_id is null then
    raise exception 'Vendedor não encontrado ou inativo' using errcode = 'P0002';
  end if;

  -- Normaliza listas vazias para null
  if p_clientes is not null and jsonb_array_length(p_clientes) = 0 then p_clientes := null; end if;
  if p_entregas is not null and jsonb_array_length(p_entregas) = 0 then p_entregas := null; end if;
  if p_pagamentos is not null and jsonb_array_length(p_pagamentos) = 0 then p_pagamentos := null; end if;
  if p_itens is not null and jsonb_array_length(p_itens) = 0 then p_itens := null; end if;
  if p_deltas is not null and jsonb_array_length(p_deltas) = 0 then p_deltas := null; end if;

  -- Clientes e entregas (regra existente, inclui o débito de 1 cesta por entrega)
  if p_clientes is not null or p_entregas is not null then
    perform public.sync_periodico(p_vendedor_id, p_clientes, null, p_entregas);
  end if;

  -- Pagamentos: só de entregas do próprio vendedor
  if p_pagamentos is not null then
    select count(*) into v_invalidos
    from jsonb_array_elements(p_pagamentos) p
    where nullif(p->>'id', '') is null
       or not exists (
         select 1 from public.entregas e
         where e.id = nullif(p->>'entrega_id', '')::uuid
           and e.vendedor_id = p_vendedor_id
       );

    if v_invalidos > 0 then
      raise exception 'Um ou mais pagamentos não pertencem ao vendedor autenticado' using errcode = '42501';
    end if;

    insert into public.pagamentos (
      id, local_id, entrega_id, forma_pagamento, valor, data_pagamento, created_at, updated_at
    )
    select
      (p->>'id')::uuid,
      nullif(p->>'local_id', '')::uuid,
      (p->>'entrega_id')::uuid,
      coalesce(nullif(p->>'forma_pagamento', ''), 'dinheiro'),
      coalesce((p->>'valor')::numeric, 0),
      coalesce(nullif(p->>'data_pagamento', '')::timestamptz, now()),
      coalesce(nullif(p->>'created_at', '')::timestamptz, now()),
      coalesce(nullif(p->>'updated_at', '')::timestamptz, now())
    from jsonb_array_elements(p_pagamentos) p
    on conflict (id) do update set
      local_id        = coalesce(excluded.local_id, pagamentos.local_id),
      entrega_id      = excluded.entrega_id,
      forma_pagamento = excluded.forma_pagamento,
      valor           = excluded.valor,
      data_pagamento  = excluded.data_pagamento,
      updated_at      = excluded.updated_at
    where exists (
      select 1 from public.entregas e
      where e.id = pagamentos.entrega_id and e.vendedor_id = p_vendedor_id
    );

    select coalesce(jsonb_agg(p->'id'), '[]'::jsonb) into v_pag_ids
    from jsonb_array_elements(p_pagamentos) p;
  end if;

  -- Itens das entregas: entrega do vendedor e produto da mesma empresa
  if p_itens is not null then
    select count(*) into v_invalidos
    from jsonb_array_elements(p_itens) i
    where nullif(i->>'id', '') is null
       or not exists (
         select 1 from public.entregas e
         where e.id = nullif(i->>'entrega_id', '')::uuid
           and e.vendedor_id = p_vendedor_id
       )
       or (
         nullif(i->>'produto_cadastrado_id', '') is not null
         and not exists (
           select 1 from public.produtos_cadastrado pc
           where pc.id = (i->>'produto_cadastrado_id')::uuid
             and pc.administrador_id = v_admin_id
         )
       );

    if v_invalidos > 0 then
      raise exception 'Um ou mais itens não pertencem ao vendedor autenticado' using errcode = '42501';
    end if;

    insert into public.itens_entrega (
      id, entrega_id, produto_cadastrado_id, quantidade, preco_unitario, subtotal, created_at, updated_at
    )
    select
      (i->>'id')::uuid,
      (i->>'entrega_id')::uuid,
      nullif(i->>'produto_cadastrado_id', '')::uuid,
      coalesce((i->>'quantidade')::numeric, 1),
      coalesce((i->>'preco_unitario')::numeric, 0),
      coalesce(
        (i->>'subtotal')::numeric,
        coalesce((i->>'preco_unitario')::numeric, 0) * coalesce((i->>'quantidade')::numeric, 1)
      ),
      coalesce(nullif(i->>'created_at', '')::timestamptz, now()),
      coalesce(nullif(i->>'updated_at', '')::timestamptz, now())
    from jsonb_array_elements(p_itens) i
    on conflict (id) do update set
      entrega_id            = excluded.entrega_id,
      produto_cadastrado_id = excluded.produto_cadastrado_id,
      quantidade            = excluded.quantidade,
      preco_unitario        = excluded.preco_unitario,
      subtotal              = excluded.subtotal,
      updated_at            = excluded.updated_at
    where exists (
      select 1 from public.entregas e
      where e.id = itens_entrega.entrega_id and e.vendedor_id = p_vendedor_id
    );

    select coalesce(jsonb_agg(i->'id'), '[]'::jsonb) into v_item_ids
    from jsonb_array_elements(p_itens) i;
  end if;

  -- Deltas do estoque do vendedor enviados pelo app
  if p_deltas is not null then
    for v_delta in select value from jsonb_array_elements(p_deltas)
    loop
      begin
        v_produto_id := (v_delta->>'produto_id')::uuid;
        v_valor_delta := round((v_delta->>'delta')::numeric)::integer;
      exception when others then
        raise exception 'Delta de estoque inválido' using errcode = '22023';
      end;

      if v_produto_id is null or v_valor_delta is null then
        raise exception 'Delta de estoque inválido' using errcode = '22023';
      end if;

      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_res
      from public.registrar_delta_estoque(p_vendedor_id, v_produto_id, v_valor_delta, v_admin_id) r;

      -- Mesmo formato que a Edge Function devolvia: { produto_id, result: [...] }
      v_estoque := v_estoque || jsonb_build_array(
        jsonb_build_object('produto_id', v_produto_id, 'result', v_res)
      );
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'baseSincronizada', (p_clientes is not null or p_entregas is not null),
    'pagamentosSincronizados', v_pag_ids,
    'itensSincronizados', v_item_ids,
    'estoqueResultados', v_estoque
  );
end;
$$;

revoke all on function public.sincronizar_upload_vendedor(uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.sincronizar_upload_vendedor(uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;


-- ---------------------------------------------------------------------
-- 3. Venda PJ (atacado): venda + itens + baixa do estoque geral
-- ---------------------------------------------------------------------
create or replace function public.criar_venda_atacado_segura(p_venda jsonb, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_vendedor_id uuid;
  v_cliente_id uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_qtd numeric;
  v_preco numeric;
  v_estoque numeric;
  v_nome text;
  v_itens_ok jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_qtd_total numeric := 0;
  v_venda_id uuid;
  v_numero integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  -- Quem vende: o dono ou funcionária com permissão de vendas atacado
  select a.id into v_admin_id from public.administradores a where a.id = auth.uid();
  if v_admin_id is null then
    select f.administrador_id into v_admin_id
    from public.funcionarios f
    where f.auth_user_id = auth.uid()
      and f.ativo = true
      and coalesce(f.bloqueado, false) = false
      and coalesce((f.permissoes->>'vendas_atacado')::boolean, false) = true
    limit 1;
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

  -- Valida itens e estoque (com trava da linha do produto)
  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    begin
      v_produto_id := nullif(v_item->>'produto_cadastrado_id', '')::uuid;
      v_qtd := (v_item->>'quantidade')::numeric;
      v_preco := (v_item->>'preco_unitario')::numeric;
    exception when others then
      raise exception 'Item inválido na venda' using errcode = '22023';
    end;

    if v_produto_id is null then
      raise exception 'Todo item precisa estar ligado a um produto cadastrado' using errcode = '22023';
    end if;
    if v_qtd is null or v_qtd <= 0 then
      raise exception 'Quantidade inválida na venda' using errcode = '22023';
    end if;
    if v_preco is null or v_preco < 0 then
      raise exception 'Preço inválido na venda' using errcode = '22023';
    end if;

    select pc.produto_nome, coalesce(pc.qtd_estoque, 0)
      into v_nome, v_estoque
    from public.produtos_cadastrado pc
    where pc.id = v_produto_id and pc.administrador_id = v_admin_id
    for update;

    if not found then
      raise exception 'Produto não encontrado nesta empresa' using errcode = 'P0002';
    end if;
    if v_estoque < v_qtd then
      raise exception 'Estoque insuficiente para "%". Disponível: %, necessário: %', v_nome, v_estoque, v_qtd
        using errcode = '22023';
    end if;

    v_itens_ok := v_itens_ok || jsonb_build_array(jsonb_build_object(
      'produto_cadastrado_id', v_produto_id,
      'descricao', coalesce(nullif(v_item->>'descricao', ''), v_nome),
      'quantidade', v_qtd,
      'preco_unitario', v_preco,
      'subtotal', round(v_qtd * v_preco, 2)
    ));
    v_total := v_total + round(v_qtd * v_preco, 2);
    v_qtd_total := v_qtd_total + v_qtd;
  end loop;

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
    (select array_agg(x->>'produto_cadastrado_id') from jsonb_array_elements(v_itens_ok) x),
    v_itens_ok,
    round(v_qtd_total)::integer,
    nullif(p_venda->>'nome_cliente_cache', ''),
    nullif(p_venda->>'observacoes', '')
  )
  returning id, numero_pedido into v_venda_id, v_numero;

  -- O trigger registrar_saida_venda_atacado baixa o estoque geral de cada item
  insert into public.vendas_atacado_itens (
    venda_atacado_id, produto_cadastrado_id, descricao, quantidade, preco_unitario, subtotal, sincronizado
  )
  select
    v_venda_id,
    (x->>'produto_cadastrado_id')::uuid,
    x->>'descricao',
    (x->>'quantidade')::numeric,
    (x->>'preco_unitario')::numeric,
    (x->>'subtotal')::numeric,
    false
  from jsonb_array_elements(v_itens_ok) x;

  return jsonb_build_object('id', v_venda_id, 'numero_pedido', v_numero, 'valor_total', v_total);
end;
$$;

revoke all on function public.criar_venda_atacado_segura(jsonb, jsonb) from public, anon;
grant execute on function public.criar_venda_atacado_segura(jsonb, jsonb) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 4. Entrega ao cliente criada pelo admin/funcionária/superadmin
--    Baixa 1 cesta do estoque do vendedor (como o app faz), não o geral.
-- ---------------------------------------------------------------------
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

  if not public.can_operate_cestas(v_admin_id) then
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

  -- Baixa 1 cesta do estoque do vendedor
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

revoke all on function public.criar_entrega_cliente_segura(uuid, uuid, uuid, jsonb, numeric, timestamptz, date, text)
  from public, anon;
grant execute on function public.criar_entrega_cliente_segura(uuid, uuid, uuid, jsonb, numeric, timestamptz, date, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 5. Exclusão de entrega (superadmin), com estorno e auditoria
-- ---------------------------------------------------------------------

-- A auditoria passa a aceitar ações do desenvolvedor (superadmin).
alter table public.auditoria_acoes drop constraint if exists auditoria_acoes_usuario_tipo_check;
alter table public.auditoria_acoes add constraint auditoria_acoes_usuario_tipo_check
  check (usuario_tipo = any (array['admin', 'funcionario', 'vendedor', 'desenvolvedor']));

create or replace function public.excluir_entrega_segura(
  p_entrega_id uuid,
  p_motivo text,
  p_excluir_pagamentos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrega public.entregas%rowtype;
  v_admin_id uuid;
  v_qtd_pagamentos integer;
  v_snapshot jsonb;
  v_dev record;
  v_estornou boolean := false;
begin
  if not public.is_super_admin() then
    raise exception 'Acesso restrito ao superadmin' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo da exclusão' using errcode = '22023';
  end if;

  select * into v_entrega from public.entregas where id = p_entrega_id for update;
  if not found then
    raise exception 'Entrega não encontrada' using errcode = 'P0002';
  end if;

  select v.administrador_id into v_admin_id from public.vendedores v where v.id = v_entrega.vendedor_id;

  select count(*) into v_qtd_pagamentos from public.pagamentos where entrega_id = p_entrega_id;
  if v_qtd_pagamentos > 0 and not coalesce(p_excluir_pagamentos, false) then
    raise exception 'A entrega tem % pagamento(s). Confirme a exclusão dos pagamentos junto.', v_qtd_pagamentos
      using errcode = '22023';
  end if;

  v_snapshot := jsonb_build_object(
    'entrega', to_jsonb(v_entrega),
    'itens', coalesce((select jsonb_agg(to_jsonb(i)) from public.itens_entrega i where i.entrega_id = p_entrega_id), '[]'::jsonb),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(p)) from public.pagamentos p where p.entrega_id = p_entrega_id), '[]'::jsonb)
  );

  -- Devolve a cesta ao estoque do vendedor, se ela tinha sido debitada
  if v_entrega.estoque_debitado then
    insert into public.estoque_vendedor (vendedor_id, produto_id, quantidade_disponivel, administrador_id, updated_at)
    values (v_entrega.vendedor_id, v_entrega.produto_id, 1, v_admin_id, now())
    on conflict (vendedor_id, produto_id) do update
      set quantidade_disponivel = public.estoque_vendedor.quantidade_disponivel + 1,
          updated_at = now();
    v_estornou := true;
  end if;

  delete from public.pagamentos where entrega_id = p_entrega_id;
  delete from public.itens_entrega where entrega_id = p_entrega_id;
  delete from public.entregas where id = p_entrega_id;

  select d.user_id, d.nome, d.email into v_dev
  from public.desenvolvedores d where d.user_id = auth.uid() and d.ativo = true limit 1;

  insert into public.auditoria_acoes (
    id, administrador_id, usuario_id, usuario_tipo, usuario_nome, usuario_email,
    acao, entidade, entidade_id, dados_anteriores, dados_novos, observacao, created_at
  )
  values (
    gen_random_uuid(), v_admin_id, auth.uid(), 'desenvolvedor', coalesce(v_dev.nome, 'Desenvolvedor'),
    coalesce(v_dev.email, ''), 'excluir_entrega', 'entregas', p_entrega_id,
    v_snapshot, jsonb_build_object('estoque_vendedor_estornado', v_estornou), btrim(p_motivo), now()
  );

  return jsonb_build_object(
    'success', true,
    'pagamentos_excluidos', v_qtd_pagamentos,
    'cesta_devolvida_ao_vendedor', v_estornou
  );
end;
$$;

revoke all on function public.excluir_entrega_segura(uuid, text, boolean) from public, anon;
grant execute on function public.excluir_entrega_segura(uuid, text, boolean) to authenticated, service_role;
