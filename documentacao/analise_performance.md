# Relatório de Análise de Performance e Cache

**Data da última atualização:** 28/02/2026  
**Status:** Otimizado (TanStack Query v5 + IndexedDB + Prefetch)

---

## 1. Visão Geral do Sistema de Cache

O projeto utiliza uma estratégia de cache multinível para garantir performance, funcionamento offline e experiência de uso fluida. Os componentes centrais são:

- `src/lib/cache/cacheConfig.ts` — QueryClient global
- `src/lib/cache/indexedDBPersister.ts` — Persistência no IndexedDB
- `src/lib/cache/prefetch.ts` — Pré-carregamento automático
- `src/lib/cache/validateCache.ts` — Validação de integridade
- `src/lib/cache/persistConfig.ts` — Configurações de persistência
- `src/lib/constants/queryKeys.ts` — 60+ chaves de cache centralizadas

---

## 2. Configurações de Tempo (Time-to-Live)

### Configuração do QueryClient Global

| Parâmetro               | Valor                     | Descrição                                          |
| :---------------------- | :------------------------ | :------------------------------------------------- |
| `staleTime` (padrão)    | 5 minutos                 | Dados considerados "frescos" durante este período   |
| `gcTime` (padrão)       | 30 minutos                | Dados inativos removidos do cache após este período |
| `retry`                 | 1 tentativa               | Tentativas de re-execução em caso de erro          |
| `retryDelay`            | Exponential backoff       | `min(1000 × 2^attempt, 30000)` ms                 |
| `refetchOnWindowFocus`  | **Desabilitado**          | Evita requests desnecessários ao focar a janela    |
| `refetchOnReconnect`    | **Habilitado**            | Revalida dados ao restaurar conexão               |

### Configurações por Entidade (`CACHE_TIMES`)

| Entidade           | Stale Time  | GC Time     | Justificativa                                        |
| :----------------- | :---------- | :---------- | :--------------------------------------------------- |
| **Padrão**         | 5 min       | 30 min      | Balanço entre frescor e redução de requests           |
| **Produtos**       | 10 min      | 30 min      | Catálogo muda com pouca frequência                    |
| **Clientes**       | 5 min       | 15 min      | Base de clientes é estável durante o uso              |
| **Vendedores**     | 5 min       | 15 min      | Cadastro estável com poucos updates                   |
| **Entregas**       | 5 min       | 30 min      | Alta volatilidade, mas usa invalidação ativa          |
| **Pagamentos**     | 5 min       | 30 min      | Frequentemente atualizado                             |
| **Cestas**         | 5 min       | 30 min      | Mudanças moderadas durante uso                        |
| **Responsáveis**   | 10 min      | 30 min      | Raramente alterado                                    |
| **Funcionários**   | 5 min       | 15 min      | Dados administrativos estáveis                        |
| **Estoque**        | 5 min       | 15 min      | Atualizado em transações de movimentação              |
| **Relatório Estoque** | 30 min   | 1 hora      | Dados analíticos consolidados                         |
| **Tabela Preços**  | 10 min      | 30 min      | Preços mudam com pouca frequência                     |
| **Dashboard Stats**| 5 min       | 30 min      | Dados que mudam com frequência                        |
| **Históricos**     | 30 min      | 1 hora      | Dados de meses anteriores não mudam                   |
| **Orçamentos PJ**  | 5 min       | 30 min      | Atualizado em aprovações/rejeições                    |
| **Vendas Atacado** | 5 min       | 30 min      | Frequentemente atualizado                             |
| **Acertos Diários**| 5 min       | 30 min      | Atualizado diariamente                                |
| **Fluxo de Caixa** | 5 min       | 30 min      | Atualizado em lançamentos                             |

### Mutações (Configurações de Retry)

| Parâmetro             | Valor                           | Descrição                                         |
| :-------------------- | :------------------------------ | :------------------------------------------------ |
| `retry` (mutations)   | Até 2 tentativas                | Para erros de rede apenas                          |
| Sem retry para 4xx    | Imediato fail                   | Erros de validação/permissão não são retentados    |

---

## 3. Chaves de Cache Centralizadas

O sistema define **60+ chaves de cache** em `queryKeys.ts` para evitar colisões e manter consistência:

### Categorias de Chaves

| Categoria             | Exemplos                                                    | Quantidade |
| :-------------------- | :---------------------------------------------------------- | :--------- |
| **CRUD Entidades**    | `PRODUTOS`, `CLIENTES`, `VENDEDORES`, `ENTREGAS`           | ~15        |
| **Dashboard**         | `DASHBOARD_STATS`, `DASHBOARD_SUMMARY`, `DASHBOARD_FLUXO`  | ~5         |
| **Estatísticas**       | `ENTREGAS_MES_ATUAL`, `FATURAMENTO_MENSAL`, `TOP_VENDEDORES` | ~15      |
| **Atividades**        | `ATIVIDADES_ENTREGAS`, `ATIVIDADES_PAGAMENTOS`              | ~4         |
| **Devedores**         | `DEVEDORES`, `VENDEDORES_FILTRO`                             | ~4         |
| **Vendas/Destalhes**  | `VENDAS_ATACADO`, `VENDA_ATACADO_DETALHES`, `VENDAS_ATACADO_STATS` | ~5 |
| **Perfil/Sistema**    | `USER_PROFILE`, `SISTEMA_STATUS`, `SUPORTE_SOLICITACOES`    | ~5         |
| **Estoque**           | `MOVIMENTACOES_ESTOQUE`, `VIEW_ESTOQUE_ATUAL`               | ~2         |
| **Compatibilidade**   | `STATS` (legacy alias)                                       | ~1         |

