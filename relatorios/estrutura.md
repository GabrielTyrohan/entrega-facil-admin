# Estrutura do Projeto - Diretório `src`

Este documento detalha a organização profunda dos arquivos e diretórios dentro de `src/` do projeto `entrega-admin`, refletindo a arquitetura mais recente implementada em 29/01/2026.

## Árvore de Diretórios Completa

```
src/
├── assets/                  # Arquivos estáticos
│   └── icon.svg             # Ícone da aplicação
├── components/              # Componentes React reutilizáveis
│   ├── charts/              # Visualização de dados
│   │   └── StatusPagamentosPieChart.tsx
│   ├── layout/              # Estrutura da aplicação
│   │   ├── Header.tsx       # Barra superior (Perfil, Tema)
│   │   ├── MainLayout.tsx   # Wrapper principal (Sidebar + Content)
│   │   └── Sidebar.tsx      # Navegação lateral com lógica de permissão
│   ├── Permissoes/          # Controle de Acesso (RBAC)
│   │   └── RequirePermission.tsx # HOC para proteção granular
│   ├── ui/                  # Componentes de Interface (Design System)
│   │   ├── button.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── pagination.tsx   # Paginação unificada
│   │   ├── Skeleton.tsx     # Loading states
│   │   ├── Modal.tsx        # Base para modais
│   │   ├── LoadingScreen.tsx # Loading de tela cheia
│   │   ├── ClienteModal.tsx # Formulários específicos (Modais)
│   │   ├── EntregaModal.tsx
│   │   ├── ProdutoModal.tsx
│   │   ├── VendedorModal.tsx
│   │   ├── FuncionarioModal.tsx
│   │   └── EditClienteModal.tsx
│   ├── ErrorBoundary.tsx    # Captura de erros de renderização (React Error Boundary)
│   ├── PaymentStatusAutoChecker.tsx # Processo background de verificação de pagamentos
│   └── ProtectedRoute.tsx   # Guardião de rotas autenticadas
├── contexts/                # Gerenciamento de Estado Global (React Context)
│   ├── AuthContext.tsx      # Autenticação, Sessão e Permissões de Usuário
│   └── ThemeContext.tsx     # Gerenciamento de Tema (Dark/Light Mode)
├── hooks/                   # Custom Hooks (Lógica de Negócio e Data Fetching)
│   ├── useAcertos.ts        # Lógica de acertos financeiros
│   ├── useAcertosDiarios.ts # Hook modular para acertos de contas
│   ├── useFluxoCaixa.ts     # Gestão de fluxo de caixa (entradas/saídas)
│   ├── useVendasAtacado.ts  # Gestão de vendas atacado
│   ├── useOrcamentosPJ.ts   # Gestão de orçamentos corporativos
│   ├── useTabelaPrecos.ts   # Tabela de preços dinâmica
│   ├── usePagamentos.ts     # Gestão de pagamentos
│   ├── useEntregas.ts       # Gestão de entregas e logística
│   ├── useCestas.ts         # Controle de estoque de cestas
│   ├── useProdutos.ts       # CRUD de produtos
│   ├── useClientes.ts       # Gestão de base de clientes
│   ├── useVendedores.ts     # Gestão de equipe de vendas
│   ├── useFuncionarios.ts   # Gestão de usuários do sistema
│   ├── useDashboard.ts      # Agregação de dados para KPIs
│   ├── useCountUp.ts        # Animação de números (UI)
│   ├── useSuporteSolicitacoes.ts # Sistema de tickets
│   ├── useResponsaveis.ts   # Gestão de responsáveis
│   ├── useEstoque.ts        # Gestão básica de estoque
│   └── useMovimentacoesEstoque.ts # Gestão de entradas/saídas de estoque
├── lib/                     # Configurações e Utilitários de Infraestrutura
│   ├── cache/               # Estratégia de Cache Avançada (TanStack Query)
│   │   ├── cacheConfig.ts   # Configuração do QueryClient (Stale/GC times)
│   │   ├── indexedDBPersister.ts # Persistência offline via IndexedDB
│   │   ├── persistConfig.ts # Opções de persistência
│   │   ├── prefetch.ts      # Estratégias de pré-carregamento de dados
│   │   └── validateCache.ts # Validação de integridade do cache
│   ├── constants/           # Constantes do Sistema
│   │   ├── queryKeys.ts     # Centralização de chaves de cache (CACHE_KEYS)
│   │   ├── pagination.ts    # Configurações de paginação
│   ├── supabase.ts          # Cliente Supabase Singleton
│   ├── supabaseCache.ts     # Helpers para cache do Supabase
│   └── utils.ts             # Utilitários gerais do Shadcn/UI
├── pages/                   # Rotas da Aplicação (Organização Modular)
│   ├── AcertosDiarios/      # Módulo Financeiro: Acertos
│   │   ├── ListaAcertos.tsx
│   │   └── NovoAcerto.tsx
│   ├── Caixa/               # Módulo Financeiro: Fluxo de Caixa
│   │   ├── FluxoCaixa.tsx
│   │   └── LancamentoCaixa.tsx
│   ├── Estoque/             # Módulo de Estoque
│   │   ├── MovimentacoesEstoque.tsx
│   │   └── RelatorioEstoque.tsx
│   ├── orcamentos/          # Módulo Comercial: Orçamentos
│   │   ├── ListaOrcamentos.tsx
│   │   ├── NovoOrcamento.tsx
│   │   └── DetalhesOrcamento.tsx
│   ├── VendasAtacado/       # Módulo Comercial: Vendas Atacado
│   │   ├── ListaVendas.tsx
│   │   └── NovaVendaAtacado.tsx
│   ├── TabelaPrecos/        # Módulo Comercial: Preços
│   │   └── TabelaAtacado.tsx
│   ├── Configuracoes.tsx    # Configurações Globais
│   ├── FuncionarioConfig.tsx # Perfil do Funcionário (Novo)
│   ├── Dashboard.tsx        # Home / Visão Geral
│   ├── LoginPage.tsx        # Autenticação (Login)
│   ├── Relatorios.tsx       # Central de Relatórios
│   ├── Suporte.tsx          # Central de Ajuda
│   ├── Clientes.tsx         # Listagem de Clientes
│   ├── Vendedores.tsx       # Listagem de Vendedores
│   ├── Produtos.tsx         # Listagem de Produtos
│   ├── Entregas.tsx         # Listagem de Entregas
│   ├── Funcionarios.tsx     # Listagem de Funcionários
│   ├── Pagamentos.tsx       # Listagem de Pagamentos
│   ├── Devedores.tsx        # Controle de Inadimplência
│   ├── CestasVendedor.tsx   # Gestão de Cestas por Vendedor
│   ├── NovaCesta.tsx        # Cadastro de Cesta
│   ├── NovoProduto.tsx      # Cadastro de Produto
│   ├── NovoVendedor.tsx     # Cadastro de Vendedor
│   ├── EditarVendedor.tsx   # Edição de Vendedor
│   ├── ChangePasswordPage.tsx # Alteração de Senha
│   └── ... (Outras páginas de CRUD simples)
├── services/                # Camada de Serviços (Abstração de Dados)
│   ├── clienteService.ts    # Lógica de acesso a dados de clientes
│   ├── entregaService.ts    # Lógica de entregas
│   ├── pagamentoService.ts  # Lógica de pagamentos
│   ├── produtoService.ts    # Lógica de produtos
│   ├── vendedorService.ts   # Lógica de vendedores
│   ├── cestaService.ts      # Lógica de cestas
│   └── validationService.ts # Validações de negócio
├── utils/                   # Helpers e Funções Puras
│   ├── currencyUtils.ts     # Formatação de moeda (BRL)
│   ├── dateUtils.ts         # Manipulação de datas (date-fns)
│   ├── toast.ts             # Sistema de notificações
│   ├── supabaseErrorHandler.ts # Tratamento de erros de API
│   ├── devToolsDetector.ts  # Segurança (detecção de devtools)
│   ├── estoqueService.ts    # Serviço de Estoque
│   └── consoleOverride.ts   # Limpeza de logs em produção
├── App.tsx                  # Definição de Rotas e Providers
├── main.tsx                 # Ponto de Entrada (Bootstrapping)
└── vite-env.d.ts            # Definições de tipos do Vite
```

