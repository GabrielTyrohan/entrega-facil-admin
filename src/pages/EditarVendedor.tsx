import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, User, Mail, Phone, Lock, MapPin, Calendar, FileText, CreditCard, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { VendedorService } from '../services/vendedorService';
import { useAuth } from '../contexts/AuthContext';
import { Vendedor } from '../lib/supabase';

interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix?: string;
}

const EditarVendedor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    endereco: '',
    dataInicio: '',
    tipoVinculo: 'CLT',
    percentualMinimo: 0,
    contrato: '',
    ativo: true,
    status: true
  });

  const [dadosBancarios, setDadosBancarios] = useState<DadosBancarios>({
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'corrente',
    pix: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Função para formatar telefone com máscara (xx) xxxxx-xxxx
  const formatTelefone = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    const limitedNumbers = numbers.slice(0, 11);
    
    // Aplica a máscara baseada no tamanho
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  // Carregar dados do vendedor
  useEffect(() => {
    const carregarVendedor = async () => {
      if (!id || !user?.id) return;
      
      try {
        const vendedorService = new VendedorService(user.id);
        const vendedor = await vendedorService.getById(id);
        
        if (!vendedor) {
          alert('Vendedor não encontrado.');
          navigate('/vendedores');
          return;
        }
        
        // Mapear dados do Supabase para o formato do formulário
        setFormData({
          nome: vendedor.nome || '',
          email: vendedor.email || '',
          telefone: formatTelefone(vendedor.telefone || ''), // Aplicar máscara ao carregar
          senha: String(vendedor.senha || ''), // Garantir que seja sempre string
          endereco: vendedor.endereco || '',
          dataInicio: vendedor.created_at ? new Date(vendedor.created_at).toISOString().split('T')[0] : '',
          tipoVinculo: 'CLT', // Valor padrão, pode ser adicionado ao banco se necessário
          percentualMinimo: vendedor.percentual_minimo || 0,
          contrato: '', // Pode ser adicionado ao banco se necessário
          ativo: vendedor.ativo ?? false,
          status: vendedor.ativo ?? false // Usando ativo como status
        });
        
        // Carregar dados bancários se existirem
        if (vendedor.dados_bancarios) {
          const dados = typeof vendedor.dados_bancarios === 'string' 
            ? JSON.parse(vendedor.dados_bancarios) 
            : vendedor.dados_bancarios;
          setDadosBancarios(dados);
        }
      } catch {
        // Error handling without logging sensitive data
        alert('Erro ao carregar dados do vendedor.');
      } finally {
        setLoadingData(false);
      }
    };

    carregarVendedor();
  }, [id, user?.id, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'percentualMinimo') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (name === 'telefone') {
      const formatted = formatTelefone(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBankDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'agencia') {
      const formatted = formatAgencia(value);
      setDadosBancarios(prev => ({ ...prev, [name]: formatted }));
    } else if (name === 'conta') {
      const formatted = formatConta(value);
      setDadosBancarios(prev => ({ ...prev, [name]: formatted }));
    } else {
      setDadosBancarios(prev => ({ ...prev, [name]: value }));
    }
  };

  // Função para formatar agência (máximo 4 números)
  const formatAgencia = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    // Limita a 4 dígitos
    return numbers.slice(0, 4);
  };

  // Função para formatar conta com máscara xxxxx-x (máximo 6 números)
  const formatConta = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    // Limita a 6 dígitos
    const limitedNumbers = numbers.slice(0, 6);
    
    // Aplica a máscara xxxxx-x
    if (limitedNumbers.length <= 5) {
      return limitedNumbers;
    } else {
      return `${limitedNumbers.slice(0, 5)}-${limitedNumbers.slice(5)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!id || !user?.id) {
        alert('Dados inválidos para atualização.');
        return;
      }

      const vendedorService = new VendedorService(user.id);
      
      // Preparar dados para atualização no formato do Supabase
      const updateData: Partial<Vendedor> = {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        endereco: formData.endereco,
        percentual_minimo: Number(formData.percentualMinimo),
        ativo: formData.ativo,
        dados_bancarios: dadosBancarios
      };

      // Se uma nova senha foi fornecida, incluir na atualização
      if (formData.senha && formData.senha.trim()) {
        // Nota: Em um sistema real, a senha deveria ser hasheada antes de salvar
        updateData.senha = Number(formData.senha);
      }

      await vendedorService.update(id, updateData);
      
      alert('Vendedor atualizado com sucesso!');
      navigate('/vendedores');
    } catch {
      // Error handling without logging sensitive data
      alert('Erro ao atualizar vendedor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/vendedores')}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Editar Vendedor</h1>
            <p className="text-gray-600 dark:text-gray-400">Atualize as informações do vendedor</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Pessoais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Pessoais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="senha"
                  value={formData.senha}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Endereço *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Informações Profissionais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Profissionais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Início *
              </label>
              <input
                type="date"
                name="dataInicio"
                value={formData.dataInicio}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Vínculo *
              </label>
              <select
                name="tipoVinculo"
                value={formData.tipoVinculo}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="CLT">CLT</option>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="Freelancer">Freelancer</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Percentual Mínimo (%) *
              </label>
              <input
                type="number"
                name="percentualMinimo"
                value={formData.percentualMinimo}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.1"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Observações do Contrato
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                name="contrato"
                value={formData.contrato}
                onChange={handleInputChange}
                rows={3}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Observações sobre o contrato..."
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-6 mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Vendedor Ativo</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                name="status"
                checked={formData.status}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Status Habilitado</span>
            </label>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Bancários</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Banco
              </label>
              <input
                type="text"
                name="banco"
                value={dadosBancarios.banco}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Ex: Banco do Brasil"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Agência
              </label>
              <input
                type="text"
                name="agencia"
                value={dadosBancarios.agencia}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Ex: 1234"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Conta
              </label>
              <input
                type="text"
                name="conta"
                value={dadosBancarios.conta}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Ex: 56789-0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Conta
              </label>
              <select
                name="tipoConta"
                value={dadosBancarios.tipoConta}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chave PIX (Opcional)
            </label>
            <input
              type="text"
              name="pix"
              value={dadosBancarios.pix}
              onChange={handleBankDataChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditarVendedor;
