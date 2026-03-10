# Histórico de Alterações e Detalhamento Técnico

**Data da última atualização:** 09/03/2026  
**Autor:** Assistant (Documentação gerada via Antigravity)

Este documento registra detalhadamente as alterações realizadas no código fonte (`src/`) e na estrutura do projeto organizadas cronologicamente.

---

## Índice Rápido

1. [Estado Atual do Projeto (07/03/2026)](#1-estado-atual-do-projeto-07032026)
2. [Funcionalidades Implementadas](#2-funcionalidades-implementadas-catálogo-completo)
3. [Alterações Recentes (10/03/2026)](#3-alterações-recentes-10032026)
4. [Alterações Anteriores (05/03 a 09/03/2026)](#4-alterações-anteriores-0503-a-09032026)
4. [Alterações de 04/03 e 05/03/2026](#4-alterações-de-0403-e-05032026)
5. [Alterações de 03/03/2026](#5-alterações-de-03032026)
6. [Alterações Anteriores (01/03 a 02/03/2026)](#6-alterações-anteriores-0103-a-02032026)
7. [Correções Críticas Acumuladas](#7-correções-críticas-acumuladas-bug-fixes)
8. [Estrutura de Documentação](#8-estrutura-de-documentação)

---

## 1. Estado Atual do Projeto (10/03/2026)

### Visão Geral

| Métrica                  | Valor            |
| :----------------------- | :--------------- |
| Versão do pacote         | 1.0.0            |
| Framework                | React 19.1.0     |
| Build tool               | Vite 5.x         |
| Linguagem                | TypeScript ~5.9.2|
| Arquivos `.ts/.tsx` em `src/` | ~115        |
| Custom Hooks             | 21               |
| Services                 | 9                |
| Utilitários              | 7                |
| Páginas                  | 35               |
| Componentes              | 26               |
| Rotas no roteador        | 32+              |
| Permissões RBAC          | 10               |
| Chaves de cache          | 60+              |
| Desktop (Electron)       | Sim (Windows x64)|

---

## 2. Funcionalidades Implementadas (Catálogo Completo)

### 2.1. Dashboard (`Dashboard.tsx`)
- Painel principal com KPIs: vendedores ativos, entregas do mês, faturamento, valores em falta.
- Comparação mês atual vs mês anterior com cálculo de percentual.
- Gráficos: faturamento mensal (12 meses), pagamentos mensais, top vendedores por entregas e valor.
- Alertas de estoque baixo (integrado com módulo de estoque).
- Hook unificado `useDashboardSummary` (~30KB) para evitar waterfall de queries.

### 2.2. Gestão de Vendedores (`Vendedores.tsx`, `NovoVendedor.tsx`, `EditarVendedor.tsx`)
- CRUD completo de vendedores vinculados ao administrador.
- Listagem com filtros: nome, email, tipo de vínculo, status (ativo/inativo).
- Formulários de criação (~23KB) e edição (~27KB) com validações.

### 2.3. Gestão de Clientes (`Clientes.tsx`)
- Suporte a Pessoa Física (PF) e Pessoa Jurídica (PJ).
- 4 modais dedicados: `ClienteModal`, `ClientePJModal`, `EditClienteModal`, `EditClientePJModal`.
- Clientes vinculados a vendedores; admin acessa via join com tabela `vendedores`.
- Busca por nome, CPF/CNPJ, filtro por vendedor.

### 2.4. Gestão de Produtos (`Produtos.tsx`, `NovoProduto.tsx`)
- Catálogo com dados completos: código, nome, categoria, preço unitário, estoque, unidade de medida.
- Campos fiscais: NCM, CEST, CFOP padrão, CST PIS/COFINS/ICMS com alíquotas.
- Campos de gestão: fornecedor principal, última compra, estoque mínimo/máximo.
- Verificação de código único por administrador.

### 2.5. Gestão de Cestas (`CestasVendedor.tsx`, `NovaCesta.tsx`, `EditarCesta.tsx`)
- Cestas = conjuntos de produtos para distribuição por vendedores.
- Criação com cálculo automático de preço total baseado nos itens.
- Entrega de cesta via modal: debita estoque via `produtos_cadastrado` e registra em `entregas_cestas_vendedor`.
- Edição de cestas existentes (alteração de itens).
- Contadores de entregas por cesta na listagem.

### 2.6. Entregas (`Entregas.tsx`, `NovaEntrega.tsx`)
- Registro de entregas refatorado:
  - Seleção de Cliente restrita dinamicamente a Pessoa Física (PF) e exibindo o nome completo.
  - O fluxo agora exige a seleção de uma Cesta Base como pacote matriz (ao invés de produtos soltos).
- `EntregaService` com busca detalhada (itens da cesta + itens adicionais + totais).
- Listagem com filtros: vendedor, status pagamento, data, nome do cliente.
- Integração com parse de endereço completo em componentes.

### 2.7. Pagamentos (`Pagamentos.tsx`)
- Gestão de pagamentos com joins completos (cliente, vendedor, produto).
- Filtros: vendedor, forma de pagamento, data, nome do cliente.
- Totais calculados.
- `PaymentStatusAutoChecker.tsx`: verificação automática em background.

### 2.8. Devedores (`Devedores.tsx`)
- Painel consolidado (~48KB) de clientes com pagamentos pendentes.
- Totais de valores em falta com filtros avançados.

### 2.9. Orçamentos PJ (`orcamentos/`)
- CRUD completo: lista, criação, detalhes.
- Fluxo de estados: pendente → aprovado / rejeitado.
- Emissão de NF-e integrada via Edge Functions do Supabase.
- Hook: `useOrcamentosPJ`.

### 2.10. Vendas Atacado (`VendasAtacado/`)
- Módulo dedicado para vendas de alto volume.
- Lista, criação e detalhamento.
- Tabela de preços específica (`TabelaPrecos/TabelaAtacado.tsx`).
- Hook: `useVendasAtacado` (~10KB) com estatísticas.

### 2.11. Acertos Diários (`AcertosDiarios/`)
- Registro de acertos financeiros diários de vendedores.
- Listagem com filtros e formulário de criação.
- Hook: `useAcertosDiarios`.

### 2.12. Fluxo de Caixa (`Caixa/`)
- Lançamentos de entrada e saída com saldo consolidado.
- Paginação (15 itens/página).
- Hook: `useFluxoCaixa` (~7KB).

### 2.13. Módulo de Estoque (`Estoque/`)
- Movimentações registradas como transações imutáveis.
- 9 tipos de movimentação: entrada (compra, devolução, ajuste, transferência) e saída (venda, perda, ajuste, devolução, transferência).
- Relatório de posição atual do estoque.
- Reservas de estoque para cestas via `estoqueService.ts`.
- Hooks: `useEstoque`, `useMovimentacoesEstoque`.

### 2.14. Relatórios Analíticos (`Relatorios.tsx`)
- Maior arquivo do projeto (~86KB).
- **Financeiro Consolidado:** entregas, vendas atacado, orçamentos PJ aprovados, acertos diários, lançamentos de caixa.
- **Fluxo de Pagamentos:** tabela unificada cronológica.
- **Vendas Atacado & PJ:** dashboard corporativo.
- Bypass de paginação para integridade de dados (queries com `.limit(10000)`).
- Exportação PDF (html2pdf.js, jsPDF) e Excel (xlsx-js-style) com lazy loading.

### 2.15. Funcionários (`Funcionarios.tsx`, `FuncionarioConfig.tsx`)
- CRUD de funcionários com 9 permissões granulares.
- Modal de criação/edição (`FuncionarioModal.tsx` ~12KB).
- Perfil de funcionário (`FuncionarioConfig.tsx`) para autogerenciamento.
- Validação dupla: frontend + RLS Supabase.

### 2.16. Autenticação e Segurança
- Login via Supabase Auth (`LoginPage.tsx`) com mensagens de erro traduzidas.
- Contexto `AuthContext` com detecção automática de tipo (admin/funcionário).
- `ProtectedRoute` + `RequirePermission` para controle de acesso.
- `ChangePasswordPage` para alteração de senha.
- Supressão de console em produção + detecção de DevTools.

### 2.17. Suporte (`Suporte.tsx`)
- Central de solicitações e troca de mensagens.
- Hook: `useSuporteSolicitacoes`.

### 2.18. NF-e (`nfeService.ts`)
- Emissão de notas fiscais eletrônicas.
- Chamada direta via `fetch` para Supabase Edge Functions com JWT.

---

## 3. Alterações Recentes (10/03/2026)

### 3.1. Bloqueio de Inclusão de Produtos Zerados
- Nas telas que utilizam o catálogo de busca para montagem de matrizes ou entregas (`NovaCestaBase`, `EditarCestaBase`, `EditarCesta` e `EntregaAvulsa`), os produtos cujo `preco_unt` seja menor ou igual a zero (0,00) agora estão bloqueados para inclusão. O botão exibe "Valor zerado" de forma estática, prevenindo a criação de cestas irregulares sem preço agregado.
- Esse bloqueio é respeitado rigorosamente a nível de UI impedindo o clique e também na camada lógica do state de montagem.

### 3.2. Refatoração Total de `NovaEntrega.tsx`
- **Fluxo de Cesta Base:** A seleção avulsa de produtos foi substituída por um agregador que obriga a seleção prévia de um template de `Cesta Base`. Ao selecionar a cesta, a matriz se expande no carrinho exibindo os produtos contidos, permitindo a edição das quantidades.
- **Filtro de Clientes PF:** A primeira etapa de seleção de clientes engessa a visualização exclusiva para cadastros de Pessoa Física (tipo_pessoa === 'PF'), extraindo nome + sobrenome formatados de forma inteligente pela propriedade calculada `useMemo`.
- Correção crítica da ausência do hook `useVendedoresByAdmin`, reconstruindo a lista na etapa de finalização de entregas.
- O filtro inteligente de componentes garante que eventuais produtos de valor "0,00" atrelados à Cesta Base matriz sejam descartados silenciosamente na montagem do carrinho da entrega.

### 3.3. Melhorias na Busca (`EntregaAvulsa.tsx`)
- A lógica de pesquisa complexa (normalização NFD, remoção de acentos/diacríticos, caixa baixa e quebra por palavras array "every") original da tela de `EditarCesta` foi clonada e aplicada nativamente na tela de `EntregaAvulsa`. O input agora acha fragmentos agnósticos (ex: 'arroz 5kg').

### 3.4. Bloqueio Antecipado para Funcionários Inativos (`LoginPage.tsx`)
- Correção de roteamento na tela de login: se um funcionário que tenha sua coluna "ativo" mascarada como `false` efetuar o login com credenciais corretas, o hook intercepta o fluxo *antes* do redirecionamento para o dashboard, exibe o toast estático de desativação global de acesso e encerra a sessão da API. Isso resolveu o problema de "loop de tela visível" onde o dashboard carregava brevemente antes da expulsão forçada.

### 3.5. Alinhamento Visual (`NovaCestaBase.tsx` e `NovaCesta.tsx`)
- Implementada compatibilidade na estilização visual da listagem reduzida de matrizes, a cor da badge de "Preço Sugerido" na `NovaCestaBase` foi adaptada para `text-blue-700` padronizando globalmente a identidade.

---

## 4. Alterações Anteriores (05/03 a 09/03/2026)

### 3.1. Exclusão de Cestas via RPC (`CestasVendedor.tsx` + `CestaService`)

- **Problema anterior:** Deleção de cestas era bloqueada por triggers e políticas de segurança do banco de dados que impediam a remoção em cascata.
- **Solução implementada:** O método `CestaService.deleteCesta()` in `cestaService.ts` foi refatorado para chamar a função PostgreSQL `excluir_cesta` via `supabase.rpc('excluir_cesta', { p_cesta_id })`. Essa função RPC executa com privilégios elevados (SECURITY DEFINER), contornando triggers de segurança e realizando a exclusão atomicamente.
- A UI em `CestasVendedor.tsx` recebeu um modal de confirmação de deleção com estado `cestaParaExcluir` e feedback de loading (`isDeleting`).
- Tratamento de erro exibe `err.message` retornado diretamente do banco, garantindo mensagens descritivas ao usuário.

### 3.2. Nova Coluna "Estoque Mobile" na Listagem de Cestas (`CestasVendedor.tsx`)

- Adicionada coluna **"Estoque Mobile"** na tabela de cestas, que exibe o campo `quantidade_disponivel` da tabela `estoque_vendedor`.
- A coluna usa badge colorizado com semáforo:
  - 🔴 Vermelho: quantidade = 0 (sem estoque)
  - 🟡 Amarelo: quantidade ≤ 3 (estoque crítico)
  - 🟢 Verde: quantidade > 3 (estoque OK)
- Caso o campo seja `null` (nenhum registro na tabela `estoque_vendedor`), exibe o texto itálico "Não definido".

### 3.3. Botão de Atalho para Entrega Avulsa em CestasVendedor

- Adicionado botão **"Entrega Avulsa"** (cor laranja/`bg-orange-600`) no cabeçalho da tela de cestas, ao lado do botão "Nova Cesta".
- O botão navega diretamente para `/entregas/avulsas`, facilitando o acesso ao fluxo de entregas avulsas sem sair da tela de cestas.

### 3.4. Atualização da Rota de Entregas Avulsas (`App.tsx`)

- A rota `/entregas/avulsa` foi **corrigida e renomeada** para `/entregas/avulsas` (plural) no `App.tsx`, evitando inconsistência entre o link no Sidebar e a rota registrada.
- O componente `EntregaAvulsa` agora é acessado via `path="/entregas/avulsas"`.

### 3.5. Nova Permissão RBAC: `configuracoes_fiscais` (`App.tsx`)

- A rota `/configuracoes-fiscais` foi atualizada para usar `RequirePermission` com a permissão `"configuracoes_fiscais"` em vez de verificação direta de `userType === 'admin'`.
- Isso permite que administradores concedam acesso às configurações fiscais a funcionários específicos via o sistema RBAC padrão, tornando o controle de acesso mais granular e consistente com os demais módulos protegidos.
- **Antes:** Verificação hard-coded de tipo de usuário (apenas Admin).
- **Depois:** `<RequirePermission permission="configuracoes_fiscais" redirectTo="/dashboard">`.

### 3.6. `nfeConfigService.ts` — Novas Funcionalidades

- **Campo `regimeTributario`:** O payload enviado à Edge Function `configurar-empresa-nfe` agora inclui o campo `regimeTributario` com tipo `1 | 2 | 3` (Simples Nacional, Lucro Presumido, Lucro Real).
- **Nova função `buscarStatusCertificado()`:** Permite consultar o status atual do certificado NF-e do administrador autenticado, retornando os campos `nfe_certificado_configurado`, `nfe_certificado_validade`, `nfe_ambiente` e `nfe_regime_tributario` da tabela `administradores`.

### 3.7. `nfeService.ts` — Injeção da `apikey` no Header

- O `fetch` para a Edge Function `emitir-nfe` agora inclui o header `'apikey': supabaseAnonKey` além do `Authorization: Bearer <JWT>`.
- Isso garante que a Edge Function receba os dois headers obrigatórios para autenticação no Supabase, resolvendo problemas de rejeição de requests em ambientes onde somente o JWT não era suficiente para autenticar corretamente.

### 3.8. Melhorias no Dashboard (`Dashboard.tsx`)

- **Componente `EstoqueAlertsCard`:** Exibição de alertas de estoque reformulada como componente dedicado com altura fixa (`h-96`) e scroll interno. Exibe badge colorizado por severidade (`ZERADO` → vermelho, `ABAIXO_MINIMO` → laranja).
- **Relógio em Tempo Real:** O Dashboard agora exibe a data e hora atualizada a cada 60 segundos via `setInterval` no `useEffect`.
- **Hook `useCountUp`:** Os valores de faturamento e valores em falta são animados via `useCountUp`, criando efeito de contagem progressiva ao carregar a página.
- **Layout responsivo aprimorado:** Os cards de "Top Vendedores" e "Alertas de Estoque" ficam lado a lado em telas `xl` (via `grid-cols-1 xl:grid-cols-2`), maximizando o aproveitamento da tela em monitores widescreen.

### 3.9. Melhorias de Busca e Filtros Normalizados (`Produtos.tsx`, `NovaCesta.tsx` e `EditarCesta.tsx`)
- **Contexto:** Buscas por produtos ou cestas eram atreladas à tipografia idêntica do banco de dados e não ignoravam acentos (ex: "Macarrão" não encontrava "MACARRAO").
- **Solução Utilitária (`normalizar`):** Implementação de função agnóstica de filtragem via `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`.
- **Busca Multi-Palavras:** No catálogo de `Produtos`, foi introduzida a separação de termos (`split(/\s+/)`) aliada ao iterador `Array.every()` no state em memória gerado via `useMemo(...)`, permitindo buscar fragmentos mistos em qualquer ordem descritiva da string unificada  (ex: "arroz 5kg").
- **Performance de Digitação:** Adicionado _Debounce_ de 500ms atrelado ao ciclo de atualizações do input para evitar sobrecarga de requisições encabeçadas nos providers Supabase em cada tecla pressionada.

### 3.10. Validação de Estoque Dinâmica (`NovaCesta.tsx`)
- Adicionada lógica de bloqueio autolimitante na quantidade máxima do campo "Qtd. Cestas para Vendedor" (a quantidade que o usuário envia fisicamente), baseando-se no estoque restritivo dos ingredientes/produtos inseridos na cesta.
- A aplicação utiliza `useMemo` para monitorar qual item da cesta é o causador do "gargalo logístico" limitador e o define matematicamente validando todas as instâncias em lote: `Math.floor(produto.qtd_estoque / item.quantidade)`.
- A UI também foi atualizada para travar reativamente o input em seu limite máximo possível em tempo-real (conforme o preenchimento de itens afeta o limite superior global) e exibir dinamicamente o _Nome_ explícito do item faltante responsável caso estoure no alerta vermelho.

### 3.11. Centralização do Bloqueio de Login (`AuthContext.tsx` e `LoginPage.tsx`)
- **Funcionários Inativos e Admins Inadimplentes:** A lógica de bloqueio de autenticação que estava fragmentada nos fluxos de páginas foi rigorosamente centralizada dentro da validação mestre `queryFn` ao inspecionar perfis pelo `AuthContext`.
- O login bem sucedido na camada da Auth API é imediatamente interceptado e bloqueado, arremessando forçadamente uma requisição assíncrona global de sessão encerrada com erro descritivo em `supabase.auth.signOut()` se detectados perfis como administrador cujo `status_pagamento` esteja _'inativo'_ ou funcionário recém revogado em _'ativo = false'_.
- **Exibição de Erros Customizada:** O formulário da `LoginPage` gerencia os trânsitos de strings de recusa do contexto da sessão indiretamente através de uma varredura de flash component em cache (`localStorage.getItem('loginErrorMsg')`). Assim que redirecionado à force, ele processa e cospe o aviso detalhado ao usuário ("PAGAMENTO_INATIVO", "ACESSO_DESATIVADO", etc) num banner vermelho estático, em detrimento do antigo `toast` que era varrido da memória volátil no re-route agressivo da RLS de rotas.

### 3.12. Versão Dinâmica no Frontend (`Sidebar.tsx` e `package.json`)
- **Problema anterior:** A versão base no roda-pé do sistema (Menu Lateral) encontrava-se com string estática encravada (hard-coded `"Versão 2.2.0"`), desvinculada do versionamento oficial de release da distribuição Desktop e Web contida na raiz do repositório NPM.
- **Solução implementada:** Injeção direta (`import packageJson from '../../../package.json'`) via módulo JSON do Vite Typescript. A tipografia flexibilizou o hook visual emitindo o reflexo constante em tempo-real do metadado master `packageJson.version`.
- **Alteração de Metadados:** Subida nominal do bump version pelo package (`1.0.1` -> `1.0.2`), complementada de payload na chave de exportação publish do electron (`"releaseType": "release"`).

---

## 4. Alterações de 04/03 e 05/03/2026

### 4.1. Novo Módulo: Entrega Avulsa (`EntregaAvulsa.tsx`)
- Implementado fluxo completo para venda/distribuição de produtos unitários para vendedores sem necessidade de criar uma "Cesta" fechada.
- Seleção múltipla de produtos com controle de quantidade.
- Integração com `estoqueService.transferir` debitando unidades do estoque (`produtos_cadastrado`) no momento da confirmação.
- Interface rica com validações e toasts descritivos (via Sonner).

### 4.2. Histórico de Entregas e Estorno de Estoque
- Funcionalidade de edição e exclusão de entregas retroativas incorporada nativamente na lista de Entregas (`Entregas.tsx`).
- Ao deletar uma entrega (cesta ou avulsa), o sistema invoca o estorno via `estoqueService` (`saida_venda` invertida) para devolver os itens ao inventário original, prevenindo perdas financeiras.

### 4.3. Configurações Fiscais e NF-e (`ConfiguracoesFiscais.tsx`)
- Criação de página restrita a administradores e do `nfeConfigService.ts`.
- Permite o upload do Certificado Digital (A1/PFX), com conversão automática segura para Base64 no frontend antes de salvar no Supabase.
- Configuração de senha do certificado, UF, CNPJ Emissor e switch de Ambiente (Homologação / Produção).
- Edge Functions preparadas para utilizar esses dados dinamicamente no XML.

### 4.4. Melhorias Visuais na DANFE (`DetalhesOrcamento.tsx`)
- Adicionada leitura e exibição da `chave_acesso` e XML/PDF da Tabela `notas_fiscais`.
- **Placeholder substituído:** O código de barras falso foi trocado pelo gerador real `react-barcode` renderizando a chave.
- **Correção de Layout (PDF html2pdf):**
  - Overflow do barcode resolvido (`width={0.6}`, `overflow: hidden`).
  - Coluna "CST" inserida na tabela de produtos dentro do template PDF, alinhando as 12 TH/TD para que a tabela não fique engolida.
  - Retirado o `minHeight` estático de 280px para que a tabela cresça dinamicamente, eliminando o vácuo ao fim da página.

### 4.5. Componentes Novos e UI Base
- Adição dos componentes Shadcn `command.tsx`, `dialog.tsx` e `popover.tsx` na pasta de UI para compor a nova estrutura da entrega avulsa (ComboBoxes de busca).
- Ajuste no `NovoOrcamento.tsx` para incluir o campo de `forma_pagamento`.

---

## 5. Alterações de 03/03/2026

### 4.1. Criação de Funcionários (Segurança e Auth)
- **Novo fluxo de Auth:** Refatoração do hook `useCreateFuncionario` para utilizar `supabase.auth.signUp()` ao invés de inserção via RPC SQL.
- **Sessão Segura:** Implementação de um cliente Secundário Supabase (sem persistência de sessão) exclusivamentre para o `signUp` do novo funcionário. Isso previne o "sequestro" de sessão, garantindo que o admin criador não seja deslogado.
- **Geração de Senha Segura:** O gerador de senhas provisórias em `FuncionarioModal.tsx` foi atualizado de 6 dígitos numéricos para **8 caracteres alfanuméricos randômicos**, exigindo sempre 1 maiúscula, 1 minúscula e 1 número para atender às políticas de segurança do Supabase Auth.

---

## 6. Alterações Anteriores (01/03 a 02/03/2026)

### 5.1. Redesign do Dashboard (`Dashboard.tsx`)
- Melhoria no layout e apelo visual da página inicial.
- Eliminação de espaços vazios ("dead space") para aproveitar melhor a área de tela.
- UX aprimorada com uma disposição mais fluida dos KPIs e gráficos.

### 4.2. Configurações Fiscais (`ConfiguracoesFiscais.tsx`)
- Nova página restrita exclusivamente a administradores.
- Acessível via menu lateral na seção de configurações.
- Tema escuro (Dark Mode) e componentes padronizados integrados.
- Suporte para upload manual de certificado e homologação automática.

### 4.3. Exibição de Nome de Clientes
- Lógica de exibição condicional implementada em `/orcamentos` (`ListaOrcamentos.tsx` e `DetalhesOrcamento.tsx`).
- Clientes Pessoa Física (PF) exibem _nome_ + _sobrenome_.
- Clientes Pessoa Jurídica (PJ) exibem _razao_social_.
- Integração refinada com o hook `useOrcamentosPJ`.

### 5.4. Correção de Tipagem no Sidebar (`Sidebar.tsx`)
- Solucionado erro TypeScript referente ao tipo `MenuItem[]`.
- Garantido que a propriedade `permission` obedeça o tipo `keyof Permissoes | undefined`.

---

## 7. Alterações Mais Antigas (Jan - Fev/2026)

### 6.1. Relatórios Avançados (`Relatorios.tsx`)
- **Financeiro Consolidado:** Nova seção que agrega entregas, vendas atacado, orçamentos PJ aprovados, acertos diários, lançamentos de caixa.
- **Fluxo de Pagamentos:** Tabela unificada com pagamentos de entregas e vendas atacado.
- **Vendas Atacado & PJ:** Dashboard específico para o setor corporativo.

### 3.2. Cestas — Entrega e Edição
- Modal de entrega em `CestasVendedor.tsx`: debita estoque automaticamente.
- Página `EditarCesta.tsx` para alterar itens em cestas existentes.
- Contadores de entregas na listagem.

### 3.3. Fluxo de Caixa — Melhorias
- Paginação de lançamentos (15 itens/página).
- Botão de confirmação direta na lista.

### 3.4. Bug Fix: Filtro "Último Ano" em Relatórios
- **Problema:** Dados incompletos ao selecionar "Último ano".
- **Causa:** Hooks paginados (limite de 50 itens) aplicavam filtro apenas na primeira página.
- **Solução:** Queries manuais com `.limit(10000)` e filtragem client-side.

### 3.5. Bug Fix: TypeScript em Relatórios
- **Problema:** `Property 'cliente_nome' does not exist`.
- **Causa:** Query manual retornava objetos aninhados diferente do esperado.
- **Solução:** Ajuste para acessar propriedades aninhadas com fallbacks seguros.

### 3.6. Bug Fix: Permissões de Funcionário
- **Problema:** Lista de vendedores vazia ao criar cestas como funcionário.
- **Solução:** Refatoração para utilizar `adminId` do `AuthContext`.

---

## 5. Alterações de 29/01/2026

### 4.1. Autenticação e Contexto (`AuthContext.tsx`)
- Refatoração para uso de `useMemo` na derivação de `userType`, `adminId` e `permissions`.
- Garantia de `adminId` consistente para admin ou funcionário vinculado.

### 4.2. Módulo de Estoque
- Implementação inicial do sistema de controle de inventário.
- `MovimentacoesEstoque.tsx`: histórico de entradas e saídas.
- Tipos de movimentação: 9 opções (compra, devolução, ajuste, transferência, venda, perda).
- Separação de responsabilidades: Produtos (catálogo) vs Estoque (quantidade física).

### 4.3. Cache e Performance
- Migração LocalStorage → IndexedDB.
- Implementação de `PersistQueryClientProvider` em `main.tsx`.
- Prefetch automático de dados essenciais ao login.

---

## 7. Correções Críticas Acumuladas (Bug Fixes)

| #   | Problema                                  | Causa                                   | Solução                                  | Arquivo(s)       |
| :-: | :---------------------------------------- | :-------------------------------------- | :--------------------------------------- | :--------------- |
| 1   | Relatórios incompletos ("Último Ano")     | Paginação server-side (50 itens)        | Queries manuais com limit(10000)         | `Relatorios.tsx` |
| 2   | `Property 'cliente_nome' does not exist`  | Objetos aninhados em query manual       | Acesso correto a props aninhadas         | `Relatorios.tsx` |
| 3   | Funcionários não criavam cestas           | `adminId` incorreto em queries          | Uso de `adminId` do AuthContext          | `useCestas.ts`   |
| 4   | Loop de login                             | Token expirado + falha no refresh       | Verificar data/hora + limpar cookies     | `AuthContext.tsx` |
| 5   | Listas vazias (RLS)                       | Política RLS não permitia SELECT        | Adição de política para funcionários     | Supabase         |
| 6   | Constraint violation em orçamentos        | Constraint não incluía status 'rejeitado' | ALTER TABLE + nova constraint          | Supabase SQL     |

---

## 8. Estrutura de Documentação

A pasta `relatorios/` mantém o registro vivo do projeto:

| Arquivo                        | Descrição                                              |
| :----------------------------- | :----------------------------------------------------- |
| `manual-das-paginas.md`        | Manual detalhado das rotas do frontend para usuários.  |
| `estrutura.md`                 | Árvore de arquivos completa com descrições por arquivo  |
| `arquitetura-frontend.md`      | Stack, padrões, módulos, rotas, RBAC, fluxo de auth    |
| `historico-alteracoes.md`      | Este documento — changelog técnico cronológico          |
| `troubleshooting-guide.md`     | Guia de solução de problemas comuns                     |
| `analise_performance.md`       | Cache, persistência, prefetch, otimizações de render    |
