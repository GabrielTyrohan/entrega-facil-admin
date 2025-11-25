import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const LoginPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para controle de segurança
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0); // Contador de quantos bloqueios já ocorreram

  // Carrega dados do localStorage ao inicializar
  useEffect(() => {
    const savedFailedAttempts = localStorage.getItem('loginFailedAttempts');
    const savedBlockEndTime = localStorage.getItem('loginBlockEndTime');
    const savedTotalBlocks = localStorage.getItem('loginTotalBlocks');

    if (savedFailedAttempts) {
      setFailedAttempts(parseInt(savedFailedAttempts));
    }

    if (savedTotalBlocks) {
      setTotalBlocks(parseInt(savedTotalBlocks));
    }

    if (savedBlockEndTime) {
      const blockEndTime = parseInt(savedBlockEndTime);
      const currentTime = Date.now();
      
      if (currentTime < blockEndTime) {
        setIsBlocked(true);
        setBlockTimeRemaining(Math.ceil((blockEndTime - currentTime) / 1000));
      } else {
        // Limpa dados expirados
        localStorage.removeItem('loginBlockEndTime');
      }
    }
  }, []);

  // Timer para contagem regressiva do bloqueio
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isBlocked && blockTimeRemaining > 0) {
      interval = setInterval(() => {
        setBlockTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsBlocked(false);
            // Reset das tentativas quando o bloqueio expira
            setFailedAttempts(0);
            localStorage.removeItem('loginBlockEndTime');
            localStorage.setItem('loginFailedAttempts', '0');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isBlocked, blockTimeRemaining]);

  // Função para formatar tempo restante
  const formatTimeRemaining = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verifica se está bloqueado
    if (isBlocked) {
      setError(`Muitas tentativas falhadas. Aguarde ${formatTimeRemaining(blockTimeRemaining)} para tentar novamente.`);
      return;
    }

    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verificação pré-autenticação: status e data de vencimento do administrador
      try {
        const { data: admin, error: adminError } = await supabase
          .from('administradores')
          .select('status_pagamento, data_vencimento, data_vendimento')
          .eq('email', email)
          .maybeSingle();

        if (!adminError && admin) {
          const rawExpiration: any = admin.data_vencimento ?? admin.data_vendimento;
          const exp = rawExpiration ? new Date(String(rawExpiration)) : null;
          const today = new Date();
          const normalize = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const expired = exp ? normalize(exp) <= normalize(today) : false;

          if (admin.status_pagamento === 'vencido' || expired) {
            setError('Acesso bloqueado por falta de pagamento');
            setLoading(false);
            return;
          }
        }
      } catch {}

      const result = await signIn(email, password);
      
      if (result.error) {
        // Se houve erro no signIn, incrementa tentativas falhadas
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        localStorage.setItem('loginFailedAttempts', newFailedAttempts.toString());

        if (newFailedAttempts >= 5 && (newFailedAttempts % 5) === 0) {
          // Só bloqueia quando completar exatamente 5, 10, 15, 20... tentativas
          const newTotalBlocks = totalBlocks + 1;
          const newBlockDuration = 30 * Math.pow(2, newTotalBlocks - 1); // 30, 60, 120, 240...
          
          setTotalBlocks(newTotalBlocks);
          setIsBlocked(true);
          setBlockTimeRemaining(newBlockDuration);
          
          const blockEndTime = Date.now() + (newBlockDuration * 1000);
          localStorage.setItem('loginBlockEndTime', blockEndTime.toString());
          localStorage.setItem('loginBlockDuration', newBlockDuration.toString());
          localStorage.setItem('loginTotalBlocks', newTotalBlocks.toString());
          
          setError(`Muitas tentativas falhadas. Aguarde ${formatTimeRemaining(newBlockDuration)} para tentar novamente.`);
        } else {
          const remainingAttempts = 5 - (newFailedAttempts % 5);
          // Só mostrar mensagem de erro a partir da 3ª tentativa
          if (newFailedAttempts >= 3) {
            // Usar a mensagem de erro do AuthContext, mas adicionar informação sobre tentativas restantes
            if (result.error.includes('Email ou senha incorretos')) {
              setError(`Email ou senha incorretos. ${remainingAttempts} tentativa(s) restante(s) antes do bloqueio.`);
            } else {
              // Para outros tipos de erro (pagamento, etc), mostrar a mensagem original
              setError(result.error);
            }
          }
        }
        return;
      }
      
      // Reset dos dados de segurança em caso de sucesso
      setFailedAttempts(0);
      setTotalBlocks(0);
      localStorage.removeItem('loginFailedAttempts');
      localStorage.removeItem('loginBlockEndTime');
      localStorage.removeItem('loginBlockDuration');
      localStorage.removeItem('loginTotalBlocks');
      
    } catch (error: any) {
      // Fallback para erros inesperados
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);
      localStorage.setItem('loginFailedAttempts', newFailedAttempts.toString());

      if (newFailedAttempts >= 5 && (newFailedAttempts % 5) === 0) {
        // Só bloqueia quando completar exatamente 5, 10, 15, 20... tentativas
        const newTotalBlocks = totalBlocks + 1;
       const newBlockDuration = 30 * Math.pow(2, newTotalBlocks - 1); // 30, 60, 120, 240...
       
       setTotalBlocks(newTotalBlocks);
       setIsBlocked(true);
       setBlockTimeRemaining(newBlockDuration);
       
       const blockEndTime = Date.now() + (newBlockDuration * 1000);
       localStorage.setItem('loginBlockEndTime', blockEndTime.toString());
       localStorage.setItem('loginBlockDuration', newBlockDuration.toString());
       localStorage.setItem('loginTotalBlocks', newTotalBlocks.toString());
        
        setError(`Muitas tentativas falhadas. Aguarde ${formatTimeRemaining(newBlockDuration)} para tentar novamente.`);
      } else {
        const remainingAttempts = 5 - (newFailedAttempts % 5);
        // Só mostrar mensagem de erro a partir da 3ª tentativa
        if (newFailedAttempts >= 3) {
          setError(`Email ou senha incorretos. ${remainingAttempts} tentativa(s) restante(s) antes do bloqueio.`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Entrega Fácil</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Painel Administrativo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBlocked}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  isBlocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                placeholder="Email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isBlocked}
                  className={`w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                    isBlocked ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isBlocked}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 ${
                    isBlocked ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Indicador de bloqueio */}
            {isBlocked && (
              <div className="flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <Clock className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  Bloqueado por {formatTimeRemaining(blockTimeRemaining)}
                </span>
              </div>
            )}

            {/* Indicador de tentativas restantes */}
            {!isBlocked && failedAttempts >= 3 && failedAttempts < 5 && (
              <div className="flex items-center justify-center p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  {5 - (failedAttempts % 5)} tentativa(s) restante(s) antes do bloqueio
                </span>
              </div>
            )}

            {error && (
              <div className={`text-sm text-center p-3 rounded-lg ${
                error.includes('Acesso bloqueado por falta de pagamento') 
                  ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700' 
                  : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
              }`}>
                {error.includes('Acesso bloqueado por falta de pagamento') ? (
                  <div>
                    <div className="font-semibold mb-1">🚫 Acesso Bloqueado</div>
                    <div>{error}</div>
                  </div>
                ) : (
                  error
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isBlocked}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                isBlocked 
                  ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white'
              }`}
            >
              {isBlocked 
                ? `Bloqueado (${formatTimeRemaining(blockTimeRemaining)})` 
                : loading 
                  ? 'Entrando...' 
                  : 'Entrar'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
