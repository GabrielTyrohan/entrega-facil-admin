// =====================================================
// pages/NovoProduto.tsx - VERSÃO COMPLETA ATUALIZADA
// =====================================================

import {
  ArrowLeft,
  Barcode,
  CheckCircle,
  FileText,
  Package,
  Save,
  Search,
  TrendingUp,
  Truck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// =====================================================
// CONSTANTES
// =====================================================

const categorias = [
  'Bebidas',
  'Alimentos',
  'Limpeza',
  'Higiene',
  'Congelados',
  'Outros'
];

const unidadesMedida = [
  'UN',
  'KG',
  'LT',
  'CX',
  'FD',
  'PCT'
];

// =====================================================
// INTERFACES
// =====================================================

interface NCMInfo {
  codigo: string;
  descricao: string;
  codigo_formatado?: string;
}

interface ProdutoEAN {
  descricao: string;
  marca: string;
  ncm: string;
  ncm_descricao?: string;
  imagem_url?: string | null;
  preco_sugerido?: number | null;
}

interface DadosProduto {
  codigo_barras?: string;
  produto_nome: string;
  categoria: string;
  ncm: string;
  custo_compra?: number;
  preco_unt?: number;
  qtd_estoque?: number;
  unidade_medida?: string;
  kit?: boolean;
  ativo?: boolean;
  fornecedor_principal?: string;
  estoque_minimo?: number;
  estoque_maximo?: number;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

const NovoProduto: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // =====================================================
  // ESTADOS
  // =====================================================



  const [formData, setFormData] = useState({
    produto_nome: '',
    categoria: '',
    qtd_estoque: 0,
    preco_unt: 0,
    codigo_barras: '',
    kit: false,
    ativo: true,
    unidade_medida: 'UN',
    custo_compra: 0,
    margem_lucro: 0,
    ncm: '',
    ncm_descricao: '',
    cest: '',
    cfop_padrao: '',
    categoria_fiscal: '',
    fornecedor_principal: '',
    estoque_minimo: 0,
    estoque_maximo: 0,
    cst_pis: '',
    aliquota_pis: 0,
    cst_cofins: '',
    aliquota_cofins: 0,
    cst_icms: '',
    aliquota_icms: 0
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEAN, setLoadingEAN] = useState(false);
  const [loadingNCM, setLoadingNCM] = useState(false);
  
  // Estados para autocomplete NCM
  const [sugestoesNCM, setSugestoesNCM] = useState<NCMInfo[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [ncmBuscaTermo, setNcmBuscaTermo] = useState('');

  // =====================================================
  // EFFECTS
  // =====================================================

  // Calcular margem de lucro
  useEffect(() => {
    if (formData.custo_compra && formData.preco_unt) {
      const custo = Number(formData.custo_compra);
      const preco = Number(formData.preco_unt);
      if (custo > 0) {
        const margem = ((preco - custo) / custo) * 100;
        setFormData(prev => ({ ...prev, margem_lucro: Number(margem.toFixed(2)) }));
      }
    }
  }, [formData.custo_compra, formData.preco_unt]);

  // =====================================================
  // FUNÇÕES - BUSCAR POR CÓDIGO DE BARRAS
  // =====================================================

  const handleBuscarEAN = async () => {
    if (!formData.codigo_barras || formData.codigo_barras.length < 8) {
      toast.error('Digite um código de barras válido (mínimo 8 dígitos)');
      return;
    }

    setLoadingEAN(true);

    try {
      const { data, error } = await supabase.functions.invoke('buscar-produto-ean', {
        body: { 
          ean: formData.codigo_barras,
          administrador_id: user?.id 
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success && data?.produto) {
        const produto: ProdutoEAN = data.produto;
        
        setFormData(prev => ({
          ...prev,
          produto_nome: produto.descricao,
          ncm: produto.ncm,
          ncm_descricao: produto.ncm_descricao || ''
        }));

        toast.success('✅ Produto encontrado! Dados preenchidos automaticamente.');
      }
    } catch (error: any) {
      console.error('Erro ao buscar EAN:', error);
      toast.error(error.message || 'Produto não encontrado. Preencha manualmente.');
    } finally {
      setLoadingEAN(false);
    }
  };

  // =====================================================
  // FUNÇÕES - PESQUISAR/VALIDAR NCM
  // =====================================================

  const handlePesquisarNCM = async (termo: string) => {
    setNcmBuscaTermo(termo);

    if (termo.length < 2) {
      setSugestoesNCM([]);
      setMostrarSugestoes(false);
      return;
    }

    setLoadingNCM(true);

    try {
      const { data, error } = await supabase.functions.invoke('pesquisar-ncm', {
        body: { 
          termo,
          administrador_id: user?.id 
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        setSugestoesNCM(data.ncms || []);
        setMostrarSugestoes(true);
      }
    } catch (error: any) {
      console.error('Erro ao pesquisar NCM:', error);
      setSugestoesNCM([]);
    } finally {
      setLoadingNCM(false);
    }
  };

  const handleSelecionarNCM = (ncm: NCMInfo) => {
    setFormData(prev => ({
      ...prev,
      ncm: ncm.codigo.replace(/\./g, ''),
      ncm_descricao: ncm.descricao
    }));
    setNcmBuscaTermo('');
    setMostrarSugestoes(false);
    setSugestoesNCM([]);
    
    if (errors.ncm) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.ncm;
        return newErrors;
      });
    }
  };

  const handleValidarNCM = async () => {
    if (!formData.ncm || formData.ncm.length !== 8) {
      return;
    }

    setLoadingNCM(true);

    try {
      const { data, error } = await supabase.functions.invoke('validar-ncm', {
        body: { 
          ncm: formData.ncm,
          administrador_id: user?.id 
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success && data?.ncm) {
        setFormData(prev => ({
          ...prev,
          ncm_descricao: data.ncm.descricao
        }));
        toast.success('✅ NCM válido');
      }
    } catch (error: any) {
      console.error('Erro ao validar NCM:', error);
      toast.error(error.message || 'NCM inválido');
      setErrors(prev => ({ ...prev, ncm: 'NCM inválido' }));
    } finally {
      setLoadingNCM(false);
    }
  };

  // =====================================================
  // FUNÇÕES - HANDLERS
  // =====================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if ([
      'qtd_estoque', 'preco_unt', 'custo_compra', 'margem_lucro',
      'estoque_minimo', 'estoque_maximo', 'aliquota_pis',
      'aliquota_cofins', 'aliquota_icms'
    ].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // =====================================================
  // VALIDAÇÃO E SUBMIT
  // =====================================================

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.produto_nome.trim()) {
      newErrors.produto_nome = 'Nome do produto é obrigatório';
    }

    if (!formData.categoria) {
      newErrors.categoria = 'Categoria é obrigatória';
    }

    if (!formData.ncm || formData.ncm.length !== 8) {
      newErrors.ncm = 'NCM deve ter 8 dígitos';
    }

    if (formData.preco_unt <= 0) {
      newErrors.preco_unt = 'Preço de venda deve ser maior que zero';
    }

    if (formData.estoque_minimo && formData.estoque_maximo && 
        formData.estoque_minimo > formData.estoque_maximo) {
      newErrors.estoque_minimo = 'Estoque mínimo não pode ser maior que o máximo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsLoading(true);

    try {
      const produtoPayload: DadosProduto = {
        codigo_barras: formData.codigo_barras || undefined,
        produto_nome: formData.produto_nome,
        categoria: formData.categoria,
        ncm: formData.ncm,
        custo_compra: formData.custo_compra || undefined,
        preco_unt: formData.preco_unt,
        qtd_estoque: formData.qtd_estoque,
        unidade_medida: formData.unidade_medida || 'UN',
        kit: formData.kit || false,
        ativo: formData.ativo !== undefined ? formData.ativo : true,
        fornecedor_principal: formData.fornecedor_principal || undefined,
        estoque_minimo: formData.estoque_minimo || 0,
        estoque_maximo: formData.estoque_maximo || 0
      };

      // Chamar Edge Function que faz TUDO
      const { data, error } = await supabase.functions.invoke('cadastrar-produto', {
        body: {
          produto: produtoPayload,
          administrador_id: user?.id
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success && data?.produto) {
        toast.success('🎉 Produto cadastrado com sucesso!');

        // Redirecionar após 1.5 segundos
        setTimeout(() => {
          navigate('/produtos');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar produto:', error);
      toast.error(error.message || 'Erro ao cadastrar produto');
      setErrors({ submit: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/produtos')}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Novo Produto
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Preencha os dados essenciais - o resto é automático! ⚡
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Save className="w-5 h-5" />
            {isLoading ? 'Salvando...' : 'Salvar Produto'}
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* =====================================================
              SEÇÃO 1: BUSCAR POR CÓDIGO DE BARRAS
              ===================================================== */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Barcode className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Buscar por Código de Barras (Opcional)
              </h2>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  name="codigo_barras"
                  value={formData.codigo_barras}
                  onChange={handleInputChange}
                  placeholder="Digite o código EAN/GTIN (ex: 7891000100103)"
                  className="w-full px-4 py-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                  maxLength={14}
                />
              </div>
              <button
                type="button"
                onClick={handleBuscarEAN}
                disabled={loadingEAN || !formData.codigo_barras}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {loadingEAN ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Buscar
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              💡 Preenche automaticamente: nome do produto e NCM
            </p>
          </div>

          {/* =====================================================
              SEÇÃO 2: INFORMAÇÕES BÁSICAS
              ===================================================== */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <Package className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Informações Básicas
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome do Produto */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  name="produto_nome"
                  value={formData.produto_nome}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    errors.produto_nome 
                      ? 'border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                  placeholder="Ex: Queijo Mussarela Fatiado 1kg"
                />
                {errors.produto_nome && (
                  <p className="text-sm text-red-500 mt-1">{errors.produto_nome}</p>
                )}
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoria *
                </label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-2 rounded-lg border ${
                    errors.categoria 
                      ? 'border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="">Selecione</option>
                  {categorias.map(categoria => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
                {errors.categoria && (
                  <p className="text-sm text-red-500 mt-1">{errors.categoria}</p>
                )}
              </div>

              {/* Unidade de Medida */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unidade de Medida
                </label>
                <select
                  name="unidade_medida"
                  value={formData.unidade_medida}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                >
                  {unidadesMedida.map(un => (
                    <option key={un} value={un}>
                      {un}
                    </option>
                  ))}
                </select>
              </div>

              {/* Switches */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="ativo"
                    checked={formData.ativo}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="kit"
                    checked={formData.kit}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">É Kit?</span>
                </label>
              </div>
            </div>
          </div>

          {/* =====================================================
              SEÇÃO 3: NCM (COM AUTOCOMPLETE)
              ===================================================== */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Classificação Fiscal (NCM)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Código NCM *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="ncm"
                    value={ncmBuscaTermo || formData.ncm}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setNcmBuscaTermo(valor);
                      
                      if (valor.length <= 8 && /^\d*$/.test(valor)) {
                        setFormData(prev => ({ ...prev, ncm: valor }));
                      }
                      
                      handlePesquisarNCM(valor);
                    }}
                    onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
                    required
                    maxLength={8}
                    placeholder="Ex: 04061010"
                    className={`flex-1 px-4 py-2 rounded-lg border ${
                      errors.ncm 
                        ? 'border-red-500' 
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                  />
                  <button
                    type="button"
                    onClick={handleValidarNCM}
                    disabled={loadingNCM || formData.ncm.length !== 8}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {loadingNCM ? '...' : <CheckCircle className="w-5 h-5" />}
                  </button>
                </div>
                {errors.ncm && (
                  <p className="text-sm text-red-500 mt-1">{errors.ncm}</p>
                )}

                {/* Lista de Sugestões NCM */}
                {mostrarSugestoes && sugestoesNCM.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {sugestoesNCM.map((ncm) => (
                      <button
                        key={ncm.codigo}
                        type="button"
                        onClick={() => handleSelecionarNCM(ncm)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {ncm.codigo_formatado || ncm.codigo}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 block truncate">
                          {ncm.descricao}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição do NCM
                </label>
                <input
                  type="text"
                  name="ncm_descricao"
                  value={formData.ncm_descricao}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                />
              </div>
            </div>
            
            <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                <span className="text-lg">💡</span>
                Os dados de CEST, CFOP e impostos serão preenchidos automaticamente pela Inteligência Artificial com base no NCM selecionado.
              </p>
            </div>
          </div>

          {/* =====================================================
              SEÇÃO 4: PREÇOS E ESTOQUE
              ===================================================== */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preços e Estoque
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Preço de Venda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preço de Venda (R$) *
                </label>
                <input
                  type="number"
                  name="preco_unt"
                  value={formData.preco_unt}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    errors.preco_unt 
                      ? 'border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                />
                {errors.preco_unt && (
                  <p className="text-sm text-red-500 mt-1">{errors.preco_unt}</p>
                )}
              </div>

              {/* Custo de Compra */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custo de Compra (R$)
                </label>
                <input
                  type="number"
                  name="custo_compra"
                  value={formData.custo_compra}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Margem de Lucro (Calculada) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Margem de Lucro (%)
                </label>
                <input
                  type="number"
                  value={formData.margem_lucro}
                  readOnly
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                />
              </div>

              {/* Estoque Atual */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estoque Atual
                </label>
                <input
                  type="number"
                  name="qtd_estoque"
                  value={formData.qtd_estoque}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Estoque Mínimo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estoque Mínimo
                </label>
                <input
                  type="number"
                  name="estoque_minimo"
                  value={formData.estoque_minimo}
                  onChange={handleInputChange}
                  min="0"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    errors.estoque_minimo 
                      ? 'border-red-500' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500`}
                />
                {errors.estoque_minimo && (
                  <p className="text-sm text-red-500 mt-1">{errors.estoque_minimo}</p>
                )}
              </div>

              {/* Estoque Máximo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estoque Máximo
                </label>
                <input
                  type="number"
                  name="estoque_maximo"
                  value={formData.estoque_maximo}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* =====================================================
              SEÇÃO 5: FORNECEDOR (OPCIONAL)
              ===================================================== */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-6">
              <Truck className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Fornecedor (Opcional)
              </h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fornecedor Principal
              </label>
              <input
                type="text"
                name="fornecedor_principal"
                value={formData.fornecedor_principal}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default NovoProduto;
