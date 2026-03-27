import { AlertCircle, ArrowLeft, Check, Minus, Package, Plus, Search, ShoppingBasket, User, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCestaDetalhes } from '../hooks/useCestas';
import { useProdutos, type Produto } from '../hooks/useProdutos';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { CestaService } from '../services/cestaService';
import { ValidationService } from '../services/validationService';

interface ItemCesta {
  produtoId: string;
  produto: Produto;
  quantidade: number;
}

const normalizar = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const EditarCesta: React.FC = () => {
  const navigate = useNavigate();
  const { id: cestaId } = useParams();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;
  
  const { data: vendedores = [] } = useVendedoresByAdmin(targetId || '', {
    enabled: !!targetId
  });


  // Buscar dados da cesta existente
  const { data: cestaDetalhes, isLoading: loadingCesta } = useCestaDetalhes(cestaId || '', {
    enabled: !!cestaId && !!targetId
  });

  const [nomeCesta, setNomeCesta] = useState<string>('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');
  const [limiteMaximo] = useState<number>(50);
  // produtosFiltrados is now derived via useMemo — no useState needed
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

  // Carregar dados da cesta quando disponíveis
  useEffect(() => {
    if (cestaDetalhes && !isLoading && !loadingCesta) {
      // Como o useCestaDetalhes retorna { itens: [...] }, precisamos de uma forma de obter os metadados da cesta (nome, vendedor, limite)
      // O hook atual useCestaDetalhes só retorna itens. Vamos precisar buscar os metadados separadamente ou ajustar o hook.
      // Por enquanto, vamos tentar obter via CestaService se necessário, ou assumir que o hook será ajustado.
      // Assumindo que precisamos buscar os metadados da cesta:
      const fetchCestaMetadata = async () => {
        try {
          // Buscar metadados da cesta diretamente
          const cestaMetadata = await CestaService.getCestaById(cestaId!);
          if (cestaMetadata) {
            setNomeCesta(cestaMetadata.nome);
            setVendedorSelecionado(cestaMetadata.vendedor_id);
            // Limite máximo não está disponível na interface Cesta atual, mas podemos assumir um valor ou buscar de outra forma se necessário
            // Por enquanto mantemos o padrão
          }

          if (cestaDetalhes.itens.length > 0) {
             // O hook useCestaDetalhes atual retorna itens com a estrutura esperada.
             // Vamos mapear os itens para o formato de edição
             const itensMapeados = cestaDetalhes.itens.map((item: any) => ({
               produtoId: item.produto.id,
               produto: item.produto,
               quantidade: item.quantidade
             }));
             setItensCesta(itensMapeados);
          }
        } catch (err) {
          console.error('Erro ao carregar metadados da cesta', err);
        }
      };
      
      fetchCestaMetadata();
    }
  }, [cestaDetalhes, targetId]);

  // ✅ useMemo: derived state — no setState, no render loop
  const produtosFiltrados = useMemo(() => {
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

    return filtered;
  }, [produtos, searchTerm, filtroEstoque]);

  // Reset page only when debouncedSearchTerm or filtroEstoque changes (no loop risk)
  useEffect(() => {
    setPaginaAtual(1);
  }, [debouncedSearchTerm, filtroEstoque]);


  // Calcular totais
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
    
    // Nota: Em edição, a validação de estoque deve considerar que itens já na cesta (salvos) já estão reservados?
    // O sistema atual parece debitar estoque apenas na entrega, mas o alerta diz "reservados".
    // Vamos manter a validação padrão.
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

    if (itensCesta.length === 0) {
      setErrors({ itens: 'Adicione pelo menos um produto à cesta' });
      return;
    }

    setIsLoading(true);

    try {
      // Preparar dados para atualização
      const updateData = {
        nome: nomeCesta,
        // Limite máximo e vendedor não são editáveis aqui
        itens: itensCesta.map(item => ({
          produto_cadastrado_id: item.produtoId,
          quantidade: item.quantidade
        }))
      };

      await CestaService.updateCestaWithItems(
        cestaId!,
        updateData,
        adminId || user?.id || '',
        user?.id || '',
        user?.email || 'Admin'
      );
      
      setSuccessMessage(`Cesta atualizada com sucesso!`);
      setTimeout(() => {
        navigate('/produtos/cestas');
      }, 2000);

    } catch (error: any) {
      setErrors({ submit: `Erro ao atualizar cesta: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const produtoJaAdicionado = (produtoId: string) => {
    return itensCesta.some(item => item.produto.id === produtoId);
  };

  if (loadingCesta) {
    return <div className="p-8 text-center">Carregando dados da cesta...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/produtos/cestas')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Editar Cesta</h1>
            <p className="text-gray-600 dark:text-gray-400">Modifique os produtos e configurações da cesta</p>
          </div>
        </div>
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
        {/* Configurações (Read-only ou Editável) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 opacity-75">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Configurações (Somente Leitura na Edição)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Campos desabilitados para simplificar a edição por enquanto */}
             <div>
               <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Nome da Cesta</label>
               <input type="text" value={nomeCesta || 'Carregando...'} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Vendedor</label>
               <input type="text" value={vendedores.find(v => v.id === vendedorSelecionado)?.nome || 'Carregando...'} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Limite</label>
               <input type="number" value={limiteMaximo} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
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
                          disabled={produtoJaAdicionado(produto.id) || produto.qtd_estoque === 0 || totalProdutos >= limiteMaximo || produto.preco_unt <= 0}
                          className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            produtoJaAdicionado(produto.id)
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 cursor-not-allowed'
                              : produto.preco_unt <= 0
                              ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-600'
                              : produto.qtd_estoque === 0 || totalProdutos >= limiteMaximo
                              ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {produtoJaAdicionado(produto.id)
                            ? 'Adicionado'
                            : produto.preco_unt <= 0
                            ? 'Valor zerado'
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
                      <button type="button" onClick={() => setPaginaAtual(1)} disabled={paginaAtual === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        «
                      </button>
                      <button type="button" onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        ‹
                      </button>
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1)
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">…</span>
                          ) : (
                            <button key={p} type="button" onClick={() => setPaginaAtual(p as number)}
                              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                paginaAtual === p
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}>
                              {p}
                            </button>
                          )
                        )
                      }
                      <button type="button" onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        ›
                      </button>
                      <button type="button" onClick={() => setPaginaAtual(totalPaginas)} disabled={paginaAtual === totalPaginas}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {errors.produto && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.produto}</div>
            </div>
          )}
          {errors.limite && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
              <div className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{errors.limite}</div>
            </div>
          )}
        </div>

        {/* Cesta Atual */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ShoppingBasket className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              Itens na Cesta ({totalProdutos})
            </h2>
            {itensCesta.length > 0 && (
              <button type="button" onClick={limparCesta} className="text-red-600 hover:text-red-700 text-sm font-medium">Limpar Cesta</button>
            )}
          </div>

          {itensCesta.length > 0 ? (
            <div className="space-y-3">
              {itensCesta.map(item => (
                <div key={item.produto.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">{item.produto.produto_nome}</h4>
                    <p className="text-xs text-gray-500">R$ {item.produto.preco_unt.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <button type="button" onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)} className="p-1 hover:bg-gray-100 rounded"><Minus className="w-4 h-4" /></button>
                      <span className="w-8 text-center font-medium">{item.quantidade}</span>
                      <button type="button" onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)} className="p-1 hover:bg-gray-100 rounded"><Plus className="w-4 h-4" /></button>
                    </div>
                    <span className="text-sm font-medium w-20 text-right">R$ {(item.produto.preco_unt * item.quantidade).toFixed(2)}</span>
                    <button type="button" onClick={() => removerProduto(item.produto.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4 flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span>R$ {valorTotal.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Cesta vazia</div>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/produtos/cestas')} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={isLoading || itensCesta.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Salvar Alterações</button>
        </div>
      </form>
    </div>
  );
};

export default EditarCesta;