# Padrões de Uso dos Hooks de Cache

Este documento descreve os padrões e melhores práticas para usar o sistema de cache implementado com React Query e Supabase Cache Helpers.

## Estrutura do Sistema

### Arquivos Principais

- **`src/lib/supabaseCache.ts`**: Configurações centrais de cache e hooks genéricos
- **`src/hooks/`**: Hooks específicos por entidade (useProdutos, useClientes, etc.)

### Configurações de Cache

```typescript
// Tempos de cache por tipo de dados
CACHE_TIMES = {
  PRODUTOS: { staleTime: 10min, gcTime: 30min },    // Dados que mudam raramente
  CLIENTES: { staleTime: 5min, gcTime: 15min },     // Frequência média
  VENDEDORES: { staleTime: 5min, gcTime: 15min },   // Frequência média
  ENTREGAS: { staleTime: 2min, gcTime: 10min },     // Dados frequentes
  PAGAMENTOS: { staleTime: 2min, gcTime: 10min },   // Dados frequentes
  CESTAS: { staleTime: 3min, gcTime: 10min },       // Frequência média
}
```

## Padrões de Uso

### 1. Queries (Leitura de Dados)

#### Hook Básico
```typescript
const { data, isLoading, error } = useProdutos({
  enabled: true,
  categoria: 'eletrônicos',
  ativo: true
});
```

#### Hook com Filtros
```typescript
const { data: vendedores } = useVendedoresByAdmin(adminId, {
  enabled: !!adminId
});
```

#### Hook para Item Único
```typescript
const { data: produto } = useProduto(produtoId, {
  enabled: !!produtoId
});
```

### 2. Mutações (Modificação de Dados)

#### Mutação Simples
```typescript
const deleteVendedorMutation = useDeleteVendedor({
  onSuccess: () => {
    toast.success('Vendedor excluído com sucesso!');
  },
  onError: (error) => {
    toast.error('Erro ao excluir vendedor');
  }
});

// Uso
await deleteVendedorMutation.mutateAsync({ id: vendedorId });
```

#### Mutação com Atualização Otimista
```typescript
// As atualizações otimistas já estão implementadas nos hooks de delete
// A interface é atualizada imediatamente, com rollback automático em caso de erro
```

### 3. Estados de Loading

#### Durante Queries
```typescript
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
```

#### Durante Mutações
```typescript
<Button 
  disabled={deleteVendedorMutation.isPending}
  onClick={() => handleDelete()}
>
  {deleteVendedorMutation.isPending ? 'Excluindo...' : 'Excluir'}
</Button>
```

## Funcionalidades Implementadas

### ✅ Cache Inteligente
- Tempos de cache otimizados por tipo de dados
- Invalidação automática de cache relacionado
- Revalidação em foco e reconexão

### ✅ Atualizações Otimistas
- Remoção imediata de itens da interface
- Rollback automático em caso de erro
- Feedback visual instantâneo

### ✅ Invalidação de Cache Relacionado
```typescript
// Exemplo: ao deletar um vendedor, invalida cache de entregas e pagamentos
invalidateRelated: ['ENTREGAS', 'PAGAMENTOS']
```

### ✅ React Query DevTools
- Monitoramento em tempo real do cache
- Debug de queries e mutações
- Visualização de estados de loading

## Melhores Práticas

### 1. Habilitação Condicional
```typescript
// ✅ Correto - só executa query quando necessário
const { data } = useVendedor(id, { enabled: !!id });

// ❌ Incorreto - executa sempre
const { data } = useVendedor(id);
```

### 2. Tratamento de Estados
```typescript
// ✅ Correto - trata todos os estados
if (isLoading) return <Loading />;
if (error) return <Error error={error} />;
if (!data) return <NoData />;

// ❌ Incorreto - não trata estados intermediários
return <DataTable data={data} />;
```

### 3. Feedback de Mutações
```typescript
// ✅ Correto - feedback claro para o usuário
const mutation = useDeleteItem({
  onSuccess: () => toast.success('Item excluído!'),
  onError: (error) => toast.error(`Erro: ${error.message}`)
});

// ❌ Incorreto - sem feedback
const mutation = useDeleteItem();
```

### 4. Loading States em Botões
```typescript
// ✅ Correto - desabilita botão durante mutação
<Button 
  disabled={mutation.isPending}
  onClick={handleAction}
>
  {mutation.isPending ? 'Processando...' : 'Confirmar'}
</Button>
```

## Troubleshooting

### Problema: Cache não atualiza
**Solução**: Verificar se `invalidateRelated` está configurado corretamente

### Problema: Loading infinito
**Solução**: Verificar condição `enabled` nos hooks

### Problema: Erro de importação
**Solução**: Verificar se o hook está exportado corretamente

### Problema: Atualização otimista não funciona
**Solução**: Verificar se a estrutura de dados está correta na função `updateFn`

## Monitoramento

Use o React Query DevTools para:
- Visualizar estado do cache
- Debug de queries lentas
- Identificar re-renders desnecessários
- Monitorar invalidações de cache

## Performance

### Otimizações Implementadas
- Cache com tempos específicos por entidade
- Atualizações otimistas para melhor UX
- Invalidação inteligente de cache relacionado
- Prefetch automático via Supabase Cache Helpers

### Métricas Esperadas
- Redução de 60-80% em requests desnecessários
- Melhoria de 40-60% na percepção de velocidade
- Cache hit rate > 70% para dados estáveis