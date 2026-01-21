import React, { useState, useEffect } from 'react';
import { ShoppingBasket, Plus, Minus, Search, User, Package, AlertCircle, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ValidationService } from '../services/validationService';
import { CestaService } from '../services/cestaService';
import { useAuth } from '../contexts/AuthContext';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { useProdutos } from '../hooks/useProdutos';

interface Produto {
  id: string;
  produto_nome: string;
  produto_cod: string;
  categoria: string;
  qtd_estoque: number;
  preco_unt: number;
  descricao?: string;
}

interface ItemCesta {
  produtoId: string;
  produto: Produto;
  quantidade: number;
}

interface Vendedor {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  admin_id: string;
  administrador_id: string;
  ativo: boolean;
  comissao_percentual?: number;
  percentual_minimo?: number;
  created_at: string;
  updated_at: string;
}

// Dados simulados - remover quando integrar com backend real

const NovaCesta: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch real data from database
  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedoresByAdmin(user?.id || '', {
    enabled: !!user?.id
  }) as { data: Vendedor[], isLoading: boolean };
  
  const { data: produtos = [] } = useProdutos({
    enabled: !!user?.id
  }) as { data: Produto[], isLoading: boolean };

  const [nomeCesta, setNomeCesta] = useState<string>('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');
  const [limiteMaximo, setLimiteMaximo] = useState<number>(50);
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [itensCesta, setItensCesta] = useState<ItemCesta[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Filtrar produtos
  useEffect(() => {
    let filtered: Produto[] = produtos;

    if (searchTerm) {
      filtered = filtered.filter((produto: Produto) =>
        produto.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.produto_cod.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setProdutosFiltrados(filtered);
  }, [produtos, searchTerm]);

  // Calcular totais
  const totalProdutos = itensCesta.length; // Conta produtos únicos
  const valorTotal = itensCesta.reduce((sum, item) => sum + (item.produto.preco_unt * item.quantidade), 0);

  const adicionarProduto = (produto: Produto) => {
    // Limpar mensagens anteriores
    setErrors({});
    setSuccessMessage('');

    // Validar produto duplicado
    const duplicadoValidation = ValidationService.validateProdutoDuplicado(produto.id, itensCesta);
    if (!duplicadoValidation.isValid) {
      setErrors({ produto: duplicadoValidation.message! });
      return;
    }

    // Simular cestas ativas para validação de estoque
    const cestasAtivas = JSON.parse(localStorage.getItem('cestasAtivas') || '[]');
    
    // Validar item da cesta (estoque disponível)
    const novoItem: ItemCesta = { produtoId: produto.id, produto, quantidade: 1 };
    const itemValidation = ValidationService.validateItemCesta(novoItem, produto, cestasAtivas);
    if (!itemValidation.isValid) {
      setErrors({ produto: itemValidation.message! });
      return;
    }

    // Validar limite da cesta
    const limiteValidation = ValidationService.validateLimiteCesta(itensCesta, novoItem, limiteMaximo);
    if (!limiteValidation.isValid) {
      setErrors({ limite: limiteValidation.message! });
      return;
    }

    setItensCesta(prev => [...prev, novoItem]);
  };

  const removerProduto = (produtoId: string) => {
    setItensCesta(prev => prev.filter(item => item.produto.id !== produtoId));
    // Limpar erros relacionados
    if (errors.produto || errors.limite) {
      setErrors(prev => ({
        ...prev,
        produto: '',
        limite: ''
      }));
    }
  };

  const alterarQuantidade = (produtoId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerProduto(produtoId);
      return;
    }

    // Limpar mensagens anteriores
    setErrors({});
    setSuccessMessage('');

    const item = itensCesta.find(i => i.produto.id === produtoId);
    if (!item) return;

    // Simular cestas ativas para validação de estoque
    const cestasAtivas = JSON.parse(localStorage.getItem('cestasAtivas') || '[]');
    
    // Validar item da cesta com nova quantidade
    const itemAtualizado: ItemCesta = { ...item, quantidade: novaQuantidade };
    const itemValidation = ValidationService.validateItemCesta(itemAtualizado, item.produto, cestasAtivas);
    if (!itemValidation.isValid) {
      setErrors({ produto: itemValidation.message! });
      return;
    }

    // Validar limite da cesta
    const limiteValidation = ValidationService.validateLimiteCesta(itensCesta, itemAtualizado, limiteMaximo, true);
    if (!limiteValidation.isValid) {
      setErrors({ limite: limiteValidation.message! });
      return;
    }

    setItensCesta(prev => 
      prev.map(item => 
        item.produto.id === produtoId 
          ? { ...item, quantidade: novaQuantidade }
          : item
      )
    );
  };

  const limparCesta = () => {
    if (confirm('Tem certeza que deseja limpar toda a cesta?')) {
      setItensCesta([]);
      setErrors({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpar mensagens anteriores
    setErrors({});
    setSuccessMessage('');

    // Validar cesta básica
    const cestaValidation = ValidationService.validateCesta({
      vendedorId: vendedorSelecionado,
      limiteMaximo
    });

    if (!cestaValidation.isValid) {
      if (cestaValidation.message?.includes('Vendedor')) {
        setErrors({ vendedor: cestaValidation.message });
      } else if (cestaValidation.message?.includes('Limite')) {
        setErrors({ limite: cestaValidation.message });
      }
      return;
    }

    // Validar nome da cesta
    if (!nomeCesta.trim()) {
      setErrors({ nome: 'Nome da cesta é obrigatório' });
      return;
    }

    // Verificar se há itens na cesta
    if (itensCesta.length === 0) {
      setErrors({ itens: 'Adicione pelo menos um produto à cesta' });
      return;
    }

    setIsLoading(true);

    try {
      // Preparar dados para criação da cesta
      const cestaData = {
        vendedor_id: vendedorSelecionado,
        administrador_id: user?.id || '',
        limite_maximo: limiteMaximo,
        nome: nomeCesta.trim(),
        itens: itensCesta.map(item => ({
          produto_cadastrado_id: item.produtoId,
          quantidade: item.quantidade
        }))
      };

      // Criar cesta no Supabase com transação atômica
      const novaCesta = await CestaService.createCestaWithItems(cestaData);

      setSuccessMessage(`Cesta "${novaCesta.nome}" criada com sucesso!`);

      // Limpar formulário
      setVendedorSelecionado('');
      setLimiteMaximo(50);
      setItensCesta([]);

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/produtos/cestas');
      }, 2000);

    } catch (error: unknown) {
      // Tratamento específico de erros
      if (error instanceof Error) {
        if (error.message.includes('Vendedor não encontrado')) {
          setErrors({ vendedor: 'Erro: Vendedor selecionado não é válido ou está inativo.' });
        } else if (error.message.includes('já possui uma cesta ativa')) {
          setErrors({ vendedor: 'Erro: Este vendedor já possui uma cesta ativa. Finalize a cesta atual antes de criar uma nova.' });
        } else if (error.message.includes('Estoque insuficiente')) {
          setErrors({ produto: `Erro: ${error.message}` });
        } else if (error.message.includes('produtos não foram encontrados')) {
          setErrors({ produto: 'Erro: Um ou mais produtos selecionados não estão disponíveis.' });
        } else if (error.message.includes('Vendedor e administrador são obrigatórios')) {
          setErrors({ vendedor: 'Erro: Dados de vendedor ou administrador inválidos.' });
        } else if (error.message?.includes('produtos')) {
          setErrors({ produto: 'Erro ao processar produtos da cesta' });
        } else if (error.message?.includes('vendedor')) {
          setErrors({ vendedor: 'Erro relacionado ao vendedor selecionado' });
        } else if (error.message?.includes('transação') || error.message?.includes('atomicidade')) {
          setErrors({ submit: 'Erro na transação. Tente novamente.' });
        } else {
          setErrors({ submit: `Erro ao criar cesta: ${error.message}` });
        }
      } else {
        setErrors({ submit: 'Erro inesperado ao criar cesta. Tente novamente.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const produtoJaAdicionado = (produtoId: string) => {
    return itensCesta.some(item => item.produto.id === produtoId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Nova Cesta</h1>
          <p className="text-gray-600 dark:text-gray-400">Monte uma nova cesta de produtos para vendedor</p>
        </div>
        <button 
          onClick={() => navigate('/produtos/cestas')}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Voltar
        </button>
      </div>

      {/* Mensagem de Sucesso */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Erro de Submissão */}
      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Configurações da Cesta */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Configurações da Cesta
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Cesta *
              </label>
              <input
                type="text"
                value={nomeCesta}
                onChange={(e) => {
                  setNomeCesta(e.target.value);
                  if (errors.nome) {
                    setErrors(prev => ({ ...prev, nome: '' }));
                  }
                }}
                placeholder="Digite o nome da cesta"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.nome ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.nome && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.nome}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vendedor *
              </label>
              <select
                value={vendedorSelecionado}
                onChange={(e) => {
                  setVendedorSelecionado(e.target.value);
                  if (errors.vendedor) {
                    setErrors(prev => ({ ...prev, vendedor: '' }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.vendedor ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={loadingVendedores}
              >
                <option value="">
                  {loadingVendedores ? 'Carregando vendedores...' : 'Selecione um vendedor'}
                </option>
                {vendedores.map((vendedor: Vendedor) => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.nome}
                  </option>
                ))}
              </select>
              {errors.vendedor && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.vendedor}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Limite Máximo de Itens *
              </label>
              <input
                type="number"
                min="1"
                value={limiteMaximo}
                onChange={(e) => {
                  setLimiteMaximo(parseInt(e.target.value) || 0);
                  if (errors.limite_maximo) {
                    setErrors(prev => ({ ...prev, limite_maximo: '' }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.limite_maximo ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.limite_maximo && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.limite_maximo}</p>
              )}
            </div>
          </div>
        </div>

        {/* Seleção de Produtos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Produtos Disponíveis
            </h2>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {produtosFiltrados.map(produto => (
              <div 
                key={produto.id} 
                className={`border rounded-lg p-4 transition-colors ${
                  produtoJaAdicionado(produto.id) 
                    ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {produto.produto_nome}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {produto.produto_cod} • {produto.categoria}
                    </p>
                  </div>
                  {produtoJaAdicionado(produto.id) && (
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    R$ {produto.preco_unt.toFixed(2)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    produto.qtd_estoque > 10 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : produto.qtd_estoque > 0
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {produto.qtd_estoque} un.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => adicionarProduto(produto)}
                  disabled={produtoJaAdicionado(produto.id) || produto.qtd_estoque === 0 || totalProdutos >= limiteMaximo}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    produtoJaAdicionado(produto.id)
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 cursor-not-allowed'
                      : produto.qtd_estoque === 0 || totalProdutos >= limiteMaximo
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {produtoJaAdicionado(produto.id) 
                    ? 'Adicionado' 
                    : produto.qtd_estoque === 0 
                    ? 'Sem estoque'
                    : totalProdutos >= limiteMaximo
                    ? 'Limite atingido'
                    : 'Adicionar'
                  }
                </button>

                {errors[`produto_${produto.id}`] && (
                  <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                    {errors[`produto_${produto.id}`]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Mensagens de Erro Gerais */}
          {errors.produto && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {errors.produto}
              </div>
            </div>
          )}

          {errors.limite && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {errors.limite}
              </div>
            </div>
          )}

          {errors.itens && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {errors.itens}
              </div>
            </div>
          )}
        </div>

        {/* Cesta Atual */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ShoppingBasket className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              Cesta Atual ({totalProdutos}/{limiteMaximo} produtos)
            </h2>
            {itensCesta.length > 0 && (
              <button
                type="button"
                onClick={limparCesta}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
              >
                Limpar Cesta
              </button>
            )}
          </div>

          {itensCesta.length > 0 ? (
            <div className="space-y-3">
              {itensCesta.map(item => (
                <div key={item.produto.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {item.produto.produto_nome}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      R$ {item.produto.preco_unt.toFixed(2)} cada
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                      >
                        <Minus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        max={item.produto.qtd_estoque}
                        value={item.quantidade}
                        onChange={(e) => alterarQuantidade(item.produto.id, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)}
                        disabled={item.quantidade >= item.produto.qtd_estoque}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                    
                    <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[60px] text-right">
                      R$ {(item.produto.preco_unt * item.quantidade).toFixed(2)}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => removerProduto(item.produto.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-4">
                <div className="flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Total:</span>
                  <span>R$ {valorTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <ShoppingBasket className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum produto adicionado à cesta
              </p>
            </div>
          )}

          {errors.itens && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{errors.itens}</p>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/produtos/cestas')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || itensCesta.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isLoading ? 'Criando...' : 'Criar Cesta'}
          </button>
        </div>
      </form>

      {/* Alertas */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Importante
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
              <li>• Produtos adicionados à cesta serão reservados do estoque</li>
              <li>• Cada vendedor pode ter apenas uma cesta ativa por vez</li>
              <li>• O limite máximo de itens não pode ser alterado após a criação</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaCesta;
