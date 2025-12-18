import React from 'react';
import { Truck } from 'lucide-react';

interface LoadingScreenProps {
  onCancel?: () => void;
  cancelText?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onCancel, cancelText = 'Cancelar' }) => {
  // Estado para mostrar o botão de cancelar apenas após alguns segundos
  const [showCancel, setShowCancel] = React.useState(false);

  React.useEffect(() => {
    if (onCancel) {
      const timer = setTimeout(() => setShowCancel(true), 3000); // Mostra botão após 3s
      return () => clearTimeout(timer);
    }
  }, [onCancel]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="relative flex flex-col items-center">
        {/* Círculo pulsante de fundo */}
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-ping opacity-75 h-32 w-32 -z-10 self-center top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* Container do ícone com borda giratória */}
        <div className="relative flex items-center justify-center w-24 h-24 mb-6">
          <div className="absolute w-full h-full border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
          <div className="absolute w-full h-full border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <Truck className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-bounce" />
        </div>

        {/* Texto animado */}
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 animate-pulse">
          Entrega Fácil
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mb-6">
          Carregando sistema
          <span className="flex ml-1">
            <span className="animate-bounce delay-75">.</span>
            <span className="animate-bounce delay-150">.</span>
            <span className="animate-bounce delay-300">.</span>
          </span>
        </p>

        {/* Botão de cancelar/sair (aparece se demorar) */}
        {showCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors cursor-pointer z-50 mt-4"
          >
            {cancelText}
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
