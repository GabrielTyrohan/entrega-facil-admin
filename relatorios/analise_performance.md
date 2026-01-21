# Relatório de Análise de Performance e Cache

**Data:** 21/01/2026
**Status:** Otimizado (TanStack Query v5 + IndexedDB)

## 1. Visão Geral do Sistema de Cache

O projeto utiliza uma estratégia de cache avançada para garantir performance e funcionamento offline. A configuração central reside em `src/lib/cache/cacheConfig.ts` e `src/lib/constants/queryKeys.ts`.

### Configurações de Tempo (Time-to-Live)

| Entidade | Stale Time (Frescor) | GC Time (Coleta de Lixo) | Justificativa |
| :--- | :--- | :--- | :--- |
| **Padrão** | 5 minutos | 30 minutos | Balanço entre frescor e redução de requests. |
| **Produtos** | 10 minutos | 30 minutos | Catálogo muda com pouca frequência. |
| **Clientes** | 5 minutos | 15 minutos | Base de clientes é estável durante o uso. |
| **Histórico** | 30 minutos | 1 hora | Dados de meses anteriores não mudam. |
| **Entregas** | 5 minutos | 30 minutos | Alta volatilidade, mas usa invalidação ativa. |

*   **Stale Time:** Período em que os dados são considerados "novos". Durante esse tempo, o React Query não fará novas requisições em background ao focar a janela.
*   **GC Time:** Tempo que os dados inativos (não usados em tela) permanecem na memória/cache antes de serem deletados.

---

## 2. Persistência Offline (IndexedDB)

Utilizamos o adaptador `idb-keyval` para persistir o cache do React Query no **IndexedDB** do navegador.

### Benefícios
1.  **Inicialização Instantânea:** Ao abrir o app, os dados da última sessão aparecem imediatamente, eliminando spinners de carregamento inicial.
2.  **Resiliência:** Se a internet cair, o usuário pode continuar visualizando dados carregados anteriormente (ex: Lista de Clientes, Histórico de Vendas).
3.  **Capacidade:** IndexedDB suporta centenas de megabytes, ao contrário do LocalStorage (5MB), permitindo cachear listas grandes de produtos e clientes.

---

## 3. Estratégias de Prefetching

Para melhorar a percepção de velocidade, implementamos funções de prefetching em `src/lib/cache/prefetch.ts`.

*   **Comportamento:** Quando o usuário passa o mouse sobre itens do menu ou realiza ações previsíveis, o sistema inicia o carregamento dos dados em background antes mesmo do clique.
*   **Impacto:** Reduz o "Tempo até a Interatividade" (TTI) para zero em navegações comuns.

---

## 4. Otimizações de Renderização

### Hooks Seletivos
Utilizamos seletores nos hooks (ex: `useFluxoCaixa`) para evitar re-renderizações desnecessárias.
*   Se um componente precisa apenas do "Saldo Total", ele não deve re-renderizar se a "Lista de Transações" mudar, a menos que o saldo também mude.

### Background Workers
*   **`PaymentStatusAutoChecker.tsx`**: Este componente roda em background (sem renderizar UI) para verificar e atualizar status de pagamentos. Isso remove a carga de verificação do momento em que o usuário abre a tela de pagamentos, deixando a UI mais responsiva.

### Code Splitting (Lazy Loading)
Bibliotecas pesadas são carregadas apenas sob demanda para não impactar o tempo de carregamento inicial:
*   `html2pdf.js`: Carregado apenas ao clicar em "Gerar PDF".
*   `xlsx`: Carregado apenas ao exportar planilhas.
