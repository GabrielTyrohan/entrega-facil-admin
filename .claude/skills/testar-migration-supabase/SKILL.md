---
name: testar-migration-supabase
description: Testa uma migration SQL do Supabase (projeto fpemgftaedlgmcdxtncg) numa transação que é desfeita, simulando dono, funcionária e service_role, e só depois aplica em produção e confere. Use sempre que criar ou alterar tabela, função, trigger, policy ou constraint em supabase/migrations.
---

# Testar e aplicar migration no Supabase

O banco `fpemgftaedlgmcdxtncg` é **produção** e serve os 3 sistemas. Nunca aplique sem
testar antes nesta sequência.

## 1. Escrever a migration

- Arquivo: `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`, com timestamp maior que o último.
- Seja idempotente: `create table if not exists`, `create or replace function`,
  `drop policy if exists` + `create policy`, `drop constraint if exists` + `add constraint`.
- Funções: `security definer`, `set search_path = public`, checagem de `auth.uid()` no início,
  erros com `errcode` (`42501` permissão, `22023` dado inválido, `P0002` não encontrado) e
  mensagem em português simples. No fim:
  `revoke all on function ... from public, anon; grant execute on function ... to authenticated, service_role;`
- Antes de escrever, confira as colunas reais:
  ```sql
  select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position)
  from information_schema.columns where table_schema='public' and table_name in ('...') group by 1;
  ```
  e, para funções existentes, `select pg_get_functiondef('public.nome(tipos)'::regprocedure);`.

## 2. Escolher dados reais para o teste

Consulte (só leitura) os ids de que precisa: admin, funcionária com e sem a permissão,
vendedor, produto, cliente. Atenção:
- Admin com assinatura vencida faz o trigger de pagamentos recusar o insert; nesse caso
  insira como `service_role`.
- Use um vendedor cujo `dia_fechamento` faça sentido para o cenário.
- `execute_sql` com várias consultas devolve só o resultado da última; rode uma por vez.

## 3. Rodar o teste em transação desfeita

Num **único** `execute_sql`, envie: o conteúdo inteiro da migration + um bloco `DO` que
monta os cenários e termina com `raise exception 'RESULTADO_TESTE ...'`. O erro desfaz tudo
(migration e dados) e a mensagem traz os resultados.

```sql
-- (conteúdo da migration aqui)

do $t$
declare
  v_admin uuid := '<admin>';
  v_ok_recusa boolean := false;
  v_res jsonb;
begin
  -- Como o dono
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub', v_admin)::text, true);
  v_res := public.minha_funcao(...);

  -- Caso que deve ser recusado (ex.: funcionária sem permissão)
  perform set_config('request.jwt.claims',
    json_build_object('role','authenticated','sub','<auth_user_id da funcionária>')::text, true);
  begin
    perform public.minha_funcao(...);
  exception when others then v_ok_recusa := sqlerrm like '%Sem permissão%'; end;

  -- Como o sistema (Edge Function / superadmin)
  -- perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  raise exception 'RESULTADO_TESTE res=% recusa=% estoque=%',
    v_res, v_ok_recusa, (select qtd_estoque from produtos_cadastrado where id = '<produto>');
end $t$;
```

Cubra no mínimo:
- o caminho feliz, conferindo o efeito real (estoque antes/depois, valores, status);
- cada recusa de permissão (outra empresa, funcionária sem permissão, bloqueado);
- a repetição (não duplicar, não converter ou baixar duas vezes);
- triggers afetados (`fn_atualizar_estoque` recusa saldo negativo).

Só siga se **todos** os valores baterem com o esperado. Se falhar, corrija o arquivo e repita.

## 4. Aplicar

- `apply_migration` com `name` = nome do arquivo sem o timestamp e `query` = conteúdo
  **exato** do arquivo (o mesmo que foi testado).
- Grave antes qualquer correção no arquivo, para o repositório e o banco ficarem iguais.

## 5. Conferir depois de aplicar

```sql
select to_regprocedure('public.minha_funcao(jsonb)') is not null as existe;
```
Confira também que nenhum dado de teste ficou gravado. Se mexeu em permissões ou
funções, rode `get_advisors` (security) e veja se apareceu aviso novo.

## 6. Fechar

- Rode `npx tsc --noEmit -p .` e `npx vitest run` se o front mudou.
- Conte ao usuário, em português, os cenários testados com os números reais.
- Commit só quando o usuário pedir (branch `developer`). Se a mudança precisar de app novo
  (Expo), avise que é preciso gerar o APK.
