import { useAuth } from '@/contexts/AuthContext';
import { useClientesByAdmin } from '@/hooks/useClientes';
import { OrcamentoPJItem, useCreateOrcamentoPJ } from '@/hooks/useOrcamentosPJ';
import { Produto } from '@/hooks/useProdutos';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/toast';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calculator,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MARGIN_OPTIONS = [10, 15, 20, 30, 40];

const NovoOrcamento: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;
  
  // Form Data
  const [clienteSearch, setClienteSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_nome: '',
    data_validade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 dias
    observacoes: '',
    margem_padrao: 40
  });

  const [itens, setItens] = useState<Partial<OrcamentoPJItem>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hooks
  const { mutateAsync: createOrcamento } = useCreateOrcamentoPJ();
  
  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['PRODUTOS_DIRECT', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('administrador_id', targetId)
        .order('produto_nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!targetId
  });

  const { data: clientesData, isLoading: isLoadingClientes } = useClientesByAdmin(targetId || '', { 
    enabled: !!targetId, 
    pageSize: 50,
    search: clienteSearch
  });
  const clientes = Array.isArray(clientesData) ? clientesData : [];

  // Handlers
  const selectCliente = (cliente: any) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome
    }));
    setClienteSearch('');
    setShowDropdown(false);
  };

  const clearCliente = () => {
    setFormData(prev => ({
      ...prev,
      cliente_id: '',
      cliente_nome: ''
    }));
    setClienteSearch('');
  };

  const adicionarItem = () => {
    setItens([...itens, {
      produto_cadastrado_id: '',
      descricao: '',
      quantidade: 1,
      custo_unitario: 0,
      margem_percentual: formData.margem_padrao,
      valor_venda_unitario: 0,
      valor_total: 0
    }]);
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrcamentoPJItem, value: any) => {
    const newItens = [...itens];
    const item = { ...newItens[index] };

    // Update field
    if (field === 'produto_cadastrado_id') {
      const prod = produtos.find((p: Produto) => p.id === value);
      if (prod) {
        item.produto_cadastrado_id = prod.id;
        item.descricao = prod.produto_nome;
        item.custo_unitario = prod.preco_unt || 0; // Assuming price is cost for now, or 0
        // Recalculate based on new cost
        const valorVenda = (prod.preco_unt || 0) * (1 + (item.margem_percentual || 0) / 100);
        item.valor_venda_unitario = valorVenda;
        item.valor_total = valorVenda * (item.quantidade || 1);
      }
    } else if (field === 'quantidade') {
      item.quantidade = Number(value);
      item.valor_total = (item.valor_venda_unitario || 0) * Number(value);
    } else if (field === 'custo_unitario') {
      item.custo_unitario = Number(value);
      const valorVenda = Number(value) * (1 + (item.margem_percentual || 0) / 100);
      item.valor_venda_unitario = valorVenda;
      item.valor_total = valorVenda * (item.quantidade || 1);
    } else if (field === 'margem_percentual') {
      item.margem_percentual = Number(value);
      const valorVenda = (item.custo_unitario || 0) * (1 + Number(value) / 100);
      item.valor_venda_unitario = valorVenda;
      item.valor_total = valorVenda * (item.quantidade || 1);
    } else {
      (item as any)[field] = value;
    }

    newItens[index] = item;
    setItens(newItens);
  };

  const calcularTotalGeral = () => {
    return itens.reduce((acc, item) => acc + (item.valor_total || 0), 0);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!formData.cliente_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    const invalidItems = itens.some(item => (item.quantidade || 0) <= 0 || (item.custo_unitario || 0) <= 0);
    if (invalidItems) {
      toast.error('Todos os itens devem ter quantidade e custo maiores que zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      await createOrcamento({
        administrador_id: adminId || '',
        cliente_id: formData.cliente_id,
        cliente_nome: formData.cliente_nome,
        data_orcamento: new Date().toISOString(),
        status: 'pendente', // Alterado de 'rascunho' para 'pendente' para evitar erro de constraint
        valor_total: calcularTotalGeral(),
        margem_lucro_geral: 0, // Calculate if needed
        numero_orcamento: Math.floor(Math.random() * 1000000), // Should be handled by DB sequence ideally
        itens: itens as OrcamentoPJItem[]
      });

      toast.success('Orçamento criado com sucesso!');
      navigate('/orcamentos-pj');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar orçamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/orcamentos-pj')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Novo Orçamento</h1>
            <p className="text-sm text-gray-500">Preencha os dados para gerar um novo orçamento</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Salvando...' : 'Salvar Orçamento'}
        </button>
      </div>

      {/* Form Principal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
            {formData.cliente_id ? (
              <div className="flex items-center justify-between px-4 py-2.5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded-lg group transition-all">
                <span className="font-medium text-blue-900 dark:text-blue-300 truncate">{formData.cliente_nome}</span>
                <button 
                  onClick={clearCliente}
                  className="text-blue-500 hover:text-red-500 dark:text-blue-400 dark:hover:text-red-400 transition-colors ml-2"
                  title="Remover cliente"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-shadow"
                  placeholder="Buscar cliente..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  {isLoadingClientes ? (
                    <Loader2 size={18} className="animate-spin text-blue-500" />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </div>
                {showDropdown && !formData.cliente_id && clientes.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 shadow-xl max-h-60 rounded-lg py-1 text-base overflow-auto border border-gray-200 dark:border-gray-700">
                    {clientes.map((cliente: any) => (
                      <div
                        key={cliente.id}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                        onClick={() => selectCliente(cliente)}
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Validade</label>
            <input
              type="date"
              value={formData.data_validade}
              onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-shadow"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Margem Padrão</label>
            <div className="relative">
              <select
                value={formData.margem_padrao}
                onChange={(e) => setFormData({ ...formData, margem_padrao: Number(e.target.value) })}
                className="w-full pl-4 pr-12 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-shadow appearance-none"
              >
                {MARGIN_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}%</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Itens do Orçamento
          </h2>
          <button
            onClick={adicionarItem}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Adicionar Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Qtd</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Custo Unit.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Margem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Venda Unit.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {itens.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">
                    <select
                      value={item.produto_cadastrado_id || ''}
                      onChange={(e) => updateItem(index, 'produto_cadastrado_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Selecione...</option>
                      {isLoadingProdutos ? (
                        <option disabled>Carregando produtos...</option>
                      ) : produtos.length === 0 ? (
                        <option disabled>Nenhum produto encontrado</option>
                      ) : (
                        produtos.map((p: Produto) => (
                          <option key={p.id} value={p.id}>{p.produto_nome}</option>
                        ))
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => updateItem(index, 'quantidade', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.custo_unitario}
                        disabled
                        className="w-full pl-6 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed opacity-100"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <select
                        value={item.margem_percentual}
                        onChange={(e) => updateItem(index, 'margem_percentual', e.target.value)}
                        className="w-full pl-3 pr-12 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none"
                      >
                        {MARGIN_OPTIONS.map(m => (
                          <option key={m} value={m}>{m}%</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_venda_unitario || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_total || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removerItem(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300 mb-2" />
                      <p>Nenhum item adicionado</p>
                      <button onClick={adicionarItem} className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                        Adicionar o primeiro item
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {itens.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Geral:
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calcularTotalGeral())}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default NovoOrcamento;
