import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Estados do formulário
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estados para mostrar/ocultar senhas
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Calcular força da senha
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, label: '', color: '', bgColor: '' };
    
    let score = 0;
    const checks = {
      length: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    // Pontuação baseada nos critérios
    if (checks.length) score += 25;
    if (checks.hasLetter) score += 25;
    if (checks.hasNumber) score += 25;
    if (checks.hasSpecial) score += 25;
    
    // Definir cor e label baseado na pontuação
    if (score === 0) {
      return { score: 0, label: '', color: '', bgColor: '' };
    } else if (score <= 25) {
      return { score, label: 'Muito Fraca', color: 'text-red-600', bgColor: 'bg-red-500' };
    } else if (score <= 50) {
      return { score, label: 'Fraca', color: 'text-orange-600', bgColor: 'bg-orange-500' };
    } else if (score <= 75) {
      return { score, label: 'Média', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
    } else {
      return { score, label: 'Forte', color: 'text-green-600', bgColor: 'bg-green-500' };
    }
  };

  // Calcular força da senha em tempo real
  const passwordStrength = getPasswordStrength(newPassword);

  // Proteção de rota - verificar se usuário está autenticado
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/login');
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Validação de senha forte
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('A senha deve ter no mínimo 8 caracteres');
    }
    
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra');
    }
    
    if (!/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um número');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial');
    }
    
    return errors;
  };

  // Validar senha atual
  const validateCurrentPassword = async (password: string): Promise<boolean> => {
    if (!user?.email) return false;
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });
      
      return !error;
    } catch (error) {
      return false;
    }
  };

  // Limpar mensagens após um tempo
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Validações básicas
      if (!currentPassword || !newPassword || !confirmPassword) {
        setMessage({ type: 'error', text: 'Todos os campos são obrigatórios' });
        return;
      }

      // Validar se nova senha e confirmação são iguais
      if (newPassword !== confirmPassword) {
        setMessage({ type: 'error', text: 'A nova senha e confirmação devem ser iguais' });
        return;
      }

      // Validar força da nova senha
      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        setMessage({ type: 'error', text: passwordErrors.join('. ') });
        return;
      }

      // Verificar se a senha é forte o suficiente
      const strength = getPasswordStrength(newPassword);
      if (strength.score < 100) {
        setMessage({ type: 'error', text: 'A senha deve atender a todos os critérios de segurança' });
        return;
      }

      // Validar senha atual
      const isCurrentPasswordValid = await validateCurrentPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        setMessage({ type: 'error', text: 'Senha atual incorreta' });
        return;
      }

      // Atualizar senha no Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      // Sucesso
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      
      // Limpar formulário
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/configuracoes');
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Erro interno. Tente novamente.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Alterar Senha
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Mantenha sua conta segura com uma senha forte
          </p>
        </div>

        {/* Botão Voltar */}
        <button
          onClick={() => navigate('/configuracoes')}
          className="mb-6 flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar para Configurações
        </button>

        {/* Formulário */}
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-lg rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Senha Atual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Senha Atual *
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Digite sua senha atual"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nova Senha *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Digite sua nova senha"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Indicador de força da senha */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Força da senha:</span>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.bgColor}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <p>Critérios para senha forte:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li className={newPassword.length >= 8 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                        Mínimo 8 caracteres
                      </li>
                      <li className={/[a-zA-Z]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                        Pelo menos uma letra
                      </li>
                      <li className={/\d/.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                        Pelo menos um número
                      </li>
                      <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                        Pelo menos um caractere especial
                      </li>
                    </ul>
                  </div>
                </div>
              )}
              
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mínimo 8 caracteres, incluindo letras, números e símbolos
              </p>
            </div>

            {/* Confirmar Nova Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Confirme sua nova senha"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Mensagem de Feedback */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            {/* Botão de Submissão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Alterando Senha...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </button>
          </form>

          {/* Dicas de Segurança */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              Dicas para uma senha segura:
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <li>• Use pelo menos 8 caracteres</li>
              <li>• Combine letras maiúsculas e minúsculas</li>
              <li>• Inclua números e símbolos especiais</li>
              <li>• Evite informações pessoais óbvias</li>
              <li>• Não reutilize senhas de outras contas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;