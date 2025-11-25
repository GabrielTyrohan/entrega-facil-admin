import React, { useState, useEffect } from 'react';
import { X, Package, Hash, Tag, DollarSign, Save } from 'lucide-react';
import { ProdutoService, CreateProdutoData } from '../../services/produtoService';
import { useAuth } from '../../contexts/AuthContext';
import { type Produto } from '../../hooks/useProdutos';
import { applyCurrencyMask, currencyMaskToNumber } from '../../utils/currencyUtils';

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
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Produto>({
    id: '',
    administrador_id: '',
    produto_nome: '',
    produto_cod: '', // Alterado para string
    categoria: '',
    qtd_estoque: 0,
    preco_unt: 0,
    created_at: '',
    updated_at: ''
  });

  const [precoDisplay, setPrecoDisplay] = useState<string>('');

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        // Reset to empty form for create mode
        setFormData({
           id: '',
           administrador_id: '',
           produto_nome: '',
           produto_cod: '', // Alterado para string
           categoria: '',
           qtd_estoque: 0,
           preco_unt: 0,
           created_at: '',
           updated_at: ''
         });
        setPrecoDisplay('');
      } else if (produto && (mode === 'edit' || mode === 'view')) {
        // Load product data for edit/view mode
        setFormData({
          ...produto,
          produto_cod: String(produto.produto_cod) // Garante que produto_cod seja string
        });
        setPrecoDisplay(produto.preco_unt > 0 ? applyCurrencyMask(String(Math.round(produto.preco_unt * 100))) : '');
      }
    }
  }, [produto, mode, isOpen, user?.id]);

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
      // Apply currency mask
      const maskedValue = applyCurrencyMask(value);
      setPrecoDisplay(maskedValue);
      
      // Convert to number and update form data
      const numericValue = currencyMaskToNumber(maskedValue);
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
      }));
    }
  };



  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.produto_nome.trim()) {
        alert('Nome do produto é obrigatório');
        return;
      }
      
      if (!formData.produto_cod.trim()) { // Alterado para trim()
        alert('Código do produto é obrigatório');
        return;
      }
      
      if (formData.produto_cod.length !== 10) { // Validação do tamanho do SKU
        alert('O código SKU deve ter 10 caracteres (XXX-######).');
        return;
      }
      
      if (!formData.categoria.trim()) {
        alert('Categoria é obrigatória');
        return;
      }
      
      if (formData.preco_unt < 0) {
        alert('Preço não pode ser negativo');
        return;
      }
      
      if (formData.qtd_estoque < 0) {
        alert('Quantidade não pode ser negativa');
        return;
      }

      if (mode === 'create') {
        if (!user?.id) {
          alert('Usuário não autenticado');
          return;
        }

        // Check if product code already exists
        const existingProduct = await ProdutoService.checkExistingCode(formData.produto_cod, user.id);
        if (existingProduct) {
          alert('Já existe um produto com este código');
          return;
        }

        const createData: CreateProdutoData = {
          administrador_id: user.id,
          produto_nome: formData.produto_nome,
          produto_cod: formData.produto_cod, // Mantido como string
          categoria: formData.categoria,
          qtd_estoque: formData.qtd_estoque,
          preco_unt: formData.preco_unt
        };

        const newProduct = await ProdutoService.createProduto(createData);
        
        if (onSave) {
          // The created product already matches the new interface
          onSave(newProduct);
        }
        
        alert('Produto criado com sucesso!');
        
        // Reset form after successful creation
        setFormData({
          id: '',
          administrador_id: '',
          produto_nome: '',
          produto_cod: '', // Alterado para string
          categoria: '',
          qtd_estoque: 0,
          preco_unt: 0,
          created_at: '',
          updated_at: ''
        });
        setPrecoDisplay('');
        
        onClose();
      } else if (mode === 'edit') {
        // Handle edit mode - implementar atualização do produto
        if (!user?.id) {
          alert('Usuário não autenticado');
          return;
        }

        try {
          const produtoService = new ProdutoService(user.id);
          
          // Verificar se o código já existe (excluindo o produto atual)
          const codigoExiste = await produtoService.verificarCodigoExistente(formData.produto_cod, formData.id);
          if (codigoExiste) {
            alert('Já existe um produto com este código');
            return;
          }

          // Atualizar o produto
          const produtoAtualizado = await produtoService.updateProduto(formData.id, {
            produto_nome: formData.produto_nome,
            produto_cod: formData.produto_cod, // Mantido como string
            categoria: formData.categoria,
            qtd_estoque: formData.qtd_estoque,
            preco_unt: formData.preco_unt
          });

          if (onSave) {
            onSave(produtoAtualizado);
          }
          
          alert('Produto atualizado com sucesso!');
          onClose();
        } catch {
          // Error handling without logging sensitive data
          alert('Erro ao atualizar produto. Tente novamente.');
        }
      }
    } catch {
      // Error handling without logging sensitive data
      alert('Erro ao salvar produto. Tente novamente.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {mode === 'create' ? 'Criar Produto' : mode === 'edit' ? 'Editar Produto' : 'Detalhes do Produto'}
            </h2>
          </div>
          <button
            onClick={() => {
              // Reset form when closing modal
              if (mode === 'create') {
                setFormData({
                  id: '',
                  administrador_id: '',
                  produto_nome: '',
                  produto_cod: '', // Alterado para string
                  categoria: '',
                  qtd_estoque: 0,
                  preco_unt: 0,
                  created_at: '',
                  updated_at: ''
                });
                setPrecoDisplay('');
              }
              onClose();
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do Produto *
              </label>
              {mode === 'view' ? (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {formData.produto_nome}
                </div>
              ) : (
                <input
                  type="text"
                  name="produto_nome"
                  value={formData.produto_nome}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Digite o nome do produto"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Código (SKU) *
              </label>
              {mode === 'view' ? (
                <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  <Hash className="w-4 h-4 mr-2 text-gray-400" />
                  {formData.produto_cod}
                </div>
              ) : (
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" // Alterado para text
                    name="produto_cod"
                    value={formData.produto_cod}
                    readOnly // Adicionado readOnly
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed font-mono"
                    placeholder="Gerado automaticamente"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoria *
              </label>
              {mode === 'view' ? (
                <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  <Tag className="w-4 h-4 mr-2 text-gray-400" />
                  {formData.categoria}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(categoria => (
                        <option key={categoria} value={categoria}>{categoria}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantidade em Estoque *
              </label>
              {mode === 'view' ? (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {formData.qtd_estoque} unidades
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    name="qtd_estoque"
                    value={formData.qtd_estoque}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preço Unitário *
              </label>
              {mode === 'view' ? (
                <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                  R$ {formData.preco_unt.toFixed(2)}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="preco_unt"
                      value={precoDisplay}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="R$ 0,00"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Informações de Sistema */}
          {mode === 'view' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Informações do Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Criado em:</span>
                  <p className="text-gray-900 dark:text-white">
                    {formData.created_at ? new Date(formData.created_at).toLocaleString('pt-BR') : 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Última atualização:</span>
                  <p className="text-gray-900 dark:text-white">
                    {formData.updated_at ? new Date(formData.updated_at).toLocaleString('pt-BR') : 'Não informado'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              // Reset form when canceling
              if (mode === 'create') {
                setFormData({
                  id: '',
                  administrador_id: '',
                  produto_nome: '',
                  produto_cod: '', // Alterado para string
                  categoria: '',
                  qtd_estoque: 0,
                  preco_unt: 0,
                  created_at: '',
                  updated_at: ''
                });
                setPrecoDisplay('');
              }
              onClose();
            }}
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
