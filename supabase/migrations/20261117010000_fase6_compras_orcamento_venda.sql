-- =====================================================================
-- Fase 6 — Entrada de compras e orçamento PJ → venda
--
-- 1. Compras: o dono compra no mercado, recebe a nota e dá entrada.
--    * registrar_compra grava a compra, gera 'entrada_compra' para cada
--      item (o trigger fn_atualizar_estoque soma no estoque geral) e
--      recalcula o custo médio do produto.
--    * Nota com chave de acesso só pode ser lançada uma vez por empresa.
--    * O vínculo "código do fornecedor → produto + fator de conversão"
--      fica lembrado para a próxima nota do mesmo fornecedor.
-- 2. Orçamento PJ convertido vira venda atacado de verdade (com baixa
--    do estoque) via criar_venda_atacado_segura, uma vez só.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Movimentações podem referenciar uma compra
-- ---------------------------------------------------------------------
alter table public.movimentacoes_estoque drop constraint if exists movimentacoes_estoque_referencia_tipo_check;
alter table public.movimentacoes_estoque add constraint movimentacoes_estoque_referencia_tipo_check
  check (referencia_tipo is null or referencia_tipo = any (array[
    'venda_atacado', 'entrega', 'entrega_avulsa', 'nota_fiscal', 'orcamento',
    'ajuste_manual', 'inventario', 'entrega_cesta', 'compra'
  ]));


-- ---------------------------------------------------------------------
-- 1. Tabelas de compra
-- ---------------------------------------------------------------------
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  administrador_id uuid not null references public.administradores(id) on delete cascade,
  origem text not null default 'manual' check (origem in ('manual', 'xml', 'contora')),
  fornecedor_nome text not null,
  fornecedor_cnpj text,
  numero_nota text,
  serie text,
  chave_acesso text,
  data_emissao date,
  data_entrada date not null default current_date,
  valor_total numeric(12,2) not null default 0,
  observacao text,
  criado_por uuid,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_compras_chave_acesso
  on public.compras (administrador_id, chave_acesso) where chave_acesso is not null;
create index if not exists idx_compras_admin_data on public.compras (administrador_id, data_entrada desc);

create table if not exists public.compras_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  produto_cadastrado_id uuid not null references public.produtos_cadastrado(id),
  codigo_fornecedor text,
  ean text,
  ncm text,
  descricao_nota text,
  unidade_nota text,
  quantidade_nota numeric(14,4) not null check (quantidade_nota > 0),
  fator_conversao numeric(14,4) not null default 1 check (fator_conversao > 0),
  quantidade_estoque numeric(14,4) not null check (quantidade_estoque > 0),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  custo_unitario_estoque numeric(14,4) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_compras_itens_compra on public.compras_itens (compra_id);

create table if not exists public.produtos_vinculo_fornecedor (
  id uuid primary key default gen_random_uuid(),
  administrador_id uuid not null references public.administradores(id) on delete cascade,
  fornecedor_cnpj text not null,
  codigo_fornecedor text not null,
  produto_cadastrado_id uuid not null references public.produtos_cadastrado(id) on delete cascade,
  fator_conversao numeric(14,4) not null default 1 check (fator_conversao > 0),
  updated_at timestamptz not null default now(),
  unique (administrador_id, fornecedor_cnpj, codigo_fornecedor)
);

alter table public.compras enable row level security;
alter table public.compras_itens enable row level security;
alter table public.produtos_vinculo_fornecedor enable row level security;

-- Leitura: dono, funcionária com 'produtos' e superadmin. Escrita só por função.
create or replace function public.can_gerir_estoque(p_administrador_id uuid)
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
      select 1 from public.funcionarios f
      where f.auth_user_id = auth.uid()
        and f.administrador_id = p_administrador_id
        and f.ativo = true
        and coalesce(f.bloqueado, false) = false
        and coalesce((f.permissoes ->> 'produtos')::boolean, false) = true
    );
$$;

revoke all on function public.can_gerir_estoque(uuid) from public, anon;
grant execute on function public.can_gerir_estoque(uuid) to authenticated, service_role;