## Detalhamento Técnico dos Módulos Principais

### 1. `src/lib/cache/` (Estratégia de Cache e Persistência)
Este diretório contém a lógica vital para a performance da aplicação e funcionamento offline.
- **`cacheConfig.ts`**: Define o `QueryClient` com configurações globais de `staleTime` (tempo de frescor) e `gcTime` (tempo de coleta de lixo). Implementa lógica de retry exponencial.
- **`indexedDBPersister.ts`**: Utiliza `idb-keyval` para salvar o estado do cache no banco de dados do navegador (IndexedDB). Isso permite que a aplicação carregue instantaneamente mesmo sem rede.
- **`prefetch.ts`**: Contém funções para carregar dados antecipadamente (`prefetchTableData`), melhorando a percepção de velocidade ao navegar entre telas.

### 2. `src/services/` (Camada de Dados)
Implementa o padrão *Service Layer* para isolar a lógica de acesso ao Supabase dos componentes React.
- **Isolamento**: Cada serviço (ex: `ClienteService`) encapsula as queries SQL/PostgREST.
- **Injeção de Dependência**: Serviços podem receber `administradorId` para aplicar filtros de segurança (RLS no nível da aplicação) automaticamente.
- **Tratamento de Erros**: Centraliza o catch de erros antes de chegarem à UI.

### 3. `src/components/Permissoes/` (Controle de Acesso)
- **`RequirePermission.tsx`**: Um componente de *High Order* (HOC) que envolve partes da interface. Ele verifica as permissões do usuário logado (via `AuthContext`) e renderiza condicionalmente o conteúdo ou um fallback (ex: "Acesso Negado").

### 4. `src/pages/` (Modularização por Domínio)
As páginas complexas foram movidas de arquivos raiz para pastas dedicadas (`/AcertosDiarios`, `/Caixa`, `/orcamentos`). Isso agrupa:
- A listagem principal (`Lista...`)
- O formulário de criação/edição (`Novo...`)
- Subcomponentes específicos do domínio

### 5. `src/lib/constants/queryKeys.ts`
Arquivo crítico que atua como *Source of Truth* para todas as chaves de cache do React Query.
- Evita "Magic Strings" espalhadas pelo código.
- Define constantes como `CACHE_KEYS.VENDAS_ATACADO` e `CACHE_KEYS.DASHBOARD_STATS`.
- Define configurações de tempo de cache específicas (`CACHE_TIMES`) para entidades com diferentes volatilidades (ex: Produtos mudam pouco, Entregas mudam muito).
