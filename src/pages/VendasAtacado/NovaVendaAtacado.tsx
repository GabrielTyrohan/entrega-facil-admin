import { toast } from '@/utils/toast';
import { addDays, format, isValid } from 'date-fns';
import { ArrowLeft, Calendar, Loader2, Plus, Save, ShoppingCart, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useListaCestas } from '../../hooks/useCestas';
import { Cliente, useClientesByAdmin } from '../../hooks/useClientes';
import { useCreateLancamento } from '../../hooks/useFluxoCaixa';
import { useCreateVendaAtacado, VendaAtacadoItem } from '../../hooks/useVendasAtacado';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { applyCurrencyMask, currencyMaskToNumber, formatCurrency } from '../../utils/currencyUtils';

const NovaVendaAtacado = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;
  const createVendaMutation = useCreateVendaAtacado();
  const createLancamentoMutation = useCreateLancamento();

  // Form State
  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [vendedorId, setVendedorId] = useState('');
  const [dataEntrega, setDataEntrega] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [dataPagamento, setDataPagamento] = useState('');
  const [itens, setItens] = useState<VendaAtacadoItem[]>([]);

  // Item Addition State
  const [selectedProdutoId, setSelectedProdutoId] = useState('');
  const [qtd, setQtd] = useState(1);
  const [precoUnit, setPrecoUnit] = useState('');

  // Queries
  const { data: vendedores } = useVendedoresByAdmin(targetId || '', { enabled: !!targetId });
  
  const { data: clientesData, isLoading: isLoadingClientes } = useClientesByAdmin(targetId || '', { 
    enabled: !!targetId && clienteSearch.length > 2, 
    search: clienteSearch,
    pageSize: 10
  });

  const { data: produtosData } = useListaCestas();

  // Derived State
  const clientes = clientesData || [];
  const produtos = produtosData || [];

  const totalVenda = useMemo(() => itens.reduce((acc, item) => acc + item.subtotal, 0), [itens]);

  // Effect: Calculate Data Pagamento
  useEffect(() => {
    if (!dataEntrega) return;
    
    const entrega = new Date(dataEntrega);
    if (!isValid(entrega)) return;

    let dias = 0;
    if (formaPagamento === 'Boleto 7 dias') dias = 7;
    else if (formaPagamento === 'Boleto 14 dias') dias = 14;
    else if (formaPagamento === 'Boleto 30 dias') dias = 30;

    if (dias > 0) {
      setDataPagamento(format(addDays(entrega, dias), 'yyyy-MM-dd'));
    } else {
      setDataPagamento(dataEntrega); 
    }
  }, [dataEntrega, formaPagamento]);

  // Effect: Update price when product changes
  useEffect(() => {
    if (selectedProdutoId && produtos.length > 0) {
      const produto = produtos.find(p => p.id === selectedProdutoId);
      if (produto) {
        setPrecoUnit(applyCurrencyMask((produto.preco * 100).toFixed(0)));
      }
    } else {
      setPrecoUnit('');
    }
  }, [selectedProdutoId, produtos]);

  // Handlers
  const handleAddItem = () => {
    if (!selectedProdutoId || !precoUnit || qtd <= 0) return;

    const produto = produtos.find(p => p.id === selectedProdutoId);
    if (!produto) return;

    const preco = currencyMaskToNumber(precoUnit);
    
    const newItem: any = {
      produto_cadastrado_id: produto.id,
      produto_nome: produto.nome,
      descricao: produto.nome,
      quantidade: qtd,
      preco_unitario: preco,
      subtotal: qtd * preco
    };

    setItens([...itens, newItem]);
    
    // Reset item form
    setSelectedProdutoId('');
    setQtd(1);
    setPrecoUnit('');
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user?.id || !selectedCliente || !vendedorId || itens.length === 0) {
      toast.error('Preencha todos os campos obrigatórios e adicione pelo menos um item.');
      return;
    }

    try {
      const selectedVendedor = vendedores?.find(v => v.id === vendedorId);
      
      const vendaData = {
        administrador_id: user.id,
        cliente_id: selectedCliente.id,
        cliente_nome: selectedCliente.nome,
        vendedor_id: vendedorId,
        vendedor_nome: selectedVendedor?.nome || 'Desconhecido',
        data_venda: new Date().toISOString(),
        data_entrega: dataEntrega,
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento as any,
        status_pagamento: 'pendente' as const,
        valor_total: totalVenda,
        itens
      };

      const novaVenda = await createVendaMutation.mutateAsync(vendaData);

      // Integrar com Fluxo de Caixa (Lançamento de Entrada)
      try {
        await createLancamentoMutation.mutateAsync({
          administrador_id: adminId || user.id,
          lancado_por: user.id,
          tipo: 'entrada',
          categoria: 'Venda',
          descricao: `Venda Atacado #${novaVenda.numero_pedido || (novaVenda.id ? novaVenda.id.slice(0, 8) : 'N/A')} - ${selectedCliente.nome}`,
          valor: totalVenda,
          data_lancamento: new Date().toISOString(),
          data_vencimento: dataPagamento || null,
          forma_pagamento: formaPagamento,
          status: 'pendente', // Venda inicia como pendente
          referencia_id: novaVenda.id,
          referencia_tipo: 'venda'
        });
        toast.success('Venda realizada e lançamento financeiro criado!');
      } catch (err) {
        console.error('Erro ao criar lançamento financeiro:', err);
        toast.success('Venda realizada, mas houve erro ao criar lançamento financeiro.');
      }

      navigate('/vendas-atacado'); 
    } catch (error) {
      console.error('Erro ao salvar venda:', error);
      toast.error('Erro ao salvar venda. Tente novamente.');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/vendas-atacado')} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nova Venda Atacado</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Preencha os dados para registrar uma nova venda</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Cliente & Vendedor */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-6 flex items-center text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
              <User size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
              Dados da Venda
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cliente *</label>
                {selectedCliente ? (
                  <div className="flex items-center justify-between p-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded-lg group transition-all">
                    <span className="font-medium text-blue-900 dark:text-blue-300">{selectedCliente.nome}</span>
                    <button 
                      onClick={() => { setSelectedCliente(null); setClienteSearch(''); }}
                      className="text-blue-500 hover:text-red-500 dark:text-blue-400 dark:hover:text-red-400 transition-colors"
                      title="Remover cliente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className="block w-full pl-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-shadow"
                      placeholder="Buscar cliente..."
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                    />
                    {isLoadingClientes && (
                      <div className="absolute right-3 top-3">
                        <Loader2 size={18} className="animate-spin text-blue-500" />
                      </div>
                    )}
                    {clienteSearch.length > 2 && !selectedCliente && clientes.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-xl max-h-60 rounded-lg py-1 text-base overflow-auto border border-gray-200 dark:border-gray-700">
                        {clientes.map((cliente: Cliente) => (
                          <div
                            key={cliente.id}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                            onClick={() => {
                              setSelectedCliente(cliente);
                              setClienteSearch('');
                            }}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{cliente.nome}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cliente.telefone || 'Sem telefone'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vendedor *</label>
                <select
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow"
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                >
                  <option value="">Selecione um vendedor</option>
                  {vendedores?.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Datas e Pagamento */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-6 flex items-center text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
              <Calendar size={20} className="mr-2 text-green-600 dark:text-green-400" />
              Pagamento e Entrega
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data de Entrega</label>
                <input
                  type="date"
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Forma de Pagamento</label>
                <select
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                >
                  <option value="PIX">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Boleto 7 dias">Boleto 7 dias</option>
                  <option value="Boleto 14 dias">Boleto 14 dias</option>
                  <option value="Boleto 30 dias">Boleto 30 dias</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Vencimento</label>
                <input
                  type="date"
                  className="block w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  value={dataPagamento}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-6 flex items-center text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
              <ShoppingCart size={20} className="mr-2 text-orange-600 dark:text-orange-400" />
              Itens do Pedido
            </h2>

            {/* Add Item Form */}
            <div className="flex flex-col md:flex-row gap-4 items-end mb-6 bg-gray-50 dark:bg-gray-700/30 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex-grow relative w-full md:w-auto">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Produto (Cesta)</label>
                <select
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={selectedProdutoId}
                  onChange={(e) => setSelectedProdutoId(e.target.value)}
                >
                  <option value="">Selecione uma cesta</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-28">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Qtd</label>
                <input
                  type="number"
                  min="1"
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={qtd}
                  onChange={(e) => setQtd(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="w-full md:w-40">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preço Unit.</label>
                <input
                  type="text"
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="R$ 0,00"
                  value={precoUnit}
                  onChange={(e) => setPrecoUnit(applyCurrencyMask(e.target.value))}
                />
              </div>

              <button
                onClick={handleAddItem}
                disabled={!selectedProdutoId || !precoUnit || qtd <= 0}
                className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Plus size={24} />
              </button>
            </div>

            {/* Items List */}
            {itens.length > 0 ? (
              <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produto</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qtd</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preço</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {itens.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{item.produto_nome}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">{item.quantidade}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">{formatCurrency(item.preco_unitario)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">{formatCurrency(item.subtotal)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhum item adicionado à venda</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 sticky top-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-3">
              Resumo da Venda
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Itens</span>
                <span>{itens.length}</span>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-base font-medium text-gray-900 dark:text-white">Total a Pagar</span>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalVenda)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={createVendaMutation.isPending || itens.length === 0}
                className="w-full flex justify-center items-center px-4 py-3.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createVendaMutation.isPending ? (
                  <>
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Save size={20} className="mr-2" />
                    Salvar Venda
                  </>
                )}
              </button>
              
              <button
                onClick={() => navigate('/vendas-atacado')}
                className="w-full flex justify-center items-center px-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaVendaAtacado;
