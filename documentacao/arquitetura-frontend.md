# Arquitetura Frontend

Este documento descreve as decisões arquiteturais, padrões de código, fluxos principais e módulos de negócio do frontend do projeto **Entrega Fácil Admin**.

**Data da última atualização:** 10/03/2026

---

## 1. Stack Tecnológico

O projeto é construído sobre uma stack moderna focada em performance, DX (Developer Experience) e distribuição desktop:

| Camada                      | Tecnologia                                                                                                          | Versão       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------ | :----------- |
| **Core**                    | [React](https://react.dev/) + [Vite](https://vitejs.dev/)                                                          | 19.1.0 / 5.x |
| **Linguagem**               | [TypeScript](https://www.typescriptlang.org/)                                                                       | ~5.9.2       |
| **Estilização**             | [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/) (Radix UI + CVA)                    | 3.4.x        |
| **Server State**            | [TanStack Query v5](https://tanstack.com/query/latest) + Persistência IndexedDB                                     | ^5.90        |
| **Client State**            | React Context API (Auth, Theme)                                                                                      | —            |
| **BaaS**                    | [Supabase](https://supabase.com/) (Auth, Database PostgreSQL, RLS, Edge Functions, Realtime)                         | ^2.58        |
| **Roteamento**              | [React Router DOM v7](https://reactrouter.com/) com `HashRouter`                                                    | ^7.9.2       |
| **Animações**               | [Framer Motion](https://www.framer.com/motion/)                                                                      | ^12.23       |
| **Gráficos**                | [Recharts](https://recharts.org/) + [Highcharts](https://www.highcharts.com/)                                       | 3.6 / 12.4   |
| **PDF**                     | [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) + [jsPDF](https://github.com/parallax/jsPDF) + jspdf-autotable | 0.12 / 4.2   |
| **Planilhas**               | [xlsx-js-style](https://github.com/gitbrent/xlsx-js-style)                                                          | ^1.2         |
| **Notificações (Toast)**    | [Sonner](https://sonner.emilkowal.dev/)                                                                              | ^2.0         |
| **Desktop**                 | [Electron](https://www.electronjs.org/) (empacotamento via electron-builder)                                          | ^38.4        |
| **Ícones**                  | [Lucide React](https://lucide.dev/)                                                                                  | ^0.460       |
| **Sanitização HTML**        | [DOMPurify](https://github.com/cure53/DOMPurify)                                                                     | ^3.3         |

---

## 2. Padrões de Código e Estrutura

### 2.1. Organização "Feature-First"

Embora existam diretórios raiz como `components/` e `hooks/`, o projeto agrupa funcionalidades relacionadas em subdiretórios específicos dentro de `pages/`:

| Módulo             | Subdiretório                      | Páginas          |
| :----------------- | :-------------------------------- | :--------------- |
| Acertos Diários    | `pages/AcertosDiarios/`           | Lista, Novo      |
| Caixa / Financeiro | `pages/Caixa/`                    | Fluxo, Lançamento|
| Estoque            | `pages/Estoque/`                  | Movimentações, Relatório |
| Orçamentos PJ      | `pages/orcamentos/`               | Lista, Novo, Detalhes |
| Tabela de Preços   | `pages/TabelaPrecos/`             | Atacado          |
| Vendas Atacado     | `pages/VendasAtacado/`            | Lista, Nova, Detalhes |

### 2.2. Custom Hooks (21 hooks)

Toda a lógica de negócio e comunicação com o Supabase é extraída para Custom Hooks no diretório `hooks/`.

- **Benefício:** Os componentes de UI (`.tsx`) ficam limpos, lidando apenas com apresentação.
- **Padrão:** Hooks retornam `{ data, isLoading, error, create, update, remove }` usando `useQuery` e `useMutation` do TanStack Query.
- **Cache por entidade:** Cada hook utiliza chaves de cache definidas em `lib/constants/queryKeys.ts` com tempos de `staleTime` e `gcTime` configurados por entidade.

### 2.3. Service Layer (8 services)

O projeto adota uma camada de serviços (classes TypeScript) que encapsulam chamadas diretas ao Supabase:

| Service               | Responsabilidade                                                |
| :-------------------- | :-------------------------------------------------------------- |
| `CestaService`        | CRUD de cestas, itens, cálculo de preço automático              |
| `ClienteService`      | Busca por admin (via join com vendedores), por vendedor, filtros |
| `EntregaService`      | CRUD de entregas (cestas e avulsas), estorno de estoque ao deletar/editar |
| `PagamentoService`    | CRUD de pagamentos com joins completos (cliente, vendedor, produto) |
| `ProdutoService`      | CRUD de produtos, verificação de código único, categorias       |
| `VendedorService`     | CRUD de vendedores, filtros, atualização de status              |
| `ValidationService`   | Validações de formulário: produto, cesta, CPF, email, telefone  |
| `nfeConfigService`    | Gestão de certificado PFX (conversão Base64), senha, regime tributário e ambiente (Homo/Prod); consulta status via `buscarStatusCertificado()`  |
| `nfeService`          | Emissão de NF-e via Supabase Edge Functions (fetch direto com JWT + apikey)         |

**Padrão:** Os services usam tanto métodos `static` (sem instância) quanto de instância (com `adminId` no construtor), dependendo da necessidade de contexto.

### 2.4. Utilitários (7 utils)

| Utilitário               | Responsabilidade                                                        |
| :----------------------- | :---------------------------------------------------------------------- |
| `dateUtils.ts`           | Manipulação de datas no timezone UTC-3 (Brasília)                       |
| `currencyUtils.ts`       | Formatação de moeda brasileira (BRL): máscara de input, parse, display  |
| `estoqueService.ts`      | Serviço completo de estoque: reservas, disponibilidade, validações       |
| `supabaseErrorHandler.ts`| Tradução de erros Supabase para mensagens amigáveis em português        |
| `toast.ts`               | Wrapper para a lib Sonner (notificações toast)                          |
| `consoleOverride.ts`     | Suprime logs (console.log/warn/error) em ambiente de produção           |
| `devToolsDetector.ts`    | Detecta abertura de DevTools do navegador (proteção anti-inspeção)      |

---

## 3. Segurança e Controle de Acesso

### 3.1. Proteção de Rotas

O componente `ProtectedRoute` envolve todas as rotas privadas dentro do `MainLayout`. Ele verifica:

1. Se o usuário está autenticado (`user !== null`).
2. Se o `isLoading` do AuthContext é falso (sessão verificada).

### 3.2. Controle Granular (RBAC — Role-Based Access Control)

O sistema possui **9 permissões** granulares, controladas pelo componente `RequirePermission` e pela interface `Permissoes`:

| Permissão               | Protege                                           |
| :----------------- | :------------------------------------------------- |
| `orcamentos_pj`    | Orçamentos PJ (lista, criação, detalhes)           |
| `vendas_atacado`    | Vendas Atacado + Tabela de Preços                  |
| `notas_fiscais`     | Emissão de notas fiscais (NF-e)                    |
| `caixa`             | Fluxo de Caixa + Estoque (movimentações, relatório)|
| `acertos`           | Acertos Diários (lista, criação)                   |
| `relatorios`        | Página de Relatórios Analíticos                    |
| `funcionarios`      | Gestão de Funcionários                              |
| `vendedores`        | Gestão de Vendedores                                |
| `configuracoes`     | Configurações administrativas gerais                |
| `configuracoes_fiscais` | Configurações Fiscais (certificado NF-e, regime tributário, ambiente) |

**Tipos de usuário:**
- **Admin (`userType = 'admin'`):** Acesso total a todas as 10 permissões e páginas exclusivas.
- **Funcionário (`userType = 'funcionario'`):** Acesso restrito conforme flags definidas pelo administrador no campo `permissoes` da tabela `funcionarios`. Não tem acesso a telas operacionais exclusivas do Admin.

### 3.3. Proteção no Frontend

- `RequirePermission`: componente wrapper que redireciona para `/dashboard` caso a permissão não exista.
- `Sidebar.tsx`: renderiza itens de menu dinamicamente com base nas permissões do usuário logado.

### 3.4. Proteção no Backend (Supabase)

- **RLS (Row Level Security):** Policies no PostgreSQL garantem que cada admin/funcionário acesse apenas seus próprios dados.
- **Edge Functions:** NF-e emitida via `supabase.functions.invoke()` com JWT do usuário logado.

---

## 4. Gerenciamento de Estado

### 4.1. React Query (Server State)

Usado para **todo** dado que vem do banco de dados (Supabase PostgreSQL).

- **QueryClient Global:** Configurado em `src/lib/cache/cacheConfig.ts`:
  - `staleTime`: 5 minutos (padrão — dados mantidos "frescos")
  - `gcTime`: 30 minutos (padrão — coleta de lixo do cache)
  - `retry`: 1 tentativa (com exponential backoff)
  - `refetchOnWindowFocus`: **desabilitado** (para evitar requests desnecessários)
  - `refetchOnReconnect`: **habilitado** (revalidar ao reconectar)
- **60+ Query Keys:** Centralizadas em `src/lib/constants/queryKeys.ts` com `CACHE_TIMES` por entidade.
- **Persistência:** Dados são salvos no IndexedDB via `idb-keyval` para funcionamento offline.
- **Prefetch:** Dados essenciais são pré-carregados ao detectar `adminId` disponível (`prefetch.ts`).

### 4.2. Estratégia de Relatórios (High-Volume Data)

Para a página `Relatorios.tsx` (~86KB — maior arquivo do projeto):

- **Bypass de Paginação:** Em vez de hooks padrão (paginados a 50 itens), utiliza queries manuais com `.limit(10000)`.
- **Filtragem Client-Side:** Busca o dataset completo e aplica filtros de data + cálculos de totais via `useMemo`.
- **Seções:** Financeiro Consolidado, Fluxo de Pagamentos, Vendas Atacado & PJ, Acertos Diários, Fluxo de Caixa.

### 4.3. Context API (Client State)

| Contexto          | Responsabilidade                                                              |
| :---------------- | :---------------------------------------------------------------------------- |
| `AuthContext`      | Dados do usuário logado, tipo (admin/funcionário), permissões, `adminId`       |
| `ThemeContext`     | Preferência de tema (Dark/Light mode) com persistência                         |

---

## 5. Fluxo de Autenticação (`AuthContext`)

O contexto de autenticação é o "coração" da segurança no frontend:

```
1. INICIALIZAÇÃO
   └─ supabase.auth.getSession() → verifica sessão existente
   └─ supabase.auth.onAuthStateChange() → listener para mudanças

2. HIDRATAÇÃO DO PERFIL (via useQuery com cache de 10 min)
   ├─ Busca em `administradores` (by user.id)
   │   └─ Se encontrou → type = 'admin', adminId = profile.id
   ├─ Se não encontrou → Busca em `funcionarios` (by auth_user_id + ativo)
   │   └─ Se encontrou → type = 'funcionario', adminId = profile.administrador_id
   └─ Se nenhum → throw Error('Usuário não autorizado')

3. DERIVAÇÃO (via useMemo — cálculo síncrono imediato)
   ├─ userType: 'admin' | 'funcionario'
   ├─ adminId: ID do administrador (próprio ou vinculado)
   └─ permissions: Permissoes (todas true para admin, campo JSON para funcionário)

4. PREFETCH AUTOMÁTICO
   └─ Ao detectar adminId → prefetchEssentialData(queryClient, adminId)

5. LOGOUT em caso de erro
   └─ Se profileError → toast.error() + signOut()
```

---

## 6. Roteamento

O projeto utiliza `HashRouter` do React Router DOM v7, com **30+ rotas** organizadas hierarquicamente:

### Rotas Públicas
| Rota        | Componente   |
| :---------- | :----------- |
| `/login`    | `LoginPage`  |

### Rotas Protegidas (dentro de `ProtectedRoute > MainLayout`)

| Rota                             | Componente             | Permissão Requerida |
| :------------------------------- | :--------------------- | :------------------ |
| `/dashboard`                     | `Dashboard`            | — (autenticado)     |
| `/vendedores`                    | `Vendedores`           | —                   |
| `/vendedores/novo`               | `NovoVendedor`         | —                   |
| `/vendedores/editar/:id`         | `EditarVendedor`       | —                   |
| `/produtos`                      | `Produtos`             | —                   |
| `/produtos/novo`                 | `NovoProduto`          | —                   |
| `/produtos/cestas`               | `CestasVendedor`       | —                   |
| `/produtos/cestas/nova`          | `NovaCesta`            | —                   |
| `/produtos/cestas/editar/:id`    | `EditarCesta`          | —                   |
| `/clientes`                      | `Clientes`             | —                   |
| `/entregas`                      | `Entregas`             | —                   |
| `/entregas/nova`                 | `NovaEntrega`          | —                   |
| `/entregas/avulsas`              | `EntregaAvulsa`        | — (autenticado)     |
| `/pagamentos`                    | `Pagamentos`           | —                   |
| `/devedores`                     | `Devedores`            | —                   |
| `/suporte`                       | `Suporte`              | —                   |
| `/configuracoes`                 | `Configuracoes`        | —                   |
| `/configuracoes-fiscais`         | `ConfiguracoesFiscais` | `configuracoes_fiscais` |
| `/funcionario-config`            | `FuncionarioConfig`    | —                   |
| `/funcionarios`                  | `Funcionarios`         | —                   |
| `/change-password`               | `ChangePasswordPage`   | —                   |
| `/estoque/movimentacoes`         | `MovimentacoesEstoque` | `caixa`             |
| `/estoque/relatorio`             | `RelatorioEstoque`     | `caixa`             |
| `/relatorios`                    | `Relatorios`           | `relatorios`        |
| `/orcamentos-pj`                 | `ListaOrcamentos`      | `orcamentos_pj`     |
| `/orcamentos-pj/novo`            | `NovoOrcamento`        | `orcamentos_pj`     |
| `/orcamentos-pj/:id`             | `DetalhesOrcamento`    | `orcamentos_pj`     |
| `/vendas-atacado`                | `ListaVendas`          | `vendas_atacado`    |
| `/vendas-atacado/nova`            | `NovaVendaAtacado`     | `vendas_atacado`    |
| `/vendas-atacado/:id`            | `DetalhesVendaAtacado` | `vendas_atacado`    |
| `/acertos-diarios`               | `ListaAcertos`         | `acertos`           |
| `/acertos-diarios/novo`          | `NovoAcerto`           | `acertos`           |
| `/caixa`                         | `FluxoCaixa`           | `caixa`             |
| `/caixa/lancamento`              | `LancamentoCaixa`      | `caixa`             |
| `/tabela-precos`                 | `TabelaAtacado`        | `vendas_atacado`    |

---

## 7. Módulos de Negócio

### 7.1. Dashboard

Painel principal com KPIs em tempo real:
- Interface recém-redesenhada sem espaços vazios ("dead space"), proporcionando melhor aproveitamento de tela e UX de alto nível.
- Vendedores ativos, entregas do mês (comparação mês atual vs anterior), faturamento mensal, valores em falta.
- Gráficos: faturamento mensal (12 meses), pagamentos mensais, top vendedores.
- Alertas de estoque baixo.
- Hook unificado: `useDashboardSummary` (~30KB) que agrega todas as estatísticas em uma única query.

### 7.2. Gestão de Vendedores

Sistema completo de CRUD e gerenciamento de vendedores:
- Listagem com filtros (nome, email, tipo vínculo, status ativo/inativo).
- Criação, edição e exclusão com validações.
- Suporte a tipo de vínculo.

### 7.3. Gestão de Clientes (PF + PJ)

- Clientes vinculados a vendedores, acessíveis pelo admin via join com tabela `vendedores`.
- Suporte a Pessoa Física e Pessoa Jurídica com modais separados (`ClienteModal`, `ClientePJModal`, `EditClienteModal`, `EditClientePJModal`).
- Busca por nome, CPF/CNPJ, e filtro por vendedor.

### 7.4. Gestão de Produtos e Estoque

- **Catálogo (`Produtos`):** Produtos com código, categoria, unidade de medida, dados fiscais (NCM, CEST, CFOP, PIS, COFINS, ICMS), fornecedor, estoque mínimo/máximo. Incorpora busca multi-palavras com normalização de acentos em tempo-real (Debounce de 500ms).
- **Estoque (`Estoque/`):** Módulo independente de inventário. Movimentações registradas como transações imutáveis (9 tipos: entrada_compra, entrada_devolucao, saida_venda, etc.).
- **Relatório de Estoque:** Visão consolidada da posição atual.

### 7.5. Gestão de Cestas

- Cestas são conjuntos de produtos montados para vendedores distribuírem.
- Fluxo: Criar cesta → Adicionar itens → Entregar a vendedor (debita estoque) → Registrar entregas.
- Criação e Edição de cestas (`NovaCesta`, `EditarCesta`), interagem dinamicamente limitando numericamente a cota máxima possível de envio a um vendedor com base no pior cenário de escassez (gargalo de estoque) dos ingredientes que compõem a cesta atual. O formulário bloqueia entradas acima da capacidade física. O campo de busca de itens agora emprega o filtro flexível `.normalize('NFD')` associado ao design pattern reativo em memória (`useMemo`).
- **Exclusão de Cestas:** A deleção utiliza a função RPC PostgreSQL `excluir_cesta` (SECURITY DEFINER), que contorna triggers e realiza a exclusão em cascata atomicamente. A UI exibe modal de confirmação com indicador de loading.
- **Coluna "Estoque Mobile":** A listagem de cestas exibe o campo `quantidade_disponivel` da tabela `estoque_vendedor`, com badge colorizado (verde/amarelo/vermelho) indicando a disponibilidade de cestas físicas para entrega imediata.
- **Acesso Rápido à Entrega Avulsa:** Botão de atalho laranja (`bg-orange-600`) no cabeçalho da tela de cestas navega diretamente para `/entregas/avulsas`.

### 7.6. Entregas (Cestas e Avulsas) e Pagamentos

- **Cestas (Nova Entrega):** O fluxo de "Nova Entrega" foi refatorado. Agora filtra restritivamente os clientes (apenas Pessoa Física) e exige a seleção de uma `Cesta Base` como payload ao invés de seleção rudimentar de produtos. Extrapola e renderiza os ingredientes na view extraídos em tempo-real do template pai, bloqueando invisivelmente itens que possam ter preço unitário zero no momento da renderização.
- **Entrega Avulsa:** Novo fluxo permitindo a seleção de múltiplos produtos independentes para entrega direta, que agora espelha a busca orgânica avançada normalizada por caracteres não-diacríticos e trava hard-coded a adição de itens "0,00".
- **Histórico e Estorno:** No gerenciamento de entregas, ao deletar ou editar uma entrega (seja cesta ou avulsa), o estoque dos produtos é automaticamente estornado via `estoqueService.transferir` com tipo `saida_venda`.
- Registro de pagamentos com formas: dinheiro, PIX, cartão, fiado.
- Verificação automática em background (`PaymentStatusAutoChecker`).
- Painel de devedores (`Devedores.tsx`, ~48KB) com totais e filtros completos.

### 7.7. Orçamentos PJ

- CRUD completo de orçamentos para Pessoa Jurídica. Adicionado campo de `forma_pagamento`.
- Exibição condicional inteligente do nome do cliente (nome + sobrenome para Pessoa Física com fallback nativo; Razão Social para Pessoa Jurídica).
- Fluxo de estados: pendente → aprovado / rejeitado.
- Emissão de NF-e (nota fiscal eletrônica) via Supabase Edge Functions, puxando dados fiscais dinamicamente.
- **Visualização DANFE:** PDF gerado front-end (`html2pdf.js`) com substituição de placeholders por código de barras real (`react-barcode`) com correção anti-overflow, contendo a chave de acesso da nota autorizada vinculada.

### 7.8. Vendas Atacado

- Módulo dedicado para vendas em grande volume.
- Tabela de preços específica para atacado.
- Listagem, criação e detalhamento de vendas.
- Permissão `vendas_atacado` controla acesso.

### 7.9. Acertos Diários

- Registro de acertos financeiros diários de vendedores.
- Listagem com filtros e criação de novos acertos.
- Permissão `acertos` controla acesso.

### 7.10. Fluxo de Caixa

- Lançamentos de entrada e saída.
- Saldo consolidado.
- Paginação de lançamentos (15 itens/página).
- Permissão `caixa` controla acesso.

### 7.11. Relatórios Analíticos

O maior módulo do projeto (`Relatorios.tsx`, ~86KB):
- **Financeiro Consolidado:** Agrega entregas, vendas atacado, orçamentos PJ aprovados, acertos diários, lançamentos de caixa.
- **Fluxo de Pagamentos:** Tabela unificada com pagamentos de entregas e vendas atacado em ordem cronológica.
- **Vendas Atacado & PJ:** Dashboard corporativo e atacado.
- **Geração de PDF:** Via `html2pdf.js` e `jsPDF` (lazy loading).
- **Exportação Excel:** Via `xlsx-js-style` (lazy loading).

### 7.12. Funcionários e Segurança Autenticada

- CRUD de funcionários com atribuição granular de permissões (9 flags).
- Perfil de funcionário dedicado (`FuncionarioConfig`) para autogerenciamento de dados pessoais.
- Validação dupla: frontend (RequirePermission) + backend (RLS do Supabase).
- **Criação de Contas:** Novo funcionário é criado via `signUp()` com um cliente Secundário Supabase (sem persistência de sessão), que impede a invalidação da sessão do administrador.
- **Autenticação Interceptadora (Bloco Anti-Loop):** O roteamento contornou o "Glitch de Loop Visual". A validação rigorosa de funcionários recém-desativados intercede a requisição de credenciais e encerra precocemente via `supabase.auth.signOut()` *antes* de injetar a navegação para `/dashboard`, exibindo os banners de bloqueio no próprio form estático da `LoginPage`.
- **Segurança de Senha:** A senha provisória gerada exige 8 caracteres alfanuméricos (incluindo número, letras em maiúsculo e minúsculo) para compatibilidade nativa com o Supabase Auth.

### 7.13. Suporte

- Central de suporte com solicitações e mensagens.
- Troca de mensagens entre admin/funcionário e sistema.

### 7.14. NF-e (Notas Fiscais Eletrônicas) e Configurações Fiscais

- **Configurações Fiscais:** Página acessível página via permissão `configuracoes_fiscais` (ao invés de verificação de tipo de usuário hard-coded), permitindo que o administrador delegue este acesso a funcionários específicos. Realiza upload do certificado OA1/PFX (armazenado em Base64 no banco via `nfeConfigService.ts`), além da definição do CNPJ, UF, Senha, Regime Tributário (`1`=Simples Nacional, `2`=Lucro Presumido, `3`=Lucro Real) e Ambiente (Homologação/Produção).
- **`nfeConfigService.ts`:** Expõe duas funções: `configurarEmpresaNFe()` (faz POST para a Edge Function `configurar-empresa-nfe` com o payload completo incluindo `regimeTributario`) e `buscarStatusCertificado()` (consulta a tabela `administradores` para verificar se o certificado está configurado, a validade e as configurações de ambiente).
- **`nfeService.ts`:** Emitte NF-e via Edge Function `emitir-nfe` usando `fetch` direto. O header agora inclui tanto `Authorization: Bearer <JWT>` quanto `apikey: <VITE_SUPABASE_ANON_KEY>`, garantindo autenticação dupla para a Edge Function.
- Integrado ao fluxo de orçamentos PJ com verificação se já existe nota autorizada para o documento.

---

## 8. Empacotamento e Distribuição

O projeto suporta distribuição como:

1. **Aplicação Web (SPA):** `npm run dev` / `npm run build`
2. **Aplicação Desktop (Electron):**
   - Os arquivos base da configuração localizam-se na pasta raiz `c:\entrega-admin\electron\` (ex: entry point empacotador Chromium em `electron/main.cjs`).
   - Binários zipados e compilações em cache armazenam-se localmente na pasta utilitária `c:\entrega-admin\electron-cache\` (ex: `electron-v38.4.0-win32-x64.zip`, gerando o setup final `Entrega Fácil Admin-1.0.0-win.zip`).
   - Desenvolvimento: `npm run electron:dev` (Vite + Electron concorrentes)
   - Build de Produção: `npm run electron:build:win` (gera pacote executável offline isolado para Windows x64 via electron-builder)
   - AppId: `com.entregafacil.admin`

---

## 9. Convenções Importantes

1. **HashRouter:** Utilizado em vez de `BrowserRouter` para compatibilidade com Electron (file:// protocol).
2. **Migração de Cache:** Na inicialização (`App.tsx`), o app verifica se caches antigos do LocalStorage precisam ser removidos (migração para IndexedDB).
3. **Sonner (Toast):** Posicionado globalmente no `App.tsx` (`<Toaster position="top-right" richColors />`).
4. **Console Override em Produção:** `consoleOverride.ts` suprime logs para não expor informações sensíveis.
5. **DevTools Detector:** `devToolsDetector.ts` detecta abertura do DevTools do navegador.
6. **Timezone:** Todas as operações de data usam UTC-3 (Brasília) via `dateUtils.ts`.
7. **Moeda:** Todas as formatações de valor usam `currencyUtils.ts` (BRL com `Intl.NumberFormat`).
