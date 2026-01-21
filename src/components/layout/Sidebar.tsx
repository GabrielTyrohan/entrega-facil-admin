// ============================================
// ARQUIVO: src/components/layout/Sidebar.tsx
// Menu lateral com controle de permissões dinâmico
// ============================================

import { Permissoes, useAuth } from '@/contexts/AuthContext';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  UserCircle,
  UserCog,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: keyof Permissoes;
  adminOnly?: boolean;
  group?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const { permissions, isAdmin, userType } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // ===== ITENS DO MENU =====
  // Memorizado para evitar recriação a cada render e loops infinitos no useEffect
  const menuItems: MenuItem[] = useMemo(() => [
    // PRINCIPAL
    {
      path: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      group: 'Principal'
    },
    
    // PESSOAS
    {
      path: '/vendedores',
      label: 'Vendedores',
      icon: <Users className="w-5 h-5" />,
      group: 'Pessoas'
    },
    {
      path: '/clientes',
      label: 'Clientes',
      icon: <UserCircle className="w-5 h-5" />,
      group: 'Pessoas'
    },
    
    // CATÁLOGO
    {
      path: '/produtos',
      label: 'Produtos',
      icon: <Package className="w-5 h-5" />,
      group: 'Catálogo'
    },
    {
      path: '/produtos/cestas',
      label: 'Cestas',
      icon: <ShoppingBasket className="w-5 h-5" />,
      group: 'Catálogo'
    },
    
    // OPERACIONAL
    {
      path: '/entregas',
      label: 'Entregas',
      icon: <Truck className="w-5 h-5" />,
      group: 'Operacional'
    },
    
    // FINANCEIRO
    {
      path: '/pagamentos',
      label: 'Pagamentos',
      icon: <CreditCard className="w-5 h-5" />,
      group: 'Financeiro'
    },
    {
      path: '/devedores',
      label: 'Devedores',
      icon: <AlertCircle className="w-5 h-5" />,
      group: 'Financeiro'
    },
    {
      path: '/caixa',
      label: 'Fluxo de Caixa',
      icon: <DollarSign className="w-5 h-5" />,
      permission: 'caixa',
      group: 'Financeiro'
    },
    {
      path: '/acertos-diarios',
      label: 'Acertos Diários',
      icon: <ClipboardList className="w-5 h-5" />,
      permission: 'acertos',
      group: 'Financeiro'
    },
    
    // COMERCIAL
    {
      path: '/vendas-atacado',
      label: 'Vendas Atacado',
      icon: <ShoppingCart className="w-5 h-5" />,
      permission: 'vendas_atacado',
      group: 'Comercial'
    },
    {
      path: '/orcamentos-pj',
      label: 'Orçamento PJ',
      icon: <FileText className="w-5 h-5" />,
      permission: 'orcamentos_pj',
      group: 'Comercial'
    },
    {
      path: '/tabela-precos',
      label: 'Tabela de Preços',
      icon: <Receipt className="w-5 h-5" />,
      permission: 'vendas_atacado',
      group: 'Comercial'
    },
    
    // RELATÓRIOS
    {
      path: '/relatorios',
      label: 'Relatórios',
      icon: <BarChart3 className="w-5 h-5" />,
      permission: 'relatorios',
      group: 'Relatórios'
    },
    
    // SISTEMA
    {
      path: '/suporte',
      label: 'Suporte',
      icon: <MessageSquare className="w-5 h-5" />,
      group: 'Sistema'
    },
    {
      path: '/funcionarios',
      label: 'Funcionários',
      icon: <UserCog className="w-5 h-5" />,
      permission: 'funcionarios',
      adminOnly: true,
      group: 'Sistema'
    },
    {
      path: '/configuracoes',
      label: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      permission: 'configuracoes',
      adminOnly: true,
      group: 'Sistema'
    },
  ], []);

  // ===== FILTRAR ITENS BASEADO NAS PERMISSÕES =====
  const visibleItems = useMemo(() => menuItems.filter((item) => {
    // Se tem adminOnly e não é admin, esconder
    if (item.adminOnly && !isAdmin) return false;

    // Se tem permissão específica, verificar
    if (item.permission && !permissions[item.permission]) return false;

    return true;
  }), [menuItems, isAdmin, permissions]);

  // Agrupar itens por categoria
  const groupedItems = useMemo(() => visibleItems.reduce((acc, item) => {
    const group = item.group || 'Outros';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>), [visibleItems]);

  const groupOrder = [
    'Principal',
    'Pessoas',
    'Catálogo',
    'Operacional',
    'Financeiro',
    'Comercial',
    'Relatórios',
    'Sistema'
  ];

  // Expandir automaticamente o grupo do item ativo
  useEffect(() => {
    const activeItem = visibleItems.find(item => item.path === location.pathname);
    if (activeItem && activeItem.group && activeItem.group !== 'Principal') {
      setOpenGroups(prev => {
        // Evitar atualização de estado se já estiver correto para prevenir loops
        if (prev[activeItem.group!]) return prev;
        return {
          ...prev,
          [activeItem.group!]: true
        };
      });
    }
  }, [location.pathname, visibleItems]);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        flex flex-col flex-shrink-0
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-0
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header fixo do sidebar */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 relative">
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X size={20} />
          </button>
      
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Gestão Entrega Facil
          </h2>
          
          {/* Badge de tipo de usuário */}
          <div className="mt-3 flex items-center gap-2">
            {userType === 'admin' ? (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30
                           text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                Administrador
              </span>
            ) : (
              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30
                           text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                Funcionário
              </span>
            )}
          </div>
        </div>
      
        {/* Menu com scroll independente */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {groupOrder.map((group) => {
            const items = groupedItems[group];
            if (!items?.length) return null;

            const isPrincipal = group === 'Principal';
            const isGroupOpen = openGroups[group];

            return (
              <div key={group} className="space-y-1">
                {/* Cabeçalho do Grupo (Dropdown) */}
                {!isPrincipal && (
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
                  >
                    <span>{group}</span>
                    {isGroupOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
                
                {/* Lista de Itens */}
                <div className={`space-y-1 ${!isPrincipal && !isGroupOpen ? 'hidden' : ''}`}>
                  {items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          if (window.innerWidth < 1024 && onClose) onClose();
                        }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                                  transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        } ${!isPrincipal ? 'ml-2' : ''}`} // Indentação para itens dentro de grupos
                      >
                        {item.icon}
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      
        {/* Footer fixo do sidebar */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Versão 2.2.0
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
