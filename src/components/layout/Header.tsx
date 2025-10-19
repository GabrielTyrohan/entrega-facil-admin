import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Função para obter saudação baseada no horário
  const getGreeting = () => {
    const currentHour = new Date().getHours();
    
    if (currentHour >= 5 && currentHour < 12) {
      return 'Bom Dia!';
    } else if (currentHour >= 12 && currentHour < 18) {
      return 'Boa Tarde!';
    } else {
      return 'Boa Noite!';
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 lg:px-8 flex-shrink-0">
      <div className="flex items-center justify-between h-16">
        {/* Left section */}
        <div className="flex items-center min-w-0 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Nome da empresa */}
          <div className="hidden lg:block ml-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{getGreeting()}</h4>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {user?.nome_empresa || 'Entrega Fácil'}
            </h1>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* User menu */}
          <div className="relative group">
            <button className="flex items-center space-x-2 p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <p className="text-sm font-medium truncate max-w-24 lg:max-w-none">
                  {user?.nome && user?.sobrenome 
                    ? `${user.nome} ${user.sobrenome}` 
                    : user?.name || 'Administrador'
                  }
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
            </button>

            {/* Dropdown menu */}
            <div className="absolute right-0 w-48 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="py-1">
                <div className="sm:hidden px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.nome ? `${user.nome} ${user.sobrenome || ''}`.trim() : 'Administrador'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Administrador</p>
                </div>
                <button 
                  onClick={async () => {
                    await signOut();
                    navigate('/login');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
