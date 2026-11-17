# Entrega Fácil — Gestão (entrega-admin)

Desktop (Vite + React + TypeScript + Electron) do **dono** e das **funcionárias** de uma
empresa de cestas básicas. Responda e escreva textos para o usuário em português.

## Os 3 sistemas (mesmo Supabase: `fpemgftaedlgmcdxtncg`)

| Pasta | Quem usa | Stack |
|---|---|---|
| `C:\entrega-facil` | Vendedor na rua (offline/online) | Expo, SQLite, sync pela Edge Function `sync-vendedor-seguro` |
| `C:\entrega-admin` (aqui) | Dono e funcionárias | Vite/React/Electron, React Query |
| `C:\Users\gabri\Desktop\entrega-facil-superadmin-main` | Só o desenvolvedor (controle total, `service_role`) | Next/Electron |

Migrations e Edge Functions dos 3 sistemas ficam versionadas **aqui**, em
`supabase/migrations` (`AAAAMMDDHHMMSS_nome.sql`) e `supabase/functions`.

## Regras de negócio

- **Dono (admin):** controla tudo. `administradores.id = auth.uid()`.
- **Funcionárias:** `funcionarios.auth_user_id`, permissões em `funcionarios.permissoes` (jsonb):
  `produtos`, `expedicao`, `cestas_vendedor`, `vendas_atacado`, `cobranca`… Elas vendem para PJ (NF-e),
  cobram e liberam cestas e avulsos para os vendedores. **Vendedores são do dono**, não de uma funcionária.
- **Vendedor:** vende ao cliente. `percentual_minimo` é o % da entrega anterior que o cliente precisa
  ter pago para liberar uma nova entrega; o próprio vendedor altera o valor no app.
- **Janela do vendedor:** do `dia_fechamento` até o dia anterior no mês seguinte (fim inclusivo).
  Use `periodo_vendedor_em(dia, data)` / `get_periodo_fechamento` do banco, sem recalcular no front.
- **Comissão:** `comissao_percentual` × pagamentos com `data_pagamento` dentro da janela. O fechamento
  (`fechar_periodo_vendedor`) congela o valor; um pagamento lançado depois com data antiga vira ajuste.
  `tipo_contrato` (efetivado/autônomo) é só informativo. `tipo_vinculo` diz quem paga a assinatura.
- **Pedidos do vendedor:** sempre pendentes até uma funcionária ou o dono atender ou recusar.
- **Troca e devolução:** feitas só pelo vendedor, no app. Na troca, o valor pago abate a nova entrega;
  na devolução, vira crédito do cliente.
- **Assinatura:** o dono paga 180 + 100 por vendedor representado; o autônomo paga 100.
  O valor vem de `calcular_valor_assinatura_admin` (lê `configuracoes_plano`).

## Estoque (não quebrar)

- O estoque geral é `produtos_cadastrado.qtd_estoque` e **só muda por insert em `movimentacoes_estoque`**.
  O trigger `fn_atualizar_estoque` soma `entrada%`, subtrai `saida%` e recusa saldo negativo.
- Sai do estoque geral ao **liberar para o vendedor** (`registrar_entrega_cestas`,
  `criar_entrega_avulsa_segura`) e na **venda PJ** (`criar_venda_atacado_segura`,
  `converter_orcamento_em_venda`). A venda do vendedor ao cliente **não** baixa o geral de novo.
- Entra pela compra (`registrar_compra` → `entrada_compra`, com custo médio).
- O estoque do vendedor é **cesta + itens extras**: cestas em `estoque_vendedor` e itens soltos em
  `estoque_vendedor_itens`, calculados pelo banco a partir das entregas (`reconciliar_estoque_entregas`).
- Constraints: `usuario_tipo` ∈ admin/funcionario/vendedor (na auditoria também `desenvolvedor`);
  `referencia_tipo` restrito a uma lista; `quantidade > 0`.

## Padrão do banco

- A regra de negócio fica no banco: funções `SECURITY DEFINER` com `set search_path = public`, que
  checam `auth.uid()` (dono ou funcionária ativa, não bloqueada e com a permissão) e fazem tudo em uma
  transação. O front só chama `supabase.rpc(...)`. Nada de gravar direto em tabela sensível pelo front.
- Helpers: `can_operate_cestas`, `can_operate_cobranca`, `can_gerir_estoque`, `is_super_admin`.
- O superadmin (dev) é auditado automaticamente (`fn_auditoria_dev`); ações de dev são funções `dev_*`
  com motivo. `auditoria_acoes` é só leitura para usuários.
- Toda função nova: `revoke all ... from public, anon; grant execute ... to authenticated, service_role;`.
- Para mudar uma migration, **use a skill `testar-migration-supabase`**: teste em transação desfeita e
  só depois aplique.

## Comandos

- Tipos: `npx tsc --noEmit -p .`
- Testes: `npx vitest run` (ficam em `src/tests`, espelhando `src/`)
- Dev: `npm run electron:dev`

## Regras de trabalho

- Branch de trabalho: `developer` (o principal é `main`). Commit só quando o usuário pedir; push só com
  pedido explícito.
- Não mexer em arquivos que o usuário deixou sem commit em outros repositórios
  (`pagamento-form.tsx` no superadmin, `erro-vendedor.txt` no app).
- Testar antes de aplicar qualquer coisa em produção (o Supabase é produção).
- O app mobile só recebe mudanças novas com um APK novo; avise quando uma mudança depender disso.
- Mensagens de erro para o usuário final em português simples.
- **Documentar tudo no Obsidian** (o vault é esta pasta): ao fim de cada fase ou alteração, antes do commit,
  crie ou atualize `documentacao/fases/<fase>.md` e `documentacao/estado-atual.md`, ligue as notas em
  `documentacao/INDEX.md` e rode o lint da skill obsidian-notes. Use links relativos em markdown e
  frontmatter (`title`, `date`, `tags`).
- Plano geral das fases: `C:\Users\gabri\.claude\plans\no-momento-estou-te-recursive-meadow.md`
  (todas as fases concluídas: 1 a 7, incluindo 6b, 6d e 6e). Estado atual: `documentacao/estado-atual.md`.
