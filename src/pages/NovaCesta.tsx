import { AlertCircle, Check, Minus, Package, Plus, Search, ShoppingBasket, User, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProdutos, type Produto } from '../hooks/useProdutos';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { CestaService } from '../services/cestaService';
import { ValidationService } from '../services/validationService';


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

const normalizar = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const NovaCesta: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;
  
  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedoresByAdmin(targetId || '', {
    enabled: !!targetId
  }) as { data: Vendedor[], isLoading: boolean };
  
  const [nomeCesta, setNomeCesta] = useState<string>('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');
  const [limiteMaximo, setLimiteMaximo] = useState<number>(50);
  const [quantidadeParaVendedor, setQuantidadeParaVendedor] = useState<number>(1); // ← NOVO
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filtroEstoque, setFiltroEstoque] = useState<'todos' | 'emEstoque'>('todos');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: produtos = [], isLoading: loadingProdutos } = useProdutos({
    enabled: !!targetId,
    searchTerm: debouncedSearchTerm
  }) as { data: Produto[], isLoading: boolean };

  const isBuscando = loadingProdutos || searchTerm !== debouncedSearchTerm;

  const [paginaAtual, setPaginaAtual] = useState(1);
  const PRODUTOS_POR_PAGINA = 9;
  const [itensCesta, setItensCesta] = useState<ItemCesta[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');


  useEffect(() => {
    let filtered: Produto[] = produtos;

    if (filtroEstoque === 'emEstoque') {
      filtered = filtered.filter((p: Produto) => p.qtd_estoque > 0);
    }

    if (searchTerm.trim()) {
      const termos = normalizar(searchTerm.trim()).split(/\s+/);
      filtered = filtered.filter((p: Produto) => {
        const campos =
          normalizar(p.produto_nome) + ' ' +
          normalizar(p.produto_cod) + ' ' +
          normalizar(p.categoria || '');
        return termos.every(termo => campos.includes(termo));
      });
    }

    setProdutosFiltrados(filtered);
    setPaginaAtual(1);
  }, [produtos, searchTerm, filtroEstoque]);


  const totalProdutos = itensCesta.length;
  const valorTotal = itensCesta.reduce((sum, item) => sum + (item.produto.preco_unt * item.quantidade), 0);


  const adicionarProduto = (produto: Produto) => {
    setErrors({});
    setSuccessMessage('');

    const duplicadoValidation = ValidationService.validateProdutoDuplicado(produto.id, itensCesta);
    if (!duplicadoValidation.isValid) {
      setErrors({ produto: duplicadoValidation.message! });
      return;
    }

    const cestasAtivas = JSON.parse(localStorage.getItem('cestasAtivas') || '[]');
    const novoItem: ItemCesta = { produtoId: produto.id, produto, quantidade: 1 };
    const itemValidation = ValidationService.validateItemCesta(novoItem, produto, cestasAtivas);
    if (!itemValidation.isValid) {
      setErrors({ produto: itemValidation.message! });
      return;
    }

    const limiteValidation = ValidationService.validateLimiteCesta(itensCesta, novoItem, limiteMaximo);
    if (!limiteValidation.isValid) {
      setErrors({ limite: limiteValidation.message! });
      return;
    }

    setItensCesta(prev => [...prev, novoItem]);
  };


  const removerProduto = (produtoId: string) => {
    setItensCesta(prev => prev.filter(item => item.produto.id !== produtoId));
    if (errors.produto || errors.limite) {
      setErrors(prev => ({ ...prev, produto: '', limite: '' }));
    }
  };


  const alterarQuantidade = (produtoId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerProduto(produtoId);
      return;
    }

    setErrors({});
    setSuccessMessage('');

    const item = itensCesta.find(i => i.produto.id === produtoId);
    if (!item) return;

    const cestasAtivas = JSON.parse(localStorage.getItem('cestasAtivas') || '[]');
    const itemAtualizado: ItemCesta = { ...item, quantidade: novaQuantidade };
    const itemValidation = ValidationService.validateItemCesta(itemAtualizado, item.produto, cestasAtivas);
    if (!itemValidation.isValid) {
      setErrors({ produto: itemValidation.message! });
      return;
    }

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
    setErrors({});
    setSuccessMessage('');

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

    if (!nomeCesta.trim()) {
      setErrors({ nome: 'Nome da cesta é obrigatório' });
      return;
    }

    if (itensCesta.length === 0) {
      setErrors({ itens: 'Adicione pelo menos um produto à cesta' });
      return;
    }

    // ← NOVO: validar quantidade para o vendedor
    if (!quantidadeParaVendedor || quantidadeParaVendedor < 1) {
      setErrors({ quantidade_vendedor: 'Informe quantas cestas o vendedor receberá' });
      return;
    }

    setIsLoading(true);

    try {
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

      const novaCesta = await CestaService.createCestaWithItems(cestaData);

      // ← NOVO: registrar estoque do vendedor
      const { error: estoqueError } = await supabase
        .from('estoque_vendedor')
        .upsert(
          {
            vendedor_id: vendedorSelecionado,
            produto_id: novaCesta.id,
            quantidade_disponivel: quantidadeParaVendedor,
            administrador_id: user?.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'vendedor_id,produto_id' }
        );

      if (estoqueError) {
        throw new Error(`Cesta criada, mas erro ao registrar estoque do vendedor: ${estoqueError.message}`);
      }

      setSuccessMessage(`Cesta "${novaCesta.nome}" criada com sucesso! ${quantidadeParaVendedor} unidade(s) registrada(s) para o vendedor.`);

      // Limpar formulário
      setVendedorSelecionado('');
      setLimiteMaximo(50);
      setQuantidadeParaVendedor(1); // ← NOVO: resetar
      setItensCesta([]);
      setNomeCesta('');

      setTimeout(() => {
        navigate('/produtos/cestas');
      }, 2000);

    } catch (error: unknown) {
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
        } else if (error.message.includes('estoque do vendedor')) { // ← NOVO
          setErrors({ submit: error.message });
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

  const calcularMaxCestas = (): { max: number; itemGargalo: string | null } => {
    if (itensCesta.length === 0) return { max: 0, itemGargalo: null };

    let max = Infinity;
    let itemGargalo: string | null = null;

    for (const item of itensCesta) {
      const possivel = Math.floor(item.produto.qtd_estoque / item.quantidade);
      if (possivel < max) {
        max = possivel;
        itemGargalo = item.produto.produto_nome;
      }
    }

    return {
      max: max === Infinity ? 0 : max,
      itemGargalo
    };
  };

  const { max: maxCestasDisponivel, itemGargalo } = useMemo(
    () => calcularMaxCestas(),
    [itensCesta]
  );
  
  // Ajusta a quantidade automaticamente se ultrapassar o novo máximo
  useEffect(() => {
    if (itensCesta.length > 0 && maxCestasDisponivel > 0 && quantidadeParaVendedor > maxCestasDisponivel) {
      setQuantidadeParaVendedor(maxCestasDisponivel);
    }
  }, [maxCestasDisponivel]);


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

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg">
          {successMessage}
        </div>
      )}

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
          
          {/* ← ALTERADO: grid de 3 para 4 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Cesta *
              </label>
              <input
                type="text"
                value={nomeCesta}
                onChange={(e) => {
                  setNomeCesta(e.target.value);
                  if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
                }}
                placeholder="Digite o nome da cesta"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.nome ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.nome && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.nome}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vendedor *
              </label>
              <select
                value={vendedorSelecionado}
                onChange={(e) => {
                  setVendedorSelecionado(e.target.value);
                  if (errors.vendedor) setErrors(prev => ({ ...prev, vendedor: '' }));
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
              {errors.vendedor && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.vendedor}</p>}
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
                  if (errors.limite_maximo) setErrors(prev => ({ ...prev, limite_maximo: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.limite_maximo ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.limite_maximo && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.limite_maximo}</p>}
            </div>

            {/* ← NOVO campo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Qtd. Cestas para Vendedor *
                {itensCesta.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                    (máx: {maxCestasDisponivel})
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max={maxCestasDisponivel > 0 ? maxCestasDisponivel : 1}
                value={quantidadeParaVendedor}
                onChange={(e) => {
                  const valor = parseInt(e.target.value) || 1;
                  if (itensCesta.length > 0 && valor > maxCestasDisponivel) {
                    setErrors(prev => ({
                      ...prev,
                      quantidade_vendedor: `Estoque insuficiente. O item "${itemGargalo ?? calcularMaxCestas().itemGargalo ?? 'desconhecido'}" limita a ${maxCestasDisponivel} cesta(s).`
                    }));
                    setQuantidadeParaVendedor(maxCestasDisponivel);
                    return;
                  }
                  setQuantidadeParaVendedor(valor);
                  if (errors.quantidade_vendedor) setErrors(prev => ({ ...prev, quantidade_vendedor: '' }));
                }}
                disabled={itensCesta.length === 0 || maxCestasDisponivel === 0}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.quantidade_vendedor ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {/* Aviso quando estoque zerado */}
              {itensCesta.length > 0 && maxCestasDisponivel === 0 && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Estoque insuficiente para montar ao menos 1 cesta completa.
                </p>
              )}
              {/* Aviso informativo quando há limite */}
              {itensCesta.length > 0 && maxCestasDisponivel > 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Estoque permite até {maxCestasDisponivel} cesta(s) completa(s).
                </p>
              )}
              {errors.quantidade_vendedor && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.quantidade_vendedor}</p>
              )}
            </div>
          </div>
        </div>

        {/* Seleção de Produtos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Produtos Disponíveis
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                ({produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {/* Filtro de estoque */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setFiltroEstoque('todos')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filtroEstoque === 'todos'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstoque('emEstoque')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filtroEstoque === 'emEstoque'
                      ? 'bg-white dark:bg-gray-600 text-green-700 dark:text-green-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Com Estoque
                </button>
              </div>
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {(() => {
            const totalPaginas = Math.ceil(produtosFiltrados.length / PRODUTOS_POR_PAGINA);
            const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
            const produtosPagina = produtosFiltrados.slice(inicio, inicio + PRODUTOS_POR_PAGINA);
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {isBuscando ? (
                    // Skeleton — exibe 6 cards fantasmas
                    Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
                      >
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-4" />
                        <div className="flex justify-between items-center mb-3">
                          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
                          <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded-full w-14" />
                        </div>
                        <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-full" />
                      </div>
                    ))
                  ) : produtosPagina.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-gray-500 dark:text-gray-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>Nenhum produto encontrado.</p>
                    </div>
                  ) : (
                    produtosPagina.map(produto => (
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
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">{produto.produto_nome}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{produto.produto_cod} • {produto.categoria}</p>
                          </div>
                          {produtoJaAdicionado(produto.id) && <Check className="w-4 h-4 text-green-600 dark:text-green-400" />}
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
                      </div>
                    ))
                  )}
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Página {paginaAtual} de {totalPaginas} &bull; {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPaginaAtual(1)}
                        disabled={paginaAtual === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                        disabled={paginaAtual === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ‹
                      </button>
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPaginaAtual(p as number)}
                              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                paginaAtual === p
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )
                      }
                      <button
                        type="button"
                        onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                        disabled={paginaAtual === totalPaginas}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaginaAtual(totalPaginas)}
                        disabled={paginaAtual === totalPaginas}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {errors.produto && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.produto}</div>
            </div>
          )}
          {errors.limite && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
              <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.limite}</div>
            </div>
          )}
          {errors.itens && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.itens}</div>
            </div>
          )}
        </div>

        {/* Cesta Atual — sem alterações */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ShoppingBasket className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              Cesta Atual ({totalProdutos}/{limiteMaximo} produtos)
            </h2>
            {itensCesta.length > 0 && (
              <button type="button" onClick={limparCesta} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium">
                Limpar Cesta
              </button>
            )}
          </div>

          {itensCesta.length > 0 ? (
            <div className="space-y-3">
              {itensCesta.map(item => (
                <div key={item.produto.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{item.produto.produto_nome}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">R$ {item.produto.preco_unt.toFixed(2)} cada</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <button type="button" onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
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
                      <button type="button" onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)} disabled={item.quantidade >= item.produto.qtd_estoque} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                        <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[60px] text-right">
                      R$ {(item.produto.preco_unt * item.quantidade).toFixed(2)}
                    </span>
                    <button type="button" onClick={() => removerProduto(item.produto.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400">
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
              <p className="text-gray-500 dark:text-gray-400">Nenhum produto adicionado à cesta</p>
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
          <button type="button" onClick={() => navigate('/produtos/cestas')} className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading || itensCesta.length === 0} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed">
            {isLoading ? 'Criando...' : 'Criar Cesta'}
          </button>
        </div>
      </form>

      {/* Alertas */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Importante</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
              <li>• Produtos adicionados à cesta serão reservados do estoque</li>
              <li>• Cada vendedor pode ter apenas uma cesta ativa por vez</li>
              <li>• O limite máximo de itens não pode ser alterado após a criação</li>
              <li>• A quantidade de cestas define o limite de entregas do vendedor no aplicativo mobile</li> {/* ← NOVO */}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaCesta;
