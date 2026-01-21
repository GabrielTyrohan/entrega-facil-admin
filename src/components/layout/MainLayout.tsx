import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => { 
  const [sidebarOpen, setSidebarOpen] = useState(false); 

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

  return ( 
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900"> 
      {/* Sidebar */} 
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      /> 

      {/* Conteúdo Principal */} 
      <div className="flex flex-col flex-1 min-w-0"> 
        {/* Header */} 
        <Header onMenuClick={() => setSidebarOpen(true)} /> 

        {/* Área de conteúdo com scroll */} 
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900"> 
          <div className="px-4 sm:px-6 lg:px-8 py-6"> 
            {children || <Outlet />} 
          </div> 
        </main> 
      </div> 
    </div> 
  ); 
}; 

export default MainLayout;