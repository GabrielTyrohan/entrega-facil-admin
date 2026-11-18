// ============================================
// ARQUIVO: src/components/layout/Sidebar.tsx
// Menu lateral (novo visual). Itens, seções e permissões vêm de ./menu.tsx.
// ============================================

import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { ChevronDown, ChevronRight, Lock, LogOut, PanelLeftClose, PanelLeftOpen, Search, UserCog, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import packageJson from '../../../package.json';
import { MAINTENANCE_MSG, MENU_ITEMS, PATH_TO_SECTION, SECTION_ORDER, secaoDaRota, useVisibleMenu, type MenuItem } from './menu';

export { MAINTENANCE_ROUTES } from './menu';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Contadores exibidos ao lado do item (ex.: { '/pedidos-vendedores': 3 }). */
  badges?: Record<string, number>;
}

const GRUPOS_KEY = 'sidebarGruposAbertos';
const GRUPOS_PADRAO: Record<string, boolean> = { Operação: true, Financeiro: true };

/** Abre a busca Ctrl+K (o MainLayout escuta este evento). */
export const abrirBusca = () => window.dispatchEvent(new CustomEvent('abrir-busca'));

const Sidebar = ({ isOpen, onClose, collapsed = false, onToggleCollapsed, badges }: SidebarProps) => {
  const location = useLocation();
  const { permissions, isAdmin, userType, signOut, userProfile } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const salvo = localStorage.getItem(GRUPOS_KEY);
      return salvo ? JSON.parse(salvo) : GRUPOS_PADRAO;
    } catch {
      return GRUPOS_PADRAO;
    }
  });
  const [hovered, setHovered] = useState<{ label: string; top: number; left: number } | null>(null);

  const visibleItems = useVisibleMenu(userType, permissions, isAdmin, MENU_ITEMS);

  // Agrupar itens por seção visual (sem alterar a lógica de permissões)
  const sectionedItems = useMemo(
    () =>
      visibleItems.reduce((acc, item) => {
        const section = PATH_TO_SECTION[item.path] || 'Outros';
        (acc[section] ||= []).push(item);
        return acc;
      }, {} as Record<string, MenuItem[]>),
    [visibleItems]
  );

  // Expandir automaticamente a seção da tela aberta (inclusive subrotas, ex.: /vendas-atacado/nova)
  const secaoAtiva = secaoDaRota(location.pathname).secao;
  useEffect(() => {
    if (!secaoAtiva || secaoAtiva === 'Início') return;
    setOpenGroups((prev) => (prev[secaoAtiva] ? prev : { ...prev, [secaoAtiva]: true }));
  }, [secaoAtiva]);

  useEffect(() => {
    try {
      localStorage.setItem(GRUPOS_KEY, JSON.stringify(openGroups));
    } catch {
      // localStorage indisponível: mantém só em memória
    }
  }, [openGroups]);

  const toggleGroup = (group: string) => setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  const showTip = (label: string) => (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
  };
  const hideTip = () => setHovered(null);

  const fecharNoCelular = () => {
    hideTip();
    if (window.innerWidth < 1024 && onClose) onClose();
  };

  const ativo = (path: string) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path + '/') && secaoDaRota(location.pathname).item?.path === path);

  const itemClass = (isActive: boolean) =>
    `group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${
      isActive
        ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-100'
    } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`;

  const renderMenuItem = (item: MenuItem) => {
    const isActive = ativo(item.path);
    const Icon = item.icon;
    const icone = <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? '' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} />;
    const contador = badges?.[item.path];

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
          className={`${itemClass(false)} w-full cursor-not-allowed text-left opacity-50`}
        >
          {icone}
          <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
          <Lock className={`h-3.5 w-3.5 shrink-0 ${collapsed ? 'lg:hidden' : ''}`} />
        </button>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        onClick={fecharNoCelular}
        onMouseEnter={showTip(item.label)}
        onMouseLeave={hideTip}
        onFocus={showTip(item.label)}
        onBlur={hideTip}
        className={itemClass(isActive)}
      >
        {icone}
        <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
        {!!contador && (
          <span
            aria-label={`${contador} aguardando`}
            className={`ml-auto inline-flex h-[18px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 font-mono text-[11px] font-semibold text-white ${
              collapsed ? 'lg:absolute lg:right-1 lg:top-0.5 lg:ml-0 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]' : ''
            }`}
          >
            {contador}
          </span>
        )}
      </Link>
    );
  };

  const nome = userProfile?.nome || 'Usuário';
  const papel = userType === 'admin' ? 'Administrador' : 'Funcionário';

  return (
    <>
      {/* Fundo escuro no celular */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        aria-label="Menu de navegação principal"
        className={`
        fixed inset-y-0 left-0 z-50 flex h-screen flex-shrink-0 flex-col overflow-hidden
        border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:relative lg:z-0
        w-64 ${collapsed ? 'lg:w-[68px]' : 'lg:w-60'}
        transition-[width,transform] duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        {/* Empresa + recolher */}
        <div className={`flex flex-shrink-0 items-center gap-2.5 px-3.5 pb-2 pt-3.5 ${collapsed ? 'lg:flex-col lg:px-2' : ''}`}>
          <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white dark:bg-gray-100 dark:text-gray-900">
            E
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <h2 className="truncate text-[13.5px] font-semibold leading-tight text-gray-900 dark:text-white">Gestão Entrega Fácil</h2>
            <p className="truncate text-[11.5px] text-gray-500 dark:text-gray-400">{papel}</p>
          </div>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              className="hidden rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white lg:flex"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar menu" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Busca Ctrl+K */}
        <div className={`flex-shrink-0 px-3 pb-2 ${collapsed ? 'lg:px-2' : ''}`}>
          <button
            type="button"
            onClick={() => {
              fecharNoCelular();
              abrirBusca();
            }}
            onMouseEnter={showTip('Buscar (Ctrl+K)')}
            onMouseLeave={hideTip}
            aria-label="Buscar telas e ações (Ctrl+K)"
            className={`flex h-8 w-full items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-left text-[12.5px] text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-500 dark:hover:text-gray-300 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className={`flex-1 ${collapsed ? 'lg:hidden' : ''}`}>Buscar ou fazer…</span>
            <kbd className={`rounded border border-gray-200 bg-white px-1.5 font-mono text-[10.5px] text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 ${collapsed ? 'lg:hidden' : ''}`}>
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Menu com scroll próprio */}
        <nav aria-label="Navegação principal" onScroll={hideTip} className={`sidebar-scroll flex-1 overflow-y-auto pb-3 ${collapsed ? 'px-2' : 'px-2.5'}`}>
          {SECTION_ORDER.map((section) => {
            const items = sectionedItems[section];
            if (!items?.length) return null;
            const isPrincipal = section === 'Início' || section === 'Outros';
            const isGroupOpen = isPrincipal ? true : !!openGroups[section];
            const isSectionOpen = collapsed ? true : isGroupOpen;
            const totalBadges = items.reduce((t, i) => t + (badges?.[i.path] ?? 0), 0);

            return (
              <div key={section} className={isPrincipal ? 'mt-1' : 'mt-3'}>
                {!isPrincipal && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(section)}
                    aria-expanded={isGroupOpen}
                    className={`mb-0.5 flex h-6 w-full items-center gap-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 ${
                      collapsed ? 'lg:hidden' : ''
                    }`}
                  >
                    <span className="flex-1 truncate text-left">{section}</span>
                    {!isGroupOpen && totalBadges > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Há pendências nesta seção" />}
                    {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                )}
                {collapsed && !isPrincipal && <div aria-hidden="true" className="mx-2 my-2 hidden border-t border-gray-100 dark:border-gray-700 lg:block" />}
                <div className={`space-y-px ${!isPrincipal && !isSectionOpen ? 'hidden' : ''}`}>{items.map(renderMenuItem)}</div>
              </div>
            );
          })}
        </nav>

        {/* Usuário */}
        <div className={`flex-shrink-0 border-t border-gray-200 dark:border-gray-700 ${collapsed ? 'p-2' : 'p-2.5'}`}>
          {userType === 'funcionario' && (
            <Link
              to="/funcionario-config"
              aria-label="Meu Perfil"
              onClick={fecharNoCelular}
              onMouseEnter={showTip('Meu Perfil')}
              onMouseLeave={hideTip}
              onFocus={showTip('Meu Perfil')}
              onBlur={hideTip}
              className={itemClass(location.pathname === '/funcionario-config')}
            >
              <UserCog className="h-[17px] w-[17px] shrink-0" />
              <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>Meu Perfil</span>
            </Link>
          )}
          <div className={`flex items-center gap-2.5 rounded-md px-1.5 py-1.5 ${collapsed ? 'lg:flex-col lg:px-0' : ''}`}>
            <div aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              {nome.charAt(0).toUpperCase()}
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">{nome}</p>
              <p className="truncate text-[11px] text-gray-400">Versão {packageJson.version}</p>
            </div>
            <button
              type="button"
              aria-label="Sair"
              title="Sair"
              onClick={() => {
                hideTip();
                signOut();
                if (window.innerWidth < 1024 && onClose) onClose();
              }}
              onMouseEnter={showTip('Sair')}
              onMouseLeave={hideTip}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Dica do modo recolhido (desktop): posição fixa fora do scroll, sem corte */}
      {collapsed && hovered && (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[70] hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-gray-700 lg:block"
          style={{ left: hovered.left, top: hovered.top, transform: 'translateY(-50%)' }}
        >
          {hovered.label}
        </span>
      )}
    </>
  );
};

export default Sidebar;
