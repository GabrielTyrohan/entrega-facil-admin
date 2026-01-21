// ============================================ 
// ARQUIVO: src/pages/LoginPage.tsx 
// PARTE 1: Imports, Estados e Lógica 
// ============================================ 

import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LoginPage = () => { 
  // Estados 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState(''); 
  const [isBlocked, setIsBlocked] = useState(false); 
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0); 

  const { signIn, user } = useAuth(); 
  const navigate = useNavigate(); 
  const location = useLocation(); 

  // ===== VERIFICAR BLOQUEIO AO CARREGAR ===== 
  useEffect(() => { 
    const blockEndTime = localStorage.getItem('loginBlockEndTime'); 
    if (blockEndTime) { 
      const remaining = parseInt(blockEndTime) - Date.now(); 
      if (remaining > 0) { 
        setIsBlocked(true); 
        setBlockTimeRemaining(Math.ceil(remaining / 1000)); 
      } else { 
        localStorage.removeItem('loginBlockEndTime'); 
        localStorage.removeItem('loginFailedAttempts'); 
      } 
    } 
  }, []); 

  // ===== COUNTDOWN DO BLOQUEIO ===== 
  useEffect(() => { 
    if (!isBlocked || blockTimeRemaining <= 0) return; 

    const timer = setInterval(() => { 
      setBlockTimeRemaining((prev) => { 
        if (prev <= 1) { 
          setIsBlocked(false); 
          localStorage.removeItem('loginBlockEndTime'); 
          localStorage.removeItem('loginFailedAttempts'); 
          return 0; 
        } 
        return prev - 1; 
      }); 
    }, 1000); 

    return () => clearInterval(timer); 
  }, [isBlocked, blockTimeRemaining]); 

  // ===== REDIRECIONAR SE JÁ LOGADO ===== 
  useEffect(() => { 
    if (user) { 
      const from = (location.state as any)?.from?.pathname || '/'; 
      navigate(from, { replace: true }); 
    } 
  }, [user, navigate, location]); 

  // ===== SUBMIT ===== 
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setError(''); 

    if (isBlocked) { 
      setError(`Aguarde ${blockTimeRemaining}s antes de tentar novamente`); 
      return; 
    } 

    setIsLoading(true); 

    try { 
      await signIn(email, password); 
      localStorage.removeItem('loginFailedAttempts'); 
      localStorage.removeItem('loginBlockEndTime'); 
    } catch (err: any) { 
      const currentAttempts = parseInt( 
        localStorage.getItem('loginFailedAttempts') || '0' 
      ); 
      const newAttempts = currentAttempts + 1; 
      localStorage.setItem('loginFailedAttempts', newAttempts.toString()); 

      if (newAttempts >= 5) { 
        const blockDuration = Math.min(30 * Math.pow(2, newAttempts - 5), 300); 
        const blockEndTime = Date.now() + blockDuration * 1000; 
        localStorage.setItem('loginBlockEndTime', blockEndTime.toString()); 
        setIsBlocked(true); 
        setBlockTimeRemaining(blockDuration); 
        setError(`Muitas tentativas falhas. Bloqueado por ${blockDuration}s`); 
      } else { 
        setError(err.message || 'Erro ao fazer login'); 
      } 
    } finally { 
      setIsLoading(false); 
    } 
  }; 

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      
      {/* Card de Login */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Bem-vindo
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Entre com suas credenciais para acessar o sistema
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isBlocked}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isBlocked}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 transition-colors pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={isLoading || isBlocked}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Entrando...
              </>
            ) : isBlocked ? (
              `Bloqueado (${blockTimeRemaining}s)`
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Entrar
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
          Detecção automática de tipo de acesso
          <br />
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            (Admin ou Funcionário)
          </span>
        </p>
      </div>
    </div>
  ); 
 }; 
 
 export default LoginPage;