import { AlertCircle, ArrowLeft, Check, Loader2, Minus, Package, Plus, Search, ShoppingBasket, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCestaBaseDetalhes, useUpdateCestaBase } from '../hooks/useCestasBase';
import { useProdutos, type Produto } from '../hooks/useProdutos';
import { applyCurrencyMask, formatCurrency } from '../utils/currencyUtils';

interface ItemCesta {
  produtoId: string;
  produto: Produto;
  quantidade: number;
}

const normalizar = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const EditarCestaBase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;

  const { data: cestaOriginal, isLoading: loadingCesta } = useCestaBaseDetalhes(id || '', {
    enabled: !!id && !!targetId
  });

  const updateCestaBaseMutation = useUpdateCestaBase();

  const [nomeCesta, setNomeCesta] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [precoFinalStr, setPrecoFinalStr] = useState<string>('');
  
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  const [itensCesta, setItensCesta] = useState<ItemCesta[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [paginaAtual, setPaginaAtual] = useState(1);
  const PRODUTOS_POR_PAGINA = 9;

  // Carregar dados originais
  useEffect(() => {
    if (cestaOriginal) {
      setNomeCesta(cestaOriginal.nome);
      setDescricao(cestaOriginal.descricao || '');
      setPrecoFinalStr(formatCurrency(cestaOriginal.preco));

      if (cestaOriginal.cestas_base_itens) {
        const itensMapeados: ItemCesta[] = cestaOriginal.cestas_base_itens.map((item: any) => ({
          produtoId: item.produto_cadastrado_id,
          quantidade: item.quantidade,
          produto: {
            id: item.produto_cadastrado_id,
            produto_nome: item.produto?.produto_nome || 'Desconhecido',
            preco_unt: item.produto?.preco_unt || 0,
            categoria: '',
            produto_cod: '',
            qtd_estoque: 9999, // Não aplicável estritamente na cesta base
          } as Produto
        }));
        setItensCesta(itensMapeados);
      }
    }
  }, [cestaOriginal]);

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

  useEffect(() => {
    let filtered: Produto[] = produtos;

    if (searchTerm.trim()) {
      const termos = normalizar(searchTerm.trim()).split(/\s+/);
      filtered = filtered.filter((p: Produto) => {
        const campos =
          normalizar(p.produto_nome) + ' ' +
          normalizar(p.produto_cod || '') + ' ' +
          normalizar(p.categoria || '');
        return termos.every(termo => campos.includes(termo));
      });
    }

    setProdutosFiltrados(filtered);
    setPaginaAtual(1);
  }, [produtos, searchTerm]);

  const precoSugerido = useMemo(() => {
    return itensCesta.reduce((sum, item) => sum + (item.produto.preco_unt * item.quantidade), 0);
  }, [itensCesta]);

  const adicionarProduto = (produto: Produto) => {
    setErrors({});
    if (itensCesta.some(i => i.produtoId === produto.id)) return;
    setItensCesta(prev => [...prev, { produtoId: produto.id, produto, quantidade: 1 }]);
  };

  const removerProduto = (produtoId: string) => {
    setItensCesta(prev => prev.filter(item => item.produtoId !== produtoId));
  };

  const alterarQuantidade = (produtoId: string, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      removerProduto(produtoId);
      return;
    }
    setItensCesta(prev =>
      prev.map(item =>
        item.produtoId === produtoId ? { ...item, quantidade: novaQuantidade } : item
      )
    );
  };

  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrecoFinalStr(applyCurrencyMask(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!nomeCesta.trim()) {
      setErrors({ nome: 'Nome da cesta base é obrigatório' });
      return;
    }

    if (itensCesta.length === 0) {
      setErrors({ itens: 'Adicione pelo menos um produto à cesta' });
      return;
    }

    let precoFinalNumber = 0;
    if (precoFinalStr) {
      const cleanString = precoFinalStr.replace(/[R$\s.]/g, '').replace(',', '.');
      precoFinalNumber = parseFloat(cleanString);
    }
    
    if (!precoFinalNumber || precoFinalNumber <= 0) {
      precoFinalNumber = precoSugerido;
    }

    try {
      await updateCestaBaseMutation.mutateAsync({
        id: id!,
        dados: {
          nome: nomeCesta.trim(),
          descricao: descricao.trim() || undefined,
          preco: precoFinalNumber,
          itens: itensCesta.map(item => ({
            produto_cadastrado_id: item.produtoId,
            quantidade: item.quantidade
          }))
        }
      });

      navigate('/produtos/cestas-base');
    } catch (error: any) {
      setErrors({ submit: error?.message || 'Erro ao atualizar cesta base. Tente novamente.' });
    }
  };

  const produtoJaAdicionado = (produtoId: string) => {
    return itensCesta.some(item => item.produtoId === produtoId);
  };

  if (loadingCesta) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!cestaOriginal) {
    return (
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Cesta Base não encontrada</h2>
        <button onClick={() => navigate('/produtos/cestas-base')} className="text-blue-500 hover:underline">
          Voltar para listar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Editar Cesta Base</h1>
          <p className="text-gray-600 dark:text-gray-400">Edite o modelo de cesta</p>
        </div>
        <button 
          onClick={() => navigate('/produtos/cestas-base')}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
      </div>

      {errors.submit && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          <span>{errors.submit}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Configurações da Cesta */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <ShoppingBasket className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            Dados da Cesta
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do Modelo *
              </label>
              <input
                type="text"
                value={nomeCesta}
                onChange={(e) => {
                  setNomeCesta(e.target.value);
                  if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.nome ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.nome && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.nome}</p>}
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preço Final
              </label>
              <input
                type="text"
                value={precoFinalStr}
                onChange={handlePrecoChange}
                placeholder="Deixe em branco p/ usar o Preço Sugerido"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              {precoSugerido > 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Sugerido: {formatCurrency(precoSugerido)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cesta Atual (Itens Selecionados) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Itens da Cesta ({itensCesta.length} incluídos)
            </h2>
            {itensCesta.length > 0 && (
              <button 
                type="button" 
                onClick={() => setItensCesta([])} 
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
              >
                Limpar Cesta
              </button>
            )}
          </div>

          {itensCesta.length > 0 ? (
            <div className="space-y-3">
              {itensCesta.map(item => (
                <div key={item.produtoId} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{item.produto.produto_nome}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(item.produto.preco_unt)} cada</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <button type="button" onClick={() => alterarQuantidade(item.produtoId, item.quantidade - 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded">
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => alterarQuantidade(item.produtoId, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white font-medium"
                      />
                      <button type="button" onClick={() => alterarQuantidade(item.produtoId, item.quantidade + 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 rounded">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px] text-right">
                      {formatCurrency(item.produto.preco_unt * item.quantidade)}
                    </span>
                    <button type="button" onClick={() => removerProduto(item.produtoId)} className="p-1.5 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                <div className="flex justify-end items-center text-lg text-gray-900 dark:text-white">
                  <span className="mr-4 text-gray-500 dark:text-gray-400 text-sm">Preço Sugerido:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(precoSugerido)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
              <ShoppingBasket className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum produto adicionado ao modelo.</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Busque no catálogo abaixo para adicionar.</p>
            </div>
          )}

          {errors.itens && (
            <div className="mt-4 text-red-500 text-sm text-center">{errors.itens}</div>
          )}
        </div>

        {/* Seleção de Produtos no Catálogo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Catálogo de Produtos</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, código ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="p-6">
            {(() => {
              const totalPaginas = Math.ceil(produtosFiltrados.length / PRODUTOS_POR_PAGINA);
              const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
              const produtosPagina = produtosFiltrados.slice(inicio, inicio + PRODUTOS_POR_PAGINA);
              
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isBuscando ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
                          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-4" />
                          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-full mt-4" />
                        </div>
                      ))
                    ) : produtosPagina.length === 0 ? (
                      <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-10 text-gray-500 dark:text-gray-400">
                        <p>Nenhum produto encontrado na busca.</p>
                      </div>
                    ) : (
                      produtosPagina.map(produto => {
                        const isAdded = produtoJaAdicionado(produto.id);
                        return (
                          <div
                            key={produto.id}
                            className={`border rounded-lg p-4 transition-all ${
                              isAdded
                                ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 pr-2">
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2" title={produto.produto_nome}>
                                  {produto.produto_nome}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {produto.produto_cod || 'S/N'} {produto.categoria ? `• ${produto.categoria}` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(produto.preco_unt)}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => adicionarProduto(produto)}
                              disabled={isAdded || produto.preco_unt <= 0}
                              className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                isAdded
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-not-allowed border border-green-200 dark:border-green-800'
                                  : produto.preco_unt <= 0
                                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-600'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800'
                              }`}
                            >
                              {isAdded ? (
                                <><Check className="w-4 h-4" /> Item Adicionado</>
                              ) : produto.preco_unt <= 0 ? (
                                <><X className="w-4 h-4" /> Valor zerado</>
                              ) : (
                                <><Plus className="w-4 h-4" /> Incluir no Modelo</>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {totalPaginas > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Mostrando {produtosPagina.length} de {produtosFiltrados.length} produtos
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        <span className="px-3 text-sm text-gray-600 dark:text-gray-400">
                          {paginaAtual} de {totalPaginas}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button 
            type="button" 
            onClick={() => navigate('/produtos/cestas-base')} 
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={updateCestaBaseMutation.isPending || itensCesta.length === 0} 
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center shadow-sm"
          >
            {updateCestaBaseMutation.isPending ? 'Salvando...' : 'Atualizar Cesta Base'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditarCestaBase;
