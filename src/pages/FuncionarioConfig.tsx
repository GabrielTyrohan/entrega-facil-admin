import { Skeleton } from "@/components/ui/Skeleton";
import { Activity, Briefcase, Clock, Save, Shield, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const FuncionarioConfig: React.FC = () => {
  const { userProfile, isLoading, userType } = useAuth();
  const navigate = useNavigate();
  
  // Cast para FuncionarioProfile
  const funcionarioData = userProfile as any;

  const [nome, setNome] = useState<string>(funcionarioData?.nome || '');
  const [telefone, setTelefone] = useState<string>(funcionarioData?.telefone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!funcionarioData) return;
    setNome(funcionarioData.nome || '');
    setTelefone(funcionarioData.telefone || '');
  }, [funcionarioData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleString('pt-BR');
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

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      setTelefone(cleaned);
    }
  };

  const handleSave = async () => {
    if (!funcionarioData?.id) {
      setMessage({ type: 'error', text: 'Usuário não encontrado.' });
      return;
    }

    const hasChanges = 
      nome !== (funcionarioData?.nome || '') ||
      telefone !== (funcionarioData?.telefone || '');

    if (!hasChanges) {
      setMessage({ type: 'info', text: 'Nenhuma alteração foi detectada. Não é necessário salvar.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('funcionarios')
        .update({
          nome,
          telefone,
          updated_at: new Date().toISOString()
        })
        .eq('id', funcionarioData.id);

      if (error) {
        throw error;
      }

      setMessage({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar os dados. Tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (userType !== 'funcionario') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
          <p className="text-red-700 dark:text-red-400">
            Esta página é exclusiva para funcionários.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie suas informações pessoais</p>
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
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
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
          
          {/* Informações Read-only */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
                <p className="text-gray-900 dark:text-white">{funcionarioData?.email || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Cargo:</span>
                <p className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  {funcionarioData?.cargo || 'Não informado'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ID do Funcionário:</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{funcionarioData?.id}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Data de Cadastro:</span>
                <p className="text-gray-900 dark:text-white">{formatDate(funcionarioData?.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Completo
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
          </div>
        </div>

        {/* Sidebar com informações adicionais */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Status da Conta</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <span className={`text-sm font-medium ${funcionarioData?.ativo ? 'text-green-600' : 'text-red-600'}`}>
                  {funcionarioData?.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Bloqueado</span>
                <span className={`text-sm font-medium ${funcionarioData?.bloqueado ? 'text-red-600' : 'text-green-600'}`}>
                  {funcionarioData?.bloqueado ? 'Sim' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tentativas Login</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {funcionarioData?.tentativas_login || 0}
                </span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                 <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span>Último Login</span>
                 </div>
                 <p className="text-sm font-medium text-gray-900 dark:text-white pl-6">
                    {formatDate(funcionarioData?.ultimo_login)}
                 </p>
              </div>
            </div>
          </div>

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
  );
};

export default FuncionarioConfig;