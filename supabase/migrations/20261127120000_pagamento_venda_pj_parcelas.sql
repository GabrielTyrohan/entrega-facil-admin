-- Pagamentos de venda PJ pelo banco + parcelamento do pedido do revendedor (27/11/2026)
--
-- 1. vendas_atacado.parcelas: em quantas vezes a venda a prazo foi combinada (1 a 12).
-- 2. vendas_atacado_pagamentos.data_pagamento: o dia em que o cliente pagou (antes só havia created_at).
-- 3. pedidos_vendedor.venda_atacado_id: liga o pedido atendido do revendedor à venda PJ criada.
-- 4. registrar_pagamento_venda_atacado: lança um pagamento numa transação só (histórico + valor pago +
--    situação), no lugar das duas gravações diretas que o front fazia.
-- 5. atender_pedido_revendedor: grava parcelas e o vínculo com a venda; quando "Pago agora", já registra
--    o pagamento no histórico.

alter table public.vendas_atacado
  add column if not exists parcelas smallint not null default 1;
alter table public.vendas_atacado drop constraint if exists vendas_atacado_parcelas_check;
alter table public.vendas_atacado
  add constraint vendas_atacado_parcelas_check check (parcelas between 1 and 12);

alter table public.vendas_atacado_pagamentos
  add column if not exists data_pagamento date not null default current_date;
update public.vendas_atacado_pagamentos
set data_pagamento = (created_at at time zone 'America/Sao_Paulo')::date
where created_at is not null
  and data_pagamento <> (created_at at time zone 'America/Sao_Paulo')::date;

alter table public.pedidos_vendedor
  add column if not exists venda_atacado_id uuid references public.vendas_atacado(id) on delete set null;
create index if not exists idx_pedidos_vendedor_venda_atacado on public.pedidos_vendedor(venda_atacado_id);

-- Pedidos de revendedor já atendidos: liga à venda pela observação padrão "Pedido #N do revendedor".
update public.pedidos_vendedor p
set venda_atacado_id = v.id
from public.vendas_atacado v
where p.venda_atacado_id is null
  and v.para_revendedor = true
  and v.vendedor_id = p.vendedor_id
  and v.observacoes like format('Pedido #%s do revendedor%%', p.numero);

-- Vendas ao revendedor marcadas como pagas ao atender não tinham o pagamento no histórico.
insert into public.vendas_atacado_pagamentos (venda_id, valor, forma_pagamento, observacao, data_pagamento, created_at)
select v.id, v.valor_pago, v.forma_pagamento, 'Pago ao atender o pedido (lançamento recuperado)',
       coalesce(v.data_pagamento, (v.created_at at time zone 'America/Sao_Paulo')::date), v.created_at
from public.vendas_atacado v
where v.para_revendedor = true
  and coalesce(v.valor_pago, 0) > 0
  and not exists (select 1 from public.vendas_atacado_pagamentos p where p.venda_id = v.id);

