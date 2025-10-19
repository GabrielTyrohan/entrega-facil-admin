import React, { useState } from 'react';
import { ArrowLeft, Save, User, Mail, Phone, Lock, MapPin, Calendar, FileText, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as vendedorService from '../services/vendedorService';

interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix?: string;
}

const NovoVendedor: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Função para gerar senha numérica de 6 dígitos
  const gerarSenhaAleatoria = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Função para obter data atual no formato YYYY-MM-DD
  const obterDataAtual = (): string => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: gerarSenhaAleatoria(), // Gera senha automática de 6 dígitos
    endereco: '',
    dataInicio: obterDataAtual(), // Data atual como padrão
    tipoVinculo: 'CLT',
    percentualMinimo: 50, // 50% como padrão
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

  // Função para formatar agência (máximo 4 dígitos)
  const formatAgencia = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 4 dígitos
    return numbers.slice(0, 4);
  };

  // Função para formatar conta com máscara (xxxxx-x)
  const formatConta = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 6 dígitos
    const limitedNumbers = numbers.slice(0, 6);
    
    // Aplica a máscara se tiver mais de 5 dígitos
    if (limitedNumbers.length > 5) {
      return `${limitedNumbers.slice(0, 5)}-${limitedNumbers.slice(5)}`;
    }
    
    return limitedNumbers;
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações básicas
      if (!formData.nome.trim()) {
        alert('Nome é obrigatório');
        setLoading(false);
        return;
      }
      
      if (!formData.email.trim()) {
        alert('Email é obrigatório');
        setLoading(false);
        return;
      }

      // Validação de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        alert('Por favor, insira um email válido');
        setLoading(false);
        return;
      }
      
      if (!formData.senha) {
        alert('Senha é obrigatória');
        setLoading(false);
        return;
      }

      if (formData.senha.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres');
        setLoading(false);
        return;
      }
      
      if (!user?.id) {
        alert('Usuário não autenticado. Faça login novamente.');
        setLoading(false);
        return;
      }

      // Log dos dados para debug
      console.log('Dados do vendedor:', {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        senha: formData.senha,
        endereco: formData.endereco,
        data_inicio: formData.dataInicio,
        tipo_vinculo: formData.tipoVinculo,
        percentual_minimo: formData.percentualMinimo,
        contrato: formData.contrato,
        ativo: formData.ativo,
        status: formData.status,
        dados_bancarios: dadosBancarios,
        administrador_id: user?.id
      });

      // Map form data to Vendedor interface structure
      const vendedorData = {
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone || undefined,
        senha: formData.senha ? parseInt(formData.senha) : undefined, // Converter para número
        endereco: formData.endereco || undefined,
        data_inicio: formData.dataInicio || undefined,
        tipo_vinculo: formData.tipoVinculo || undefined,
        percentual_minimo: formData.percentualMinimo || undefined,
        contrato: formData.contrato || undefined,
        ativo: formData.ativo,
        status: formData.status,
        dados_bancarios: Object.keys(dadosBancarios).length > 0 && 
                        (dadosBancarios.banco || dadosBancarios.agencia || dadosBancarios.conta) 
                        ? dadosBancarios : undefined,
        administrador_id: user?.id || ''
      };

      // Debug: verificar se o administrador_id está correto
      console.log('Administrador ID:', user?.id);
      console.log('Dados do vendedor:', vendedorData);

      // Use the vendedorService to create the vendor
      const result = await vendedorService.VendedorService.createVendedor(vendedorData);
      
      if (result) {
        alert('Vendedor cadastrado com sucesso!');
        navigate('/vendedores');
      } else {
        throw new Error('Falha ao criar vendedor - resultado vazio');
      }
    } catch (error) {
      console.error('Erro detalhado:', error);
      
      // Mostrar erro mais específico
      let errorMessage = 'Erro ao cadastrar vendedor. Tente novamente.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Se for um erro do Supabase
        const supabaseError = error as Record<string, unknown>;
        if (supabaseError.message) {
          errorMessage = supabaseError.message as string;
        } else if (supabaseError.error_description) {
          errorMessage = supabaseError.error_description as string;
        }
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Novo Vendedor</h1>
            <p className="text-gray-600 dark:text-gray-400">Cadastre um novo vendedor na equipe</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Pessoais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Pessoais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Digite o nome completo"
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
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Senha de Acesso *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    name="senha"
                    value={formData.senha}
                    onChange={handleInputChange}
                    required
                    min="0"
                    max="999999"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Senha numérica (6 dígitos)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, senha: gerarSenhaAleatoria() }))}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                  title="Gerar nova senha"
                >
                  🔄
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Senha numérica de 6 dígitos gerada automaticamente
              </p>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Endereço
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Endereço completo"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Informações Profissionais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <FileText className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Profissionais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Início
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  name="dataInicio"
                  value={formData.dataInicio}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Vínculo
              </label>
              <select
                name="tipoVinculo"
                value={formData.tipoVinculo}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="CLT">CLT</option>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Terceirizado">Terceirizado</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Percentual Mínimo (%)
              </label>
              <input
                type="number"
                name="percentualMinimo"
                value={formData.percentualMinimo}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.0"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observações do Contrato
              </label>
              <textarea
                name="contrato"
                value={formData.contrato}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observações sobre o contrato"
              />
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Bancários</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Banco
              </label>
              <input
                type="text"
                name="banco"
                value={dadosBancarios.banco}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome do banco"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Número da agência"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Número da conta"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="salario">Conta Salário</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Chave PIX (Opcional)
              </label>
              <input
                type="text"
                name="pix"
                value={dadosBancarios.pix}
                onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="CPF, email, telefone ou chave aleatória"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h2>
          
          <div className="flex flex-col space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Vendedor ativo</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                name="status"
                checked={formData.status}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Status habilitado</span>
            </label>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/vendedores')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar Vendedor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoVendedor;
