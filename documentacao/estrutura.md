# Estrutura do Projeto — Diretório `src/` e Desktop

**Data da última atualização:** 09/03/2026

> [!NOTE]
> Esta árvore reflete o estado real do sistema de arquivos do diretório `src/` na data acima. Diretórios vazios reservados para futuras funcionalidades estão marcados com `(vazio)`. As pastas utilitárias `electron` e `electron-cache` listadas no topo encontram-se no diretório-raiz do projeto.

```text
/ (Raiz do Projeto)
├── documentacao/                        # Documentação técnica e de negócio do sistema
│   ├── analise_performance.md
│   ├── arquitetura-frontend.md
│   ├── estrutura.md
│   ├── historico-alteracoes.md
│   ├── manual-das-paginas.md            # Manual detalhado das rotas do frontend para usuários
│   └── troubleshooting-guide.md
├── electron/                            # Configurações do wrapper Desktop (Electron Chromium)
│   └── main.cjs                         # Entry point local que encapsula o Vite Webapp
├── electron-cache/                      # Repositório de builds temporários e releases ZIP da aplicação desktop (informativo)
├── src/
│   ├── App.tsx                              # Componente raiz: roteamento (HashRouter), providers globais, migração de cache
├── main.tsx                             # Entry point: renderiza <App /> dentro de PersistQueryClientProvider + StrictMode
├── index.css                            # Estilos globais (Tailwind + customizações)
├── vite-env.d.ts                        # Declarações de tipo para Vite (import.meta.env)
│
├── assets/
│   └── icon.svg                         # Ícone da aplicação (SVG)
│
├── components/
│   ├── ErrorBoundary.tsx                # Componente de captura de erros (React Error Boundary)
│   ├── FuncionarioModal.tsx             # Modal de criação/edição de funcionário (Geração de senha segura)
│   ├── NovoClienteModal.tsx             # Modal de criação de novo cliente (~43KB, Pessoa Física + PJ)
│   ├── PaymentStatusAutoChecker.tsx     # Worker em background: verifica/atualiza status de pagamentos automaticamente
│   ├── ProtectedRoute.tsx               # Wrapper de rotas protegidas (verifica autenticação ativa)
│   │
│   ├── charts/
│   │   └── StatusPagamentosPieChart.tsx # Gráfico de pizza (Recharts/Highcharts) - status de pagamentos
│   │
│   ├── layout/
│   │   ├── Header.tsx                   # Cabeçalho: nome da empresa, tema dark/light, botão logout
│   │   ├── MainLayout.tsx               # Layout principal: Sidebar + área de conteúdo
│   │   └── Sidebar.tsx                  # Menu lateral dinâmico com controle de permissões por grupo e tipagem estrita (~11KB)
│   │
│   ├── Permissoes/
│   │   └── RequirePermission.tsx        # Controle granular de acesso: renderiza children apenas se permissão existir
│   │
│   └── ui/
│       ├── button.tsx                   # Componente Button (CVA — Class Variance Authority)
│       ├── command.tsx                  # Componente Command (cmdk) — busca/seleção por teclado
│       ├── dialog.tsx                   # Componente Dialog (Radix UI)
│       ├── dropdown-menu.tsx            # Componente Dropdown Menu (Radix UI)
│       ├── pagination.tsx               # Componente Paginação customizado
│       ├── popover.tsx                  # Componente Popover (Radix UI)
│       ├── ClienteModal.tsx             # Modal para visualizar detalhes de cliente PF (~25KB)
│       ├── ClientePJModal.tsx           # Modal para visualizar detalhes de cliente PJ (~16KB)
│       ├── EditClienteModal.tsx         # Modal para editar cliente PF (~26KB)
│       ├── EditClientePJModal.tsx        # Modal para editar cliente PJ (~25KB)
│       ├── EntregaModal.tsx             # Modal para criar/editar entrega (~24KB)
│       ├── LoadingScreen.tsx            # Tela de carregamento animada (Framer Motion)
│       ├── Modal.tsx                    # Wrapper genérico de modal reutilizável
│       ├── ProdutoModal.tsx             # Modal para criar/editar produto (~26KB)
│       ├── Skeleton.tsx                 # Componente Skeleton para loading placeholder
│       └── VendedorModal.tsx            # Modal de detalhes do vendedor (~10KB)
│
├── contexts/
│   ├── AuthContext.tsx                  # Contexto de autenticação: login, logout, RBAC, perfil admin/funcionário
│   └── ThemeContext.tsx                 # Contexto de tema: dark/light mode com persistência
│
├── hooks/
│   ├── useAcertos.ts                   # Hook para acertos de vendedores (CRUD + React Query)
│   ├── useAcertosDiarios.ts            # Hook para acertos diários (listagem, filtros)
│   ├── useAdicionarClienteAdmin.ts     # Hook para adicionar clientes diretamente como admin
│   ├── useCestas.ts                    # Hook para cestas de vendedor (CRUD, itens, entrega ~11KB)
│   ├── useClientes.ts                  # Hook para clientes (CRUD, busca, filtros ~15KB)
│   ├── useCountUp.ts                   # Hook de animação: contagem progressiva de números
│   ├── useDashboard.ts                 # Hook agregador do dashboard (~30KB): estatísticas, top vendedores, faturamento mensal, alertas de estoque
│   ├── useEntregas.ts                  # Hook para entregas (CRUD, busca, filtros ~15KB)
│   ├── useEstoque.ts                   # Hook básico de referência para estoque
│   ├── useFluxoCaixa.ts                # Hook para fluxo de caixa (lançamentos, saldo, filtros ~7KB)
│   ├── useFuncionarios.ts              # Hook para funcionários (CRUD, permissões, auth signUp com client isolado)
│   ├── useMovimentacoesEstoque.ts       # Hook para movimentações de estoque (entradas/saídas/ajustes)
│   ├── useNotasFiscais.ts              # Hook para notas fiscais (listagem, status de emissão)
│   ├── useOrcamentosPJ.ts             # Hook para orçamentos PJ (CRUD, aprovação, rejeição ~5KB)
│   ├── usePagamentos.ts               # Hook para pagamentos (CRUD, filtros, totais ~6KB)
│   ├── useProdutos.ts                  # Hook para produtos (CRUD, categorias, busca ~7KB)
│   ├── useResponsaveis.ts             # Hook para lista de responsáveis (select simplificado)
│   ├── useSuporteSolicitacoes.ts       # Hook para solicitações de suporte (CRUD, mensagens)
│   ├── useTabelaPrecos.ts             # Hook para tabela de preços atacado (CRUD)
│   ├── useVendasAtacado.ts            # Hook para vendas atacado (CRUD, detalhes, stats ~10KB)
│   └── useVendedores.ts               # Hook para vendedores (CRUD, busca por filtros ~6KB)
│
├── lib/
│   ├── supabase.ts                     # Cliente Supabase: configuração, tipos globais (Cliente, Vendedor, etc.) ~4KB
│   ├── supabaseCache.ts                # Wrapper de cache para queries Supabase (useSupabaseQuery) ~7KB
│   ├── utils.ts                        # Utilitário cn() para merge de classes (clsx + tailwind-merge)
│   │
│   ├── cache/
│   │   ├── cacheConfig.ts              # QueryClient global: retry, staleTime, gcTime, funções de invalidação
│   │   ├── indexedDBPersister.ts        # Persistência do cache no IndexedDB (idb-keyval)
│   │   ├── persistConfig.ts            # Configurações de persistência offline
│   │   ├── prefetch.ts                 # Funções de pré-carregamento de dados essenciais
│   │   └── validateCache.ts            # Validação e limpeza de cache obsoleto/corrompido
│   │
│   └── constants/
│       ├── pagination.ts               # Constantes de paginação (itens por página)
│       └── queryKeys.ts                # Chaves de cache centralizadas (60+ keys), CACHE_TIMES por entidade
│
├── pages/
│   ├── Dashboard.tsx                   # Painel principal redesignado (sem espaços vazios): KPIs, gráficos, alertas (~20KB)
│   ├── LoginPage.tsx                   # Página de login com validação (~8KB)
│   ├── ChangePasswordPage.tsx          # Página para alteração de senha (~15KB)
│   ├── Configuracoes.tsx               # Configurações gerais do administrador (~25KB)
│   ├── ConfiguracoesFiscais.tsx        # Configurações fiscais (certificado, homologação) exclusivas para admin (~17KB)
│   ├── FuncionarioConfig.tsx           # Configurações do perfil do funcionário (~11KB)
│   ├── Funcionarios.tsx                # Gestão de funcionários: listagem, permissões (~12KB)
│   ├── Suporte.tsx                     # Central de suporte: solicitações e mensagens (~18KB)
│   │
│   ├── Vendedores.tsx                  # Listagem de vendedores com filtros (~21KB)
│   ├── NovoVendedor.tsx                # Formulário de criação de vendedor (~23KB)
│   ├── EditarVendedor.tsx              # Formulário de edição de vendedor (~27KB)
│   │
│   ├── Clientes.tsx                    # Listagem de clientes PF/PJ com busca (~24KB)
│   ├── Devedores.tsx                   # Painel de devedores com totais e filtros (~48KB)
│   │
│   ├── Produtos.tsx                    # Catálogo de produtos com categorias (~27KB)
│   ├── NovoProduto.tsx                 # Formulário de criação de produto (~32KB, inclui dados fiscais)
│   │
│   ├── CestasVendedor.tsx              # Gestão de cestas: listagem, entrega (modal), exclusão via RPC, coluna Estoque Mobile, atalho Entrega Avulsa (~40KB)
│   ├── NovaCesta.tsx                   # Criação de cesta com itens (~27KB)
│   ├── EditarCesta.tsx                 # Edição de cesta existente (~17KB)
│   │
│   ├── Entregas.tsx                    # Listagem de entregas cadastradas (histórico, edição, exclusão estornando estoque)
│   ├── NovaEntrega.tsx                 # Formulário legad/básico de criação de entrega
│   ├── EntregaAvulsa.tsx               # Fluxo completo de entregas avulsas multi-seleção com validação de estoque (~46KB)
│   │
│   ├── Pagamentos.tsx                  # Gestão de pagamentos com filtros e totais (~15KB)
│   ├── Relatorios.tsx                  # Relatórios analíticos consolidados (~86KB, maior arquivo do projeto)
│   │
│   ├── AcertosDiarios/
│   │   ├── ListaAcertos.tsx            # Listagem de acertos diários
│   │   └── NovoAcerto.tsx              # Formulário de novo acerto
│   │
│   ├── Caixa/
│   │   ├── FluxoCaixa.tsx              # Fluxo de caixa com saldo e lançamentos
│   │   └── LancamentoCaixa.tsx         # Formulário de lançamento (entrada/saída)
│   │
│   ├── Estoque/
│   │   ├── MovimentacoesEstoque.tsx     # Histórico de movimentações de estoque
│   │   └── RelatorioEstoque.tsx        # Relatório de posição de estoque atual
│   │
│   ├── orcamentos/
│   │   ├── ListaOrcamentos.tsx         # Listagem de orçamentos PJ
│   │   ├── NovoOrcamento.tsx           # Formulário de criação de orçamento
│   │   └── DetalhesOrcamento.tsx       # Detalhes de orçamento com ações (aprovar, rejeitar, emitir NF-e)
│   │
│   ├── TabelaPrecos/
│   │   └── TabelaAtacado.tsx           # Tabela de preços para vendas atacado
│   │
│   ├── VendasAtacado/
│   │   ├── ListaVendas.tsx             # Listagem de vendas atacado
│   │   ├── NovaVendaAtacado.tsx        # Formulário de nova venda atacado
│   │   └── DetalhesVendaAtacado.tsx    # Detalhes de venda atacado
│   │
│   ├── financeiro/                     # (vazio — reservado para futuro módulo financeiro)
│   ├── produtos/                       # (vazio — reservado para futuras sub-funcionalidades de produtos)
│   └── vendas/                         # (vazio — reservado para futuro módulo de vendas)
│
├── services/
│   ├── cestaService.ts                 # CestaService: CRUD de cestas, itens, preço automático (~15KB)
│   ├── clienteService.ts               # ClienteService: busca por admin, vendedor, filtros (~4KB)
│   ├── entregaService.ts               # EntregaService: CRUD de entregas, detalhes com cesta + itens (~26KB)
│   ├── nfeConfigService.ts             # nfeConfigService: `configurarEmpresaNFe()` (cert. Base64, senha, regime tributário, ambiente) + `buscarStatusCertificado()`
│   ├── nfeService.ts                   # nfeService: emissão de NF-e via Edge Function com fetch (JWT + apikey) (~2KB)
│   ├── pagamentoService.ts             # PagamentoService: CRUD de pagamentos, totais, filtros (~11KB)
│   ├── produtoService.ts               # ProdutoService: CRUD de produtos, tipos de movimentação (~8KB)
│   ├── validationService.ts            # ValidationService: validações de formulário (produto, cesta, CPF, email, telefone) (~7KB)
│   └── vendedorService.ts              # VendedorService: CRUD de vendedores, filtros, status (~7KB)
│
├── types/
│   └── estoque.ts                      # Interfaces TypeScript para estoque (EstoqueAtual, MovimentacaoEstoque) (~2KB)
│
└── utils/
    ├── consoleOverride.ts              # Sobrescreve console.log/warn/error em produção (~3KB)
    ├── currencyUtils.ts                # Formatação de moeda BRL: formatCurrency, parseCurrency, applyCurrencyMask (~2KB)
    ├── dateUtils.ts                    # Manipulação de datas UTC-3 (Brasília): toUTC3, startOfDay, formatDateForQuery (~3KB)
    ├── devToolsDetector.ts             # Detecção de DevTools abertas (proteção contra inspeção) (~5KB)
    ├── estoqueService.ts               # EstoqueService: reservas, disponibilidade, validações de cesta (~10KB)
    ├── supabaseErrorHandler.ts         # Handler centralizado de erros Supabase: mensagens amigáveis (~2KB)
    └── toast.ts                        # Wrapper para notificações (Sonner) (~1KB)
```

---

## Resumo de Contagem

| Categoria          | Quantidade | Observação                                           |
| :----------------- | :--------: | :--------------------------------------------------- |
| **Componentes**    |    26      | 5 raiz + 1 chart + 3 layout + 1 permissão + 16 UI   |
| **Páginas**        |    35      | 22 páginas soltas + 13 em subdiretórios              |
| **Hooks**          |    21      | Todos com React Query (useQuery/useMutation)         |
| **Services**       |     9      | Classes com métodos estáticos e de instância          |
| **Utilitários**    |     7      | Datas, moeda, estoque, erros, toast, segurança        |
| **Contextos**      |     2      | AuthContext + ThemeContext                             |
| **Lib/Cache**      |     5      | Config, persistência, prefetch, validação, keys       |
| **Lib/Constants**  |     2      | Paginação + 60+ query keys                            |
| **Types**          |     1      | Interfaces de estoque                                  |

> **Total de arquivos TypeScript/TSX no `src/`:** ~115 arquivos (atualizado em 07/03/2026)
