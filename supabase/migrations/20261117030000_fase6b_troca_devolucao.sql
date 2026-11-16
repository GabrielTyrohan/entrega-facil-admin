-- =====================================================================
-- Fase 6b — Troca, devolução e personalização de entregas
--
-- 1. Estoque do vendedor = cestas (estoque_vendedor) + itens soltos
--    (estoque_vendedor_itens: avulsos, extras e sobras de personalização).
-- 2. O banco calcula o efeito de cada entrega no estoque do vendedor e
--    guarda o que já aplicou (entregas.estoque_aplicado). Assim criação,
--    edição de itens e devolução viram só "aplicar a diferença", sem
--    depender dos deltas que o app mandava (que somavam errado).
--      entrega normal  → sai 1 cesta + itens a mais que a composição
--                        (itens a menos voltam como itens soltos)
--      devolução       → volta exatamente o que saiu
-- 3. Crédito do cliente = pagamentos de entregas devolvidas. Na troca ou
--    na próxima entrega, o app pede "credito_aplicado" e o banco move
--    esses pagamentos para a entrega nova (sem duplicar no caixa nem na
--    comissão: o pagamento continua o mesmo, com a mesma data).
-- 4. Itens com quantidade 0 enviados pelo app são apagados (edição).
-- 5. Entrega avulsa liberada pela funcionária entra no estoque do vendedor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------
create table if not exists public.estoque_vendedor_itens (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  produto_cadastrado_id uuid not null references public.produtos_cadastrado(id) on delete cascade,
  administrador_id uuid not null references public.administradores(id) on delete cascade,
  quantidade integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (vendedor_id, produto_cadastrado_id)
);

alter table public.estoque_vendedor_itens enable row level security;

drop policy if exists estoque_vendedor_itens_leitura on public.estoque_vendedor_itens;
create policy estoque_vendedor_itens_leitura on public.estoque_vendedor_itens for select to authenticated
  using (public.can_operate_cestas(administrador_id));

-- Entregas antigas ficam com estoque_controle = false (o default só vale
-- para as novas): não mexemos no estoque delas, a não ser na devolução.
alter table public.entregas add column if not exists estoque_controle boolean not null default false;
alter table public.entregas alter column estoque_controle set default true;
alter table public.entregas add column if not exists estoque_aplicado jsonb;
alter table public.entregas add column if not exists entrega_origem_id uuid references public.entregas(id) on delete set null;
alter table public.entregas add column if not exists credito_aplicado numeric(12,2) not null default 0;
alter table public.entregas add column if not exists credito_movido numeric(12,2) not null default 0;
alter table public.entregas add column if not exists devolvida_em timestamptz;

create index if not exists idx_entregas_cliente_status on public.entregas (cliente_id, status_entrega);
create index if not exists idx_entregas_origem on public.entregas (entrega_origem_id) where entrega_origem_id is not null;

create or replace function public.fn_entrega_marca_devolucao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status_entrega = 'devolução' and old.status_entrega is distinct from 'devolução' then
    new.devolvida_em := coalesce(new.devolvida_em, now());
  elsif new.status_entrega is distinct from 'devolução' and old.status_entrega = 'devolução' then
    new.devolvida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_entrega_marca_devolucao on public.entregas;
create trigger trg_entrega_marca_devolucao
  before update of status_entrega on public.entregas
  for each row execute function public.fn_entrega_marca_devolucao();


