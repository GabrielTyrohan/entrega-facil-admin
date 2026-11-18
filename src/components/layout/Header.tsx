import { ChevronRight, Menu, Moon, Search, Sun } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { secaoDaRota } from './menu';
import { abrirBusca } from './Sidebar';

interface HeaderProps {
  onMenuClick: () => void;
  onLogout?: () => void | Promise<void>;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogout }) => {
  const { userProfile, userType, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { secao, item } = secaoDaRota(location.pathname);
  const tela = item?.label ?? (location.pathname.startsWith('/funcionario-config') ? 'Meu Perfil' : '');
  const subtela = item && location.pathname !== item.path;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center justify-between h-14">
        {/* Esquerda: trilha "Seção / Tela" */}
        <div className="flex items-center min-w-0 flex-1 gap-2">
          <button
            onClick={onMenuClick}
            aria-label="Abrir menu"
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="hidden truncate text-gray-400 sm:inline">{userProfile?.nome_empresa || 'Empresa não configurada'}</span>
            {secao && secao !== 'Início' && (
              <>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600 sm:block" />
                <span className="hidden truncate text-gray-400 md:inline">{secao}</span>
              </>
            )}
            {tela && (
              <>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600 sm:block" />
                <span className={`truncate ${subtela ? 'text-gray-400' : 'font-medium text-gray-900 dark:text-white'}`}>{tela}</span>
              </>
            )}
          </nav>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 sm:gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs md:inline-flex ${
              isOnline ? 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            {isOnline ? 'Conectado' : 'Sem internet'}
          </span>
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar telas e ações (Ctrl+K)"
            title="Buscar (Ctrl+K)"
            className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Abrir menu do usuário"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex items-center space-x-2 p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium">
                {userProfile?.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <p className="text-sm font-medium truncate max-w-24 lg:max-w-none">
                  {userProfile?.nome || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{userProfile?.email}</p>
              </div>
            </button>

            {/* Dropdown menu */}
            {isMenuOpen && (
              <div className="absolute right-0 w-48 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <div className="sm:hidden px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                      {userProfile?.nome || 'Usuário'}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {userProfile?.email}
                    </span>
                  </div>
                  <div className="hidden sm:block px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {userType === 'admin' ? 'Administrador' : 'Funcionário'}
                    </p>
                  </div>
                  <button 
                    onClick={async () => {
                      setIsMenuOpen(false);
                      if (onLogout) {
                        await onLogout();
                      } else {
                        await signOut();
                        navigate('/login');
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
