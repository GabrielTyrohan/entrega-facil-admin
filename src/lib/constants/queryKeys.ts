export const CACHE_KEYS = {
  PRODUTOS: 'produtos_cadastrado',
  CLIENTES: 'clientes', 
  VENDEDORES: 'vendedores',
  ENTREGAS: 'entregas',
  PAGAMENTOS: 'pagamentos',
  CESTAS: 'cestas',
  RESPONSAVEIS: 'responsaveis',
  FUNCIONARIOS: 'funcionarios',
  ORCAMENTOS_PJ: 'orcamentos_pj',
  TABELA_PRECOS: 'tabela_precos',
  VENDAS_ATACADO: 'vendas_atacado',
  ACERTOS_DIARIOS: 'acertos_diarios',
  USER_PROFILE: 'user_profile',
  FLUXO_CAIXA: 'fluxo_caixa',
  FLUXO_CAIXA_STATS: 'FLUXO_CAIXA_STATS',
  VENDAS_ATACADO_STATS: 'VENDAS_ATACADO_STATS',
  // Dashboard specific cache keys
  DASHBOARD_STATS: 'dashboard_stats',
  DASHBOARD_SUMMARY: 'DASHBOARD_SUMMARY',
  DASHBOARD_FLUXO: 'dashboard_fluxo',
  DASHBOARD_CHARTS: 'dashboard_charts',
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
  TOP_VENDEDORES_ATUAL: 'top_vendedores_atual',
  TOP_VENDEDORES_ANTERIOR: 'top_vendedores_anterior',
  TOP_VENDEDORES_ENTREGAS_ATUAL: 'top_vendedores_entregas_atual',
  TOP_VENDEDORES_ENTREGAS_ANTERIOR: 'top_vendedores_entregas_anterior',
  LATEST_PAYMENT: 'latest_payment',
  LATEST_ENTREGA: 'latest_entrega',
  ATIVIDADES_ENTREGAS: 'atividades_entregas',
  ATIVIDADES_PAGAMENTOS: 'atividades_pagamentos',
  ATIVIDADES_PRODUTOS: 'atividades_produtos',
  ATIVIDADES_VENDEDORES: 'atividades_vendedores',
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
  // Legacy/Compatibility
  STATS: 'dashboard-stats',
} as const;

export const QUERY_KEYS = CACHE_KEYS;
export type QueryKey = (typeof QUERY_KEYS)[keyof typeof QUERY_KEYS];

export const DEFAULT_CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000,  // 5 minutos
  gcTime: 30 * 60 * 1000,    // 30 minutos
} as const;

export const HISTORICAL_CACHE_CONFIG = {
  staleTime: 30 * 60 * 1000, // 30 minutos
  gcTime: 60 * 60 * 1000,    // 1 hora
} as const;

export const CACHE_TIMES = {
  // Dados que mudam raramente
  PRODUTOS: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },
  // Dados que mudam com frequência média
  CLIENTES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  VENDEDORES: {
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
  },
  // Dados que mudam frequentemente
  ENTREGAS: DEFAULT_CACHE_CONFIG,
  PAGAMENTOS: DEFAULT_CACHE_CONFIG,
  CESTAS: DEFAULT_CACHE_CONFIG,
  RESPONSAVEIS: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000,    // 30 minutos
  },
  FUNCIONARIOS: {
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },
  ORCAMENTOS_PJ: DEFAULT_CACHE_CONFIG,
  VENDAS_ATACADO: DEFAULT_CACHE_CONFIG,
  ACERTOS_DIARIOS: DEFAULT_CACHE_CONFIG,
  FLUXO_CAIXA_STATS: DEFAULT_CACHE_CONFIG,
  VENDAS_ATACADO_STATS: DEFAULT_CACHE_CONFIG,
  TABELA_PRECOS: {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },
  // Dashboard cache times - dados que mudam com frequência
  DASHBOARD_STATS: DEFAULT_CACHE_CONFIG,
  DASHBOARD_SUMMARY: DEFAULT_CACHE_CONFIG,
  VENDEDORES_ATIVOS: DEFAULT_CACHE_CONFIG,
  ENTREGAS_DO_MES: DEFAULT_CACHE_CONFIG,
  ENTREGAS_MES_ATUAL: DEFAULT_CACHE_CONFIG,
  ENTREGAS_MES_ANTERIOR: HISTORICAL_CACHE_CONFIG,
  FATURAMENTO_DO_MES: DEFAULT_CACHE_CONFIG,
  FATURAMENTO_MES_ATUAL: DEFAULT_CACHE_CONFIG,
  FATURAMENTO_MES_ANTERIOR: HISTORICAL_CACHE_CONFIG,
  VALORES_EM_FALTA: DEFAULT_CACHE_CONFIG,
  FATURAMENTO_MENSAL: HISTORICAL_CACHE_CONFIG,
  PAGAMENTOS_MENSAIS: HISTORICAL_CACHE_CONFIG,
  TOP_VENDEDORES: DEFAULT_CACHE_CONFIG,
  TOP_VENDEDORES_ATUAL: DEFAULT_CACHE_CONFIG,
  TOP_VENDEDORES_ANTERIOR: HISTORICAL_CACHE_CONFIG,
  TOP_VENDEDORES_ENTREGAS_ATUAL: DEFAULT_CACHE_CONFIG,
  TOP_VENDEDORES_ENTREGAS_ANTERIOR: HISTORICAL_CACHE_CONFIG,
  LATEST_PAYMENT: DEFAULT_CACHE_CONFIG,
  LATEST_ENTREGA: DEFAULT_CACHE_CONFIG,
  ATIVIDADES_ENTREGAS: DEFAULT_CACHE_CONFIG,
  ATIVIDADES_PAGAMENTOS: DEFAULT_CACHE_CONFIG,
  ATIVIDADES_PRODUTOS: DEFAULT_CACHE_CONFIG,
  ATIVIDADES_VENDEDORES: DEFAULT_CACHE_CONFIG,
  // Devedores cache times
  DEVEDORES: DEFAULT_CACHE_CONFIG,
  VENDEDORES_FILTRO: DEFAULT_CACHE_CONFIG,
  VENDAS_MENSAIS_VENDEDORES: DEFAULT_CACHE_CONFIG,
  TOTAL_VENDAS_VENDEDOR: DEFAULT_CACHE_CONFIG,
  TOTAL_ENTREGAS_ADMINISTRADOR: DEFAULT_CACHE_CONFIG,
  SUPORTE_SOLICITACOES: DEFAULT_CACHE_CONFIG,
  SUPORTE_MENSAGENS: DEFAULT_CACHE_CONFIG,
  SISTEMA_STATUS: DEFAULT_CACHE_CONFIG,
  // Compatibility
  STATS: DEFAULT_CACHE_CONFIG,
} as const;
