import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Preferência de sidebar recolhida (somente desktop) persistida em localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Fechar sidebar ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebarCollapsed', String(next));
      } catch {
        // localStorage indisponível: mantém apenas em memória
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      {/* Conteúdo Principal */} 
      <div className="flex flex-col flex-1 min-w-0"> 
        {/* Header */} 
        <Header onMenuClick={() => setSidebarOpen(true)} /> 

        {/* Área de conteúdo com scroll — fonte única do espaçamento externo das páginas */}
        <main className="main-scroll flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="w-full px-4 sm:px-5 lg:px-6 py-6">
            {children || <Outlet />}
          </div>
        </main>
      </div> 
    </div> 
  ); 
}; 

export default MainLayout;