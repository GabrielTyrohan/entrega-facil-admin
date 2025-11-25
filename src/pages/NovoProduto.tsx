import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Package, Hash, Tag, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ValidationService } from '../services/validationService';

interface FormData {
  nome: string;
  codigo: string;
  categoria: string;
  quantidade: number;
  preco: number;
  descricao: string;
}

const categorias = [
  'Bebidas',
  'Alimentos',
  'Limpeza',
  'Higiene',
  'Outros'
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
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    codigo: '',
    categoria: '',
    quantidade: 0,
    preco: 0,
    descricao: ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // useEffect para gerar SKU quando categoria mudar
  useEffect(() => {
    if (formData.categoria) {
      const novoSKU = gerarSKU(formData.categoria);
      console.log('🔍 Categoria selecionada:', formData.categoria);
      console.log('🔍 SKU gerado:', novoSKU);
      setFormData(prev => ({ ...prev, codigo: novoSKU }));
      
      // Limpar erro do código quando categoria for selecionada
      if (errors.codigo) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.codigo;
          return newErrors;
        });
      }
    } else {
      setFormData(prev => ({ ...prev, codigo: '' }));
    }
  }, [formData.categoria]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Limpar mensagem de sucesso
    if (successMessage) {
      setSuccessMessage('');
    }
    
    if (name === 'quantidade') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else if (name === 'preco') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
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

    // Validação básica do produto
    const produtoValidation = ValidationService.validateProduto(formData);
    if (!produtoValidation.isValid) {
      // Determinar qual campo tem erro baseado na mensagem
      if (produtoValidation.message?.includes('Nome')) {
        newErrors.nome = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Código')) {
        newErrors.codigo = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Categoria')) {
        newErrors.categoria = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Quantidade')) {
        newErrors.quantidade = produtoValidation.message;
      } else if (produtoValidation.message?.includes('Preço')) {
        newErrors.preco = produtoValidation.message;
      }
    }

    if (!formData.codigo) {
      newErrors.codigo = 'Selecione uma categoria para gerar o código SKU.';
    }

    if (formData.codigo.length !== 10) {
      newErrors.codigo = 'O código SKU deve ter 10 caracteres (XXX-######).';
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
      
      // Salvar no localStorage para demonstração
      const produtosExistentes = JSON.parse(localStorage.getItem('produtos') || '[]');
      const novoProduto = {
        id: Date.now().toString(),
        ...formData,
        dataCriacao: new Date().toISOString()
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

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações do Produto</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do Produto *
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.nome ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Ex: Coca-Cola 350ml"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nome}</p>
              )}
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
                  <option value="">Selecione uma categoria</option>
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
                Código do Produto (SKU) *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="codigo"
                  value={formData.codigo}
                  readOnly
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed font-mono"
                  placeholder="Selecione uma categoria"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Gerado automaticamente ao selecionar a categoria</p>
              {errors.codigo && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.codigo}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantidade em Estoque *
              </label>
              <input
                type="number"
                name="quantidade"
                value={formData.quantidade}
                onChange={handleInputChange}
                min="0"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  errors.quantidade ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0"
              />
              {errors.quantidade && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantidade}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preço Unitário (R$) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  name="preco"
                  value={formData.preco}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    errors.preco ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.preco && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.preco}</p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição (Opcional)
              </label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Descrição adicional do produto..."
              />
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Resumo do Produto</h3>
          <div className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <p><strong>Nome:</strong> {formData.nome || 'Não informado'}</p>
            <p><strong>Categoria:</strong> {formData.categoria || 'Não selecionada'}</p>
            <p><strong>Código SKU:</strong> {formData.codigo || 'Não gerado'}</p>
            <p><strong>Estoque:</strong> {formData.quantidade} unidades</p>
            <p><strong>Preço:</strong> R$ {formData.preco.toFixed(2)}</p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NovoProduto;
