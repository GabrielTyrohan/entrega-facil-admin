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
  Lock,
  LogOut,
  MessageSquare,
  Package,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
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
import { toast } from '@/utils/toast';
import packageJson from '../../../package.json';

export const MAINTENANCE_ROUTES: string[] = [];
const MAINTENANCE_MSG = 'Esta área está temporariamente indisponível por estar em manutenção. Em breve retornaremos com uma nova solução de emissão fiscal.';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: keyof Permissoes;
  adminOnly?: boolean;
  funcionarioOnly?: boolean;
  group?: string;
  disabled?: boolean;
  maintenanceMessage?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

// ===== AGRUPAMENTO VISUAL (apresentação) =====
// Não altera rotas nem permissões: o filtro de permissões continua usando `item.group`.
const PATH_TO_SECTION: Record<string, string> = {
  '/dashboard': 'Principal',
  '/vendedores': 'Cadastros',
  '/funcionarios': 'Cadastros',
  '/clientes': 'Cadastros',
  '/produtos': 'Produtos e Estoque',
  '/produtos/cestas-base': 'Produtos e Estoque',
  '/estoque/movimentacoes': 'Produtos e Estoque',
  '/estoque/relatorio': 'Produtos e Estoque',
  '/entregas': 'Operação',
  '/produtos/cestas': 'Operação',
  '/entregas/avulsas': 'Operação',
  '/historico-pdfs': 'Operação',
  '/pagamentos': 'Financeiro',
  '/devedores': 'Financeiro',
  '/caixa': 'Financeiro',
  '/acertos-diarios': 'Financeiro',
  '/vendas-atacado': 'Comercial',
  '/orcamentos-pj': 'Comercial',
  '/tabela-precos': 'Comercial',
  '/configuracoes-fiscais': 'Comercial',
  '/relatorios': 'Relatórios',
  '/suporte': 'Sistema',
  '/configuracoes': 'Sistema',
};

const SECTION_ORDER = [
  'Principal',
  'Cadastros',
  'Produtos e Estoque',
  'Operação',
  'Financeiro',
  'Comercial',
  'Relatórios',
  'Sistema',
  'Outros'
];

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

