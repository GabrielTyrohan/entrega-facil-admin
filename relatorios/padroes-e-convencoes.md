# Guia de Padrões e Convenções de Código

**Projeto:** Sistema de Gestão de Entregas
**Data:** 21/01/2026
**Versão:** 2.3

Este documento define os padrões técnicos obrigatórios para manter a consistência, segurança e qualidade do código no projeto.

---

## 1. Padrões de Arquitetura de Dados

### Service Pattern (Camada de Serviços)
Todo acesso a dados complexo ou reutilizável deve ser encapsulado em serviços dentro de `src/services/`.
**Não faça:** Queries complexas do Supabase diretamente dentro de `useEffect` ou componentes.
**Faça:**
```typescript
// src/services/produtoService.ts
export class ProdutoService {
  constructor(private adminId: string) {}

  async getProdutos() {
    // Lógica do Supabase aqui
  }
}
```

### Chaves de Cache (Query Keys)
NUNCA use strings literais ("magic strings") para chaves de cache do React Query.
**Obrigatório:** Use sempre as constantes definidas em `src/lib/constants/queryKeys.ts`.
```typescript
// Errado
useQuery({ queryKey: ['produtos'], ... })

// Correto
import { CACHE_KEYS } from '@/lib/constants/queryKeys';
useQuery({ queryKey: [CACHE_KEYS.PRODUTOS], ... })
```

---

## 2. Padrões de Interface (UI/UX)

### Suporte a Dark Mode (Mandatório)
Todas as telas devem ser compatíveis com modo escuro.
*   Use prefixo `dark:` do Tailwind.
*   Teste sempre alternando o tema no Header.

### Feedback de Carregamento
Nunca deixe a tela em branco durante requisições.
*   **Listas:** Use o componente `Skeleton` repetido para simular linhas.
*   **Ações (Botões):** Use o estado `disabled` e mostre um spinner ou texto "Salvando..." no botão.

---

## 3. Convenções de Hooks (`src/hooks/`)

### Nomenclatura e Estrutura
*   Nome: `use[Entidade].ts` (ex: `useClientes.ts`).
*   O hook deve encapsular tanto a **Query** (GET) quanto as **Mutations** (POST/PUT/DELETE) relacionadas àquela entidade.
*   Retorne um objeto tipado, não um array (exceto se for apenas um valor simples).

```typescript
export function useClientes() {
  const query = useQuery(...);
  const createMutation = useMutation(...);

  return {
    clientes: query.data,
    isLoading: query.isLoading,
    criarCliente: createMutation.mutateAsync
  };
}
```

---

## 4. Convenções TypeScript

### Tipagem Estrita
*   Evite `any` a todo custo.
*   Se o tipo for desconhecido temporariamente, use `unknown`.
*   Compartilhe interfaces em `src/types/` ou exporte do próprio arquivo de serviço se for específico.

### Tratamento de Listas
Sempre verifique se a lista existe antes de fazer map.
```typescript
// Errado
data.map(...) // Quebra se data for undefined

// Correto
{data?.map(...) || <EmptyState />}
```

### Imports
*   Certifique-se de importar todas as dependências explicitamente.
*   O TypeScript pode não acusar erro de compilação em alguns ambientes se o import faltar, mas causará erro em runtime (ex: `React is not defined` ou `useQuery is not defined`).

---

## 5. Integração Supabase

### Row Level Security (RLS)
Lembre-se que o frontend não garante segurança. Sempre assuma que o RLS no banco de dados é a barreira real.
*   Ao criar serviços, sempre passe o contexto necessário (ex: `administrador_id`) para que as queries sejam filtradas corretamente, mas confie no RLS para bloquear acessos indevidos.

### Atualizações de Schema
Se adicionar colunas no banco, atualize os tipos TypeScript gerados ou as interfaces manuais imediatamente para evitar erros de compilação.

---

## 6. Geração de Documentos (PDF)

### Biblioteca e Configuração
*   Utilize `html2pdf.js` para gerar PDFs a partir do DOM.
*   **Configuração Obrigatória:** Utilize unidades em milímetros (`mm`) e formato A4 para garantir compatibilidade de impressão.

```typescript
const opt = {
  margin: [5, 5, 5, 5] as [number, number, number, number],
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
};
```

---

## 7. Compatibilidade de Dados (Legacy)

### Acesso Case-Insensitive
Ao lidar com dados legados ou migrações onde os nomes dos campos podem variar (ex: `Bairro` vs `bairro`), utilize helpers ou verificação dupla.

```typescript
// Exemplo de Helper
const getField = (obj: any, field: string) => {
  return obj[field] || obj[field.toLowerCase()] || '';
};
```
