# Guia de Troubleshooting e Resolução de Problemas

**Data:** 21/01/2026
**Versão:** 2.3

Este guia compila soluções para erros técnicos, problemas de cache e comportamentos inesperados identificados no ambiente de produção e desenvolvimento.

---

## 1. Problemas de Cache e Persistência

### Dados Desatualizados ou "Presos"
**Sintoma:** O usuário faz uma alteração (ex: edita cliente), mas a lista continua mostrando o valor antigo, mesmo após recarregar.
**Causa Provável:** O cache persistido no IndexedDB pode estar dessincronizado ou a invalidação falhou.
**Solução:**
1.  **Forçar Limpeza:** O usuário pode limpar o cache do navegador (Application > Storage > Clear Site Data).
2.  **Via Console (Dev):** Execute `queryClient.clear()` no console se exposto, ou use a ferramenta de Developer Tools do React Query para invalidar a chave específica.
3.  **Código:** Verifique se a mutation correspondente tem o `onSuccess` chamando `queryClient.invalidateQueries({ queryKey: [...] })`.

### Erro de Cota do IndexedDB
**Sintoma:** Erro no console `QuotaExceededError` ou falha ao salvar cache.
**Causa:** O dispositivo do usuário está sem espaço em disco.
**Solução:** O sistema falha silenciosamente e passa a operar apenas em memória (RAM). Instrua o usuário a liberar espaço no dispositivo.

---

## 2. Erros de Autenticação

### Loop de Login
**Sintoma:** Usuário faz login, é redirecionado, mas volta para a tela de login.
**Causa:**
1.  Token expirado e falha no refresh token.
2.  Data/Hora do dispositivo do usuário incorreta (impede validação do JWT).
**Solução:**
1.  Verifique a data/hora do sistema operacional.
2.  Limpe os cookies e LocalStorage (`sb-xxxx-auth-token`).

### Permissão Negada (RLS)
**Sintoma:** Erro 403 ou listas vazias inesperadamente.
**Causa:** O usuário logado não tem o `administrador_id` correto vinculado na tabela `users` ou `vendedores`.
**Diagnóstico:** Verifique a tabela `users` no Supabase e confirme se o campo `administrador_id` está preenchido e coincide com os dados que estão sendo acessados.

---

## 3. Problemas de Build e TypeScript

### Erro `Module not found` em CI/CD
**Sintoma:** Funciona localmente (Windows/Mac) mas falha no build (Linux).
**Causa:** Case sensitivity. O arquivo é `Header.tsx` mas o import está `header.tsx`.
**Solução:** Garanta que os imports respeitem exatamente o casing do nome do arquivo.

### Erro TS2345: Argument of type 'number[]' (html2pdf)
**Sintoma:** Erro ao passar margens como array `[5, 5, 5, 5]`.
**Causa:** O TypeScript infere como `number[]` genérico, mas a lib espera uma tupla fixa.
**Solução:** Use *Type Assertion*: `margin: [5, 5, 5, 5] as [number, number, number, number]`.

### Conflito de Classes Tailwind (`cssConflict`)
**Sintoma:** Warning no editor sobre classes duplicadas (ex: `bg-white dark:bg-gray-800`).
**Causa:** O elemento possui classes que definem a mesma propriedade CSS múltiplas vezes (ex: herdado de um componente pai ou duplicado no className).
**Solução:** Remova a classe duplicada ou utilize `tailwind-merge` (`twMerge`) para resolver conflitos automaticamente.

---

## 4. Erros de Runtime e Lógica

### `useQuery is not defined` (Missing Import)
**Sintoma:** Tela branca ou erro no console ao carregar a página.
**Causa:** Uso de hooks ou bibliotecas sem o devido `import` no topo do arquivo.
**Solução:** Verifique os imports. O VS Code nem sempre adiciona imports de pacotes externos (`@tanstack/react-query`) automaticamente.

### Dropdown Vazio ou Inconsistente
**Sintoma:** Select de Produtos/Clientes aparece vazio mesmo com dados no banco.
**Causa:**
1.  **Tipagem:** Acesso a propriedades incorretas (ex: `produto.nome` vs `produto.produto_nome`).
2.  **Fallback Inseguro:** Uso de `||` que mascara valores válidos.
**Solução:**
*   Verifique a interface TypeScript (`Produto`).
*   Remova fallbacks inseguros (`@ts-ignore`) e corrija a tipagem.
*   Adicione logs (`console.log`) na função de busca para validar o retorno do Supabase.

### Dados da Empresa Faltando (Funcionários)
**Sintoma:** PDF ou cabeçalho sem nome/endereço da empresa quando logado como funcionário.
**Causa:** O perfil do funcionário (`userProfile`) não contém dados da empresa.
**Solução:** Busque sempre os dados na tabela `administradores` usando o `administrador_id` vinculado, independentemente de quem está logado.
