import React, { useState, useEffect } from 'react';
import { User, Shield, Building, MapPin, CreditCard, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Configuracoes: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica'>(
    user?.tipo_pessoa === 'juridica' ? 'juridica' : 'fisica'
  );
  const [cpfCnpj, setCpfCnpj] = useState<string>(user?.cpf_cnpj || '');
  const [cep, setCep] = useState<string>(user?.cep || '');
  const [estado, setEstado] = useState<string>(user?.estado || '');
  const [nome, setNome] = useState<string>(user?.nome || '');
  const [sobrenome, setSobrenome] = useState<string>(user?.sobrenome || '');
  const [telefone, setTelefone] = useState<string>(user?.telefone || '');
  const [telefoneSecundario, setTelefoneSecundario] = useState<string>(user?.telefone_secundario || '');
  const [nomeEmpresa, setNomeEmpresa] = useState<string>(user?.nome_empresa || '');
  const [endereco, setEndereco] = useState<string>(user?.endereco || '');
  const [numero, setNumero] = useState<string>(user?.numero || '');
  const [complemento, setComplemento] = useState<string>(user?.complemento || '');
  const [bairro, setBairro] = useState<string>(user?.bairro || '');
  const [cidade, setCidade] = useState<string>(user?.cidade || '');
  const [pais, setPais] = useState<string>(user?.pais || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (user?.tipo_pessoa) {
      setTipoPessoa(user.tipo_pessoa === 'juridica' ? 'juridica' : 'fisica');
    }
  }, [user?.tipo_pessoa]);

  useEffect(() => {
    if (user?.cpf_cnpj) {
      setCpfCnpj(user.cpf_cnpj);
    }
  }, [user?.cpf_cnpj]);

  useEffect(() => {
    if (user?.cep) {
      setCep(user.cep);
    }
  }, [user?.cep]);

  useEffect(() => {
    if (user?.estado) {
      setEstado(user.estado);
    }
  }, [user?.estado]);

  useEffect(() => {
    if (!user) return;
    setNome(user.nome || '');
    setSobrenome(user.sobrenome || '');
    setTelefone(user.telefone || '');
    setTelefoneSecundario(user.telefone_secundario || '');
    setNomeEmpresa(user.nome_empresa || '');
    setEndereco(user.endereco || '');
    setNumero(user.numero || '');
    setComplemento(user.complemento || '');
    setBairro(user.bairro || '');
    setCidade(user.cidade || '');
    setPais(user.pais || '');
  }, [user]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return cleaned;
  };



  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCpfCnpj = (value?: string) => {
    if (!value) return '';
    
    const cleaned = value.replace(/\D/g, '');
    
    if (tipoPessoa === 'fisica') {
      return formatCPF(cleaned);
    } else {
      return formatCNPJ(cleaned);
    }
  };

  const formatCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 8) {
      return cleaned.replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '');
    }
    return value;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 8) {
      setCep(cleaned);
    }
  };

  const estadosBrasil = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    
    // Limita o número de dígitos baseado no tipo de pessoa
    const maxLength = tipoPessoa === 'fisica' ? 11 : 14;
    if (cleaned.length <= maxLength) {
      setCpfCnpj(cleaned);
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      setTelefone(cleaned);
    }
  };

  const handleTelefoneSecundarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      setTelefoneSecundario(cleaned);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'Usuário não encontrado.' });
      return;
    }

    const hasChanges = 
      tipoPessoa !== (user.tipo_pessoa || '') ||
      cpfCnpj !== (user.cpf_cnpj || '') ||
      cep !== (user.cep || '') ||
      estado !== (user.estado || '') ||
      nome !== (user.nome || '') ||
      sobrenome !== (user.sobrenome || '') ||
      telefone !== (user.telefone || '') ||
      telefoneSecundario !== (user.telefone_secundario || '') ||
      nomeEmpresa !== (user.nome_empresa || '') ||
      endereco !== (user.endereco || '') ||
      numero !== (user.numero || '') ||
      complemento !== (user.complemento || '') ||
      bairro !== (user.bairro || '') ||
      cidade !== (user.cidade || '') ||
      pais !== (user.pais || '');

    if (!hasChanges) {
      setMessage({ type: 'info', text: 'Nenhuma alteração foi detectada. Não é necessário salvar.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('administradores')
        .update({
          tipo_pessoa: tipoPessoa,
          cpf_cnpj: cpfCnpj,
          cep,
          estado,
          nome,
          sobrenome,
          telefone,
          telefone_secundario: telefoneSecundario,
          nome_empresa: nomeEmpresa,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          pais,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar os dados. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
          <p className="text-gray-600 dark:text-gray-400">Perfil, informações pessoais e configurações do sistema</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {message && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-700 border border-green-200'
                : message.type === 'info'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados Pessoais */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Pessoais</h2>
          </div>
          
          {/* Informações básicas */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
                <p className="text-gray-900 dark:text-white">{user?.email || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Data de Cadastro:</span>
                <p className="text-gray-900 dark:text-white">{formatDate(user?.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sobrenome
              </label>
              <input
                type="text"
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefone
              </label>
              <input
                type="text"
                value={formatPhone(telefone)}
                onChange={handleTelefoneChange}
                placeholder="(11) 99999-9999"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefone Secundário
              </label>
              <input
                type="text"
                value={formatPhone(telefoneSecundario)}
                onChange={handleTelefoneSecundarioChange}
                placeholder="(11) 99999-9999"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

          </div>
        </div>

        {/* Sidebar com informações adicionais */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Status da Conta</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status do Pagamento</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {user?.status_pagamento || 'Ativo'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Valor da Assinatura</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(user?.valor_assinatura) || 'R$ 0,00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Data de Vencimento</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {formatDate(user?.data_vencimento) || 'Não informado'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Última Cobrança</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {formatDate(user?.ultima_cobranca) || 'Não informado'}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Segurança */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Segurança</h2>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/alterar-senha')}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Alterar Senha
            </button>
          </div>
        </div>
      </div>
        </div>
      </div>
      

      {/* Dados da Empresa */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-6">
          <Building className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados da Empresa</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Pessoa
            </label>
            <select
              value={tipoPessoa}
              onChange={(e) => {
                setTipoPessoa(e.target.value as 'fisica' | 'juridica');
                setCpfCnpj('');
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="fisica">Pessoa Física</option>
              <option value="juridica">Pessoa Jurídica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatCpfCnpj(cpfCnpj)}
                onChange={handleCpfCnpjChange}
                placeholder={tipoPessoa === 'fisica' ? 'Digite o CPF' : 'Digite o CNPJ'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-6">
          <MapPin className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Endereço</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CEP
            </label>
            <input
              type="text"
              value={formatCEP(cep)}
              onChange={handleCepChange}
              placeholder="Digite o CEP"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Endereço
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Número
            </label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Complemento
            </label>
            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bairro
            </label>
            <input
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cidade
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Selecione o estado</option>
              {estadosBrasil.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              País
            </label>
            <input
              type="text"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      

      {/* Botão Sair da Conta */}
      <div className="flex justify-center mt-6">
        <button
          onClick={() => {
            signOut();
            navigate('/login');
          }}
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg font-medium transition-colors"
        >
          Sair da Conta
        </button>
      </div>
    </div>
  );
};

export default Configuracoes;