const Sidebar = ({ isOpen, onClose, collapsed = false, onToggleCollapsed }: SidebarProps) => {
  const location = useLocation();
  const { permissions, isAdmin, userType, signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<{ label: string; top: number; left: number } | null>(null);

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
    {
      path: '/historico-pdfs',
      label: 'Histórico de Notas',
      icon: <FileText className="w-5 h-5" />,
      adminOnly: true,
      group: 'Operacional',
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
      group: 'Comercial',
    },
    {
      path: '/orcamentos-pj',
      label: 'Orçamento PJ',
      icon: <FileText className="w-5 h-5" />,
      permission: 'orcamentos_pj',
      group: 'Comercial',
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

  // Agrupar itens por seção visual (sem alterar a lógica de permissões)
  const sectionedItems = useMemo(() => visibleItems.reduce((acc, item) => {
    const section = PATH_TO_SECTION[item.path] || 'Outros';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>), [visibleItems]);

  // Expandir automaticamente a seção do item ativo
  useEffect(() => {
    const activeItem = visibleItems.find(item => item.path === location.pathname);
    if (!activeItem) return;
    const section = PATH_TO_SECTION[activeItem.path] || 'Outros';
    if (section === 'Principal') return;
    setOpenGroups(prev => {
      // Evitar atualização de estado se já estiver correto para prevenir loops
      if (prev[section]) return prev;
      return {
        ...prev,
        [section]: true
      };
    });
  }, [location.pathname, visibleItems]);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const showTip = (label: string) => (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
  };

  const hideTip = () => setHovered(null);

  const itemBaseClass = (isActive: boolean) => `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm
    transition-all duration-200 ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`;

  const renderMenuItem = (item: MenuItem) => {
    const isActive = location.pathname === item.path;

    if (item.disabled) {
      return (
        <button
          key={item.path}
          type="button"
          aria-disabled="true"
          aria-label={`${item.label} (em manutenção)`}
          onClick={() => toast.info(item.maintenanceMessage || MAINTENANCE_MSG, { duration: 5000 })}
          onMouseEnter={showTip(item.label)}
          onMouseLeave={hideTip}
          onFocus={showTip(item.label)}
          onBlur={hideTip}
          className={`${itemBaseClass(false)} w-full text-left cursor-not-allowed opacity-50`}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className={`flex-1 truncate whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
          <Lock className={`w-4 h-4 shrink-0 ${collapsed ? 'lg:hidden' : ''}`} />
        </button>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        aria-label={item.label}
        onClick={() => {
          hideTip();
          if (window.innerWidth < 1024 && onClose) onClose();
        }}
        onMouseEnter={showTip(item.label)}
        onMouseLeave={hideTip}
        onFocus={showTip(item.label)}
        onBlur={hideTip}
        className={itemBaseClass(isActive)}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-400 ${collapsed ? 'lg:hidden' : ''}`}
          />
        )}
        <span className="shrink-0">{item.icon}</span>
        <span className={`truncate whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
      </Link>
    );
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

      <aside
        aria-label="Menu de navegação principal"
        className={`
        h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        flex flex-col flex-shrink-0 overflow-hidden
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-0
        w-64 ${collapsed ? 'lg:w-20' : 'lg:w-64'}
        transition-[width,transform] duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header fixo do sidebar */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 relative">
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="absolute top-4 right-4 p-1 lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X size={20} />
          </button>

          {/* Cabeçalho expandido (mobile sempre + desktop expandida) */}
          <div className={`p-6 ${collapsed ? 'lg:hidden' : ''}`}>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Gestão Entrega Fácil
            </h2>

            {/* Badge de tipo de usuário */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                {userType === 'admin' ? (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                    Administrador
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                    Funcionário
                  </span>
                )}
                {onToggleCollapsed && (
                  <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label="Recolher menu lateral"
                    aria-expanded="true"
                    title="Recolher menu lateral"
                    className="hidden lg:flex p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                  >
                    <PanelLeftClose className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cabeçalho colapsado (somente desktop) */}
          <div className={`hidden ${collapsed ? 'lg:flex' : ''} flex-col items-center gap-2 px-2 py-4`}>
            <div
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white"
            >
              E
            </div>
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Expandir menu lateral"
                aria-expanded="false"
                title="Expandir menu lateral"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Menu com scroll independente */}
        <nav
          aria-label="Navegação principal"
          onScroll={hideTip}
          className={`sidebar-scroll flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2 lg:px-2' : 'px-3'} ${collapsed ? 'space-y-2 lg:space-y-2' : 'space-y-4'}`}
        >
          {SECTION_ORDER.map((section, sectionIndex) => {
            const items = sectionedItems[section];
            if (!items?.length) return null;

            const isPrincipal = section === 'Principal' || section === 'Outros';
            // No modo colapsado (desktop) todos os itens ficam visíveis em sequência
            const isGroupOpen = isPrincipal ? true : !!openGroups[section];
            const isSectionOpen = collapsed ? true : isGroupOpen;

            return (
               <div key={section} className="space-y-1">
                {/* Cabeçalho da Seção (Dropdown) — oculto no modo colapsado (desktop) */}
                {!isPrincipal && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(section)}
                    aria-expanded={isGroupOpen}
                    className={`flex items-center justify-between w-full px-3 py-2 min-h-[32px] text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-300 transition-colors ${collapsed ? 'lg:hidden' : ''}`}
                  >
                    <span className="truncate">{section}</span>
                    {isGroupOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                )}

                {/* Lista de Itens */}
                <div className={`space-y-1 ${!isPrincipal && !isSectionOpen ? 'hidden' : ''}`}>
                  {items.map((item) => renderMenuItem(item))}
                </div>

                {/* Divisor sutil entre seções no modo colapsado (desktop) */}
                {collapsed && sectionIndex < SECTION_ORDER.length - 1 && items.length > 0 && (
                  <div aria-hidden="true" className="mx-1 hidden border-t border-gray-100 pt-2 lg:block dark:border-gray-800" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer fixo do sidebar */}
        <div className={`flex-shrink-0 space-y-2 border-t border-gray-200 dark:border-gray-700 ${collapsed ? 'p-2' : 'p-4'}`}>
          {/* Menu Fixo de Rodapé */}
          {userType === 'funcionario' && (
            <Link
              to="/funcionario-config"
              aria-label="Meu Perfil"
              onClick={() => { hideTip(); if (window.innerWidth < 1024 && onClose) onClose(); }}
              onMouseEnter={showTip('Meu Perfil')}
              onMouseLeave={hideTip}
              onFocus={showTip('Meu Perfil')}
              onBlur={hideTip}
              className={`flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                location.pathname === '/funcionario-config'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
            >
              <UserCog className="w-5 h-5 shrink-0" />
              <span className={`truncate whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>Meu Perfil</span>
            </Link>
          )}
          <button
            type="button"
            aria-label="Sair"
            onClick={() => {
              hideTip();
              signOut();
              if (window.innerWidth < 1024 && onClose) onClose();
            }}
            onMouseEnter={showTip('Sair')}
            onMouseLeave={hideTip}
            onFocus={showTip('Sair')}
            onBlur={hideTip}
            className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`truncate whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>Sair</span>
          </button>

          <p className={`text-xs text-gray-500 dark:text-gray-400 text-center mt-4 pt-2 border-t border-gray-100 dark:border-gray-800 ${collapsed ? 'lg:hidden' : ''}`}>
            Versão {packageJson.version}
          </p>
        </div>
      </aside>

      {/* Tooltip do modo colapsado (desktop): posição fixa fora do scroll, sem clipping */}
      {collapsed && hovered && (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[70] hidden rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg lg:block dark:bg-gray-700"
          style={{ left: hovered.left, top: hovered.top, transform: 'translateY(-50%)' }}
        >
          {hovered.label}
        </span>
      )}
    </>
  );
};

export default Sidebar;
