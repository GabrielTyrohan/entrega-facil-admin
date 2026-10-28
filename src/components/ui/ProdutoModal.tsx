import { DollarSign, Hash, Package, Save, Tag, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { type Produto } from '../../hooks/useProdutos';
import {
  buscarHistoricoFiscalProduto,
  produtoVeioDeImportacao,
  mapearSnapshotParaCamposFiscais,
  preencherCamposFiscaisDoHistorico,
  type ItemImportacaoFiscalHistorico,
} from '../../services/produtoFiscalReferenciaHistoricaService';
import { CreateProdutoData, ProdutoService } from '../../services/produtoService';
import { applyCurrencyMask, currencyMaskToNumber } from '../../utils/currencyUtils';
import { toast } from '@/utils/toast';

interface ProdutoModalProps {
  produto: Produto | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'edit' | 'create';
  onSave?: (produto: Produto) => void;
}

const categorias = [
  'Bebidas',
  'Alimentos',
  'Limpeza',
  'Higiene',
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

export const ORIGEM_MERCADORIA_OPTIONS = [
  { value: 0, label: '0 - Nacional' },
  { value: 1, label: '1 - Estrangeira (importação direta)' },
  { value: 2, label: '2 - Estrangeira (mercado interno)' },
  { value: 3, label: '3 - Nacional (conteúdo importado > 40%)' },
  { value: 4, label: '4 - Nacional (processos básicos)' },
  { value: 5, label: '5 - Nacional (conteúdo importado < 40%)' },
  { value: 6, label: '6 - Estrangeira (importação direta, sem similar)' },
  { value: 7, label: '7 - Estrangeira (mercado interno, sem similar)' },
  { value: 8, label: '8 - Nacional (conteúdo importado > 70%)' },
] as const;

const gerarSKU = (categoria: string): string => {
  const categoriaMap: { [key: string]: string } = {
    'Bebidas': 'BEB',
    'Alimentos': 'ALI',
    'Limpeza': 'LIM',
    'Higiene': 'HIG',
    'Outros': 'OUT'
  };

  const prefixo = categoriaMap[categoria] || 'GEN';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefixo}-${timestamp}`;
};

const ProdutoModal: React.FC<ProdutoModalProps> = ({ produto, isOpen, onClose, mode, onSave }) => {
  const [historicoFiscal, setHistoricoFiscal] = useState<ItemImportacaoFiscalHistorico | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  // Campos fiscais preenchidos a partir da referência histórica (para exibir como somente leitura no modo view)
  const [camposFiscaisHistorico, setCamposFiscaisHistorico] = useState<Record<string, boolean>>({});

  const { user, adminId } = useAuth();
  
  const [formData, setFormData] = useState<Produto>({
    id: '',
    administrador_id: '',
    produto_nome: '',
    produto_cod: '',
    categoria: '',
    qtd_estoque: 0,
    preco_unt: 0,
    created_at: '',
    updated_at: '',
    // Campos opcionais inicializados
    codigo_barras: '',
    kit: false,
    ativo: true,
    unidade_medida: 'UN',
    custo_compra: 0,
    margem_lucro: 0,
    ncm: '',
    cest: '',
    cfop_padrao: '',
    fornecedor_principal: '',
    estoque_minimo: 0,
    estoque_maximo: 0,
    cst_pis: '',
    aliquota_pis: 0,
    cst_cofins: '',
    aliquota_cofins: 0,
    cst_icms: '',
    aliquota_icms: 0,
    origem_mercadoria: 0
  });

  const [precoDisplay, setPrecoDisplay] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'basico' | 'estoque' | 'fiscal'>('basico');

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        // Reset to empty form for create mode
        setFormData({
           id: '',
           administrador_id: '',
           produto_nome: '',
           produto_cod: '',
           categoria: '',
           qtd_estoque: 0,
           preco_unt: 0,
           created_at: '',
           updated_at: '',
           codigo_barras: '',
           kit: false,
           ativo: true,
           unidade_medida: 'UN',
           custo_compra: 0,
           margem_lucro: 0,
           ncm: '',
           cest: '',
           cfop_padrao: '',
           fornecedor_principal: '',
           estoque_minimo: 0,
           estoque_maximo: 0,
           cst_pis: '',
           aliquota_pis: 0,
           cst_cofins: '',
           aliquota_cofins: 0,
           cst_icms: '',
           aliquota_icms: 0,
           origem_mercadoria: 0
         });
        setPrecoDisplay('');
        setActiveTab('basico');
      } else if (produto && (mode === 'edit' || mode === 'view')) {
        // Load product data for edit/view mode
        setFormData({
          ...produto,
          produto_cod: String(produto.produto_cod)
        });
        setPrecoDisplay(produto.preco_unt > 0 ? applyCurrencyMask(String(Math.round(produto.preco_unt * 100))) : '');
        setActiveTab('basico');
      }
    }
  }, [produto, mode, isOpen, user?.id]);

  // Carregar histórico fiscal para produtos importados (modo view e edit)
  useEffect(() => {
    if (!isOpen || (mode !== 'view' && mode !== 'edit') || !produto || !produtoVeioDeImportacao(produto) || !adminId) {
      setHistoricoFiscal(null);
      setErroHistorico(null);
      setCamposFiscaisHistorico({});
      return;
    }

    setCarregandoHistorico(true);
    setErroHistorico(null);
    buscarHistoricoFiscalProduto(produto.id, adminId)
      .then((hist) => {
        setHistoricoFiscal(hist);
      })
      .catch((err) => {
        setErroHistorico(
          err instanceof Error ? err.message : 'Erro ao carregar histórico fiscal.',
        );
      })
      .finally(() => {
        setCarregandoHistorico(false);
      });
  }, [isOpen, mode, produto, adminId]);

  // No modo view, mesclar valores históricos nos campos fiscais quando o
  // campo do cadastro estiver nulo/vazio. Isso é automático (somente leitura).
  useEffect(() => {
    if (mode !== 'view' || !produto || !historicoFiscal?.snapshot_referencia) return;

    const snap = historicoFiscal.snapshot_referencia;
    const campos = mapearSnapshotParaCamposFiscais(snap);
    if (Object.keys(campos).length === 0) return;

    const novosCampos: Record<string, boolean> = {};
    setFormData((prev) => {
      const atualizado = { ...prev };
      let mudou = false;

      for (const [chave, valor] of Object.entries(campos) as [string, string | number][]) {
        const atual = (atualizado as Record<string, unknown>)[chave];
        const vazio = atual === null || atual === undefined || atual === '';
        if (vazio && valor !== undefined && valor !== null) {
          (atualizado as Record<string, unknown>)[chave] = valor;
          novosCampos[chave] = true;
          mudou = true;
        }
      }

      return mudou ? atualizado : prev;
    });

    setCamposFiscaisHistorico(novosCampos);
  }, [mode, produto, historicoFiscal]);

  // useEffect para gerar SKU quando categoria mudar no modo 'create'
  useEffect(() => {
    if (mode === 'create' && formData.categoria) {
      const novoSKU = gerarSKU(formData.categoria);
      setFormData(prev => ({ ...prev, produto_cod: novoSKU }));
    } else if (mode === 'create' && !formData.categoria) {
      setFormData(prev => ({ ...prev, produto_cod: '' }));
    }
  }, [formData.categoria, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'preco_unt') {
      const maskedValue = applyCurrencyMask(value);
      setPrecoDisplay(maskedValue);
      const numericValue = currencyMaskToNumber(maskedValue);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else if (name === 'origem_mercadoria') {
      setFormData(prev => ({ ...prev, origem_mercadoria: Number(value) }));
    } else if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if ([
      'qtd_estoque', 'custo_compra', 'margem_lucro', 
      'estoque_minimo', 'estoque_maximo', 'aliquota_pis', 
      'aliquota_cofins', 'aliquota_icms'
    ].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.produto_nome.trim()) { toast.error('Nome do produto é obrigatório'); return; }
      if (!formData.produto_cod.trim()) { toast.error('Código do produto é obrigatório'); return; }
      if (formData.produto_cod.length < 1 || formData.produto_cod.length > 64) {
        toast.error('O código SKU deve ter entre 1 e 64 caracteres.');
        return;
      }
      if (!formData.categoria.trim()) { toast.error('Categoria é obrigatória'); return; }
      if (formData.preco_unt < 0) { toast.error('Preço não pode ser negativo'); return; }
      if (formData.qtd_estoque < 0) { toast.error('Quantidade não pode ser negativa'); return; }

      if (mode === 'create') {
        if (!user?.id) { toast.error('Usuário não autenticado'); return; }

        const existingProduct = await ProdutoService.checkExistingCode(formData.produto_cod, user.id);
        if (existingProduct) { toast.error('Já existe um produto com este código'); return; }

        const createData: CreateProdutoData = {
          administrador_id: user.id,
          produto_nome: formData.produto_nome,
          produto_cod: formData.produto_cod,
          categoria: formData.categoria,
          qtd_estoque: formData.qtd_estoque,
          preco_unt: formData.preco_unt,
          codigo_barras: formData.codigo_barras,
          kit: formData.kit,
          ativo: formData.ativo,
          unidade_medida: formData.unidade_medida,
          custo_compra: formData.custo_compra,
          margem_lucro: formData.margem_lucro,
          ncm: formData.ncm,
          cest: formData.cest,
          cfop_padrao: formData.cfop_padrao,
          fornecedor_principal: formData.fornecedor_principal,
          estoque_minimo: formData.estoque_minimo,
          estoque_maximo: formData.estoque_maximo,
          cst_pis: formData.cst_pis,
          aliquota_pis: formData.aliquota_pis,
          cst_cofins: formData.cst_cofins,
          aliquota_cofins: formData.aliquota_cofins,
          cst_icms: formData.cst_icms,
          aliquota_icms: formData.aliquota_icms,
          origem_mercadoria: formData.origem_mercadoria ?? 0
        };

        const newProduct = await ProdutoService.createProduto(createData);
        if (onSave) onSave(newProduct);
        toast.success('Produto criado com sucesso!');
        onClose();
      } else if (mode === 'edit') {
        if (!user?.id) { toast.error('Usuário não autenticado'); return; }

        const produtoService = new ProdutoService(user.id);
        const codigoExiste = await produtoService.verificarCodigoExistente(formData.produto_cod, formData.id);
        if (codigoExiste) { toast.error('Já existe um produto com este código'); return; }

        const produtoAtualizado = await produtoService.updateProduto(formData.id, {
          produto_nome: formData.produto_nome,
          produto_cod: formData.produto_cod,
          categoria: formData.categoria,
          qtd_estoque: formData.qtd_estoque,
          preco_unt: formData.preco_unt,
          codigo_barras: formData.codigo_barras,
          kit: formData.kit,
          ativo: formData.ativo,
          unidade_medida: formData.unidade_medida,
          custo_compra: formData.custo_compra,
          margem_lucro: formData.margem_lucro,
          ncm: formData.ncm,
          cest: formData.cest,
          cfop_padrao: formData.cfop_padrao,
          fornecedor_principal: formData.fornecedor_principal,
          estoque_minimo: formData.estoque_minimo,
          estoque_maximo: formData.estoque_maximo,
          cst_pis: formData.cst_pis,
          aliquota_pis: formData.aliquota_pis,
          cst_cofins: formData.cst_cofins,
          aliquota_cofins: formData.aliquota_cofins,
          cst_icms: formData.cst_icms,
          aliquota_icms: formData.aliquota_icms,
          origem_mercadoria: formData.origem_mercadoria ?? 0
        });

        if (onSave) onSave(produtoAtualizado);
        toast.success('Produto atualizado com sucesso!');
        onClose();
      }
    } catch {
      toast.error('Erro ao salvar produto. Tente novamente.');
    }
  };

  function formatarValorHistorico(valor: unknown): string {
    if (valor === null || valor === undefined) return 'Não informado na referência';
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (typeof valor === 'number') return String(valor);
    if (typeof valor === 'string') return valor.trim() || 'Não informado na referência';
    return String(valor);
  }

  // Preenche campos fiscais vazios com valores da referência histórica (modo edit).
  // Não sobrescreve valores já preenchidos nem altera origem_mercadoria.
  function aplicarPreenchimentoHistorico() {
    if (!historicoFiscal?.snapshot_referencia) return;

    const preenchido = preencherCamposFiscaisDoHistorico(formData, historicoFiscal.snapshot_referencia);
    if (JSON.stringify(preenchido) !== JSON.stringify(formData)) {
      setFormData(preenchido);
      toast.success('Campos fiscais preenchidos com valores da referência histórica. Revise e salve.');
    } else {
      toast.info('Não há novos campos fiscais para preencher a partir da referência.');
    }
  }

  // Retorna o valor a exibir no input: valor do cadastro se preenchido, senão
  // o valor histórico (somente leitura) se disponível.
  function valorInputFiscal(campo: keyof typeof formData): string {
    const valorAtual = formData[campo];
    if (valorAtual !== null && valorAtual !== undefined && valorAtual !== '') {
      return String(valorAtual);
    }
    // Modo view: tentar histórico
    if (mode === 'view' && historicoFiscal?.snapshot_referencia) {
      const campos = mapearSnapshotParaCamposFiscais(historicoFiscal.snapshot_referencia);
      const valorHistorico = (campos as Record<string, string | number | undefined>)[campo];
      if (valorHistorico !== undefined && valorHistorico !== null) {
        return String(valorHistorico);
      }
    }
    return '';
  }

  // Retorna true se o campo fiscal está sendo exibido com valor histórico (somente leitura).
  const ehValorHistorico = (campo: keyof typeof formData): boolean => {
    const valorAtual = formData[campo];
    if (valorAtual !== null && valorAtual !== undefined && valorAtual !== '') return false;
    return (
      mode === 'view' &&
      camposFiscaisHistorico[campo] === true &&
      historicoFiscal?.snapshot_referencia !== null
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Criar Produto' : mode === 'edit' ? 'Editar Produto' : 'Detalhes do Produto'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 shrink-0">
          <button
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'basico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('basico')}
          >
            Informações Básicas
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'estoque' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('estoque')}
          >
            Estoque e Custos
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'fiscal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('fiscal')}
          >
            Dados Fiscais
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Tab: Informações Básicas */}
          {activeTab === 'basico' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome do Produto *</label>
                <input
                  type="text"
                  name="produto_nome"
                  value={formData.produto_nome}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código (SKU) *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="produto_cod"
                    value={formData.produto_cod}
                    readOnly={mode === 'view'}
                    onChange={handleInputChange}
                    className={mode === 'view'
                      ? "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed font-mono disabled:opacity-50"
                      : "w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categoria *</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleInputChange}
                    disabled={mode === 'view'}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Selecione</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código de Barras</label>
                <input
                  type="text"
                  name="codigo_barras"
                  value={formData.codigo_barras || ''}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unidade</label>
                <select
                  name="unidade_medida"
                  value={formData.unidade_medida || 'UN'}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  {unidadesMedida.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="flex items-center space-x-4 pt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="ativo"
                    checked={formData.ativo}
                    onChange={handleInputChange}
                    disabled={mode === 'view'}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ativo</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="kit"
                    checked={formData.kit}
                    onChange={handleInputChange}
                    disabled={mode === 'view'}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">É Kit?</span>
                </label>
              </div>
            </div>
          )}

          {/* Tab: Estoque e Custos */}
          {activeTab === 'estoque' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Qtd. Estoque *</label>
                <input
                  type="number"
                  name="qtd_estoque"
                  value={formData.qtd_estoque}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preço Unitário *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="preco_unt"
                    value={precoDisplay}
                    onChange={handleInputChange}
                    disabled={mode === 'view'}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custo Compra</label>
                <input
                  type="number"
                  name="custo_compra"
                  value={formData.custo_compra || 0}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Margem Lucro (%)</label>
                <input
                  type="number"
                  name="margem_lucro"
                  value={formData.margem_lucro || 0}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estoque Mínimo</label>
                <input
                  type="number"
                  name="estoque_minimo"
                  value={formData.estoque_minimo || 0}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estoque Máximo</label>
                <input
                  type="number"
                  name="estoque_maximo"
                  value={formData.estoque_maximo || 0}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fornecedor Principal</label>
                <input
                  type="text"
                  name="fornecedor_principal"
                  value={formData.fornecedor_principal || ''}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Tab: Dados Fiscais */}
          {activeTab === 'fiscal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  NCM
                  {ehValorHistorico('ncm') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="ncm"
                  value={valorInputFiscal('ncm')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('ncm')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CEST
                  {ehValorHistorico('cest') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="cest"
                  value={valorInputFiscal('cest')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('cest')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CFOP Padrão
                  {ehValorHistorico('cfop_padrao') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="cfop_padrao"
                  value={valorInputFiscal('cfop_padrao')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('cfop_padrao')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              {/* Espaço vazio para alinhar */}
              <div className="hidden md:block"></div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CST PIS
                  {ehValorHistorico('cst_pis') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="cst_pis"
                  value={valorInputFiscal('cst_pis')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('cst_pis')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CST COFINS
                  {ehValorHistorico('cst_cofins') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="cst_cofins"
                  value={valorInputFiscal('cst_cofins')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('cst_cofins')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CST ICMS
                  {ehValorHistorico('cst_icms') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="text"
                  name="cst_icms"
                  value={valorInputFiscal('cst_icms')}
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('cst_icms')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alíquota ICMS (%)
                  {ehValorHistorico('aliquota_icms') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="number"
                  name="aliquota_icms"
                  value={
                    formData.aliquota_icms === null || formData.aliquota_icms === undefined
                      ? valorInputFiscal('aliquota_icms')
                      : String(formData.aliquota_icms)
                  }
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('aliquota_icms')}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alíquota PIS (%)
                  {ehValorHistorico('aliquota_pis') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="number"
                  name="aliquota_pis"
                  value={
                    formData.aliquota_pis === null || formData.aliquota_pis === undefined
                      ? valorInputFiscal('aliquota_pis')
                      : String(formData.aliquota_pis)
                  }
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('aliquota_pis')}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alíquota COFINS (%)
                  {ehValorHistorico('aliquota_cofins') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1">Referência histórica — ainda não gravada no cadastro</span>
                  )}
                </label>
                <input
                  type="number"
                  name="aliquota_cofins"
                  value={
                    formData.aliquota_cofins === null || formData.aliquota_cofins === undefined
                      ? valorInputFiscal('aliquota_cofins')
                      : String(formData.aliquota_cofins)
                  }
                  onChange={handleInputChange}
                  disabled={mode === 'view' || ehValorHistorico('aliquota_cofins')}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Origem da Mercadoria
                </label>
                <select
                  name="origem_mercadoria"
                  value={String(formData.origem_mercadoria ?? 0)}
                  onChange={handleInputChange}
                  disabled={mode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  {ORIGEM_MERCADORIA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {mode === 'edit' && produto && produtoVeioDeImportacao(produto) && (
                <div className="md:col-span-2">
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
                    <button
                      type="button"
                      onClick={aplicarPreenchimentoHistorico}
                      disabled={carregandoHistorico}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      <Package className="w-4 h-4" />
                      {carregandoHistorico ? 'Carregando...' : 'Preencher campos fiscais a partir da referência'}
                    </button>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      Preenche apenas campos vazios com valores da referência histórica.
                      Não grava no banco automaticamente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dados fiscais históricos da referência (somente visualização) */}
          {mode === 'view' && produto && produtoVeioDeImportacao(produto) && (
            <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Dados fiscais da referência (histórico de importação)
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Estes valores foram importados da base de referência fiscal e são
                somente leitura. Quando o campo do cadastro está vazio, o valor
                histórico é exibido dentro do campo acima.
              </p>

              {carregandoHistorico && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Carregando dados históricos...
                </p>
              )}

              {erroHistorico && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Erro ao carregar histórico: {erroHistorico}
                </p>
              )}

              {historicoFiscal && historicoFiscal.snapshot_referencia && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">NCM</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.ncm)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">CEST</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.cest)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">CFOP</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(
                        historicoFiscal.snapshot_referencia.cfop_padrao ??
                          historicoFiscal.snapshot_referencia.nfe_cfop,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">Origem</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.origem_mercadoria)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">CST ICMS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_icms)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. ICMS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_icms)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">CST PIS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_pis)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. PIS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_pis)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">CST COFINS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.cst_cofins)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-blue-800 dark:text-blue-300">Alíq. COFINS</dt>
                    <dd className="text-blue-900 dark:text-blue-100">
                      {formatarValorHistorico(historicoFiscal.snapshot_referencia.aliquota_cofins)}
                    </dd>
                  </div>
                </div>
              )}

              {historicoFiscal && !historicoFiscal.snapshot_referencia && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  O item de importação foi encontrado, mas não contém snapshot de referência.
                </p>
              )}

              {!carregandoHistorico && !erroHistorico && !historicoFiscal && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum dado histórico encontrado para este produto.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {mode === 'view' ? 'Fechar' : 'Cancelar'}
          </button>
          {mode !== 'view' && (
             <button
               onClick={handleSave}
               className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
             >
               <Save className="w-4 h-4" />
               <span>{mode === 'create' ? 'Criar Produto' : 'Salvar'}</span>
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default ProdutoModal;
