import { QueryClient } from '@tanstack/react-query';

// Tempos de cache por tipo de dado
export const CACHE_TIMES = {
  // Dados estáticos (mudam raramente)
  PRODUTOS: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },

  // Dados de frequência média
  CLIENTES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },

  VENDEDORES: {
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },

  // Dados operacionais (alta frequência)
  ENTREGAS: {
    staleTime: 2 * 60 * 1000,  // 2 minutos
    gcTime: 10 * 60 * 1000,    // 10 minutos
  },

  PAGAMENTOS: {
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  // Estatísticas/Dashboard
  STATS: {
    staleTime: 1 * 60 * 1000,  // 1 minuto
    gcTime: 5 * 60 * 1000,     // 5 minutos
  },
};

// Chaves de cache padronizadas
export const CACHE_KEYS = {
  PRODUTOS: 'produtos',
  CLIENTES: 'clientes', 
  VENDEDORES: 'vendedores',
  ENTREGAS: 'entregas',
  PAGAMENTOS: 'pagamentos',
  CESTAS: 'cestas',
  RESPONSAVEIS: 'responsaveis',
  // Dashboard specific cache keys
  DASHBOARD_STATS: 'dashboard_stats',
  VENDEDORES_ATIVOS: 'vendedores_ativos',
  ENTREGAS_DO_MES: 'entregas_do_mes',
  ENTREGAS_MES_ATUAL: 'entregas_mes_atual',
  ENTREGAS_MES_ANTERIOR: 'entregas_mes_anterior',
  FATURAMENTO_DO_MES: 'faturamento_do_mes',
  FATURAMENTO_MES_ATUAL: 'faturamento_mes_atual',
  FATURAMENTO_MES_ANTERIOR: 'faturamento_mes_anterior',
  VALORES_EM_FALTA: 'valores_em_falta',
  FATURAMENTO_MENSAL: 'faturamento_mensal',
  PAGAMENTOS_MENSAIS: 'pagamentos_mensais',
  TOP_VENDEDORES: 'top_vendedores',
  // Devedores specific cache keys
  DEVEDORES: 'devedores',
  VENDEDORES_FILTRO: 'vendedores_filtro',
  // Vendas mensais por vendedor
  VENDAS_MENSAIS_VENDEDORES: 'vendas_mensais_vendedores',
  // Total de vendas por vendedor
  TOTAL_VENDAS_VENDEDOR: 'total_vendas_vendedor',
  // Total de entregas por administrador
  TOTAL_ENTREGAS_ADMINISTRADOR: 'total_entregas_administrador',
  SUPORTE_SOLICITACOES: 'suporte_solicitacoes',
  SUPORTE_MENSAGENS: 'suporte_mensagens',
  SISTEMA_STATUS: 'sistema_status',
  STATS: 'dashboard-stats', // Mantendo para retrocompatibilidade se necessário
};

// QueryClient configurado
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000, // padrão: 2 minutos
      gcTime: 24 * 60 * 60 * 1000, // Ajustado para 24h para alinhar com a persistência
    },
  },
});
