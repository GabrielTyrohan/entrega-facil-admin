import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, Phone, MapPin, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('maior_atraso');
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteDetalhes | null>(null);

  // Função para fechar o modal
  const fecharModal = () => {
    setModalAberto(false);
    setClienteSelecionado(null);
  };

  // useEffect para lidar com a tecla ESC
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalAberto) {
        fecharModal();
      }
    };

    if (modalAberto) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [modalAberto]);

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
      const { data: entregasCliente, error } = await supabase
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
        .not('dataRetorno', 'is', null)
        .lt('dataRetorno', firstDayOfCurrentMonthString);

      if (error) throw error;

      // Buscar pagamentos para cada entrega e filtrar apenas as com valor devido > 0
      const entregasComPagamentos = await Promise.all(
        (entregasCliente || []).map(async (entrega) => {
          const { data: viewData } = await supabase
            .from('view_pagamentos_por_entrega')
            .select('*')
            .eq('entrega_id', entrega.id)
            .single();

          const valorPago = viewData?.total_pago || 0;
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
    queryKey: ['devedores', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Calcular o primeiro dia do mês atual
      const currentDate = new Date();
      const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const firstDayOfCurrentMonthString = firstDayOfCurrentMonth.toISOString().split('T')[0];

      // Buscar todas as entregas com data de retorno anterior ao mês atual
      const { data: entregasData, error: entregasError } = await supabase
        .from('entregas')
        .select(`
          id,
          valor,
          data_entrega,
          mes_cobranca,
          dataRetorno,
          pago,
          clientes!inner(
            id,
            nome,
            sobrenome,
            telefone,
            endereco
          ),
          vendedores!inner(
            id,
            nome,
            administrador_id
          ),
          produtos!inner(
            nome
          )
        `)
        .eq('vendedores.administrador_id', user.id)
        .not('dataRetorno', 'is', null)
        .lt('dataRetorno', firstDayOfCurrentMonthString);

      if (entregasError) throw entregasError;

      // Buscar valores pagos para cada entrega
      const entregasComPagamentos = await Promise.all(
        (entregasData || []).map(async (entrega) => {
          const { data: viewData } = await supabase
            .from('view_entregas_com_pagamentos')
            .select('valor_total_pago')
            .eq('entrega_id', entrega.id)
            .single();

          return {
            entrega_id: entrega.id,
            valor_total_pago: viewData?.valor_total_pago || 0,
            entregas: entrega
          };
        })
      );

      return entregasComPagamentos;
    },
    enabled: !!user?.id,
  });

  // Buscar vendedores para filtro
  const { data: vendedoresData = [] } = useQuery({
    queryKey: ['vendedores-filtro', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome')
        .eq('administrador_id', user.id)
        .eq('ativo', true)
        .order('nome');
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
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
            vendedor_id: String((entrega.vendedores as Record<string, unknown>)?.id || ''),
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

          {/* Filtro por vendedor */}
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
                {devedoresFiltrados.map((devedor) => (
                  <tr key={`${devedor.cliente_id}_${devedor.vendedor_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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

       {/* Modal de Detalhes do Cliente */}
       {modalAberto && clienteSelecionado && (
         <div 
           className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
           onClick={fecharModal}
         >
           <div 
             className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800"
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
           </div>
         </div>
       )}
     </div>
   );
};

export default Devedores;
