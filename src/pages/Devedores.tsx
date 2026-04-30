import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/pagination";
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Calendar, DollarSign, Eye, MapPin, Phone, Search, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCreatePagamento } from '../hooks/usePagamentos';
import { supabase } from '../lib/supabase';
import { toast } from '@/utils/toast';
import { usePeriodoVendedor } from '../hooks/usePeriodoVendedor';

interface DevedorData {
  cliente_id: string;
  cliente_nome: string;
  cliente_sobrenome: string;
  cliente_telefone: string;
  cliente_endereco: string;
  vendedor_id: string;
  vendedor_nome: string;
  total_devido: number;
  total_entregas: number;
  maior_dias_atraso: number;
  menor_data_retorno: string;
}

interface ClienteDetalhes {
  id: string;
  nome: string;
  sobrenome: string;
  telefone: string;
  endereco: string;
  entregas: Array<{
    id: string;
    valor: number;
    data_entrega: string;
    mes_cobranca: string;
    dataRetorno: string;
    produto_nome: string;
    valor_pago: number;
    valor_devido: number;
    pago: boolean;
    dias_atraso: number;
  }>;
}

const Devedores: React.FC = () => {
  const { user, adminId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('maior_atraso');
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteDetalhes | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const periodo = usePeriodoVendedor(selectedVendedor || null);

  // Estados para modal de pagamento
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [pagamentoEntrega, setPagamentoEntrega] = useState<any>(null);
  const [valorPagar, setValorPagar] = useState<string>('');
  const [metodoPagamento, setMetodoPagamento] = useState('Dinheiro');
  const [isSubmittingPagamento, setIsSubmittingPagamento] = useState(false);

  const createPagamento = useCreatePagamento();

  // Função para fechar o modal
  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
  };

  // useEffect para lidar com a tecla ESC
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pagamentoModalOpen) {
          setPagamentoModalOpen(false);
        } else if (modalAberto) {
          fecharModal();
        }
      }
    };

    if (modalAberto || pagamentoModalOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [modalAberto, pagamentoModalOpen]);

  // Funções para pagamento
  const abrirModalPagamento = (entrega: any) => {
    setPagamentoEntrega(entrega);
    setValorPagar(entrega.valor_devido.toFixed(2));
    setMetodoPagamento('Dinheiro');
    setPagamentoModalOpen(true);
  };

  const handleRealizarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagamentoEntrega || !user?.id) return;

    try {
      setIsSubmittingPagamento(true);
      
      const valor = parseFloat(valorPagar);
      if (isNaN(valor) || valor <= 0) {
        toast.error('Valor inválido');
        return;
      }

      await createPagamento.mutateAsync({
        entrega_id: pagamentoEntrega.id,
        valor: valor,
        data_pagamento: new Date().toISOString(),
        forma_pagamento: metodoPagamento,
      });

      // Atualizar estado local
      if (clienteSelecionado) {
        const novasEntregas = clienteSelecionado.entregas.map(ent => {
          if (ent.id === pagamentoEntrega.id) {
            const novoValorPago = (ent.valor_pago || 0) + valor;
            const novoValorDevido = ent.valor - novoValorPago;
            return {
              ...ent,
              valor_pago: novoValorPago,
              valor_devido: Math.max(0, novoValorDevido),
              pago: novoValorDevido <= 0.01 // Margem de erro pequena
            };
          }
          return ent;
        });

        setClienteSelecionado({
          ...clienteSelecionado,
          entregas: novasEntregas
        });
      }

      setPagamentoModalOpen(false);
      setPagamentoEntrega(null);
    } catch (error) {
      console.error('Erro ao realizar pagamento:', error);
      toast.error('Erro ao realizar pagamento. Tente novamente.');
    } finally {
      setIsSubmittingPagamento(false);
    }
  };

  // Função para formatar telefone
  const formatarTelefone = (telefone: string) => {
    if (!telefone) return '';
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    }
    return telefone;
  };

  // Função para abrir modal com detalhes do cliente
  const abrirModalCliente = async (devedor: DevedorData) => {
    if (!user?.id) return;

    try {
      // Calcular o primeiro dia do mês atual (mesmo filtro da lista principal)
      const currentDate = new Date();
      const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const firstDayOfCurrentMonthString = firstDayOfCurrentMonth.toISOString().split('T')[0];

      // Buscar entregas do cliente que estão em atraso
      let query = supabase
        .from('entregas')
        .select(`
          id,
          valor,
          data_entrega,
          mes_cobranca,
          dataRetorno,
          produtos!inner (
            nome
          )
        `)
        .eq('cliente_id', devedor.cliente_id)
        .not('dataRetorno', 'is', null);

      if (selectedVendedor && periodo.inicioStr && periodo.fimStr) {
        query = query
          .gte('dataRetorno', periodo.inicioStr)
          .lte('dataRetorno', periodo.fimStr);
      } else {
        query = query.lt('dataRetorno', firstDayOfCurrentMonthString);
      }

      const { data: entregasCliente, error } = await query;

      if (error) throw error;

      // Buscar pagamentos para cada entrega e filtrar apenas as com valor devido > 0
      const entregasComPagamentos = await Promise.all(
        (entregasCliente || []).map(async (entrega) => {
          // Buscar pagamentos diretamente da tabela para garantir dados atualizados
          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('valor')
            .eq('entrega_id', entrega.id);

          const valorPago = pagamentos?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
          const valorDevido = entrega.valor - valorPago;

          if (valorDevido <= 0) return null; // Filtrar entregas já pagas

          // Calcular dias de atraso
          const dataRetorno = new Date(entrega.dataRetorno);
          const hoje = new Date();
          const diasAtraso = Math.floor((hoje.getTime() - dataRetorno.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: entrega.id,
            valor: entrega.valor,
            data_entrega: entrega.data_entrega,
            mes_cobranca: entrega.mes_cobranca,
            dataRetorno: entrega.dataRetorno,
            produto_nome: String((entrega.produtos as { nome?: string })?.nome || 'Produto não encontrado'),
            valor_pago: valorPago,
            valor_devido: valorDevido,
            pago: false,
            dias_atraso: diasAtraso
          };
        })
      );

      // Filtrar entregas nulas (já pagas)
      const entregasDevendo = entregasComPagamentos.filter(entrega => entrega !== null);

      const clienteDetalhes: ClienteDetalhes = {
        id: devedor.cliente_id,
        nome: devedor.cliente_nome,
        sobrenome: devedor.cliente_sobrenome,
        telefone: devedor.cliente_telefone,
        endereco: devedor.cliente_endereco,
        entregas: entregasDevendo
      };

      setClienteSelecionado(clienteDetalhes);
      setModalAberto(true);
    } catch {
      // Error handling without logging sensitive data
    }
  };

  // Buscar devedores usando abordagem corrigida
  const { data: devedores, isLoading } = useQuery({
    queryKey: ['devedores', adminId, selectedVendedor, periodo.inicioStr, periodo.fimStr],
    queryFn: async () => {
      if (!adminId) return [];

      // Calcular o primeiro dia do mês atual
      const currentDate = new Date();
      const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const firstDayOfCurrentMonthString = firstDayOfCurrentMonth.toISOString().split('T')[0];

      // 1. Buscar IDs dos vendedores vinculados ao administrador
      const { data: vendedoresIdsData, error: vendedoresIdsError } = await supabase
        .from('vendedores')
        .select('id')
        .eq('administrador_id', adminId);

      if (vendedoresIdsError) throw vendedoresIdsError;
      
      const vendedorIds = vendedoresIdsData?.map(v => v.id) || [];
      
      if (vendedorIds.length === 0) return [];

      // Buscar todas as entregas com data de retorno anterior ao mês atual
      let query = supabase
        .from('entregas')
        .select(`
          id,
          valor,
          data_entrega,
          mes_cobranca,
          dataRetorno,
          pago,
          vendedor_id,
          clientes!inner(
            id,
            nome,
            sobrenome,
            telefone,
            endereco
          ),
          vendedores(
            id,
            nome,
            administrador_id
          ),
          produtos!inner(
            nome
          )
        `)
        .not('dataRetorno', 'is', null);

      if (selectedVendedor && periodo.inicioStr && periodo.fimStr) {
        query = query
          .eq('vendedor_id', selectedVendedor)
          .gte('dataRetorno', periodo.inicioStr)
          .lte('dataRetorno', periodo.fimStr);
      } else {
        query = query
          .in('vendedor_id', vendedorIds)
          .lt('dataRetorno', firstDayOfCurrentMonthString);
      }

      const { data: entregasData, error: entregasError } = await query;

      if (entregasError) throw entregasError;

      // Buscar valores pagos para cada entrega
      const entregasComPagamentos = await Promise.all(
        (entregasData || []).map(async (entrega) => {
          // Buscar pagamentos diretamente da tabela
          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('valor')
            .eq('entrega_id', entrega.id);

          const valorPago = pagamentos?.reduce((acc, curr) => acc + curr.valor, 0) || 0;

          return {
            entrega_id: entrega.id,
            valor_total_pago: valorPago,
            entregas: entrega
          };
        })
      );

      return entregasComPagamentos;
    },
    enabled: !!adminId,
  });

  // Buscar vendedores para filtro
  const { data: vendedoresData = [] } = useQuery({
    queryKey: ['vendedores-filtro', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome')
        .eq('administrador_id', adminId)
        .eq('ativo', true)
        .order('nome');
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!adminId,
  });

  // Processar dados dos devedores - agrupar por cliente e vendedor
  const devedoresProcessados: DevedorData[] = (() => {
    const gruposClienteVendedor = new Map<string, {
      cliente_id: string;
      cliente_nome: string;
      cliente_sobrenome: string;
      cliente_telefone: string;
      cliente_endereco: string;
      vendedor_id: string;
      vendedor_nome: string;
      entregas: Record<string, unknown>[];
    }>();

    // Agrupar entregas por cliente.id + vendedor.id
    ((devedores as Record<string, unknown>[]) || []).forEach((item) => {
      const entrega = item.entregas as Record<string, unknown>;
      const valorEntrega = (entrega.valor as number) || 0;
      const valorTotalPago = (item.valor_total_pago as number) || 0;
      const valorDevendo = valorEntrega - valorTotalPago;
      
      // Só processar entregas que têm valor devido > 0
      if (valorDevendo > 0) {
        const chave = `${(entrega.clientes as Record<string, unknown>)?.id || ''}_${(entrega.vendedores as Record<string, unknown>)?.id || ''}`;

        if (!gruposClienteVendedor.has(chave)) {
          gruposClienteVendedor.set(chave, {
            cliente_id: String((entrega.clientes as Record<string, unknown>)?.id || ''),
            cliente_nome: String((entrega.clientes as Record<string, unknown>)?.nome || ''),
            cliente_sobrenome: String((entrega.clientes as Record<string, unknown>)?.sobrenome || ''),
            cliente_telefone: String((entrega.clientes as Record<string, unknown>)?.telefone || ''),
            cliente_endereco: String((entrega.clientes as Record<string, unknown>)?.endereco || ''),
            vendedor_id: String((entrega.vendedores as Record<string, unknown>)?.id || entrega.vendedor_id || ''),
            vendedor_nome: String((entrega.vendedores as Record<string, unknown>)?.nome || ''),
            entregas: []
          });
        }
        
        gruposClienteVendedor.get(chave)!.entregas.push(item);
      }
    });

    // Processar cada grupo
    return Array.from(gruposClienteVendedor.values()).map((grupo) => {
      let totalDevido = 0;
      let totalEntregasDevendo = 0;
      let maiorDiasAtraso = 0;
      let menorDataRetorno = new Date();

      grupo.entregas.forEach((item) => {
        const entrega = item.entregas as Record<string, unknown>;
        const valorEntrega = (entrega.valor as number) || 0;
        const valorTotalPago = (item.valor_total_pago as number) || 0;
        const valorDevendo = valorEntrega - valorTotalPago;
        
        // Somar ao total devido (já filtrado para > 0)
        totalDevido += valorDevendo;
        totalEntregasDevendo += 1;

        // Calcular dias de atraso
        const dataRetorno = new Date(entrega.dataRetorno as string);
        const hoje = new Date();
        const diasAtraso = Math.floor((hoje.getTime() - dataRetorno.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diasAtraso > maiorDiasAtraso) {
          maiorDiasAtraso = diasAtraso;
        }

        if (dataRetorno < menorDataRetorno) {
          menorDataRetorno = dataRetorno;
        }
      });

      return {
        cliente_id: grupo.cliente_id,
        cliente_nome: grupo.cliente_nome,
        cliente_sobrenome: grupo.cliente_sobrenome,
        cliente_telefone: grupo.cliente_telefone,
        cliente_endereco: grupo.cliente_endereco,
        vendedor_id: grupo.vendedor_id,
        vendedor_nome: grupo.vendedor_nome,
        total_devido: totalDevido,
        total_entregas: totalEntregasDevendo,
        maior_dias_atraso: maiorDiasAtraso,
        menor_data_retorno: menorDataRetorno.toISOString().split('T')[0]
      };
    });
  })();

  // Função para aplicar ordenação
  const applySorting = (devedores: DevedorData[]) => {
    return [...devedores].sort((a, b) => {
      switch (sortOption) {
        case 'mais_devido':
          return b.total_devido - a.total_devido;
        case 'menos_devido':
          return a.total_devido - b.total_devido;
        case 'maior_atraso':
          return b.maior_dias_atraso - a.maior_dias_atraso;
        case 'menor_atraso':
          return a.maior_dias_atraso - b.maior_dias_atraso;
        case 'primeira_data':
          return new Date(a.menor_data_retorno).getTime() - new Date(b.menor_data_retorno).getTime();
        case 'ultima_data':
          return new Date(b.menor_data_retorno).getTime() - new Date(a.menor_data_retorno).getTime();
        case 'mais_entregas':
          return b.total_entregas - a.total_entregas;
        case 'menos_entregas':
          return a.total_entregas - b.total_entregas;
        default:
          return b.maior_dias_atraso - a.maior_dias_atraso;
      }
    });
  };

  // Filtrar e ordenar devedores
  const devedoresFiltrados = applySorting(
    devedoresProcessados.filter((devedor) => {
      const matchesSearch = searchTerm === '' || 
        devedor.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        devedor.cliente_telefone.includes(searchTerm) ||
        devedor.vendedor_nome.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVendedor = selectedVendedor === '' || 
        devedor.vendedor_id === selectedVendedor;

      return matchesSearch && matchesVendedor;
    })
  );

  // Função para calcular itens por página baseado no tamanho da tela
  const calculateItemsPerPage = () => {
    const height = window.innerHeight;
    const width = window.innerWidth;
    
    // Altura disponível para a tabela (descontando header, filtros, etc.)
    const availableHeight = height - 400; // ~400px para header, filtros, paginação
    const rowHeight = 73; // altura aproximada de cada linha da tabela
    
    let baseItemsPerPage = Math.floor(availableHeight / rowHeight);
    
    // Ajustar baseado na largura da tela para melhor experiência
    if (width >= 1920) { // 4K ou maior
      baseItemsPerPage = Math.max(baseItemsPerPage, 15);
    } else if (width >= 1440) { // Desktop grande
      baseItemsPerPage = Math.max(baseItemsPerPage, 12);
    } else if (width >= 1024) { // Desktop padrão
      baseItemsPerPage = Math.max(baseItemsPerPage, 10);
    } else { // Tablet/Mobile
      baseItemsPerPage = Math.max(baseItemsPerPage, 8);
    }
    
    // Garantir um mínimo e máximo razoável
    return Math.min(Math.max(baseItemsPerPage, 5), 25);
  };

  // ✅ Resize effect without currentPage in deps — page clamping moved to render
  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(calculateItemsPerPage());
    };

    handleResize(); // Calcular inicial
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [devedoresFiltrados.length]);

  // Reset página quando filtro mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedVendedor, sortOption]);

  // Lógica de paginação — safePage clamps currentPage defensively without a setState
  const totalPages = Math.ceil(devedoresFiltrados.length / itemsPerPage);
  const safePage = Math.min(currentPage, totalPages || 1);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDevedores = devedoresFiltrados.slice(startIndex, endIndex);

  // Calcular totais
  const totalDevido = devedoresFiltrados.reduce((sum, devedor) => {
    return sum + devedor.total_devido;
  }, 0);
  const totalDevedores = devedoresFiltrados.length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getDiasAtrasoColor = (dias: number) => {
    if (dias <= 7) return 'text-yellow-600 bg-yellow-100';
    if (dias <= 30) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <Skeleton className="h-4 w-24 ml-auto mb-1" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="text-right">
              <Skeleton className="h-4 w-24 ml-auto mb-1" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {[...Array(8)].map((_, i) => (
                    <th key={i} className="px-6 py-3 text-left">
                      <Skeleton className="h-4 w-24" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-4 h-4 mr-2" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Devedores</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Clientes com pagamentos em atraso
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total devido</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDevido)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Devedores</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalDevedores}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por cliente, telefone ou vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos os vendedores</option>
              {(vendedoresData as Record<string, unknown>[]).map((vendedor) => (
                <option key={String(vendedor.id)} value={String(vendedor.id)}>
                  {String(vendedor.nome)}
                </option>
              ))}
            </select>
            {selectedVendedor && periodo.exibicao && (
              <span className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                📅 Período: {periodo.exibicao}
              </span>
            )}
          </div>

          {/* Ordenação */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="mais_devido">Maior Devedor</option>
            <option value="menos_devido">Menor Devedor</option>
            <option value="maior_atraso">Maior Atraso</option>
            <option value="menor_atraso">Menor Atraso</option>
            <option value="primeira_data">Primeira Data</option>
            <option value="ultima_data">Última Data</option>
            <option value="mais_entregas">Maior Entregas</option>
            <option value="menos_entregas">Menor Entregas</option>
          </select>
        </div>
      </div>

      {/* Lista de Devedores */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {devedoresFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nenhum devedor encontrado
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || selectedVendedor 
                ? 'Tente ajustar os filtros de busca.'
                : 'Não há clientes com pagamentos em atraso no momento.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Vendedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Devido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Entregas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Primeira Data Retorno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Maior Atraso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Contato
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Ação
                   </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {currentDevedores.map((devedor, index) => (
                  <tr 
                    key={`${devedor.cliente_id}_${devedor.vendedor_id}`} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {devedor.cliente_nome} {devedor.cliente_sobrenome}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {devedor.cliente_endereco.substring(0, 30)}...
                          </div>
                        </div>
                      </div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {devedor.vendedor_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(devedor.total_devido)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {devedor.total_entregas} cestas
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {formatDate(devedor.menor_data_retorno)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDiasAtrasoColor(devedor.maior_dias_atraso)}`}>
                        {devedor.maior_dias_atraso} dias
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center text-sm text-gray-900 dark:text-white">
                         <Phone className="w-4 h-4 text-gray-400 mr-2" />
                         <a 
                           href={`tel:${devedor.cliente_telefone}`}
                           className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                         >
                           {formatarTelefone(devedor.cliente_telefone)}
                         </a>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => abrirModalCliente(devedor)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalhes
                        </button>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage - 1}
          totalPages={totalPages}
          totalCount={devedoresFiltrados.length}
          pageSize={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page + 1)}
        />
      )}

      {/* Modal de Detalhes do Cliente */}
      <AnimatePresence>
        {modalAberto && clienteSelecionado && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 lg:left-64 bg-gray-600 bg-opacity-50 overflow-y-auto z-50"
            onClick={fecharModal}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
              className="relative top-10 mx-auto p-5 border w-[95%] max-w-[95%] shadow-lg rounded-md bg-white dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-3">
              {/* Header do Modal */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Detalhes do Cliente
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {clienteSelecionado.nome} {clienteSelecionado.sobrenome}
                  </p>
                </div>
                <button
                  onClick={fecharModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              {/* Informações do Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome Completo</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {clienteSelecionado.nome} {clienteSelecionado.sobrenome}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatarTelefone(clienteSelecionado.telefone)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Endereço</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {clienteSelecionado.endereco}
                  </p>
                </div>
              </div>

              {/* Histórico de Entregas */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Histórico de Entregas ({clienteSelecionado.entregas.filter(e => e.valor_devido > 0).length} cestas devendo)
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Produto
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Data Entrega
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Data Retorno
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Dias Atraso
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Valor Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Valor Pago
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Valor Devido
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {clienteSelecionado.entregas.map((entrega) => (
                        <tr key={entrega.id}>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {entrega.produto_nome}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatDate(entrega.data_entrega)}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatDate(entrega.dataRetorno)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              entrega.valor_pago >= entrega.valor
                                ? 'text-green-800 bg-green-100'
                                : 'text-red-800 bg-red-100'
                            }`}>
                              {entrega.valor_pago >= entrega.valor ? 'Quitado' : `${entrega.dias_atraso} dias`}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatCurrency(entrega.valor)}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatCurrency(entrega.valor_pago)}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatCurrency(entrega.valor_devido)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              entrega.valor_pago >= entrega.valor
                                ? 'text-green-800 bg-green-100' 
                                : entrega.valor_devido > 0 
                                  ? 'text-red-800 bg-red-100' 
                                  : 'text-yellow-800 bg-yellow-100'
                            }`}>
                              {entrega.valor_pago >= entrega.valor ? 'Pago' : entrega.valor_devido > 0 ? 'Devendo' : 'Parcial'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {entrega.valor_devido > 0 && (
                              <button
                                onClick={() => abrirModalPagamento(entrega)}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                <DollarSign className="w-3 h-3 mr-1" />
                                Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo Financeiro */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total de Entregas</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                      {formatCurrency(clienteSelecionado.entregas.reduce((sum, e) => sum + e.valor, 0))}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Pago</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-300">
                      {formatCurrency(clienteSelecionado.entregas.reduce((sum, e) => sum + e.valor_pago, 0))}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Total Devido</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                      {formatCurrency(clienteSelecionado.entregas.filter(e => e.valor_devido > 0).reduce((sum, e) => sum + e.valor_devido, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer do Modal */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Modal de Pagamento */}
      <AnimatePresence>
      {pagamentoModalOpen && pagamentoEntrega && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]"
          onClick={() => setPagamentoModalOpen(false)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
            className="relative top-40 mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">Registrar Pagamento</h3>
              <button onClick={() => setPagamentoModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleRealizarPagamento} className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                <p className="text-lg text-gray-900 dark:text-white">{pagamentoEntrega.produto_nome}</p>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Devido</label>
                <p className="text-lg font-bold text-red-600">{formatCurrency(pagamentoEntrega.valor_devido)}</p>
              </div>

              <div>
                <label htmlFor="valor" className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Pagamento</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-lg">R$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    name="valor"
                    id="valor"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 py-3 text-lg border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    placeholder="0.00"
                    value={valorPagar}
                    onChange={(e) => setValorPagar(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="metodo" className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                <select
                  id="metodo"
                  name="metodo"
                  className="mt-1 block w-full pl-3 pr-10 py-3 text-lg border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={metodoPagamento}
                  onChange={(e) => setMetodoPagamento(e.target.value)}
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                </select>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isSubmittingPagamento}
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-3 bg-green-600 text-lg font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {isSubmittingPagamento ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default Devedores;
