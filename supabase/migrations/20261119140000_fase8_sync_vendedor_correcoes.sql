-- =====================================================================
-- Fase 8: correções da sincronização do app do vendedor
--
-- 1. sincronizar_upload_vendedor: tenta aplicar o crédito da troca de novo
--    depois de gravar os pagamentos do mesmo envio.
-- 2. sync_periodico (clientes): cliente com CPF que já existia no vendedor
--    leva as entregas do mesmo envio para o cliente existente.
-- 3. sync_periodico (clientes): só com versao_dados >= 2 (app novo) grava
--    tipo_pessoa, pessoas_autorizadas e responsaveis (e a tabela
--    responsaveis). Sem a marca (APKs antigos) esses campos não mudam.
-- 4. sync_periodico (entregas): recebe data_proximo_retorno; as funções de
--    download passam a devolver o campo.
-- Permissões mantidas: só service_role (Edge sync-vendedor-seguro).
-- =====================================================================

-- ---------------------------------------------------------------------
-- sync_periodico
-- ---------------------------------------------------------------------
create or replace function public.sync_periodico(vendedor_uuid uuid, clientes_json jsonb DEFAULT NULL::jsonb, produtos_json jsonb DEFAULT NULL::jsonb, entregas_json jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado      jsonb;
  v_decremento   jsonb;
  v_dia_fech     integer;
  v_periodo_ini  date;
  v_cliente      record;
  v_id_existente uuid;
  v_ids          uuid[];
  v_mapa         jsonb := '{}'::jsonb; -- id local do app -> id do cliente que já tinha o CPF
  v_alvo         uuid;
  v_resp         jsonb;
  v_resp_id      uuid;
begin

  SELECT dia_fechamento
  INTO v_dia_fech
  FROM public.vendedores
  WHERE id = vendedor_uuid;

  v_periodo_ini := public.get_periodo_fechamento(CURRENT_DATE, COALESCE(v_dia_fech, 1));

  -- ── Clientes ──────────────────────────────────────────────────────────
  if clientes_json is not null then
    for v_cliente in
      select
        c.id, vendedor_uuid as vendedor_id,
        c.nome, c.sobrenome, c.cpf, c.rg, c.data_nascimento, c.sexo, c.estado_civil,
        c.nacionalidade, c.nome_pai, c.nome_mae,
        c.telefone, c.email,
        c.endereco, c.cep, c.numero, c."Bairro", c."Cidade", c."Estado", c.complemento,
        c.nome_conjuge, c.renda_mensal, c.ponto_referencia,
        c.menor_idade, COALESCE(c.ativo, true) as ativo, COALESCE(c.tipo_pessoa, 'PF') as tipo_pessoa,
        COALESCE(c.pessoas_autorizadas, '[]'::jsonb) as pessoas_autorizadas,
        COALESCE(c.responsaveis, '[]'::jsonb) as responsaveis,
        -- Fase 8: só o app novo (versao_dados >= 2) manda tipo_pessoa,
        -- pessoas_autorizadas e responsaveis confiáveis
        (COALESCE(c.versao_dados, 1) >= 2) as v2,
        c.tipo_pessoa as tipo_pessoa_enviado,
        c.pessoas_autorizadas as pessoas_autorizadas_enviado,
        c.responsaveis as responsaveis_enviado
      from jsonb_to_recordset(clientes_json) as c(
        id                  uuid,
        nome                text,
        sobrenome           text,
        cpf                 text,
        rg                  text,
        data_nascimento     date,
        sexo                text,
        estado_civil        text,
        nacionalidade       text,
        nome_pai            text,
        nome_mae            text,
        telefone            text,
        email               text,
        endereco            text,
        cep                 text,
        numero              text,
        "Bairro"            text,
        "Cidade"            text,
        "Estado"            text,
        complemento         text,
        nome_conjuge        text,
        renda_mensal        numeric,
        ponto_referencia    text,
        menor_idade         boolean,
        ativo               boolean,
        tipo_pessoa         text,
        pessoas_autorizadas jsonb,
        responsaveis        jsonb,
        versao_dados        integer
      )
    loop
      v_id_existente := null;
      if v_cliente.cpf is not null then
        SELECT id INTO v_id_existente
        FROM public.clientes
        WHERE cpf = v_cliente.cpf
          AND vendedor_id = vendedor_uuid
          AND id <> v_cliente.id
        LIMIT 1;
      end if;

      if v_id_existente is not null then
        v_mapa := v_mapa || jsonb_build_object(v_cliente.id::text, v_id_existente);
        UPDATE public.clientes SET
          nome                = v_cliente.nome,
          sobrenome           = v_cliente.sobrenome,
          rg                  = v_cliente.rg,
          data_nascimento     = v_cliente.data_nascimento,
          sexo                = v_cliente.sexo,
          estado_civil        = v_cliente.estado_civil,
          nacionalidade       = v_cliente.nacionalidade,
          nome_pai            = v_cliente.nome_pai,
          nome_mae            = v_cliente.nome_mae,
          telefone            = v_cliente.telefone,
          email               = v_cliente.email,
          endereco            = v_cliente.endereco,
          cep                 = v_cliente.cep,
          numero              = v_cliente.numero,
          "Bairro"            = v_cliente."Bairro",
          "Cidade"            = v_cliente."Cidade",
          "Estado"            = v_cliente."Estado",
          complemento         = v_cliente.complemento,
          nome_conjuge        = v_cliente.nome_conjuge,
          renda_mensal        = v_cliente.renda_mensal,
          ponto_referencia    = v_cliente.ponto_referencia,
          menor_idade         = v_cliente.menor_idade,
          ativo               = v_cliente.ativo,
          tipo_pessoa         = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.tipo_pessoa_enviado, clientes.tipo_pessoa) ELSE clientes.tipo_pessoa END,
          pessoas_autorizadas = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.pessoas_autorizadas_enviado, clientes.pessoas_autorizadas) ELSE clientes.pessoas_autorizadas END,
          responsaveis        = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.responsaveis_enviado, clientes.responsaveis) ELSE clientes.responsaveis END,
          updated_at          = now(),
          sincronizado        = true
        WHERE id = v_id_existente;
      else
        INSERT INTO public.clientes(
          id, vendedor_id,
          nome, sobrenome, cpf, rg, data_nascimento, sexo, estado_civil,
          nacionalidade, nome_pai, nome_mae,
          telefone, email,
          endereco, cep, numero, "Bairro", "Cidade", "Estado", complemento,
          nome_conjuge, renda_mensal, ponto_referencia,
          menor_idade, ativo, tipo_pessoa,
          pessoas_autorizadas, responsaveis,
          sincronizado, created_at, updated_at
        ) VALUES (
          v_cliente.id, vendedor_uuid,
          v_cliente.nome, v_cliente.sobrenome, v_cliente.cpf, v_cliente.rg, v_cliente.data_nascimento,
          v_cliente.sexo, v_cliente.estado_civil, v_cliente.nacionalidade,
          v_cliente.nome_pai, v_cliente.nome_mae,
          v_cliente.telefone, v_cliente.email,
          v_cliente.endereco, v_cliente.cep, v_cliente.numero,
          v_cliente."Bairro", v_cliente."Cidade", v_cliente."Estado", v_cliente.complemento,
          v_cliente.nome_conjuge, v_cliente.renda_mensal, v_cliente.ponto_referencia,
          v_cliente.menor_idade, v_cliente.ativo, v_cliente.tipo_pessoa,
          v_cliente.pessoas_autorizadas, v_cliente.responsaveis,
          true, now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
          nome                = EXCLUDED.nome,
          sobrenome           = EXCLUDED.sobrenome,
          cpf                 = EXCLUDED.cpf,
          rg                  = EXCLUDED.rg,
          data_nascimento     = EXCLUDED.data_nascimento,
          sexo                = EXCLUDED.sexo,
          estado_civil        = EXCLUDED.estado_civil,
          nacionalidade       = EXCLUDED.nacionalidade,
          nome_pai            = EXCLUDED.nome_pai,
          nome_mae            = EXCLUDED.nome_mae,
          telefone            = EXCLUDED.telefone,
          email               = EXCLUDED.email,
          endereco            = EXCLUDED.endereco,
          cep                 = EXCLUDED.cep,
          numero              = EXCLUDED.numero,
          "Bairro"            = EXCLUDED."Bairro",
          "Cidade"            = EXCLUDED."Cidade",
          "Estado"            = EXCLUDED."Estado",
          complemento         = EXCLUDED.complemento,
          nome_conjuge        = EXCLUDED.nome_conjuge,
          renda_mensal        = EXCLUDED.renda_mensal,
          ponto_referencia    = EXCLUDED.ponto_referencia,
          menor_idade         = EXCLUDED.menor_idade,
          ativo               = EXCLUDED.ativo,
          tipo_pessoa         = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.tipo_pessoa_enviado, clientes.tipo_pessoa) ELSE clientes.tipo_pessoa END,
          pessoas_autorizadas = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.pessoas_autorizadas_enviado, clientes.pessoas_autorizadas) ELSE clientes.pessoas_autorizadas END,
          responsaveis        = CASE WHEN v_cliente.v2 THEN COALESCE(v_cliente.responsaveis_enviado, clientes.responsaveis) ELSE clientes.responsaveis END,
          updated_at          = now(),
          sincronizado        = true
        WHERE clientes.vendedor_id = vendedor_uuid;
      end if;

      -- Fase 8: responsáveis do app novo também vão para a tabela
      v_alvo := COALESCE(v_id_existente, v_cliente.id);
      if v_cliente.v2
         and jsonb_typeof(v_cliente.responsaveis_enviado) = 'array'
         and exists (select 1 from public.clientes cl where cl.id = v_alvo and cl.vendedor_id = vendedor_uuid)
      then
        for v_resp in select value from jsonb_array_elements(v_cliente.responsaveis_enviado)
        loop
          continue when jsonb_typeof(v_resp) <> 'object' or nullif(btrim(v_resp->>'nome'), '') is null;
          if (v_resp->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
            v_resp_id := (v_resp->>'id')::uuid;
          else
            -- id local inválido: id estável a partir do cliente + nome, para não duplicar
            v_resp_id := md5(v_alvo::text || '|' || lower(btrim(v_resp->>'nome')))::uuid;
          end if;

          insert into public.responsaveis (id, cliente_id, nome, cpf, telefone, parentesco)
          values (v_resp_id, v_alvo, btrim(v_resp->>'nome'),
                  nullif(v_resp->>'cpf', ''), nullif(v_resp->>'telefone', ''), nullif(v_resp->>'parentesco', ''))
          on conflict (id) do update set
            nome       = excluded.nome,
            cpf        = excluded.cpf,
            telefone   = excluded.telefone,
            parentesco = excluded.parentesco
          where responsaveis.cliente_id = v_alvo;
        end loop;
      end if;
    end loop;
  end if;

  -- ── Produtos ──────────────────────────────────────────────────────────
  if produtos_json is not null then
    update produtos set
      nome         = p.nome,
      preco        = p.preco,
      descricao    = p.descricao,
      updated_at   = now(),
      sincronizado = true
    from jsonb_to_recordset(produtos_json) as p(
      id uuid, nome text, preco numeric, descricao text
    )
    where produtos.id = p.id
      and produtos.vendedor_id = vendedor_uuid;

    insert into produtos(
      id, vendedor_id, nome, preco, descricao,
      ativo, sincronizado, created_at, updated_at
    )
    select
      p.id, vendedor_uuid, p.nome, p.preco, p.descricao,
      true, true, now(), now()
    from jsonb_to_recordset(produtos_json) as p(
      id uuid, nome text, preco numeric, descricao text
    )
    on conflict (id) do update set
      nome         = EXCLUDED.nome,
      preco        = EXCLUDED.preco,
      descricao    = EXCLUDED.descricao,
      updated_at   = now(),
      sincronizado = true
    WHERE produtos.vendedor_id = vendedor_uuid;
  end if;

  -- ── Entregas ──────────────────────────────────────────────────────────
  if entregas_json is not null then
    insert into entregas(
      id, vendedor_id, cliente_id, produto_id,
      valor, data_entrega, "dataRetorno", data_proximo_retorno,
      pago, status_pagamento, mes_cobranca, status_entrega,
      local_id, entrega_origem_id, credito_aplicado,
      sincronizado, created_at, updated_at
    )
    select
      e.id, vendedor_uuid,
      -- Fase 8: cliente com CPF repetido vira o cliente que já existia
      COALESCE((v_mapa->>e.cliente_id::text)::uuid, e.cliente_id),
      e.produto_id,
      e.valor, e.data_entrega, e."dataRetorno", e.data_proximo_retorno,
      e.pago, e.status_pagamento, e.mes_cobranca, e.status_entrega,
      e.local_id,
      -- Só aceita origem que seja entrega do mesmo vendedor
      (select o.id from public.entregas o where o.id = e.entrega_origem_id and o.vendedor_id = vendedor_uuid),
      greatest(coalesce(e.credito_aplicado, 0), 0),
      true, now(), now()
    from jsonb_to_recordset(entregas_json) as e(
      id                uuid,
      local_id          uuid,
      cliente_id        uuid,
      produto_id        uuid,
      valor             numeric,
      data_entrega      date,
      "dataRetorno"     date,
      data_proximo_retorno date,
      pago              boolean,
      status_pagamento  text,
      mes_cobranca      date,
      status_entrega    text,
      entrega_origem_id uuid,
      credito_aplicado  numeric
    )
    on conflict (id) do update set
      valor             = EXCLUDED.valor,
      data_entrega      = EXCLUDED.data_entrega,
      "dataRetorno"     = EXCLUDED."dataRetorno",
      data_proximo_retorno = COALESCE(EXCLUDED.data_proximo_retorno, entregas.data_proximo_retorno),
      pago              = EXCLUDED.pago,
      status_pagamento  = EXCLUDED.status_pagamento,
      mes_cobranca      = EXCLUDED.mes_cobranca,
      status_entrega    = EXCLUDED.status_entrega,
      local_id          = COALESCE(entregas.local_id, EXCLUDED.local_id),
      entrega_origem_id = COALESCE(entregas.entrega_origem_id, EXCLUDED.entrega_origem_id),
      credito_aplicado  = greatest(entregas.credito_aplicado, EXCLUDED.credito_aplicado),
      updated_at        = now(),
      sincronizado      = true
    WHERE entregas.vendedor_id = vendedor_uuid;

    select array_agg(distinct (x->>'id')::uuid) into v_ids
    from jsonb_array_elements(entregas_json) x
    where nullif(x->>'id', '') is not null;

    -- Estoque do vendedor e crédito, só das entregas enviadas agora
    v_decremento := public.reconciliar_estoque_entregas(vendedor_uuid, v_ids)
                 || public.aplicar_credito_entregas(vendedor_uuid, v_ids);
  end if;

  -- ── Corrige entregas antigas com sincronizado = false (legado) ─────────
  UPDATE public.entregas
  SET sincronizado = true
  WHERE vendedor_id = vendedor_uuid
    AND sincronizado = false
    AND NOT (
      "dataRetorno" IS NOT NULL
      AND "dataRetorno" < CURRENT_DATE
      AND (pago = true OR status_pagamento = 'pago')
      AND NOT EXISTS (
        SELECT 1 FROM public.pagamentos p
        WHERE p.entrega_id = entregas.id
          AND p.data_pagamento::date >= v_periodo_ini
      )
    );

  -- ── Retorno ────────────────────────────────────────────────────────────
  select jsonb_build_object(
    'vendedor',         (select row_to_json(v) from vendedores v where id = vendedor_uuid),
    'clientes',         COALESCE((select jsonb_agg(row_to_json(c)) from clientes c where vendedor_id = vendedor_uuid), '[]'::jsonb),
    'produtos',         COALESCE((select jsonb_agg(row_to_json(p)) from produtos p where vendedor_id = vendedor_uuid), '[]'::jsonb),
    'entregas',         COALESCE((
      SELECT jsonb_agg(row_to_json(e))
      FROM public.entregas e
      WHERE e.vendedor_id = vendedor_uuid
        AND NOT (
          e."dataRetorno" IS NOT NULL
          AND e."dataRetorno" < CURRENT_DATE
          AND (e.pago = true OR e.status_pagamento = 'pago')
          AND NOT EXISTS (
            SELECT 1 FROM public.pagamentos p
            WHERE p.entrega_id = e.id
              AND p.data_pagamento::date >= v_periodo_ini
          )
        )
    ), '[]'::jsonb),
    'estoque_vendedor', COALESCE((select jsonb_agg(row_to_json(ev)) from estoque_vendedor ev where vendedor_id = vendedor_uuid), '[]'::jsonb),
    'decremento',       COALESCE(v_decremento, '{}'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

revoke all on function public.sync_periodico(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_periodico(uuid, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- sincronizar_upload_vendedor
-- ---------------------------------------------------------------------
create or replace function public.sincronizar_upload_vendedor(p_vendedor_id uuid, p_clientes jsonb DEFAULT NULL::jsonb, p_entregas jsonb DEFAULT NULL::jsonb, p_pagamentos jsonb DEFAULT NULL::jsonb, p_itens jsonb DEFAULT NULL::jsonb, p_deltas jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin_id uuid;
  v_invalidos integer;
  v_delta jsonb;
  v_produto_id uuid;
  v_qtd integer;
  v_estoque jsonb := '[]'::jsonb;
  v_pag_ids jsonb := '[]'::jsonb;
  v_item_ids jsonb := '[]'::jsonb;
  v_entregas_itens uuid[];
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

  if p_clientes is not null and jsonb_array_length(p_clientes) = 0 then p_clientes := null; end if;
  if p_entregas is not null and jsonb_array_length(p_entregas) = 0 then p_entregas := null; end if;
  if p_pagamentos is not null and jsonb_array_length(p_pagamentos) = 0 then p_pagamentos := null; end if;
  if p_itens is not null and jsonb_array_length(p_itens) = 0 then p_itens := null; end if;
  if p_deltas is not null and jsonb_array_length(p_deltas) = 0 then p_deltas := null; end if;

  if p_clientes is not null or p_entregas is not null then
    perform public.sync_periodico(p_vendedor_id, p_clientes, null, p_entregas);
  end if;

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

    -- Fase 8: o crédito da troca é tentado de novo depois dos pagamentos
    -- (o pagamento da entrega devolvida pode chegar no mesmo envio)
    perform public.aplicar_credito_entregas(
      p_vendedor_id,
      array(
        select e.id from public.entregas e
        where e.vendedor_id = p_vendedor_id
          and e.credito_aplicado > e.credito_movido
          and e.status_entrega is distinct from 'devolução'
      )
    );

    select coalesce(jsonb_agg(p->'id'), '[]'::jsonb) into v_pag_ids
    from jsonb_array_elements(p_pagamentos) p;
  end if;

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

    -- Edição de itens: quantidade 0 = item retirado da entrega
    delete from public.itens_entrega ie
    using jsonb_array_elements(p_itens) i
    where ie.id = (i->>'id')::uuid
      and ie.quantidade <= 0
      and exists (select 1 from public.entregas e where e.id = ie.entrega_id and e.vendedor_id = p_vendedor_id);

    select array_agg(distinct (i->>'entrega_id')::uuid) into v_entregas_itens
    from jsonb_array_elements(p_itens) i;

    perform public.reconciliar_estoque_entregas(p_vendedor_id, v_entregas_itens);

    select coalesce(jsonb_agg(i->'id'), '[]'::jsonb) into v_item_ids
    from jsonb_array_elements(p_itens) i;
  end if;

  -- Deltas do app (versões antigas): o estoque agora é calculado pelo
  -- banco; só confirmamos com a quantidade atual para o app limpar a fila.
  if p_deltas is not null then
    for v_delta in select value from jsonb_array_elements(p_deltas)
    loop
      begin
        v_produto_id := (v_delta->>'produto_id')::uuid;
      exception when others then
        raise exception 'Delta de estoque inválido' using errcode = '22023';
      end;

      select coalesce(
        (select ev.quantidade_disponivel from public.estoque_vendedor ev
          where ev.vendedor_id = p_vendedor_id and ev.produto_id = v_produto_id),
        (select ei.quantidade from public.estoque_vendedor_itens ei
          where ei.vendedor_id = p_vendedor_id and ei.produto_cadastrado_id = v_produto_id),
        0) into v_qtd;

      v_estoque := v_estoque || jsonb_build_array(jsonb_build_object(
        'produto_id', v_produto_id, 'quantidade_final', v_qtd, 'sucesso', true,
        'mensagem', 'Estoque calculado pelo servidor'));
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
$function$;

revoke all on function public.sincronizar_upload_vendedor(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sincronizar_upload_vendedor(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- Download: data_proximo_retorno
-- ---------------------------------------------------------------------
create or replace function public.get_entregas_vendedor(p_vendedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',                e.id,
        'vendedor_id',       e.vendedor_id,
        'cliente_id',        e.cliente_id,
        'produto_id',        e.produto_id,
        'valor',             e.valor,
        'valor_pago',        coalesce((
                               select sum(p.valor)
                               from public.pagamentos p
                               where p.entrega_id = e.id
                             ), 0),
        'data_entrega',      e.data_entrega,
        'pago',              e.pago,
        'mes_cobranca',      e.mes_cobranca,
        'status_pagamento',  e.status_pagamento,
        'dataRetorno',       e."dataRetorno",
        'data_proximo_retorno', e.data_proximo_retorno,
        'status_entrega',    e.status_entrega,
        'entrega_origem_id', e.entrega_origem_id,
        'credito_aplicado',  e.credito_aplicado,
        'created_at',        e.created_at,
        'updated_at',        e.updated_at
      )
    ), '[]'::jsonb)
    from public.entregas e
    where e.vendedor_id = p_vendedor_id
      and round(e.valor, 2) > coalesce((
        select round(sum(p.valor), 2)
        from public.pagamentos p
        where p.entrega_id = e.id
      ), 0)
      and (e.status_entrega is null or e.status_entrega <> 'devolução')
  );
end;
$function$;

revoke all on function public.get_entregas_vendedor(uuid) from public, anon, authenticated;
grant execute on function public.get_entregas_vendedor(uuid) to service_role;

-- O formato do retorno muda, então a função é recriada
drop function if exists public.get_entregas_pendentes_vendedor(uuid);
create function public.get_entregas_pendentes_vendedor(p_vendedor_id uuid)
 RETURNS TABLE(id uuid, local_id uuid, vendedor_id uuid, cliente_id uuid, produto_id uuid, valor numeric, valor_pago numeric, data_entrega timestamp with time zone, "dataRetorno" date, mes_cobranca date, status_pagamento text, status_entrega text, pago boolean, sincronizado boolean, estoque_debitado boolean, created_at timestamp with time zone, updated_at timestamp with time zone, data_proximo_retorno date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    e.id,
    e.local_id,
    e.vendedor_id,
    e.cliente_id,
    e.produto_id,
    e.valor,
    COALESCE((
      SELECT round(SUM(p.valor), 2)
      FROM public.pagamentos p
      WHERE p.entrega_id = e.id
    ), 0) AS valor_pago,
    e.data_entrega,
    e."dataRetorno",
    e.mes_cobranca,
    e.status_pagamento,
    e.status_entrega,
    e.pago,
    e.sincronizado,
    e.estoque_debitado,
    e.created_at,
    e.updated_at,
    e.data_proximo_retorno
  FROM public.entregas e
  WHERE e.vendedor_id = p_vendedor_id
    AND round(e.valor, 2) > COALESCE((
      SELECT round(SUM(p.valor), 2)
      FROM public.pagamentos p
      WHERE p.entrega_id = e.id
    ), 0)
    AND e."dataRetorno" IS NOT NULL
    AND (e.status_entrega IS NULL OR e.status_entrega != 'devolução')
  ORDER BY e."dataRetorno" ASC;
$function$;

revoke all on function public.get_entregas_pendentes_vendedor(uuid) from public, anon, authenticated;
grant execute on function public.get_entregas_pendentes_vendedor(uuid) to service_role;