---

## 4. Persistência Offline (IndexedDB)

O cache do React Query é persistido no **IndexedDB** do navegador utilizando o adaptador `idb-keyval`.

### Fluxo de Persistência

```
1. App inicia → PersistQueryClientProvider carrega cache do IndexedDB
2. Dados aparecem imediatamente (sem spinner) → dados podem estar stale
3. React Query revalida em background → substitui cache se dados mudaram
4. Toda mutação → invalidação de cache → dados re-buscados → IndexedDB atualizado
5. App fecha → estado do cache salvo automaticamente no IndexedDB
```

### Migração LocalStorage → IndexedDB

Na inicialização, `App.tsx` executa uma migração one-time:
1. Verifica flag `migrated-to-idb` no localStorage.
2. Se não migrado: remove todas as chaves `REACT_QUERY*` do localStorage.
3. Seta flag para não repetir.

### Benefícios

| Benefício                  | Descrição                                                              |
| :------------------------- | :--------------------------------------------------------------------- |
| **Inicialização Instantânea** | Dados da última sessão aparecem imediatamente, sem spinners            |
| **Resiliência Offline**    | Visualização de dados mesmo sem internet                                |
| **Capacidade**             | IndexedDB suporta centenas de MB (vs 5MB do LocalStorage)               |
| **Silencioso em Falha**    | Se IndexedDB falhar (quota), opera apenas em memória RAM               |

---

## 5. Estratégias de Prefetching

### Prefetch Automático (`prefetch.ts`)

Ao detectar `adminId` disponível no `AuthContext`, o sistema pré-carrega dados essenciais:

```typescript
// Executado automaticamente ao login ou reload
useEffect(() => {
  if (adminId) {
    prefetchEssentialData(queryClient, adminId).catch(console.error);
  }
}, [adminId, queryClient]);
```

### Prefetch por Interação

- **Hover no menu:** Ao passar o mouse sobre itens do `Sidebar`, dados da página alvo começam a carregar.
- **Impacto:** Reduz TTI (Time to Interactive) para zero em navegações previsíveis.

---

## 6. Otimizações de Renderização

### 6.1. Hooks Seletivos

- Hooks utilizam `useMemo` para computar dados derivados sem re-renderizações.
- `useDashboardSummary` agrega todas as estatísticas do dashboard em uma **única query** para evitar waterfall de requests.
- Componentes seletivos: se um componente precisa apenas do "Saldo Total", não re-renderiza se a "Lista de Transações" mudar.

### 6.2. Background Workers

- **`PaymentStatusAutoChecker.tsx`:** Componente sem UI que roda em background, verificando e atualizando status de pagamentos automaticamente. Remove a carga de verificação do momento em que o usuário abre a tela.

### 6.3. Code Splitting (Lazy Loading)

Bibliotecas pesadas são carregadas apenas sob demanda:

| Biblioteca       | Carregada quando                        | Tamanho estimado |
| :--------------- | :-------------------------------------- | :--------------- |
| `html2pdf.js`    | Clique em "Gerar PDF"                   | ~500KB           |
| `jspdf`          | Geração de relatórios em PDF             | ~300KB           |
| `jspdf-autotable`| Tabelas em relatórios PDF               | ~100KB           |
| `xlsx-js-style`  | Exportar planilha Excel                 | ~400KB           |

### 6.4. Supressão de Console em Produção

`consoleOverride.ts` intercepta `console.log`, `console.warn` e `console.error` em produção para:
- Evitar vazamento de informações sensíveis.
- Reduzir overhead de I/O no console.

---

## 7. Invalidação de Cache — Helpers Globais

O `cacheConfig.ts` exporta helpers para invalidação programática:

| Função                         | Descrição                                                |
| :----------------------------- | :------------------------------------------------------- |
| `invalidateTableCache(name)`   | Invalida cache de uma entidade específica                |
| `invalidateMultipleTablesCache(names)` | Invalida múltiplas entidades de uma vez          |
| `clearAllCache()`              | Limpa todo o cache (QueryClient + IndexedDB)             |
| `prefetchTableData(name, fn)`  | Pré-carrega dados de uma entidade com staleTime custom   |

---

## 8. Métricas de Cache por Módulo

| Módulo                | Queries típicas | Invalidação ativa         | Notas                    |
| :-------------------- | :-------------- | :------------------------ | :----------------------- |
| Dashboard             | 10-15           | A cada 5 min (staleTime)  | `useDashboardSummary` unifica |
| Produtos              | 2-3             | Após CRUD                 | Stale time elevado (10 min) |
| Entregas              | 3-5             | Após criar/editar         | Cache padrão (5 min)     |
| Pagamentos            | 3-5             | Após registrar            | Checker automático em bg |
| Relatórios            | 5-8 manuais     | Bypass de cache padrão    | Queries com limit(10000) |
| Estoque               | 2-4             | Após movimentação         | Relatório com 30 min     |
