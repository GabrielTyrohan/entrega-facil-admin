// ============================================
// ARQUIVO: src/components/layout/menu.tsx
// Itens do menu, grupos visuais e filtro de permissões.
// Usado pelo menu lateral (Sidebar) e pela busca Ctrl+K (CommandPalette).
// ============================================

import { useMemo } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  BadgePercent,
  BarChart3,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileKey,
  FileText,
  Home,
  Inbox,
  ListChecks,
  MessageSquare,
  Package,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingBasket,
  Store,
  ShoppingCart,
  Truck,
  Undo2,
  Upload,
  UserCircle,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Permissoes, UserType } from '@/contexts/AuthContext';

export const MAINTENANCE_ROUTES: string[] = [];
export const MAINTENANCE_MSG =
  'Esta área está temporariamente indisponível por estar em manutenção. Em breve retornaremos com uma nova solução de emissão fiscal.';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: keyof Permissoes;
  /** Basta ter qualquer uma destas permissões. */
  permissionAny?: (keyof Permissoes)[];
  adminOnly?: boolean;
  funcionarioOnly?: boolean;
  /** Grupo de PERMISSÃO (regras de acesso). Não é o grupo visual do menu. */
  group?: string;
  disabled?: boolean;
  maintenanceMessage?: string;
}

// A ordem do array é a ordem em que os itens aparecem dentro de cada seção.
export const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard', label: 'Início', icon: Home, group: 'Principal' },

  // OPERAÇÃO DO DIA
  { path: '/produtos/cestas', label: 'Entregar Cesta', icon: ShoppingBasket, permissionAny: ['cestas_vendedor', 'produtos'], group: 'Catálogo' },
  { path: '/pedidos-vendedores', label: 'Pedidos dos Vendedores', icon: Inbox, permissionAny: ['cestas_vendedor', 'produtos'], group: 'Catálogo' },
  { path: '/entregas', label: 'Entregas', icon: Truck, permission: 'cobranca', group: 'Operacional' },
  { path: '/entregas/avulsas', label: 'Entregas Avulsas', icon: Truck, permissionAny: ['cestas_vendedor', 'produtos'], group: 'Catálogo' },

  // PESSOAS
  { path: '/vendedores', label: 'Vendedores', icon: Users, permission: 'vendedores', group: 'Pessoas' },
  { path: '/clientes', label: 'Clientes', icon: UserCircle, permission: 'cobranca', group: 'Pessoas' },
  { path: '/funcionarios', label: 'Funcionários', icon: UserCog, permission: 'funcionarios', adminOnly: true, group: 'Pessoas' },

  // ESTOQUE
  { path: '/produtos', label: 'Produtos', icon: Package, permission: 'produtos', group: 'Catálogo' },
  { path: '/produtos/cestas-base', label: 'Cadastrar Cestas', icon: PackagePlus, permission: 'produtos', group: 'Catálogo' },
  { path: '/estoque/compras', label: 'Compras', icon: ShoppingCart, permission: 'produtos', group: 'Estoque' },
  { path: '/estoque/movimentacoes', label: 'Movimentações', icon: ArrowUpDown, permission: 'produtos', group: 'Estoque' },
  { path: '/estoque/relatorio', label: 'Relatório', icon: ClipboardList, permission: 'produtos', group: 'Estoque' },

  // FINANCEIRO
  { path: '/devedores', label: 'Devedores', icon: AlertCircle, permission: 'cobranca', group: 'Financeiro' },
  { path: '/pagamentos', label: 'Pagamentos', icon: CreditCard, permission: 'cobranca', group: 'Financeiro' },
  { path: '/comissoes', label: 'Comissões', icon: BadgePercent, adminOnly: true, group: 'Financeiro' },
  { path: '/devolucoes', label: 'Devoluções', icon: Undo2, permission: 'cobranca', group: 'Financeiro' },
  { path: '/caixa', label: 'Fluxo de Caixa', icon: DollarSign, permission: 'caixa', group: 'Financeiro' },
  { path: '/acertos-diarios', label: 'Acertos Diários', icon: ClipboardList, permission: 'acertos', group: 'Financeiro' },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, permission: 'relatorios', group: 'Relatórios' },

  // COMERCIAL E FISCAL
  { path: '/vendas-atacado', label: 'Vendas Atacado', icon: ShoppingCart, permission: 'vendas_atacado', group: 'Comercial' },
  { path: '/revendedores', label: 'Revendedores', icon: Store, permissionAny: ['vendas_atacado', 'cestas_vendedor'], group: 'Comercial' },
  { path: '/orcamentos-pj', label: 'Orçamento PJ', icon: FileText, permission: 'orcamentos_pj', group: 'Comercial' },
  { path: '/tabela-precos', label: 'Tabela de Preços', icon: Receipt, permission: 'vendas_atacado', group: 'Comercial' },
  { path: '/historico-pdfs', label: 'Histórico de Notas', icon: FileText, adminOnly: true, group: 'Operacional' },
  { path: '/configuracoes-fiscais', label: 'Configuração Fiscal', icon: FileKey, permission: 'configuracoes_fiscais', adminOnly: true, group: 'Comercial' },
  { path: '/configuracoes-fiscais/importacao', label: 'Importação Fiscal', icon: Upload, permission: 'configuracoes_fiscais', adminOnly: true, group: 'Comercial' },
  { path: '/configuracoes-fiscais/revisao', label: 'Revisão Fiscal', icon: ListChecks, permission: 'configuracoes_fiscais', adminOnly: true, group: 'Comercial' },
  { path: '/configuracoes-fiscais/sincronizacao', label: 'Sincronização Fiscal', icon: RefreshCw, permission: 'configuracoes_fiscais', adminOnly: true, group: 'Comercial' },

  // SISTEMA
  { path: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'configuracoes', adminOnly: true, group: 'Sistema' },
  { path: '/suporte', label: 'Suporte', icon: MessageSquare, group: 'Sistema' },
];

