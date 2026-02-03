import { ArrowLeft, FileText, Hash, Package, Save, Tag, TrendingUp, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProdutoCadastrado } from '../services/produtoService';
import { ValidationService } from '../services/validationService';

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

const NovoProduto: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<ProdutoCadastrado>>({
    produto_nome: '',
    produto_cod: '',
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
    aliquota_icms: 0
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // useEffect para gerar SKU quando categoria mudar
  useEffect(() => {
    if (formData.categoria) {
      // Apenas gerar novo SKU se não houver um definido ou se o usuário estiver mudando a categoria de um novo produto
      // (assumindo que estamos criando, não editando)
      const novoSKU = gerarSKU(formData.categoria);
      console.log('🔍 Categoria selecionada:', formData.categoria);
      console.log('🔍 SKU gerado:', novoSKU);
      setFormData(prev => ({ ...prev, produto_cod: novoSKU }));
      
      // Limpar erro do código quando categoria for selecionada
      if (errors.produto_cod) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.produto_cod;
          return newErrors;
        });
      }
    } else {
      setFormData(prev => ({ ...prev, produto_cod: '' }));
    }
  }, [formData.categoria]);

  // Cálculo automático da margem de lucro ou preço de venda
  useEffect(() => {
    // Se temos custo e preço, podemos calcular a margem
    if (formData.custo_compra && formData.preco_unt) {
      const custo = Number(formData.custo_compra);
      // const preco = Number(formData.preco_unt);
      if (custo > 0) {
        // const margem = ((preco - custo) / custo) * 100;
      }
    }
  }, [formData.custo_compra, formData.preco_unt]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Limpar mensagem de sucesso
    if (successMessage) {
      setSuccessMessage('');
    }
    
    // Tratamento para checkboxes
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } 
    // Tratamento para números
    else if ([
      'qtd_estoque', 'preco_unt', 'custo_compra', 'margem_lucro', 
      'estoque_minimo', 'estoque_maximo', 'aliquota_pis', 
      'aliquota_cofins', 'aliquota_icms'
    ].includes(name)) {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } 
    // Texto padrão
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validação básica do produto usando o serviço
    const produtoValidation = ValidationService.validateProduto(formData);
    if (!produtoValidation.isValid) {
      // Mapear mensagens de erro genéricas para campos específicos
      if (produtoValidation.message?.includes('Nome')) {
        newErrors.produto_nome = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Código')) {
        newErrors.produto_cod = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Categoria')) {
        newErrors.categoria = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Quantidade')) {
        newErrors.qtd_estoque = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Preço')) {
        newErrors.preco_unt = produtoValidation.message;
      }
    }

    if (!formData.produto_cod) {
      newErrors.produto_cod = 'Selecione uma categoria para gerar o código SKU.';
    }

    // Validar campos adicionais
    if (formData.estoque_minimo && formData.estoque_maximo && formData.estoque_minimo > formData.estoque_maximo) {
      newErrors.estoque_minimo = 'Estoque mínimo não pode ser maior que o máximo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Simular salvamento (em um sistema real, seria uma chamada à API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Salvar no localStorage para demonstração (adaptado para nova estrutura)
      const produtosExistentes = JSON.parse(localStorage.getItem('produtos') || '[]');
      const novoProduto = {
        id: Date.now().toString(),
        administrador_id: 'admin-demo', // Valor mockado
        ...formData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      produtosExistentes.push(novoProduto);
      localStorage.setItem('produtos', JSON.stringify(produtosExistentes));
      
      setSuccessMessage(ValidationService.getSuccessMessage('create', 'produto'));
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/produtos');
      }, 2000);
      
    } catch {
      setErrors({ submit: 'Erro ao salvar produto. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/produtos')}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Novo Produto</h1>
            <p className="text-gray-600 dark:text-gray-400">Cadastre um novo produto no sistema</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{isLoading ? 'Salvando...' : 'Salvar Produto'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Erro de Submissão */}
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {errors.submit}
          </div>
        )}

        {/* Informações Básicas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Básicas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do Produto *
              </label>
              <input
                type="text"
                name="produto_nome"
                value={formData.produto_nome}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.produto_nome ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Ex: Coca-Cola 350ml"
              />
              {errors.produto_nome && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.produto_nome}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Código de Barras
              </label>
              <input
                type="text"
                name="codigo_barras"
                value={formData.codigo_barras}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="EAN-13"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoria *
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.categoria ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Selecione</option>
                  {categorias.map(categoria => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
              </div>
              {errors.categoria && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.categoria}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Código (SKU) *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="produto_cod"
                  value={formData.produto_cod}
                  readOnly
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed font-mono"
                  placeholder="Automático"
                />
              </div>
              {errors.produto_cod && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.produto_cod}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unidade
              </label>
              <select
                name="unidade_medida"
                value={formData.unidade_medida}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {unidadesMedida.map(un => (
                  <option key={un} value={un}>{un}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-4 pt-8">
               <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleInputChange}
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
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">É Kit?</span>
              </label>
            </div>
          </div>
        </div>

        {/* Estoque e Custos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Estoque e Custos</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Qtd. Estoque *
              </label>
              <input
                type="number"
                name="qtd_estoque"
                value={formData.qtd_estoque}
                onChange={handleInputChange}
                min="0"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.qtd_estoque ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.qtd_estoque && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.qtd_estoque}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preço Venda (R$) *
              </label>
              <input
                type="number"
                name="preco_unt"
                value={formData.preco_unt}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.preco_unt ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.preco_unt && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.preco_unt}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custo Compra (R$)
              </label>
              <input
                type="number"
                name="custo_compra"
                value={formData.custo_compra}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Margem Lucro (%)
              </label>
              <input
                type="number"
                name="margem_lucro"
                value={formData.margem_lucro}
                onChange={handleInputChange}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

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
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.estoque_minimo ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
               {errors.estoque_minimo && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.estoque_minimo}</p>
              )}
            </div>

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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Dados Fiscais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Fiscais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                NCM
              </label>
              <input
                type="text"
                name="ncm"
                value={formData.ncm}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="0000.00.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CEST
              </label>
              <input
                type="text"
                name="cest"
                value={formData.cest}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CFOP Padrão
              </label>
              <input
                type="text"
                name="cfop_padrao"
                value={formData.cfop_padrao}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="5102"
              />
            </div>

            {/* Impostos simplificados para layout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CST PIS
              </label>
              <input
                type="text"
                name="cst_pis"
                value={formData.cst_pis}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CST COFINS
              </label>
              <input
                type="text"
                name="cst_cofins"
                value={formData.cst_cofins}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CST ICMS
              </label>
              <input
                type="text"
                name="cst_icms"
                value={formData.cst_icms}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Fornecedor */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Truck className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fornecedor</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fornecedor Principal
              </label>
              <input
                type="text"
                name="fornecedor_principal"
                value={formData.fornecedor_principal}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Nome do Fornecedor"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NovoProduto;