drop policy if exists compras_leitura on public.compras;
create policy compras_leitura on public.compras for select to authenticated
  using (public.can_gerir_estoque(administrador_id));

drop policy if exists compras_itens_leitura on public.compras_itens;
create policy compras_itens_leitura on public.compras_itens for select to authenticated
  using (exists (select 1 from public.compras c where c.id = compras_itens.compra_id
                 and public.can_gerir_estoque(c.administrador_id)));

drop policy if exists produtos_vinculo_fornecedor_leitura on public.produtos_vinculo_fornecedor;
create policy produtos_vinculo_fornecedor_leitura on public.produtos_vinculo_fornecedor for select to authenticated
  using (public.can_gerir_estoque(administrador_id));


-- ---------------------------------------------------------------------
-- 2. Registrar compra
-- p_compra: { fornecedor_nome, fornecedor_cnpj, numero_nota, serie,
--             chave_acesso, data_emissao, data_entrada, origem, observacao }
-- p_itens:  [{ produto_cadastrado_id, quantidade_nota, fator_conversao,
--              valor_total, codigo_fornecedor, ean, ncm, descricao_nota,
--              unidade_nota }]
-- ---------------------------------------------------------------------
create or replace function public.registrar_compra(p_compra jsonb, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_usuario_tipo text;
  v_usuario_nome text;
  v_compra_id uuid;
  v_item jsonb;
  v_produto record;
  v_qtd_nota numeric;
  v_fator numeric;
  v_qtd_estoque numeric;
  v_valor numeric;
  v_custo numeric;
  v_estoque_antes numeric;
  v_custo_antes numeric;
  v_total numeric := 0;
  v_qtd_itens integer := 0;
  v_cnpj text;
  v_chave text;
  v_fornecedor text;
  v_data date;
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
    where f.auth_user_id = auth.uid() and f.ativo = true and coalesce(f.bloqueado, false) = false
      and coalesce((f.permissoes->>'produtos')::boolean, false) = true
    limit 1;
    v_usuario_tipo := 'funcionario';
  end if;
  if v_admin_id is null then
    raise exception 'Sem permissão para lançar compras' using errcode = '42501';
  end if;

  v_fornecedor := nullif(btrim(coalesce(p_compra->>'fornecedor_nome', '')), '');
  if v_fornecedor is null then
    raise exception 'Informe o fornecedor (mercado)' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A compra precisa ter pelo menos 1 item' using errcode = '22023';
  end if;

  v_cnpj := nullif(regexp_replace(coalesce(p_compra->>'fornecedor_cnpj', ''), '\D', '', 'g'), '');
  v_chave := nullif(regexp_replace(coalesce(p_compra->>'chave_acesso', ''), '\D', '', 'g'), '');
  if v_chave is not null and length(v_chave) <> 44 then
    raise exception 'Chave de acesso deve ter 44 números' using errcode = '22023';
  end if;
  if v_chave is not null and exists (
    select 1 from public.compras where administrador_id = v_admin_id and chave_acesso = v_chave
  ) then
    raise exception 'Esta nota já foi lançada' using errcode = '22023';
  end if;

  v_data := coalesce(nullif(p_compra->>'data_entrada', '')::date, current_date);

  insert into public.compras (
    administrador_id, origem, fornecedor_nome, fornecedor_cnpj, numero_nota, serie, chave_acesso,
    data_emissao, data_entrada, observacao, criado_por, criado_por_nome
  )
  values (
    v_admin_id,
    coalesce(nullif(p_compra->>'origem', ''), 'manual'),
    left(v_fornecedor, 200),
    v_cnpj,
    nullif(btrim(coalesce(p_compra->>'numero_nota', '')), ''),
    nullif(btrim(coalesce(p_compra->>'serie', '')), ''),
    v_chave,
    nullif(p_compra->>'data_emissao', '')::date,
    v_data,
    nullif(btrim(coalesce(p_compra->>'observacao', '')), ''),
    auth.uid(),
    v_usuario_nome
  )
  returning id into v_compra_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    begin
      v_qtd_nota := (v_item->>'quantidade_nota')::numeric;
      v_fator := coalesce(nullif(v_item->>'fator_conversao', '')::numeric, 1);
      v_valor := coalesce((v_item->>'valor_total')::numeric, 0);
    exception when others then
      raise exception 'Item inválido na compra' using errcode = '22023';
    end;

    if v_qtd_nota is null or v_qtd_nota <= 0 then
      raise exception 'Quantidade inválida na compra' using errcode = '22023';
    end if;
    if v_fator <= 0 then
      raise exception 'Fator de conversão inválido' using errcode = '22023';
    end if;
    if v_valor < 0 then
      raise exception 'Valor inválido na compra' using errcode = '22023';
    end if;

    select pc.id, pc.produto_nome, coalesce(pc.qtd_estoque, 0) as estoque, coalesce(pc.custo_compra, 0) as custo
      into v_produto
    from public.produtos_cadastrado pc
    where pc.id = nullif(v_item->>'produto_cadastrado_id', '')::uuid and pc.administrador_id = v_admin_id
    for update;
    if v_produto.id is null then
      raise exception 'Item "%" sem produto cadastrado vinculado', coalesce(v_item->>'descricao_nota', '?')
        using errcode = '22023';
    end if;

    v_qtd_estoque := round(v_qtd_nota * v_fator, 4);
    v_custo := round(v_valor / v_qtd_estoque, 4);
    v_estoque_antes := v_produto.estoque;
    v_custo_antes := v_produto.custo;

    insert into public.compras_itens (
      compra_id, produto_cadastrado_id, codigo_fornecedor, ean, ncm, descricao_nota, unidade_nota,
      quantidade_nota, fator_conversao, quantidade_estoque, valor_total, custo_unitario_estoque
    )
    values (
      v_compra_id, v_produto.id,
      nullif(btrim(coalesce(v_item->>'codigo_fornecedor', '')), ''),
      nullif(btrim(coalesce(v_item->>'ean', '')), ''),
      nullif(btrim(coalesce(v_item->>'ncm', '')), ''),
      nullif(btrim(coalesce(v_item->>'descricao_nota', '')), ''),
      nullif(btrim(coalesce(v_item->>'unidade_nota', '')), ''),
      v_qtd_nota, v_fator, v_qtd_estoque, round(v_valor, 2), v_custo
    );

    -- Entrada no estoque geral (o trigger soma em qtd_estoque)
    insert into public.movimentacoes_estoque (
      administrador_id, produto_cadastrado_id, tipo_movimentacao, quantidade,
      quantidade_anterior, quantidade_nova, custo_unitario, valor_total,
      referencia_tipo, referencia_id, usuario_id, usuario_tipo, usuario_nome,
      motivo, fornecedor, nota_fiscal_numero, created_at
    )
    values (
      v_admin_id, v_produto.id, 'entrada_compra', v_qtd_estoque,
      0, 0, v_custo, round(v_valor, 2),
      'compra', v_compra_id, auth.uid(), v_usuario_tipo, v_usuario_nome,
      'Compra', left(v_fornecedor, 200), nullif(btrim(coalesce(p_compra->>'numero_nota', '')), ''), now()
    );

    -- Custo médio ponderado (estoque zerado/negativo: assume o custo da compra)
    update public.produtos_cadastrado
    set custo_compra = case
          when v_estoque_antes <= 0 or v_custo_antes <= 0 then round(v_custo, 2)
          else round((v_estoque_antes * v_custo_antes + v_valor) / (v_estoque_antes + v_qtd_estoque), 2)
        end,
        ultima_compra = v_data,
        fornecedor_principal = coalesce(nullif(fornecedor_principal, ''), left(v_fornecedor, 200)),
        updated_at = now()
    where id = v_produto.id;

    -- Lembra o vínculo do código do fornecedor para a próxima nota
    if v_cnpj is not null and nullif(btrim(coalesce(v_item->>'codigo_fornecedor', '')), '') is not null then
      insert into public.produtos_vinculo_fornecedor (administrador_id, fornecedor_cnpj, codigo_fornecedor, produto_cadastrado_id, fator_conversao)
      values (v_admin_id, v_cnpj, btrim(v_item->>'codigo_fornecedor'), v_produto.id, v_fator)
      on conflict (administrador_id, fornecedor_cnpj, codigo_fornecedor) do update
        set produto_cadastrado_id = excluded.produto_cadastrado_id,
            fator_conversao = excluded.fator_conversao,
            updated_at = now();
    end if;

    v_total := v_total + round(v_valor, 2);
    v_qtd_itens := v_qtd_itens + 1;
    v_produto := null;
  end loop;

  update public.compras set valor_total = v_total where id = v_compra_id;

  return jsonb_build_object('id', v_compra_id, 'itens', v_qtd_itens, 'valor_total', v_total);
end;
$$;

revoke all on function public.registrar_compra(jsonb, jsonb) from public, anon;
grant execute on function public.registrar_compra(jsonb, jsonb) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3. Orçamento PJ → venda atacado (com baixa do estoque)
-- ---------------------------------------------------------------------
alter table public.vendas_atacado add column if not exists orcamento_id uuid references public.orcamentos_pj(id);
create unique index if not exists uq_vendas_atacado_orcamento
  on public.vendas_atacado (orcamento_id) where orcamento_id is not null;

create or replace function public.converter_orcamento_em_venda(
  p_orcamento_id uuid,
  p_venda jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc public.orcamentos_pj%rowtype;
  v_itens jsonb;
  v_res jsonb;
begin
  select * into v_orc from public.orcamentos_pj where id = p_orcamento_id for update;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'P0002';
  end if;
  -- Só o dono ou uma funcionária da mesma empresa
  if v_orc.administrador_id is distinct from auth.uid() and not exists (
    select 1 from public.funcionarios f
    where f.auth_user_id = auth.uid() and f.administrador_id = v_orc.administrador_id
      and f.ativo = true and coalesce(f.bloqueado, false) = false
  ) then
    raise exception 'Sem permissão para este orçamento' using errcode = '42501';
  end if;
  if exists (select 1 from public.vendas_atacado where orcamento_id = p_orcamento_id) then
    raise exception 'Este orçamento já virou venda' using errcode = '22023';
  end if;
  if v_orc.status = 'convertido' then
    raise exception 'Este orçamento já está marcado como convertido' using errcode = '22023';
  end if;
  if v_orc.cliente_id is null then
    raise exception 'O orçamento não tem cliente cadastrado' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'produto_cadastrado_id', i.produto_cadastrado_id,
           'descricao', i.descricao,
           'quantidade', i.quantidade,
           'preco_unitario', i.valor_venda_unitario
         ) order by i.created_at)
    into v_itens
  from public.orcamentos_pj_itens i
  where i.orcamento_id = p_orcamento_id;

  if v_itens is null then
    raise exception 'O orçamento não tem itens' using errcode = '22023';
  end if;

  -- Mesma regra da venda PJ: permissão, estoque e baixa numa transação
  v_res := public.criar_venda_atacado_segura(
    coalesce(p_venda, '{}'::jsonb) || jsonb_build_object(
      'cliente_id', v_orc.cliente_id,
      'nome_cliente_cache', v_orc.cliente_nome,
      'forma_pagamento', coalesce(nullif(p_venda->>'forma_pagamento', ''), v_orc.forma_pagamento),
      'observacoes', coalesce(nullif(p_venda->>'observacoes', ''),
                              format('Orçamento #%s', v_orc.numero_orcamento))
    ),
    v_itens
  );

  update public.vendas_atacado set orcamento_id = p_orcamento_id where id = (v_res->>'id')::uuid;
  update public.orcamentos_pj set status = 'convertido', updated_at = now() where id = p_orcamento_id;

  return v_res || jsonb_build_object('orcamento_id', p_orcamento_id);
end;
$$;

revoke all on function public.converter_orcamento_em_venda(uuid, jsonb) from public, anon;
grant execute on function public.converter_orcamento_em_venda(uuid, jsonb) to authenticated, service_role;
