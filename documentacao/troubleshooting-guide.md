# Guia de Troubleshooting e Resolução de Problemas

**Data da última atualização:** 02/03/2026  
**Versão:** 3.0

Este guia compila soluções para erros técnicos, problemas de cache, comportamentos inesperados e erros de build identificados no ambiente de produção e desenvolvimento.

---

## Índice

1. [Problemas de Cache e Persistência](#1-problemas-de-cache-e-persistência)
2. [Erros de Autenticação](#2-erros-de-autenticação)
3. [Permissões e Controle de Acesso](#3-permissões-e-controle-de-acesso)
4. [Relatórios e Filtros](#4-relatórios-e-filtros)
5. [Problemas de Build e TypeScript](#5-problemas-de-build-e-typescript)
6. [Erros de Runtime e Lógica](#6-erros-de-runtime-e-lógica)
7. [Erros de Banco de Dados (Supabase)](#7-erros-de-banco-de-dados-supabase)
8. [Problemas com Electron (Desktop)](#8-problemas-com-electron-desktop)
9. [Problemas de Performance](#9-problemas-de-performance)
10. [Checklist de Diagnóstico Geral](#10-checklist-de-diagnóstico-geral)

---

## 1. Problemas de Cache e Persistência

### 1.1. Dados Desatualizados ou "Presos"

**Sintoma:** O usuário faz uma alteração (ex: edita cliente), mas a lista continua mostrando o valor antigo, mesmo após recarregar.

**Causa Provável:** O cache persistido no IndexedDB pode estar dessincronizado ou a invalidação falhou.

**Solução:**
1. **Via Interface:** O usuário pode limpar o cache do navegador → Application → Storage → Clear Site Data.
2. **Via Console (Dev):**
   ```javascript
   // Invalidar tudo
   queryClient.clear();
   // Invalidar entidade específica
   queryClient.invalidateQueries({ queryKey: ['produtos_cadastrado'] });
   ```
3. **Via React Query DevTools:** Se habilitado em dev (`import.meta.env.DEV`), usar a ferramenta para invalidar chaves específicas.
4. **No Código:** Verificar se a mutation tem `onSuccess` chamando:
   ```typescript
   queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PRODUTOS] });
   ```

### 1.2. Erro de Cota do IndexedDB

**Sintoma:** Erro no console `QuotaExceededError` ou falha silenciosa ao salvar cache.

**Causa:** O dispositivo do usuário está sem espaço em disco.

**Solução:**
- O sistema falha silenciosamente e opera apenas em memória (RAM).
- Instrua o usuário a liberar espaço no dispositivo.
- Verificar via DevTools → Application → IndexedDB.

### 1.3. Cache Corrompido Após Atualização

**Sintoma:** Após deploy de nova versão, dados aparecem em formato antigo ou tela branca ao carregar.

**Causa:** Estrutura de dados no cache (IndexedDB) incompatível com a nova versão do código.

**Solução:**
1. `validateCache.ts` detecta e limpa cache inválido automaticamente.
2. Se persistir: limpar manualmente Application → Storage → Clear site data.
3. Forçar migração: adicionar nova chave de migração em `App.tsx` (alterar `MIGRATION_KEY`).

---

## 2. Erros de Autenticação

### 2.1. Loop de Login

**Sintoma:** Usuário faz login, é redirecionado, mas volta para a tela de login.

**Causas:**
1. Token expirado e falha no refresh token.
2. Data/Hora do dispositivo incorreta (impede validação do JWT).
3. `AuthContext` não encontra perfil (nem admin nem funcionário).

**Solução:**
1. Verificar data/hora do sistema operacional.
2. Limpar cookies e LocalStorage (chave `sb-xxxx-auth-token`).
3. Verificar no Supabase se o `auth.uid()` existe na tabela `administradores` ou `funcionarios`.
4. Verificar logs do AuthContext no console:
   ```
   ❌ Nenhum perfil encontrado para o usuário
   ```

### 2.2. Sessão Expirada Silenciosamente

**Sintoma:** Usuário logado há muito tempo começa a receber erros 401 em requests.

**Causa:** O refresh token expirou (configuração do Supabase).

**Solução:**
1. O `AuthContext` escuta `onAuthStateChange` e atualiza o estado automaticamente.
2. Se o `profileError` for detectado, faz logout automático com toast de erro.
3. Verificar configuração de `JWT Expiry` no painel → Supabase → Authentication → Settings.

### 2.3. Erro "Usuário não autorizado"

**Sintoma:** Login com sucesso mas tela fica em loading infinito seguido de logout.

**Causa:** O email logado não tem registro na tabela `administradores` nem na tabela `funcionarios`.

**Solução:**
1. Verificar se o usuário foi cadastrado no painel do Supabase.
2. Para funcionários: verificar se o campo `ativo` está `true` e se `auth_user_id` está correto.
3. Log de debug:
   ```
   🔍 Buscando perfil de admin para: [user_id]
   🔍 Admin não encontrado, buscando funcionário...
   ❌ Nenhum perfil encontrado para o usuário
   ```

### 2.4. Erro 500 ao Criar Funcionário (Database error querying schema)

**Sintoma:** Ao tentar criar um novo funcionário, a requisição falha com erro 500 e a mensagem `Database error querying schema` no console.

**Causa:** Inserções diretas na tabela `auth.users` via RPC SQL (usando `SECURITY DEFINER`) causam quebras internas no Supabase Auth por ignorarem triggers associados à tabela `auth.identities`.

**Solução:**
1. A criação de funcionários não deve usar inserts SQL via RPC na tabela de auth.
2. O sistema utiliza agora o método nativo `supabase.auth.signUp()`.
3. Para não deslogar o admin que está efetuando o cadastro, o hook `useCreateFuncionario` foi refatorado instanciando um cliente secundário interno (com `persistSession: false`) responsável unicamente pelo registro.

---

## 3. Permissões e Controle de Acesso

### 3.1. Permissão Negada (RLS) — Listas Vazias

**Sintoma:** Listas vazias (ex: Produtos, Clientes) para funcionários, mesmo com dados no banco.

**Causa:** As Policies RLS do Supabase não permitem SELECT para o funcionário. O Supabase retorna array vazio (não erro).

**Solução:**
1. Verificar Policies no Supabase → Authentication → Policies.
2. A política deve permitir SELECT se:
   ```sql
   auth.uid() = administrador_id 
   OR EXISTS (
     SELECT 1 FROM funcionarios 
     WHERE auth_user_id = auth.uid() 
     AND administrador_id = tabela.administrador_id
   )
   ```
3. Rodar script `fix_permissions.sql` se disponível.

### 3.2. Funcionário Não Vê Menu/Rota

**Sintoma:** Funcionário logado não vê um item no menu lateral (ex: "Orçamentos PJ").

**Causa:** O campo `permissoes` na tabela `funcionarios` não tem a flag correspondente como `true`.

**Solução:**
1. Verificar o campo `permissoes` (JSON) do funcionário no Supabase:
   ```json
   {
     "orcamentos_pj": false,  // ← Desabilitado
     "vendas_atacado": true,
     "caixa": true,
     ...
   }
   ```
2. Editar via interface admin → Funcionários → Editar → Permissões.
3. O `Sidebar.tsx` verifica `permissions[item.permission]` antes de renderizar cada item.

### 3.3. RequirePermission Redireciona Inesperadamente

**Sintoma:** Usuário admin é redirecionado para Dashboard ao acessar uma rota protegida.

**Causa:** O `AuthContext` ainda está em loading quando o `RequirePermission` avalia.

**Solução:**
1. Verificar se `isLoading` do AuthContext está sendo considerado.
2. O `RequirePermission` deve esperar o loading terminar antes de avaliar permissões.

---

## 4. Relatórios e Filtros

### 4.1. Relatórios Incompletos ("Último Ano" Vazio)

**Sintoma:** Ao selecionar período longo, relatório mostra valores muito baixos ou vazios.

**Causa:** Hooks padrão (`useEntregas`, `usePagamentos`) usam paginação (50 itens). Filtro de data aplicado client-side sobre essa primeira página ignora registros antigos.

**Solução:**
- Em `Relatorios.tsx`, usar queries manuais:
  ```typescript
  const { data } = useQuery({
    queryKey: ['relatorio-entregas', adminId],
    queryFn: async () => {
      const { data } = await supabase
        .from('entregas')
        .select('*, cliente:clientes(*), vendedor:vendedores(*)')
        .eq('administrador_id', adminId)
        .order('data_entrega', { ascending: false })
        .limit(10000);
      return data || [];
    }
  });
  ```

### 4.2. Totais Financeiros Inconsistentes

**Sintoma:** Somatório de valores no relatório não bate com o esperado.

**Causa:** Cálculos usando `useMemo` podem estar filtrando dados incorretamente por timezone.

**Solução:**
1. Verificar se datas são comparadas usando `dateUtils.ts` (UTC-3).
2. Usar `startOfDayUTC3` e `endOfDayUTC3` para filtros de data.
3. Verificar se valores nulos são tratados (`item.valor || 0`).

### 4.3. PDF/Excel Não Gera

**Sintoma:** Ao clicar em "Gerar PDF" ou "Exportar Excel", nada acontece.

**Causa:** Bibliotecas lazy-loaded (`html2pdf.js`, `xlsx-js-style`) falharam ao carregar.

**Solução:**
1. Verificar rede — as bibliotecas são carregadas sob demanda.
2. Verificar console para erros de importação dinâmica.
3. Em ambiente Electron offline: garantir que as libs estejam no bundle.

---

## 5. Problemas de Build e TypeScript

### 5.1. Erro `Module not found` em CI/CD

**Sintoma:** Funciona localmente (Windows) mas falha no build (Linux).

**Causa:** Case sensitivity. O arquivo é `Header.tsx` mas o import está `header.tsx`.

**Solução:** Importações devem respeitar **exatamente** o casing do nome do arquivo.

### 5.2. Erro TS2304 (`Cannot find name 'useMemo'`)

**Sintoma:** Erro de compilação ao usar hooks do React.

**Causa:** Hook usado sem importação no topo do arquivo.

**Solução:**
```typescript
import { useMemo, useState, useEffect } from 'react';
```

### 5.3. Erro `Property 'x' does not exist` em Queries Manuais

**Sintoma:** TypeScript reclama de propriedades aninhadas (ex: `cliente_nome`).

**Causa:** O Supabase infere tipos baseados na query. Um join retorna objetos aninhados, não propriedades planas.

**Solução:**
```typescript
// ❌ Errado
item.cliente_nome

// ✅ Correto
item.cliente?.nome || 'Sem nome'
```

### 5.4. Erro `Type 'x' is not assignable to type 'y'`

**Sintoma:** Erro de tipo ao passar dados entre components e services.

**Causa:** Interfaces desatualizadas após mudanças na estrutura de dados.

**Solução:**
1. Verificar interfaces em `services/` e `types/`.
2. Usar `as any` como escape temporário durante migrações (marcar com `// TODO: fix type`).
3. Verificar se os campos do Supabase correspondem à interface TypeScript.

### 5.5. Erro no Tipo do Sidebar (Menu Items)

**Sintoma:** TypeScript reclama que `menuItems` não é atribuível a `MenuItem[]` em `Sidebar.tsx`.

**Causa:** Tipagem incompatível em itens de menu, geralmente por inferir uma string larga.

**Solução:**
```typescript
permission: 'configuracoes' as keyof Permissoes
// ou garantir que as propriedades sejam avaliadas como união estrita.
```

### 5.6. Erro de Build com Electron

**Sintoma:** `npm run electron:build:win` falha.

**Causa:** Dependências nativas incompatíveis ou Node.js no Electron desatualizado.

**Solução:**
1. Verificar versão do Electron (`^38.4.0`) e Node.js do projeto.
2. Executar `npm run build` primeiro para garantir que o bundle web funciona.
3. Verificar `electron/main.cjs` para erros de path.

---

## 6. Erros de Runtime e Lógica

### 6.1. `useQuery is not defined`

**Sintoma:** Tela branca ou erro no console ao carregar a página.

**Causa:** Hook ou biblioteca usado sem `import`.

**Solução:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
```

### 6.2. Dropdown Vazio ou Inconsistente

**Sintoma:** Select de Produtos/Clientes aparece vazio mesmo com dados no banco.

**Causas:**
1. Acesso a propriedades incorretas (`produto.nome` vs `produto.produto_nome`).
2. Fallback inseguro com `||` que mascara valores válidos.
3. `adminId` não propagado corretamente.

**Solução:**
1. Verificar a interface TypeScript (ex: `ProdutoCadastrado`).
2. Adicionar logs: `console.log('Dados:', data)` na função de busca.
3. Verificar se o `adminId` do `useAuth()` está correto.

### 6.3. Dados da Empresa Faltando (Funcionários)

**Sintoma:** PDF ou cabeçalho sem nome/endereço da empresa quando logado como funcionário.

**Causa:** O perfil do funcionário não contém diretamente os dados da empresa.

**Solução:**
- O `AuthContext` resolve `adminId` automaticamente (próprio ou do admin vinculado).
- Use `adminId` para buscar dados na tabela `administradores`.
- O campo `nome_empresa` é propagado via trigger no banco para a tabela `funcionarios`.

### 6.4. Animations Travadas (Framer Motion)

**Sintoma:** Animações de loading ou transições travam ao navegar entre páginas.

**Causa:** Componentes com `AnimatePresence` ou `motion` não desmontam corretamente.

**Solução:**
1. Verificar se `AnimatePresence` tem a prop `mode="wait"`.
2. Adicionar `key` único em componentes animados.
3. Verificar se `isLoading` não oscila rapidamente entre `true/false` (causa re-mount).

### 6.5. Toast Não Aparece

**Sintoma:** Notificações toast não são exibidas.

**Causa:** `<Toaster />` não está montado no DOM.

**Solução:**
- Verificar se `<Toaster position="top-right" richColors />` está no `App.tsx`.
- Usar o wrapper `toast.ts` em vez de importar diretamente do Sonner:
  ```typescript
  import { toast } from '@/utils/toast';
  toast.success('Operação realizada!');
  ```

---

## 7. Erros de Banco de Dados (Supabase)

### 7.1. Violação de Constraint (`check_violation`)

**Sintoma:** Erro 400 ao mudar status de orçamento. `violates check constraint "orcamentos_pj_status_check"`.

**Causa:** A restrição no banco não inclui o novo status na lista de valores permitidos.

**Solução:**
```sql
ALTER TABLE orcamentos_pj DROP CONSTRAINT orcamentos_pj_status_check;
ALTER TABLE orcamentos_pj ADD CONSTRAINT orcamentos_pj_status_check 
  CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado', 'finalizado'));
```

### 7.2. Foreign Key Violation (`23503`)

**Sintoma:** Erro ao deletar registro: "Não é possível excluir: existem registros vinculados".

**Causa:** Registro referenciado por outra tabela via foreign key.

**Solução:**
1. Verificar dependências no banco antes de deletar.
2. `supabaseErrorHandler.ts` traduz automaticamente para mensagem amigável.
3. Considerar soft delete (`ativo = false`) em vez de `DELETE`.

### 7.3. Duplicate Key Violation (`23505`)

**Sintoma:** Erro ao criar registro: "Registro duplicado".

**Causa:** Valor de campo UNIQUE já existe (ex: email de vendedor).

**Solução:**
1. Verificar se há validação prévia no frontend.
2. `VendedorService.createVendedor` trata código `23505` especificamente.

### 7.4. Erro de Conexão / Timeout

**Sintoma:** Requests falham intermitentemente com erro de rede.

**Causa:** Instabilidade de rede ou rate limiting do Supabase.

**Solução:**
1. O QueryClient tem `retry: 1` com exponential backoff.
2. Mutations retentam até 2x para erros de rede (não para 4xx).
3. `refetchOnReconnect: true` revalida após reconexão.

---

## 8. Problemas com Electron (Desktop)

### 8.1. Tela Branca no Electron

**Sintoma:** App abre no Electron mas mostra tela branca.

**Causa:** `HashRouter` não está configurado ou paths de assets incorretos.

**Solução:**
1. Verificar `"homepage": "./"` no `package.json`.
2. Verificar que o roteador é `HashRouter` (não `BrowserRouter`).
3. Em dev: `npm run electron:dev` usa `wait-on` para esperar o Vite.

### 8.2. Cache do Electron Persistente

**Sintoma:** Mesmo após atualização, Electron mostra versão antiga.

**Causa:** Cache do Electron/Chromium não foi limpo.

**Solução:**
1. Limpar `electron-cache/` na raiz do projeto.
2. No código: forçar limpeza via `session.defaultSession.clearCache()`.

---

## 9. Problemas de Performance

### 9.1. Renderizações Excessivas

**Sintoma:** Interface fica lenta ao interagir (especialmente em listas longas).

**Causas:**
1. Estados derivados sem `useMemo`.
2. Invalidação de cache muito ampla (invalida queries não relacionadas).
3. Componentes grandes sem code splitting.

**Solução:**
1. Usar `useMemo` para computações derivadas.
2. Invalidar apenas as query keys afetadas: `queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ESPECIFICA] })`.
3. Verificar React DevTools Profiler para identificar componentes quentes.

### 9.2. Carregamento Inicial Lento

**Sintoma:** Primeira carga do app demora vários segundos.

**Causa:** Bundle grande ou muitas queries paralelas.

**Solução:**
1. Verificar se bibliotecas pesadas (PDF, Excel) estão com lazy loading.
2. O prefetch automático prioriza dados essenciais.
3. Cache IndexedDB elimina loading em sessões subsequentes.

---

## 10. Checklist de Diagnóstico Geral

Ao investigar qualquer problema, siga este checklist:

```
□ 1. Verificar console do navegador (Ctrl+Shift+J / Cmd+Option+J)
□ 2. Verificar aba Network — requests falhando?
□ 3. Verificar se está em produção (console suprimido por consoleOverride.ts)
□ 4. Verificar AuthContext logs (🔍, ✅, ❌)
□ 5. Verificar React Query DevTools (apenas em dev)
□ 6. Limpar cache: Application → Storage → Clear Site Data
□ 7. Verificar RLS Policies no Supabase Dashboard
□ 8. Verificar tipo de usuário (admin vs funcionário) e permissões
□ 9. Testar em modo incógnito (elimina cache/extensões)
□ 10. Verificar data/hora do dispositivo (crucial para JWT)
```
