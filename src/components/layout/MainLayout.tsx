import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when clicking outside on mobile
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
    <div className="min-h-screen bg-background transition-colors overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
        />
        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 max-w-full overflow-x-auto">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
