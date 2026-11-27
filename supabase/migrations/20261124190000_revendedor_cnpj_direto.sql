-- Fase 9 (ajuste) — o dono informa o CNPJ do próprio revendedor, sem escolher "um cliente".
--
-- Antes: em Modelo de venda o dono escolhia um cadastro PJ em Clientes, que precisava estar na carteira de
-- OUTRO vendedor (para não aparecer no app do revendedor). Isso confundia: parecia que era preciso escolher
-- um dos clientes do vendedor.
--
-- Agora:
-- * definir_modelo_vendedor recebe p_cnpj. O banco acha o cadastro PJ com esse CNPJ na empresa ou cria um
--   com os dados do vendedor (nome da empresa, telefone e endereço), na carteira do próprio revendedor.
--   p_cliente_pj_id continua aceito (desktop antigo).
-- * O cadastro PJ do revendedor pode ficar na carteira dele: get_clientes_vendedor deixa de mandá-lo para o
--   app, então ele não aparece como cliente.
-- * vendedores.cpf_cnpj vazio é preenchido com o CNPJ informado.

-- 1. CNPJ válido (dígitos verificadores) ----------------------------------------------------------------

create or replace function public._cnpj_valido(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_soma int;
  v_dv int;
  i int;
begin
  if length(v) <> 14 or v ~ '^(\d)\1{13}$' then
    return false;
  end if;
  v_soma := 0;
  for i in 1..12 loop
    v_soma := v_soma + substr(v, i, 1)::int * v_pesos1[i];
  end loop;
  v_dv := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
  if v_dv <> substr(v, 13, 1)::int then
    return false;
  end if;
  v_soma := 0;
  for i in 1..13 loop
    v_soma := v_soma + substr(v, i, 1)::int * v_pesos2[i];
  end loop;
  v_dv := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
  return v_dv = substr(v, 14, 1)::int;
end;
$$;

revoke all on function public._cnpj_valido(text) from public, anon;
grant execute on function public._cnpj_valido(text) to authenticated, service_role;

-- 2. Trocar o modelo do vendedor, agora com o CNPJ ------------------------------------------------------

drop function if exists public.definir_modelo_vendedor(uuid, text, uuid);

create or replace function public.definir_modelo_vendedor(
  p_vendedor_id uuid,
  p_modelo text,
  p_cliente_pj_id uuid default null,
  p_cnpj text default null
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
  v_cliente_pj_id uuid := p_cliente_pj_id;
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_nome text;
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
    -- CNPJ digitado: acha o cadastro PJ com esse CNPJ ou cria um com os dados do vendedor.
    if v_cnpj <> '' then
      if not public._cnpj_valido(v_cnpj) then
        raise exception 'CNPJ inválido. Confira os números.' using errcode = '22023';
      end if;

      select c.id, coalesce(c.administrador_id, cv.administrador_id) as admin_id, c.tipo_pessoa
        into v_cliente
      from public.clientes c
      left join public.vendedores cv on cv.id = c.vendedor_id
      where regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = v_cnpj
         or regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cnpj
      order by (c.id = v_vend.cliente_pj_id) desc nulls last, c.created_at
      limit 1;

      if v_cliente.id is not null then
        if v_cliente.admin_id is distinct from v_vend.administrador_id then
          raise exception 'Este CNPJ já está cadastrado em outra empresa' using errcode = '22023';
        end if;
        v_cliente_pj_id := v_cliente.id;
      else
        v_nome := coalesce(nullif(btrim(v_vend.nome_empresa), ''), v_vend.nome);
        insert into public.clientes (
          vendedor_id, administrador_id, tipo_pessoa, nome, razao_social, cnpj, cpf, telefone, endereco, ativo
        ) values (
          p_vendedor_id, v_vend.administrador_id, 'PJ', v_nome, v_nome, v_cnpj, v_cnpj,
          coalesce(v_vend.telefone, ''), coalesce(v_vend.endereco, ''), true
        )
        returning id into v_cliente_pj_id;
      end if;
    end if;

    if v_cliente_pj_id is null then
      raise exception 'Informe o CNPJ do revendedor' using errcode = '22023';
    end if;

    select c.id, c.tipo_pessoa, c.cnpj, coalesce(c.administrador_id, cv.administrador_id) as admin_id
      into v_cliente
    from public.clientes c
    left join public.vendedores cv on cv.id = c.vendedor_id
    where c.id = v_cliente_pj_id;
    if v_cliente.id is null or v_cliente.admin_id is distinct from v_vend.administrador_id then
      raise exception 'Cadastro PJ não encontrado nesta empresa' using errcode = 'P0002';
    end if;
    if v_cliente.tipo_pessoa is distinct from 'PJ' or nullif(btrim(coalesce(v_cliente.cnpj, '')), '') is null then
      raise exception 'Esse CNPJ está num cadastro de pessoa física. Corrija o cadastro em Clientes.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.vendedores o
      where o.cliente_pj_id = v_cliente_pj_id and o.id <> p_vendedor_id and o.modelo_venda = 'revendedor'
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
         cliente_pj_id = case when p_modelo = 'revendedor' then v_cliente_pj_id else cliente_pj_id end,
         cpf_cnpj = case when p_modelo = 'revendedor' and v_cnpj <> '' and nullif(btrim(coalesce(cpf_cnpj, '')), '') is null
                         then v_cnpj else cpf_cnpj end,
         updated_at = now()
   where id = p_vendedor_id;

  -- O revendedor paga a própria assinatura do app.
  if p_modelo = 'revendedor' and v_vend.tipo_vinculo is distinct from 'autonomo' then
    perform public.alterar_tipo_vinculo_vendedor(p_vendedor_id, 'autonomo');
  end if;

  return jsonb_build_object(
    'vendedor_id', p_vendedor_id,
    'modelo_venda', p_modelo,
    'cliente_pj_id', case when p_modelo = 'revendedor' then v_cliente_pj_id else v_vend.cliente_pj_id end
  );
end;
$$;

revoke all on function public.definir_modelo_vendedor(uuid, text, uuid, text) from public, anon;
grant execute on function public.definir_modelo_vendedor(uuid, text, uuid, text) to authenticated, service_role;

-- 3. O cadastro PJ do revendedor não vai para o app dele (não é um cliente) ------------------------------

create or replace function public.get_clientes_vendedor(p_vendedor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      AND NOT EXISTS (
        SELECT 1 FROM public.vendedores v WHERE v.id = p_vendedor_id AND v.cliente_pj_id = c.id
      )
  );
END;
$function$;

create or replace function public.get_clientes_vendedor(p_vendedor_id uuid, p_updated_after timestamp with time zone)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_updated_after is null then
    return public.get_clientes_vendedor(p_vendedor_id);
  end if;

  return (
    select coalesce(jsonb_agg(
      to_jsonb(c) || jsonb_build_object(
        'responsaveis', coalesce((
          select jsonb_agg(to_jsonb(r))
          from public.responsaveis r
          where r.cliente_id = c.id
        ), '[]'::jsonb),
        'credito_disponivel', coalesce((
          select round(sum(p.valor), 2)
          from public.entregas d
          join public.pagamentos p on p.entrega_id = d.id
          where d.cliente_id = c.id
            and d.vendedor_id = p_vendedor_id
            and d.status_entrega = 'devolução'
        ), 0)
      )
    ), '[]'::jsonb)
    from public.clientes c
    where c.vendedor_id = p_vendedor_id
      and not exists (
        select 1 from public.vendedores v where v.id = p_vendedor_id and v.cliente_pj_id = c.id
      )
      and (
        c.updated_at > p_updated_after
        or exists (
          select 1
          from public.entregas e
          where e.cliente_id = c.id
            and e.vendedor_id = p_vendedor_id
            and (
              e.updated_at > p_updated_after
              or exists (
                select 1 from public.pagamentos pg
                where pg.entrega_id = e.id
                  and greatest(pg.created_at, coalesce(pg.updated_at, pg.created_at)) > p_updated_after
              )
            )
        )
      )
  );
end;
$function$;
