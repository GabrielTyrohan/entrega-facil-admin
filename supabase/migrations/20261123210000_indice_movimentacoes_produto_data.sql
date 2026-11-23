-- Tela de estoque (view_estoque_atual) rápida.
--
-- A view busca, para cada produto, a última movimentação (max(created_at)). Sem um índice por
-- produto e data, o Postgres percorria idx_movimentacoes_data inteiro filtrando o produto; nos
-- produtos sem movimentação ele lia ~10 mil linhas à toa, 1.276 vezes: 3,3 s para o dono.
-- Com este índice: 43 ms, com resultado idêntico (md5 do JSON igual), testado em transação desfeita.
--
-- O índice antigo idx_movimentacoes_produto (só produto_cadastrado_id) fica coberto por este,
-- mas continua: é pequeno e a remoção fica para quando o aviso de índice sem uso confirmar.

create index if not exists idx_movimentacoes_produto_data
  on public.movimentacoes_estoque (produto_cadastrado_id, created_at desc);
