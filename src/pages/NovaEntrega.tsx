import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, Package, Search, ShoppingCart, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useClientesByAdmin } from '../hooks/useClientes';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { CACHE_KEYS } from '../lib/supabaseCache';

// Steps definition
const STEPS = [
  { number: 1, title: 'Selecionar Cliente' },
  { number: 2, title: 'Selecionar Produtos' },
  { number: 3, title: 'Finalizar Entrega' }
];

interface CartItem {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
}

const NovaEntrega: React.FC = () => {
  const navigate = useNavigate();
  const { adminId } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  
  // Debounce para busca de clientes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Selection State
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Hooks
  // Usando useClientesByAdmin para busca avançada de clientes (igual a Clientes.tsx)
  const { data: clientes = [], isLoading: isLoadingClientes } = useClientesByAdmin(adminId || '', {
    enabled: currentStep === 1 && !!adminId,
    search: debouncedSearchTerm || undefined,
    pageSize: 50
  });

  // Busca direta na tabela produtos_cadastrado (solicitação explícita para não usar tabela 'produtos')
  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos_cadastrado_entrega', adminId],
    queryFn: async () => {
      if (!adminId) return [];
      
      const { data, error } = await supabase
        .from('produtos_cadastrado')
        .select('*')
        .eq('administrador_id', adminId)
        .eq('ativo', true)
        .order('produto_nome');
        
      if (error) {
        console.error('Erro ao buscar produtos:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: (currentStep === 2 || currentStep === 3) && !!adminId,
    staleTime: 1000 * 60 * 5 // 5 minutos
  });

  const { data: vendedores = [], isLoading: isLoadingVendedores } = useVendedoresByAdmin(adminId || '', {
    enabled: currentStep === 3
  });

  // Filter products
  const filteredProdutos = useMemo(() => {
    if (!productSearchTerm) return produtos;
    const lowerTerm = productSearchTerm.toLowerCase();
    return produtos.filter((p: any) => 
      p.produto_nome.toLowerCase().includes(lowerTerm) || 
      p.produto_cod?.toLowerCase().includes(lowerTerm)
    );
  }, [produtos, productSearchTerm]);

  // Calculate Total
  const totalValue = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0);
  }, [cartItems]);

  // Helpers
  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return 'N/A';
    
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Aplica a máscara baseada no tamanho do número
    if (cleanPhone.length === 11) {
      // Celular: (XX) 9XXXX-XXXX
      return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 10) {
      // Fixo: (XX) XXXX-XXXX
      return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanPhone.length === 9) {
      // Celular sem DDD: 9XXXX-XXXX
      return cleanPhone.replace(/(\d{5})(\d{4})/, '$1-$2');
    } else if (cleanPhone.length === 8) {
      // Fixo sem DDD: XXXX-XXXX
      return cleanPhone.replace(/(\d{4})(\d{4})/, '$1-$2');
    }
    
    // Se não se encaixar nos padrões, retorna o número original
    return phone;
  };

  // Handlers
  const handleSelectCliente = (cliente: any) => {
    setSelectedCliente(cliente);
    setCurrentStep(2);
    setSearchTerm('');
  };

  const handleQuantityChange = (produto: any, quantity: number) => {
    if (quantity < 0) return;
    
    setCartItems(prev => {
      const existingItemIndex = prev.findIndex(item => item.produtoId === produto.id);
      
      if (quantity === 0) {
        // Remove item if quantity is 0
        if (existingItemIndex >= 0) {
          return prev.filter((_, index) => index !== existingItemIndex);
        }
        return prev;
      }

      const newItem = {
        produtoId: produto.id,
        produtoNome: produto.produto_nome,
        quantidade: quantity,
        precoUnitario: produto.preco_unt
      };

      if (existingItemIndex >= 0) {
        // Update existing
        const newCart = [...prev];
        newCart[existingItemIndex] = newItem;
        return newCart;
      } else {
        // Add new
        return [...prev, newItem];
      }
    });
  };

  const getProductQuantity = (produtoId: string) => {
    return cartItems.find(item => item.produtoId === produtoId)?.quantidade || 0;
  };

  const handleFinalize = async () => {
    if (!selectedCliente || cartItems.length === 0 || !selectedVendedor) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Entrega
      // We use the first product as the "main" product for legacy compatibility
      const mainProduct = cartItems[0];

      const entregaData = {
        cliente_id: selectedCliente.id,
        vendedor_id: selectedVendedor,
        produto_id: mainProduct.produtoId, 
        valor: totalValue,
        data_entrega: new Date().toISOString(),
        status_entrega: 'Pendente',
        status_pagamento: 'Pendente',
        pago: false,
        sincronizado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: entrega, error: entregaError } = await supabase
        .from('entregas')
        .insert(entregaData)
        .select()
        .single();

      if (entregaError) throw entregaError;

      // 2. Create Itens Entrega
      const itensData = cartItems.map(item => ({
        entrega_id: entrega.id,
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario
      }));

      const { error: itensError } = await supabase
        .from('itens_entrega')
        .insert(itensData);

      if (itensError) {
        // If items fail, we might want to delete the header or just warn
        console.error('Error creating items:', itensError);
        toast.error('Entrega criada, mas houve erro ao salvar os itens.');
      } else {
        toast.success('Entrega criada com sucesso!');
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.ENTREGAS] });
        queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.CLIENTES] }); // Update client stats if any
        
        navigate('/entregas');
      }
    } catch (error: any) {
      console.error('Error creating entrega:', error);
      toast.error('Erro ao criar entrega: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Steps
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar clientes..."
          className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoadingClientes ? (
          <div className="p-8 text-center text-gray-500">Carregando clientes...</div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum cliente encontrado.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
            {clientes.map((cliente: any) => {
              const isPJ = cliente.tipo_pessoa === 'PJ';
              const nome = isPJ ? (cliente.nome_fantasia || cliente.razao_social || cliente.responsavel_pj_nome) : cliente.nome;
              
              return (
              <button
                key={cliente.id}
                onClick={() => handleSelectCliente(cliente)}
                className="w-full text-left p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${isPJ ? 'bg-blue-600' : 'bg-green-600'}`}>
                    {isPJ ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {nome}
                      </h3>
                      {isPJ && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          PJ
                        </span>
                      )}
                    </div>
                    {isPJ && cliente.responsavel_pj_nome && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        Resp: {cliente.responsavel_pj_nome}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 gap-1 sm:gap-2 mt-0.5">
                      <span className="truncate">
                        {formatPhoneNumber(cliente.telefone)}
                      </span>
                      <span className="hidden sm:inline text-gray-300 dark:text-gray-600">•</span>
                      <span className="truncate">
                        {`${cliente.endereco || ''}${cliente.numero ? `, ${cliente.numero}` : ''}${cliente.Bairro || cliente.bairro ? `, ${cliente.Bairro || cliente.bairro}` : ''}${cliente.Cidade || cliente.cidade ? `, ${cliente.Cidade || cliente.cidade}` : ''}`.replace(/^, /g, '') || 'Sem endereço'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-4" />
              </button>
            )})}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => {
    const isPJ = selectedCliente?.tipo_pessoa === 'PJ';
    const nome = isPJ ? (selectedCliente?.nome_fantasia || selectedCliente?.razao_social || selectedCliente?.responsavel_pj_nome) : selectedCliente?.nome;

    return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${isPJ ? 'bg-blue-600' : 'bg-green-600'}`}>
             {isPJ ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              Cliente: {nome}
              {isPJ && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PJ
                </span>
              )}
            </span>
            {isPJ && selectedCliente?.responsavel_pj_nome && (
               <span className="text-xs text-gray-500 dark:text-gray-400">Resp: {selectedCliente.responsavel_pj_nome}</span>
            )}
          </div>
        </div>
        <button 
          onClick={() => setCurrentStep(1)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Trocar
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar produtos..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          value={productSearchTerm}
          onChange={(e) => setProductSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Produtos Disponíveis</span>
          </div>
          <div className="flex items-center justify-between bg-blue-100 dark:bg-blue-900/40 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {cartItems.length} {cartItems.length === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
            </div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        
        {isLoadingProdutos ? (
          <div className="p-8 text-center text-gray-500">Carregando produtos...</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[50vh] overflow-y-auto">
            {filteredProdutos.map((produto: any) => {
              const quantity = getProductQuantity(produto.id);
              return (
                <div key={produto.id} className={`p-4 flex items-center justify-between ${quantity > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-gray-600 dark:text-gray-400 shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white text-lg">{produto.produto_nome}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">R$ {produto.preco_unt?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleQuantityChange(produto, quantity - 1)}
                      className="w-10 h-10 rounded-md bg-white dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm border border-gray-200 dark:border-gray-600"
                      disabled={quantity <= 0}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(produto, parseInt(e.target.value) || 0)}
                      className="w-16 text-center border-none bg-transparent focus:ring-0 text-gray-900 dark:text-white font-bold text-lg mx-2"
                      min="0"
                    />
                    <button
                      onClick={() => handleQuantityChange(produto, quantity + 1)}
                      className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 shadow-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={() => setCurrentStep(3)}
          disabled={cartItems.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span>Próximo: Selecionar Vendedor</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resumo do Cliente e Produtos */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-500" />
              Cliente
            </h3>
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              {selectedCliente?.tipo_pessoa === 'PJ' ? selectedCliente?.responsavel_pj_nome : selectedCliente?.nome}
            </p>
            <p className="text-sm text-gray-500">{selectedCliente?.endereco}, {selectedCliente?.numero}</p>
            <p className="text-sm text-gray-500">{selectedCliente?.Cidade} - {selectedCliente?.Estado}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-blue-500" />
              Itens da Entrega
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.quantidade}x {item.produtoNome}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    R$ {(item.quantidade * item.precoUnitario).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <span className="font-bold text-gray-900 dark:text-white">Total</span>
              <span className="font-bold text-xl text-blue-600 dark:text-blue-400">R$ {totalValue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Seleção de Vendedor */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-fit">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-500" />
            Selecionar Vendedor Responsável
          </h3>
          
          {isLoadingVendedores ? (
            <p className="text-gray-500">Carregando vendedores...</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {vendedores.map((vendedor: any) => (
                <label 
                  key={vendedor.id} 
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedVendedor === vendedor.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' 
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="vendedor"
                    value={vendedor.id}
                    checked={selectedVendedor === vendedor.id}
                    onChange={() => setSelectedVendedor(vendedor.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-3 font-medium text-gray-900 dark:text-white">{vendedor.nome}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
        
        <button
          onClick={handleFinalize}
          disabled={isSubmitting || !selectedVendedor}
          className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Processando...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Finalizar Entrega</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <button 
          onClick={() => navigate('/entregas')}
          className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nova Entrega</h1>
          <p className="text-gray-500 dark:text-gray-400">Preencha os dados para criar uma nova entrega</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10"></div>
          {STEPS.map((step) => {
            const isActive = currentStep >= step.number;
            const isCurrent = currentStep === step.number;
            return (
              <div key={step.number} className="flex flex-col items-center bg-gray-50 dark:bg-gray-900 px-4">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.number}
                </div>
                <span className={`mt-2 text-sm font-medium ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default NovaEntrega;
