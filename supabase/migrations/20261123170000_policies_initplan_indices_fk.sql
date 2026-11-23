-- Desempenho das policies e índices (item 4 do teste de consumo).
--
-- 1. Policies: `auth.uid()` (e auth.jwt/role/email) solto na policy é calculado de novo para cada
--    linha lida. Dentro de `(select ...)` o Postgres calcula uma vez por consulta (initPlan).
--    O mesmo vale para as funções auxiliares sem parâmetro, que só dependem de quem está logado:
--    is_super_admin, get_user_admin_id, get_admin_id_for_user, can_manage_produtos e
--    can_manage_vendedores (cada chamada é uma consulta; em movimentacoes_estoque eram 3 por linha).
--    O resultado é o mesmo; só muda o custo. Feito de forma automática e idempotente: só troca
--    chamadas que ainda não estão dentro de um SELECT.
-- 2. Índice em toda chave estrangeira (FK) sem índice: acelera os joins das policies e evita
--    varredura completa ao apagar a linha referenciada.
-- 3. Índices repetidos sem constraint: fica um de cada par.
--    (Os dois de estoque_vendedor são constraints únicas iguais e continuam.)
--
-- Não junta as policies permissivas duplicadas: isso muda quem pode ver o quê e fica para outra etapa.

do $$
declare
  p record;
  v_using text;
  v_check text;
  v_padrao constant text := '(?<!SELECT )auth\.(uid|jwt|role|email)\(\)';
  v_troca constant text := '(select auth.\1())';
  v_padrao_fn constant text :=
    '(?<!SELECT )(?<![\w.])((?:public\.)?(?:is_super_admin|get_user_admin_id|get_admin_id_for_user|can_manage_produtos|can_manage_vendedores))\(\)';
  v_troca_fn constant text := '(select \1())';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ v_padrao or coalesce(with_check, '') ~ v_padrao
        or coalesce(qual, '') ~ v_padrao_fn or coalesce(with_check, '') ~ v_padrao_fn)
  loop
    v_using := case when p.qual is not null
      then ' using (' || regexp_replace(regexp_replace(p.qual, v_padrao, v_troca, 'g'), v_padrao_fn, v_troca_fn, 'g') || ')'
      else '' end;
    v_check := case when p.with_check is not null
      then ' with check (' || regexp_replace(regexp_replace(p.with_check, v_padrao, v_troca, 'g'), v_padrao_fn, v_troca_fn, 'g') || ')'
      else '' end;
    execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename) || v_using || v_check;
  end loop;
end $$;

do $$
declare
  f record;
  v_nome text;
begin
  for f in
    select c.conrelid, cl.relname as tabela,
      array_agg(a.attname order by k.ord) as colunas,
      c.conkey
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and cl.relnamespace = 'public'::regnamespace
    group by c.oid, c.conrelid, cl.relname, c.conkey
  loop
    -- Já existe índice cujas primeiras colunas são exatamente as da FK?
    if exists (
      select 1 from pg_index i
      where i.indrelid = f.conrelid
        and (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] @> f.conkey
        and (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] <@ f.conkey
    ) then
      continue;
    end if;
    v_nome := left('idx_' || f.tabela || '_' || array_to_string(f.colunas, '_'), 63);
    execute format('create index if not exists %I on public.%I (%s)',
      v_nome, f.tabela,
      (select string_agg(format('%I', col), ', ') from unnest(f.colunas) as col));
  end loop;
end $$;

drop index if exists public.idx_produtos_ncm;                 -- igual a idx_produtos_cadastrado_ncm
drop index if exists public.idx_vendas_atacado_itens_venda;   -- igual a idx_vendas_atacado_itens_venda_atacado_id