-- ---------------------------------------------------------------------------------------------
create or replace function public.registrar_pagamento_venda_atacado(
  p_venda_id uuid,
  p_valor numeric,
  p_forma_pagamento text default null,
  p_data_pagamento date default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas_atacado%rowtype;
  v_saldo numeric;
  v_novo_pago numeric;
  v_status text;
  v_data date := coalesce(p_data_pagamento, (now() at time zone 'America/Sao_Paulo')::date);
  v_pag_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  select * into v_venda from public.vendas_atacado where id = p_venda_id for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'P0002';
  end if;

  if not (
    v_venda.administrador_id = auth.uid()
    or exists (
      select 1 from public.funcionarios f
      where f.auth_user_id = auth.uid()
        and f.administrador_id = v_venda.administrador_id
        and f.ativo = true
        and coalesce(f.bloqueado, false) = false
        and coalesce((f.permissoes->>'vendas_atacado')::boolean, false) = true
    )
  ) then
    raise exception 'Sem permissão para registrar pagamento desta venda' using errcode = '42501';
  end if;

  if v_venda.status_pagamento = 'cancelado' then
    raise exception 'Esta venda foi cancelada' using errcode = '22023';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero' using errcode = '22023';
  end if;
  if round(p_valor, 2) <> p_valor then
    raise exception 'O valor pode ter no máximo 2 casas (centavos)' using errcode = '22023';
  end if;

  v_saldo := round(coalesce(v_venda.valor_total, 0) - coalesce(v_venda.valor_pago, 0), 2);
  if v_saldo <= 0 then
    raise exception 'Esta venda já está paga' using errcode = '22023';
  end if;
  if p_valor > v_saldo then
    raise exception 'O valor (R$ %) é maior que o que falta pagar (R$ %)',
      replace(to_char(p_valor, 'FM999999990.00'), '.', ','), replace(to_char(v_saldo, 'FM999999990.00'), '.', ',')
      using errcode = '22023';
  end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data do pagamento não pode ser no futuro' using errcode = '22023';
  end if;

  insert into public.vendas_atacado_pagamentos (venda_id, valor, forma_pagamento, observacao, data_pagamento)
  values (p_venda_id, p_valor, nullif(btrim(coalesce(p_forma_pagamento, '')), ''),
          nullif(btrim(coalesce(p_observacao, '')), ''), v_data)
  returning id into v_pag_id;

  v_novo_pago := round(coalesce(v_venda.valor_pago, 0) + p_valor, 2);
  v_status := case when v_novo_pago >= coalesce(v_venda.valor_total, 0) then 'pago' else 'parcial' end;

  update public.vendas_atacado
  set valor_pago = v_novo_pago,
      status_pagamento = v_status,
      pago = (v_status = 'pago'),
      updated_at = now()
  where id = p_venda_id;

  return jsonb_build_object(
    'pagamento_id', v_pag_id,
    'venda_id', p_venda_id,
    'valor_pago', v_novo_pago,
    'saldo', round(coalesce(v_venda.valor_total, 0) - v_novo_pago, 2),
    'status_pagamento', v_status
  );
end;
$$;

revoke all on function public.registrar_pagamento_venda_atacado(uuid, numeric, text, date, text) from public, anon;
grant execute on function public.registrar_pagamento_venda_atacado(uuid, numeric, text, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
create or replace function public.atender_pedido_revendedor(
  p_pedido_id uuid,
  p_itens jsonb,
  p_venda jsonb default '{}'::jsonb,
  p_resposta text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  v_venda_id uuid;
  v_parcelas int;
  v_venda_criada public.vendas_atacado%rowtype;
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

  v_parcelas := coalesce(nullif(p_venda->>'parcelas', '')::int, 1);
  if v_parcelas < 1 or v_parcelas > 12 then
    raise exception 'O número de parcelas deve ficar entre 1 e 12' using errcode = '22023';
  end if;
  if coalesce((p_venda->>'pago')::boolean, false) then
    v_parcelas := 1;
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
    (coalesce(p_venda, '{}'::jsonb) - 'parcelas') || jsonb_build_object(
      'cliente_id', v_vend.cliente_pj_id,
      'vendedor_id', v_vend.id,
      'nome_cliente_cache', coalesce(nullif(p_venda->>'nome_cliente_cache', ''), v_vend.nome_empresa, v_vend.nome),
      'observacoes', coalesce(nullif(p_venda->>'observacoes', ''), format('Pedido #%s do revendedor', v_pedido.numero))
    ),
    v_itens_venda
  );
  v_venda_id := (v_res->>'id')::uuid;

  update public.vendas_atacado set parcelas = v_parcelas where id = v_venda_id
  returning * into v_venda_criada;

  -- "Pago agora": o pagamento também entra no histórico da venda.
  if coalesce(v_venda_criada.valor_pago, 0) > 0 then
    insert into public.vendas_atacado_pagamentos (venda_id, valor, forma_pagamento, observacao, data_pagamento)
    values (v_venda_id, v_venda_criada.valor_pago, v_venda_criada.forma_pagamento,
            format('Pago ao atender o pedido #%s', v_pedido.numero),
            coalesce(v_venda_criada.data_pagamento, (now() at time zone 'America/Sao_Paulo')::date));
  end if;

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
      venda_atacado_id = v_venda_id,
      updated_at = now()
  where id = p_pedido_id;

  return jsonb_build_object('id', p_pedido_id, 'status', v_status, 'venda', v_res || jsonb_build_object('parcelas', v_parcelas));
end;
$function$;

revoke all on function public.atender_pedido_revendedor(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.atender_pedido_revendedor(uuid, jsonb, jsonb, text) to authenticated, service_role;
