---
name: contexto-enxuto
description: Economiza tokens no entrega-admin começando pelo mapa do código (documentacao/mapa-do-codigo.md) em vez de reler o projeto. Use no início de qualquer tarefa, pergunta ou investigação neste repositório (código, banco, Edge Functions, documentação), e sempre que for explorar ou procurar onde algo fica.
---

# Contexto enxuto — entrega-admin

Objetivo: chegar ao arquivo certo com o mínimo de leitura. Economizar **não** pode tirar os testes, o
teste de migration nem a documentação que o `CLAUDE.md` exige.

## 1. Ordem de leitura

1. `CLAUDE.md` e memória: já vêm carregados, não releia.
2. `documentacao/mapa-do-codigo.md`: rota → página → hook/service → RPC/Edge. Comece sempre por ele.
3. `documentacao/estado-atual.md`: só se a tarefa depender de como um fluxo funciona hoje. Leia a seção, não o arquivo todo.
4. Só então, os arquivos que a tarefa toca.

## 2. Como ler

- `Grep` antes de `Read`. Procure o nome da função, da RPC ou do componente e abra só o trecho (`offset`/`limit`).
- Arquivos acima de ~400 linhas (`App.tsx`, `NovoProduto.tsx`, `NovoClienteModal.tsx`, páginas grandes): leia em trechos.
- Não faça varredura global nem chame agentes Explore quando o mapa já aponta o arquivo.
- Não releia o que já está no contexto desta conversa.
- Não abra os arquivos da seção "Não ler sem motivo" do mapa.

## 3. Banco (Supabase)

- Para uma função: `select pg_get_functiondef('public.nome'::regproc);`, ou `grep` em `supabase/migrations`.
- Para uma tabela: consulte as colunas só dela (`information_schema.columns where table_name = '...'`).
- Nunca puxe o schema inteiro nem gere os tipos do projeto todo só para consultar.

## 4. Resposta

Direto ao ponto: resultado, arquivos alterados, testes e resultado, pendências. Use diff ou resumo em vez
de arquivo inteiro, e só o trecho relevante dos logs.

## 5. Manter o mapa vivo

Se a tarefa criou, moveu ou apagou uma página, rota, hook, service, RPC ou Edge Function, atualize a linha
correspondente em `documentacao/mapa-do-codigo.md` (e a `date` do frontmatter), junto com a documentação
de fase que o `CLAUDE.md` já pede. Um mapa errado custa mais tokens que nenhum mapa.
