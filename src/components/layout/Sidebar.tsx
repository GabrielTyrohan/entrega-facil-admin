import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  Truck, 
  CreditCard, 
  Package, 
  FileText, 
  MessageSquare, 
  Settings, 
  X,
  Home,
  ChevronDown,
  ChevronRight,
  ShoppingBasket,
  AlertCircle
} from 'lucide-react';
import iconSvg from '@/assets/icon.svg';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  group: string;
  badge?: string;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, group: 'Principal' },
  { name: 'Vendedores', href: '/vendedores', icon: Users, group: 'Pessoas' },
  { name: 'Clientes', href: '/clientes', icon: UserCheck, group: 'Pessoas' },
  { name: 'Entregas', href: '/entregas', icon: Truck, group: 'Operacional' },
  { name: 'Pagamentos', href: '/pagamentos', icon: CreditCard, group: 'Financeiro' },
  { name: 'Devedores', href: '/devedores', icon: AlertCircle, group: 'Financeiro' },
  { name: 'Produtos', href: '/produtos', icon: Package, group: 'Catálogo' },
  { name: 'Cestas', href: '/produtos/cestas', icon: ShoppingBasket, group: 'Catálogo' },
  { name: 'Relatórios', href: '/relatorios', icon: FileText, group: 'Relatórios' },
  { name: 'Suporte', href: '/suporte', icon: MessageSquare, group: 'Sistema' },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, group: 'Sistema' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Principal': true,
    'Pessoas': false,
    'Operacional': false,
    'Financeiro': false,
    'Catálogo': false,
    'Relatórios': false,
    'Sistema': false
  });

  const groupedNavigation = navigation.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Close sidebar on navigation for mobile
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 sm:w-80 lg:w-64 bg-white dark:bg-gray-800 
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        border-r border-gray-200 dark:border-gray-700 flex flex-col
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 lg:px-4 lg:py-3 h-16 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <img src={iconSvg} alt="Entrega Fácil" className="w-full h-full object-contain" />
            </div>
            <div className="ml-3 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Entrega Fácil</h1>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto overscroll-contain">
          {Object.entries(groupedNavigation).map(([group, items]) => (
            <div key={group} className="space-y-1">
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-3 py-3 lg:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
              >
                <span className="text-xs font-semibold uppercase tracking-wider">{group}</span>
                {expandedGroups[group] ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
              
              {expandedGroups[group] && (
                <div className="ml-3 space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      end
                      onClick={handleNavClick}
                      className={({ isActive }) => `
                        group flex items-center px-3 py-3 lg:py-2 text-sm font-medium rounded-md transition-colors touch-manipulation
                        ${isActive 
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700'
                        }
                      `}
                    >
                      <item.icon className="flex-shrink-0 w-4 h-4 mr-3" />
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer spacer for mobile safe area */}
        <div className="h-4 lg:h-0 flex-shrink-0"></div>
      </div>
    </>
  );
};

export default Sidebar;
