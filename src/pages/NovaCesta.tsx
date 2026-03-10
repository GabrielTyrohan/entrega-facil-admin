import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Eye, Package, ShoppingBasket, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/currencyUtils';
import { toast } from '../utils/toast';


// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

interface ProdutoCadastrado {
  produto_nome: string;
  preco_unt: number;
  qtd_estoque: number;
  unidade_medida?: string;
  categoria?: string;
}

interface ItemCestaBase {
  id: string;
  cesta_base_id: string;
  produto_cadastrado_id: string;
  quantidade: number;
  produtos_cadastrado: ProdutoCadastrado;
}

interface CestaBase {
  id: string;
  administrador_id: string;
  nome: string;
  descricao?: string;
  preco: number;
  ativo: boolean;
  cestas_base_itens: ItemCestaBase[];
}

interface Vendedor {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  admin_id?: string;
  administrador_id: string;
  ativo: boolean;
  comissao_percentual?: number;
  percentual_minimo?: number;
  created_at: string;
  updated_at: string;
}


// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

const NovaCesta: React.FC = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const targetId = adminId || user?.id;

  // ── Vendedores ──
  const { data: vendedores = [], isLoading: loadingVendedores } = useVendedoresByAdmin(targetId || '', {
    enabled: !!targetId
  }) as { data: Vendedor[]; isLoading: boolean };

  // ── Cestas Base ──
  const { data: cestasBase = [], isLoading: loadingCestas } = useQuery<CestaBase[]>({
    queryKey: ['cestas_base', targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cestas_base')
        .select(`
          *,
          cestas_base_itens(
            *,
            produtos_cadastrado(produto_nome, preco_unt, qtd_estoque, unidade_medida, categoria)
          )
        `)
        .eq('administrador_id', targetId!)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return (data || []) as CestaBase[];
    },
    enabled: !!targetId
  });

  // ── Estados do formulário ──
  const [cestaSelecionadaId, setCestaSelecionadaId] = useState<string>('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>('');
  const [quantidadeParaVendedor, setQuantidadeParaVendedor] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Cesta base atualmente selecionada (objeto completo)
  const cestaSelecionada = cestasBase.find(c => c.id === cestaSelecionadaId);

  // ── Cálculo do máximo de cestas com base no estoque ──
  const { maxCestasDisponivel, itemGargalo } = useMemo(() => {
    if (!cestaSelecionada?.cestas_base_itens?.length)
      return { maxCestasDisponivel: 0, itemGargalo: null };

    let max = Infinity;
    let gargalo: string | null = null;

    for (const item of cestaSelecionada.cestas_base_itens) {
      const possivel = Math.floor(
        (item.produtos_cadastrado?.qtd_estoque ?? 0) / item.quantidade
      );
      if (possivel < max) {
        max = possivel;
        gargalo = item.produtos_cadastrado?.produto_nome ?? null;
      }
    }

    return {
      maxCestasDisponivel: max === Infinity ? 0 : max,
      itemGargalo: gargalo
    };
  }, [cestaSelecionada]);

  // Ajusta quantidade automaticamente se ultrapassar o máximo
  useEffect(() => {
    if (maxCestasDisponivel > 0 && quantidadeParaVendedor > maxCestasDisponivel) {
      setQuantidadeParaVendedor(maxCestasDisponivel);
    }
  }, [maxCestasDisponivel]);

  // Reseta quantidade ao trocar cesta
  useEffect(() => {
    setQuantidadeParaVendedor(1);
    setErrors({});
  }, [cestaSelecionadaId]);


  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!cestaSelecionadaId)
      newErrors.cesta = 'Selecione uma Cesta Base';
    if (!vendedorSelecionado)
      newErrors.vendedor = 'Selecione um vendedor';
    if (cestaSelecionadaId && maxCestasDisponivel === 0)
      newErrors.estoque = 'Estoque insuficiente para montar ao menos 1 cesta';
    if (quantidadeParaVendedor < 1)
      newErrors.quantidade = 'Informe ao menos 1 cesta';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
  const { data, error } = await supabase.rpc('distribuir_cesta_para_vendedor', {
    p_cesta_base_id: cestaSelecionadaId,
    p_vendedor_id: vendedorSelecionado,
    p_quantidade: quantidadeParaVendedor,
    p_administrador_id: targetId
  });

  console.log('RPC response:', { data, error }); // ← ADICIONE
  console.log('Params enviados:', {               // ← ADICIONE
    p_cesta_base_id: cestaSelecionadaId,
    p_vendedor_id: vendedorSelecionado,
    p_quantidade: quantidadeParaVendedor,
    p_administrador_id: targetId
    
  });
