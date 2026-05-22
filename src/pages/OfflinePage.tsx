import { useQueryClient } from '@tanstack/react-query';
import { LogOut, RefreshCw, WifiOff } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const OfflinePage: React.FC = () => {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleReload = async () => {
    setChecking(true);
    await new Promise(res => setTimeout(res, 1000));
    if (navigator.onLine) {
      navigate('/dashboard', { replace: true });
    } else {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 sm:p-12 max-w-md w-full text-center">

        <div className="flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-red-500 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Sem conexão
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8">
          Não foi possível se conectar à internet.<br />
          Verifique sua rede e tente novamente.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReload}
            disabled={checking}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verificando...' : 'Recarregar'}
          </button>

          <button
            onClick={handleSignOut}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {!checking && !navigator.onLine && (
          <p className="mt-4 text-xs text-red-500 dark:text-red-400">
            Ainda sem conexão. Verifique sua rede.
          </p>
        )}
      </div>
    </div>
  );
};

export default OfflinePage;
