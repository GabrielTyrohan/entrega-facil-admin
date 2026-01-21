# Relatório Técnico de Arquitetura Frontend

**Projeto:** Sistema de Gestão de Entregas (React + Supabase + React Query + Electron)
**Data:** 21/01/2026
**Versão:** 2.4

---

## 1. Stack Tecnológico Detalhado

A aplicação utiliza uma stack moderna focada em performance, tipagem estática e distribuição multiplataforma.

### Core
*   **Framework:** React 19.1.0
*   **Build Tool:** Vite
*   **Linguagem:** TypeScript (Strict Mode)
*   **Distribuição Desktop:** Electron 38.4.0 (com `electron-builder`)

### Gerenciamento de Estado & Dados
*   **Server State:** TanStack Query v5.90.12 (React Query)
    *   *Persistência:* `@tanstack/react-query-persist-client` + `idb-keyval` (IndexedDB)
    *   *DevTools:* Habilitado em ambiente de desenvolvimento
*   **Client State:** React Context API (`AuthContext`, `ThemeContext`)
*   **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
    *   *Client:* `@supabase/supabase-js` v2.58.0

### Interface (UI/UX)
*   **Estilização:** Tailwind CSS v3.4.1 + `tailwindcss-animate`
*   **Componentes:** Shadcn/UI (Radix UI primitives)
*   **Ícones:** Lucide React v0.460.0
*   **Gráficos:** Recharts v3.6.0 + Highcharts v12.4.0
*   **Utilitários:** `clsx`, `tailwind-merge`, `class-variance-authority`

---

## 2. Estratégia de Cache e Offline-First

A aplicação implementa uma estratégia robusta de **Offline-First** utilizando a persistência do React Query.

### Arquitetura de Cache (`src/lib/cache/`)
1.  **Persistência no IndexedDB:**
    *   Diferente do `localStorage` (limitado a ~5MB e síncrono), utilizamos o **IndexedDB** via `idb-keyval` para armazenar grandes volumes de dados de forma assíncrona.
    *   Isso permite que a aplicação carregue instantaneamente o estado anterior enquanto revalida os dados em background (*stale-while-revalidate*).

2.  **Configuração de Tempos (`staleTime` vs `gcTime`):**
    *   As configurações são definidas em `src/lib/constants/queryKeys.ts`.
    *   **Padrão:** `staleTime: 5 min` (dados considerados frescos), `gcTime: 30 min` (tempo em memória/disco).
    *   **Dados Estáticos (Produtos/Tabelas):** `staleTime: 10 min`, `gcTime: 30 min`.
    *   **Dados Voláteis (Entregas/Fluxo):** Seguem o padrão, mas com invalidação imediata em mutações.

3.  **Invalidação Inteligente:**
    *   O sistema utiliza invalidação cirúrgica. Ao criar uma venda, apenas as chaves `[CACHE_KEYS.VENDAS]` e `[CACHE_KEYS.DASHBOARD_STATS]` são invalidadas, forçando uma atualização apenas onde necessário.

---

## 3. Camada de Serviços e Segurança

### Service Layer Pattern (`src/services/`)
Para desacoplar a UI da lógica de banco de dados, utilizamos classes de serviço:
*   **Isolamento:** Componentes React nunca chamam `supabase.from(...)` diretamente para regras de negócio complexas.
*   **Injeção de Dependência:** Serviços como `ClienteService` são instanciados com o contexto do usuário (ex: `administradorId`), garantindo que os filtros de segurança sejam aplicados consistentemente.

### Segurança e Permissões
1.  **Proteção de Rotas:**
    *   `ProtectedRoute.tsx`: Verifica autenticação básica.
    *   `RequirePermission.tsx`: Verifica permissões granulares (ex: `can_edit_products`) dentro de componentes ou páginas.
    
2.  **Row Level Security (RLS):**
    *   A segurança final é garantida pelo banco de dados. O Supabase aplica políticas RLS baseadas no token JWT do usuário, impedindo acesso a dados de outros administradores/empresas mesmo que a aplicação frontend seja manipulada.

---

## 4. Performance e Otimizações Recentes

### Code Splitting e Lazy Loading
*   Bibliotecas pesadas como `html2pdf.js` e `xlsx` são importadas dinamicamente apenas quando a ação de exportação é acionada.
*   Isso mantém o bundle inicial leve ("Main Thread" desbloqueada).

### Renderização Otimizada
*   **Skeletons:** Uso extensivo de `src/components/ui/Skeleton.tsx` para evitar *Layout Shift* durante o carregamento inicial.
*   **Memoização:** Uso de `useMemo` para cálculos pesados em tabelas e gráficos (ex: agregação de totais no Dashboard).

---

## 5. Fluxo de Autenticação (`AuthContext`)

O contexto de autenticação é o "coração" da segurança no frontend:
1.  **Inicialização:** Verifica sessão existente no Supabase.
2.  **Hidratação do Perfil:** Busca dados estendidos na tabela `public.users` e `configuracoes_empresa`.
3.  **Gestão de Sessão:** Monitora eventos de `SIGNED_IN`, `SIGNED_OUT` e `TOKEN_REFRESHED` para manter a UI sincronizada.