// ===== SEÇÕES VISUAIS (apresentação) =====
// Não alteram rotas nem permissões: o filtro de permissões continua usando `item.group`.
export const PATH_TO_SECTION: Record<string, string> = {
  '/dashboard': 'Início',
  '/produtos/cestas': 'Operação',
  '/pedidos-vendedores': 'Operação',
  '/entregas': 'Operação',
  '/entregas/avulsas': 'Operação',
  '/vendedores': 'Pessoas',
  '/clientes': 'Pessoas',
  '/funcionarios': 'Pessoas',
  '/produtos': 'Estoque',
  '/produtos/cestas-base': 'Estoque',
  '/estoque/compras': 'Estoque',
  '/estoque/movimentacoes': 'Estoque',
  '/estoque/relatorio': 'Estoque',
  '/devedores': 'Financeiro',
  '/pagamentos': 'Financeiro',
  '/comissoes': 'Financeiro',
  '/devolucoes': 'Financeiro',
  '/caixa': 'Financeiro',
  '/acertos-diarios': 'Financeiro',
  '/relatorios': 'Financeiro',
  '/vendas-atacado': 'Comercial e fiscal',
  '/revendedores': 'Comercial e fiscal',
  '/orcamentos-pj': 'Comercial e fiscal',
  '/tabela-precos': 'Comercial e fiscal',
  '/historico-pdfs': 'Comercial e fiscal',
  '/configuracoes-fiscais': 'Comercial e fiscal',
  '/configuracoes-fiscais/importacao': 'Comercial e fiscal',
  '/configuracoes-fiscais/revisao': 'Comercial e fiscal',
  '/configuracoes-fiscais/sincronizacao': 'Comercial e fiscal',
  '/configuracoes': 'Sistema',
  '/suporte': 'Sistema',
};

export const SECTION_ORDER = ['Início', 'Operação', 'Pessoas', 'Estoque', 'Financeiro', 'Comercial e fiscal', 'Sistema', 'Outros'];