-- ---------------------------------------------------------------------
-- 2. Efeito de uma entrega no estoque do vendedor
--    {"cestas": {produto_id: qtd}, "itens": {produto_cadastrado_id: qtd}}
--    qtd positiva = saiu do vendedor; negativa = voltou para ele.
-- ---------------------------------------------------------------------
create or replace function public.estoque_desejado_entrega(p_entrega_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e record;
  v_itens jsonb;
begin
  select id, produto_id, status_entrega into v_e from public.entregas where id = p_entrega_id;
  if not found or v_e.status_entrega = 'devolução' then
    return jsonb_build_object('cestas', '{}'::jsonb, 'itens', '{}'::jsonb);
  end if;

  -- Sem itens registrados, ou cesta sem composição cadastrada (os itens são
  -- a própria cesta): só a cesta sai.
  if not exists (select 1 from public.itens_entrega i where i.entrega_id = p_entrega_id and i.quantidade > 0)
     or (v_e.produto_id is not null
         and not exists (select 1 from public.produtos_na_cesta n where n.cesta_id = v_e.produto_id)) then
    return jsonb_build_object(
      'cestas', case when v_e.produto_id is null then '{}'::jsonb
                     else jsonb_build_object(v_e.produto_id::text, 1) end,
      'itens', '{}'::jsonb);
  end if;

  -- Com itens: diferença entre o que foi entregue e a composição da cesta.
  select coalesce(jsonb_object_agg(produto_cadastrado_id::text, dif), '{}'::jsonb)
    into v_itens
  from (
    select produto_cadastrado_id, round(sum(qtd))::integer as dif
    from (
      select i.produto_cadastrado_id, i.quantidade as qtd
      from public.itens_entrega i
      where i.entrega_id = p_entrega_id and i.quantidade > 0 and i.produto_cadastrado_id is not null
      union all
      select n.produto_cadastrado_id, -n.quantidade
      from public.produtos_na_cesta n
      where v_e.produto_id is not null and n.cesta_id = v_e.produto_id
    ) x
    group by produto_cadastrado_id
    having round(sum(qtd)) <> 0
  ) d;

  return jsonb_build_object(
    'cestas', case when v_e.produto_id is null then '{}'::jsonb
                   else jsonb_build_object(v_e.produto_id::text, 1) end,
    'itens', v_itens);
end;
$$;

revoke all on function public.estoque_desejado_entrega(uuid) from public, anon, authenticated;
grant execute on function public.estoque_desejado_entrega(uuid) to service_role;


-- ---------------------------------------------------------------------
-- 3. Aplica a diferença (desejado − já aplicado) no estoque do vendedor
-- ---------------------------------------------------------------------
create or replace function public.reconciliar_estoque_entregas(p_vendedor_id uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e record;
  v_admin uuid;
  v_desejado jsonb;
  v_aplicado jsonb;
  v_chave text;
  v_delta integer;
  v_processadas integer := 0;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('processadas', 0);
  end if;

  select administrador_id into v_admin from public.vendedores where id = p_vendedor_id;

  for v_e in
    select id, produto_id, status_entrega, estoque_controle, estoque_aplicado, estoque_debitado
    from public.entregas
    where vendedor_id = p_vendedor_id and id = any(p_ids)
    order by id
    for update
  loop
    -- Entrega antiga: só a devolução mexe (devolve o que tinha saído).
    if not v_e.estoque_controle and v_e.status_entrega is distinct from 'devolução' then
      continue;
    end if;

    v_aplicado := coalesce(v_e.estoque_aplicado, jsonb_build_object(
      'cestas', case when coalesce(v_e.estoque_debitado, false) and v_e.produto_id is not null
                     then jsonb_build_object(v_e.produto_id::text, 1) else '{}'::jsonb end,
      'itens', '{}'::jsonb));
    v_desejado := public.estoque_desejado_entrega(v_e.id);

    if v_desejado = v_aplicado then
      continue;
    end if;

    -- Cestas
    for v_chave in
      select k from jsonb_object_keys(coalesce(v_desejado->'cestas', '{}')) k
      union select k from jsonb_object_keys(coalesce(v_aplicado->'cestas', '{}')) k
    loop
      v_delta := coalesce((v_desejado->'cestas'->>v_chave)::integer, 0)
               - coalesce((v_aplicado->'cestas'->>v_chave)::integer, 0);
      if v_delta <> 0 then
        insert into public.estoque_vendedor (vendedor_id, produto_id, quantidade_disponivel, administrador_id, updated_at)
        values (p_vendedor_id, v_chave::uuid, -v_delta, v_admin, now())
        on conflict (vendedor_id, produto_id) do update
          set quantidade_disponivel = public.estoque_vendedor.quantidade_disponivel - v_delta,
              updated_at = now();
      end if;
    end loop;

    -- Itens soltos
    for v_chave in
      select k from jsonb_object_keys(coalesce(v_desejado->'itens', '{}')) k
      union select k from jsonb_object_keys(coalesce(v_aplicado->'itens', '{}')) k
    loop
      v_delta := coalesce((v_desejado->'itens'->>v_chave)::integer, 0)
               - coalesce((v_aplicado->'itens'->>v_chave)::integer, 0);
      if v_delta <> 0 then
        insert into public.estoque_vendedor_itens (vendedor_id, produto_cadastrado_id, administrador_id, quantidade, updated_at)
        values (p_vendedor_id, v_chave::uuid, v_admin, -v_delta, now())
        on conflict (vendedor_id, produto_cadastrado_id) do update
          set quantidade = public.estoque_vendedor_itens.quantidade - v_delta,
              updated_at = now();
      end if;
    end loop;

    update public.entregas
       set estoque_aplicado = v_desejado,
           estoque_debitado = (v_desejado->'cestas') <> '{}'::jsonb
     where id = v_e.id;

    v_processadas := v_processadas + 1;
  end loop;

  return jsonb_build_object('processadas', v_processadas);
end;
$$;

revoke all on function public.reconciliar_estoque_entregas(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reconciliar_estoque_entregas(uuid, uuid[]) to service_role;


-- ---------------------------------------------------------------------
-- 4. Crédito: move pagamentos de entregas devolvidas para a entrega nova
-- ---------------------------------------------------------------------
create or replace function public.aplicar_credito_entregas(p_vendedor_id uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e record;
  v_p record;
  v_falta numeric;
  v_movido numeric;
  v_total numeric := 0;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('credito_movido', 0);
  end if;

  for v_e in
    select e.id, e.cliente_id, e.entrega_origem_id, e.valor, e.credito_aplicado, e.credito_movido
    from public.entregas e
    where e.vendedor_id = p_vendedor_id and e.id = any(p_ids)
      and e.status_entrega is distinct from 'devolução'
      and e.credito_aplicado > e.credito_movido
    order by e.created_at
    for update
  loop
    -- Nunca mais que o pedido nem mais que o saldo da entrega
    v_falta := least(
      v_e.credito_aplicado - v_e.credito_movido,
      v_e.valor - coalesce((select sum(p.valor) from public.pagamentos p where p.entrega_id = v_e.id), 0)
    );
    v_movido := 0;

    for v_p in
      select p.id, p.valor, p.forma_pagamento, p.data_pagamento
      from public.pagamentos p
      join public.entregas d on d.id = p.entrega_id
      where d.vendedor_id = p_vendedor_id
        and d.cliente_id = v_e.cliente_id
        and d.status_entrega = 'devolução'
        and d.id <> v_e.id
      order by (d.id = v_e.entrega_origem_id) desc nulls last, p.data_pagamento, p.id
      for update of p
    loop
      exit when v_falta <= 0;
      if v_p.valor <= v_falta then
        update public.pagamentos set entrega_id = v_e.id, updated_at = now() where id = v_p.id;
        v_falta := v_falta - v_p.valor;
        v_movido := v_movido + v_p.valor;
      else
        -- Divide o pagamento: a parte usada vai para a entrega nova
        update public.pagamentos set valor = valor - v_falta, updated_at = now() where id = v_p.id;
        insert into public.pagamentos (id, entrega_id, forma_pagamento, valor, data_pagamento, created_at, updated_at)
        values (gen_random_uuid(), v_e.id, v_p.forma_pagamento, v_falta, v_p.data_pagamento, now(), now());
        v_movido := v_movido + v_falta;
        v_falta := 0;
      end if;
    end loop;

    if v_movido > 0 then
      update public.entregas set credito_movido = credito_movido + v_movido where id = v_e.id;
      v_total := v_total + v_movido;
    end if;
  end loop;

  return jsonb_build_object('credito_movido', v_total);
end;
$$;

revoke all on function public.aplicar_credito_entregas(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.aplicar_credito_entregas(uuid, uuid[]) to service_role;

-- Crédito disponível por cliente (pagamentos que ficaram em entregas devolvidas)
create or replace view public.v_creditos_cliente
with (security_invoker = true) as
select d.cliente_id, d.vendedor_id, round(sum(p.valor), 2) as credito_disponivel,
       max(d.devolvida_em) as ultima_devolucao
from public.entregas d
join public.pagamentos p on p.entrega_id = d.id
where d.status_entrega = 'devolução'
group by d.cliente_id, d.vendedor_id
having sum(p.valor) > 0;


-- ---------------------------------------------------------------------
-- 5. sync_periodico: recebe entrega_origem_id/credito_aplicado e troca o
--    decremento antigo (que tentava de novo toda sincronização) pelo
--    cálculo exato das entregas enviadas.
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
        COALESCE(c.responsaveis, '[]'::jsonb) as responsaveis
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
        responsaveis        jsonb
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
          tipo_pessoa         = v_cliente.tipo_pessoa,
          pessoas_autorizadas = v_cliente.pessoas_autorizadas,
          responsaveis        = v_cliente.responsaveis,
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
          tipo_pessoa         = EXCLUDED.tipo_pessoa,
          pessoas_autorizadas = EXCLUDED.pessoas_autorizadas,
          responsaveis        = EXCLUDED.responsaveis,
          updated_at          = now(),
          sincronizado        = true
        WHERE clientes.vendedor_id = vendedor_uuid;
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
      valor, data_entrega, "dataRetorno",
      pago, status_pagamento, mes_cobranca, status_entrega,
      local_id, entrega_origem_id, credito_aplicado,
      sincronizado, created_at, updated_at
    )
    select
      e.id, vendedor_uuid, e.cliente_id, e.produto_id,
      e.valor, e.data_entrega, e."dataRetorno",
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


-- ---------------------------------------------------------------------
-- 6. Upload do app: apaga itens zerados, recalcula estoque das entregas
--    dos itens e deixa de aplicar os deltas de estoque do app (o banco
--    calcula). Os deltas ainda são confirmados para o app limpar a fila.
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


-- ---------------------------------------------------------------------
-- 7. Download para o app: estoque com itens soltos, crédito do cliente,
--    origem da troca na entrega
-- ---------------------------------------------------------------------
create or replace function public.get_estoque_vendedor(p_vendedor_id uuid)
 RETURNS TABLE(id uuid, vendedor_id uuid, produto_id uuid, quantidade_disponivel integer, administrador_id uuid, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ev.id, ev.vendedor_id, ev.produto_id, ev.quantidade_disponivel, ev.administrador_id, ev.updated_at
  from public.estoque_vendedor ev
  where ev.vendedor_id = p_vendedor_id
  union all
  select ei.id, ei.vendedor_id, ei.produto_cadastrado_id, ei.quantidade, ei.administrador_id, ei.updated_at
  from public.estoque_vendedor_itens ei
  where ei.vendedor_id = p_vendedor_id;
$function$;

create or replace function public.get_clientes_vendedor(p_vendedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(c) || jsonb_build_object(
        'responsaveis', COALESCE((
          SELECT jsonb_agg(to_jsonb(r))
          FROM public.responsaveis r
          WHERE r.cliente_id = c.id
        ), '[]'::jsonb),
        'credito_disponivel', COALESCE((
          SELECT round(sum(p.valor), 2)
          FROM public.entregas d
          JOIN public.pagamentos p ON p.entrega_id = d.id
          WHERE d.cliente_id = c.id
            AND d.vendedor_id = p_vendedor_id
            AND d.status_entrega = 'devolução'
        ), 0)
      )
    ), '[]')
    FROM public.clientes c
    WHERE c.vendedor_id = p_vendedor_id AND c.ativo = true
  );
END;
$function$;

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


-- ---------------------------------------------------------------------
-- 8. Entrega avulsa liberada pela funcionária entra no estoque do vendedor
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_antes text := $q$'Saída por entrega avulsa',now()
    );$q$;
  v_depois text := $q$'Saída por entrega avulsa',now()
    );

    -- Fase 6b: o item vai para o estoque de itens soltos do vendedor
    insert into public.estoque_vendedor_itens(
      vendedor_id,produto_cadastrado_id,administrador_id,quantidade,updated_at
    )
    values(p_vendedor_id,v_produto_id,v_admin_id,round(v_quantidade)::integer,now())
    on conflict (vendedor_id,produto_cadastrado_id) do update
      set quantidade=public.estoque_vendedor_itens.quantidade+excluded.quantidade,
          updated_at=now();$q$;
begin
  v_def := pg_get_functiondef('public.criar_entrega_avulsa_segura(uuid,jsonb,text)'::regprocedure);
  if position('estoque_vendedor_itens' in v_def) > 0 then
    return; -- já aplicado
  end if;
  if position(v_antes in v_def) = 0 then
    raise exception 'criar_entrega_avulsa_segura mudou: trecho esperado não encontrado';
  end if;
  execute replace(v_def, v_antes, v_depois);
end $$;