console.log('Erro detalhado:', JSON.stringify(error, null, 2));

      if (error) throw error;

      const vendedor = vendedores.find(v => v.id === vendedorSelecionado);
      toast.success(
        `Cesta "${cestaSelecionada!.nome}" distribuída para ${vendedor?.nome ?? 'vendedor'}! ${quantidadeParaVendedor} unidade(s) registrada(s).`
      );

      navigate('/produtos/cestas');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrors({ submit: `Erro ao distribuir cesta: ${error.message}` });
      } else {
        setErrors({ submit: 'Erro inesperado ao distribuir cesta. Tente novamente.' });
      }
    } finally {
      setIsLoading(false);
    }
  };


  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Nova Cesta</h1>
          <p className="text-gray-600 dark:text-gray-400">Distribua uma cesta base para um vendedor</p>
        </div>
        <button
          onClick={() => navigate('/produtos/cestas')}
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

        {/* ── Card: Configurações ── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Configurações
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Select Cesta Base */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cesta Base *
              </label>
              <select
                value={cestaSelecionadaId}
                onChange={(e) => {
                  setCestaSelecionadaId(e.target.value);
                  if (errors.cesta) setErrors(prev => ({ ...prev, cesta: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.cesta ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={loadingCestas}
              >
                <option value="">
                  {loadingCestas ? 'Carregando cestas...' : 'Selecione uma Cesta Base'}
                </option>
                {cestasBase.map(cesta => (
                  <option key={cesta.id} value={cesta.id}>
                    {cesta.nome} — {formatCurrency(cesta.preco)}
                  </option>
                ))}
              </select>
              {errors.cesta && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.cesta}</p>}
            </div>

            {/* Select Vendedor */}
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

            {/* Campo Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Qtd. Cestas para o Vendedor *
                {cestaSelecionadaId && (
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
                  if (cestaSelecionadaId && maxCestasDisponivel > 0 && valor > maxCestasDisponivel) {
                    setErrors(prev => ({
                      ...prev,
                      quantidade: `Estoque insuficiente. "${itemGargalo ?? 'produto'}" limita a ${maxCestasDisponivel} cesta(s).`
                    }));
                    setQuantidadeParaVendedor(maxCestasDisponivel);
                    return;
                  }
                  setQuantidadeParaVendedor(valor);
                  if (errors.quantidade) setErrors(prev => ({ ...prev, quantidade: '' }));
                }}
                disabled={!cestaSelecionadaId || maxCestasDisponivel === 0}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.quantidade ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {/* Estoque zerado */}
              {cestaSelecionadaId && maxCestasDisponivel === 0 && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Estoque insuficiente para montar ao menos 1 cesta completa.
                </p>
              )}
              {/* Aviso informativo */}
              {cestaSelecionadaId && maxCestasDisponivel > 0 && !errors.quantidade && (
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Estoque permite até {maxCestasDisponivel} cesta(s) completa(s).
                  {itemGargalo && ` Gargalo: ${itemGargalo}`}
                </p>
              )}
              {errors.quantidade && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.quantidade}</p>}
              {errors.estoque && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.estoque}</p>}
            </div>
          </div>
        </div>

        {/* ── Card: Composição da Cesta (somente leitura) ── */}
        {cestaSelecionada && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              Composição da Cesta
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                (somente leitura)
              </span>
            </h2>

            {cestaSelecionada.cestas_base_itens.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-40" />
                <p className="text-gray-500 dark:text-gray-400">Esta cesta não possui itens cadastrados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cestaSelecionada.cestas_base_itens.map((item: any) => {
                  const prod = item.produtos_cadastrado;
                  const subtotal = prod.preco_unt * item.quantidade;
                  const estoque = prod.qtd_estoque;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {prod.produto_nome}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {prod.categoria && `${prod.categoria} • `}
                          {formatCurrency(prod.preco_unt)} cada
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Qtd na cesta */}
                        <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[48px] text-center">
                          {item.quantidade} un.
                        </span>

                        {/* Subtotal */}
                        <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[72px] text-right">
                          {formatCurrency(subtotal)}
                        </span>

                        {/* Badge estoque */}
                        <span className={`text-xs px-2 py-1 rounded-full min-w-[58px] text-center ${
                          estoque > 10
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : estoque > 0
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {estoque} est.
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Total */}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-4">
                  <div className="flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <span>Preço base da cesta:</span>
                    <span>{formatCurrency(cestaSelecionada.preco)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Alerta informativo ── */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Importante</h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                <li>• A cesta base é copiada como template para o vendedor selecionado</li>
                <li>• Os produtos e quantidades são definidos pelo modelo de cesta base</li>
                <li>• A quantidade de cestas define o limite de entregas do vendedor no aplicativo mobile</li>
                <li>• O estoque exibido é atual e pode mudar antes da confirmação</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Botões de ação ── */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/produtos/cestas')}
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || !cestaSelecionadaId || !vendedorSelecionado || maxCestasDisponivel === 0}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center shadow-sm"
          >
            <ShoppingBasket className="w-4 h-4 mr-2" />
            {isLoading ? 'Distribuindo...' : 'Criar Cesta →'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default NovaCesta;
