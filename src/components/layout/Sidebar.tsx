// ============================================
// ARQUIVO: src/components/layout/Sidebar.tsx
// Menu lateral com controle de permissões dinâmico
// ============================================

import { Permissoes, useAuth, UserType } from '@/contexts/AuthContext';
import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileKey,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  PackagePlus,
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
import packageJson from '../../../package.json';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: keyof Permissoes;
  adminOnly?: boolean;
  funcionarioOnly?: boolean;
  group?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function useVisibleMenu(userType: UserType, permissions: Permissoes, isAdmin: boolean, menuItems: MenuItem[]) {
  return useMemo(() => {
    // ADMIN
    if (isAdmin) return menuItems;

    // EXPEDIÇÃO
    if (userType !== 'admin' && permissions?.expedicao) {
      const expedicaoPaths = [
        '/dashboard',
        '/vendedores', '/clientes',
        '/produtos', '/produtos/cestas-base', '/produtos/cestas', '/entregas/avulsas',
        '/configuracoes', '/suporte'
      ];
      return menuItems.filter(item => expedicaoPaths.includes(item.path));
    }

    // FUNCIONÁRIO NORMAL
    return menuItems.filter(item => {
      if (item.adminOnly) return false;
      if (item.funcionarioOnly && userType !== 'funcionario') return false;

      switch (item.group) {
        case 'Estoque':
          return !!permissions?.caixa;
          
        case 'Financeiro': {
          const hasFinanceiroAcc = permissions?.caixa || permissions?.acertos || permissions?.relatorios;
          if (!hasFinanceiroAcc) return false;
          if (item.permission && !permissions[item.permission]) return false;
          return true;
        }

        case 'Comercial': {
          const hasComercialAcc = permissions?.vendas_atacado || permissions?.orcamentos_pj || permissions?.configuracoes_fiscais;
          if (!hasComercialAcc) return false;
          if (item.permission && !permissions[item.permission]) return false;
          return true;
        }

        case 'Relatórios':
          return !!permissions?.relatorios;

        default:
          if (item.path === '/funcionarios') return !!permissions?.funcionarios;
          if (item.permission && !permissions[item.permission]) return false;
          return true;
      }
    });
  }, [userType, permissions, isAdmin, menuItems]);
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const { permissions, isAdmin, userType, signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // ===== ITENS DO MENU =====
  // Memorizado para evitar recriação a cada render e loops infinitos no useEffect
  const menuItems: MenuItem[] = useMemo(() => [
    // PRINCIPAL
    {
      path: '/dashboard',
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
      path: '/funcionarios',
      label: 'Funcionários',
      icon: <UserCog className="w-5 h-5" />,
      permission: 'funcionarios',
      adminOnly: true,
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
      label: 'Entregar Cesta',
      icon: <ShoppingBasket className="w-5 h-5" />,
      group: 'Catálogo'
    },
    {
      path: '/produtos/cestas-base',
      label: 'Cadastrar Cestas',
      icon: <PackagePlus className="w-5 h-5" />,
      group: 'Catálogo'
    },
    {
      path: '/entregas/avulsas',
      label: 'Entregas Avulsas',
      icon: <Truck className="w-5 h-5" />,
      group: 'Catálogo'
    },
    
    // ESTOQUE
    {
      path: '/estoque/movimentacoes',
      label: 'Movimentações',
      icon: <ArrowUpDown className="w-5 h-5" />,
      permission: 'caixa',
      group: 'Estoque'
    },
    {
      path: '/estoque/relatorio',
      label: 'Relatório',
      icon: <ClipboardList className="w-5 h-5" />,
      permission: 'caixa',
      group: 'Estoque'
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
    {
      path: '/configuracoes-fiscais',
      label: 'Configuração Fiscal',
      icon: <FileKey className="w-5 h-5" />,
      permission: 'configuracoes_fiscais',
      adminOnly: true,
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
      path: '/configuracoes',
      label: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      permission: 'configuracoes',
      adminOnly: true,
      group: 'Sistema'
    },
  ], []);

  // ===== FILTRAR ITENS BASEADO NAS PERMISSÕES =====
  const visibleItems = useVisibleMenu(userType, permissions, isAdmin, menuItems);

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
    'Sistema',
    'Outros'
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
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center">
              {userType === 'admin' ? (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                  Administrador
                </span>
              ) : (
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                  Funcionário
                </span>
              )}
            </div>
          </div>
        </div>
      
        {/* Menu com scroll independente */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {groupOrder.map((group) => {
            const items = groupedItems[group];
            if (!items?.length) return null;

            const isPrincipal = group === 'Principal' || group === 'Outros';
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
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {/* Menu Fixo de Rodapé */}
          <Link
            to="/funcionario-config"
            onClick={() => { if (window.innerWidth < 1024 && onClose) onClose(); }}
            className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ${location.pathname === '/funcionario-config' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : ''}`}
          >
            <UserCog className="w-5 h-5" />
            <span>Meu Perfil</span>
          </Link>
          <button
            onClick={() => {
              signOut();
              if (window.innerWidth < 1024 && onClose) onClose();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            Versão {packageJson.version}
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