/** Seção visual de uma rota, considerando subrotas (ex.: /vendas-atacado/nova → Comercial e fiscal). */
export function secaoDaRota(pathname: string): { secao: string; item?: MenuItem } {
  const item = [...MENU_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(i.path + '/'));
  return { secao: item ? PATH_TO_SECTION[item.path] ?? 'Outros' : '', item };
}

export function useVisibleMenu(userType: UserType, permissions: Permissoes, isAdmin: boolean, menuItems: MenuItem[] = MENU_ITEMS) {
  return useMemo(() => {
    // ADMIN
    if (isAdmin) return menuItems;

    // EXPEDIÇÃO
    if (userType !== 'admin' && permissions?.expedicao) {
      const expedicaoPaths = [
        '/dashboard',
        '/vendedores', '/clientes',
        '/produtos', '/produtos/cestas-base', '/produtos/cestas', '/entregas/avulsas', '/pedidos-vendedores',
        '/configuracoes', '/suporte',
      ];
      return menuItems.filter((item) => expedicaoPaths.includes(item.path));
    }

    // FUNCIONÁRIO NORMAL
    return menuItems.filter((item) => {
      if (item.adminOnly) return false;
      if (item.funcionarioOnly && userType !== 'funcionario') return false;

      // Itens com permissão própria decidem sozinhos (cobrança, cestas do vendedor).
      if (item.permissionAny) return item.permissionAny.some((p) => !!permissions?.[p]);
      if (item.permission === 'cobranca') return !!permissions?.cobranca;

      switch (item.group) {
        case 'Estoque': {
          // Autoridade é a permissão explícita do item (produtos) —
          // caixa NÃO libera estoque administrativo.
          if (item.permission) return !!permissions[item.permission];
          return !!permissions?.produtos;
        }

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

// ===== AÇÕES RÁPIDAS (busca Ctrl+K) =====
// Cada ação só aparece se a tela de origem (`base`) estiver liberada para o usuário.
export interface AcaoRapida {
  label: string;
  path: string;
  base: string;
  icon: LucideIcon;
  palavras?: string;
}

export const ACOES_RAPIDAS: AcaoRapida[] = [
  { label: 'Entregar cesta para vendedor', path: '/produtos/cestas', base: '/produtos/cestas', icon: ShoppingBasket, palavras: 'liberar estoque vendedor' },
  { label: 'Atender pedidos dos vendedores', path: '/pedidos-vendedores', base: '/pedidos-vendedores', icon: Inbox, palavras: 'pedido pendente' },
  { label: 'Nova entrega', path: '/entregas/nova', base: '/entregas', icon: Plus, palavras: 'entrega cliente' },
  { label: 'Cadastrar vendedor', path: '/vendedores?novo=1', base: '/vendedores', icon: Plus, palavras: 'novo vendedor' },
  { label: 'Cadastrar produto', path: '/produtos/novo', base: '/produtos', icon: Plus, palavras: 'novo produto' },
  { label: 'Registrar compra', path: '/estoque/compras/nova', base: '/estoque/compras', icon: ShoppingCart, palavras: 'compra fornecedor nota entrada estoque' },
  { label: 'Nova venda atacado', path: '/vendas-atacado/nova', base: '/vendas-atacado', icon: Plus, palavras: 'venda pj empresa nf-e nota' },
  { label: 'Novo orçamento PJ', path: '/orcamentos-pj/novo', base: '/orcamentos-pj', icon: Plus, palavras: 'orcamento empresa nf-e nota' },
  { label: 'Lançar no caixa', path: '/caixa/lancamento', base: '/caixa', icon: DollarSign, palavras: 'lancamento despesa conta pagar' },
  { label: 'Novo acerto diário', path: '/acertos-diarios/novo', base: '/acertos-diarios', icon: ClipboardList, palavras: 'acerto dinheiro vendedor' },
];
