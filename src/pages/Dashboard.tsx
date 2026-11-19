import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCountUp, useDashboardAnimationFlag } from '@/hooks/useCountUp';
import { useDashboard, useIsVisible } from '@/hooks/useDashboard';
import {
  Activity, AlertTriangle, ArrowRight, Calendar,
  DollarSign, FileText, HelpCircle, Search, ShoppingBasket,
  TrendingUp, Truck, Users
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import PrecisaDeVoce from '../components/dashboard/PrecisaDeVoce';
import ReceitaMensalChart from '../components/dashboard/ReceitaMensalChart';
import { abrirBusca } from '../components/layout/Sidebar';

// Ícone dos cartões em tom suave (novo visual), a partir da cor sólida antiga.
const ICONE_SUAVE: Record<string, string> = {
  'bg-emerald-500': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-green-500': 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300',
  'bg-red-500': 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  'bg-purple-500': 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300',
  'bg-indigo-500': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-blue-500': 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
};

const saudacao = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip: React.FC<{ text: string }> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    setVisible(true);
  };

  return (
    <div className="relative inline-flex items-center ml-1">
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        onClick={() => visible ? setVisible(false) : show()}
        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
        aria-label="Informação"
        type="button"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {visible && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] w-52 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none leading-relaxed -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── DashboardSection ─────────────────────────────────────────────────────────
const DashboardSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      )}
    </div>
    {children}
  </section>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  isLoading: boolean;
  showChange?: boolean;
  subtitle?: string;
  tooltip?: string;
  linkTo?: string;
  linkLabel?: string;
  linkAriaLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, change, changeType, icon: Icon,
  color, isLoading, showChange = false, subtitle, tooltip,
  linkTo, linkLabel = 'Ver detalhes', linkAriaLabel,
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-full relative transition-shadow ${
    linkTo ? 'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-blue-500 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800' : ''
  }`}>
    {isLoading ? (
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-20 mb-2" />
          {showChange && <Skeleton className="h-4 w-24 mt-2" />}
        </div>
        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg ml-3 flex-shrink-0" />
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 animate-fade-in-up">
          <div className="flex items-center gap-0.5 mb-1">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{title}</p>
            {tooltip && <span className="relative z-10"><Tooltip text={tooltip} /></span>}
          </div>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white break-words">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          )}
          {showChange && change && (
            <div className="flex items-center mt-2">
              <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0 ${
                changeType === 'increase' ? 'text-green-500' :
                changeType === 'decrease' ? 'text-red-500' : 'text-gray-500'
              }`} />
              <span className={`text-xs sm:text-sm font-medium ${
                changeType === 'increase' ? 'text-green-600' :
                changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
              }`}>{change}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">
                vs mês anterior
              </span>
            </div>
          )}
        </div>
        <div className={`w-10 h-10 ${ICONE_SUAVE[color] ?? `${color} text-white`} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    )}
    {!isLoading && linkTo && (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <Link
          to={linkTo}
          aria-label={linkAriaLabel || `${linkLabel}: ${title}`}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-none after:absolute after:inset-0 after:content-[''] after:rounded-lg"
        >
          {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    )}
  </div>
);

// ─── Cartões de análise (mesmo padrão da Receita mensal) ─────────────────────
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const CartaoAnalise: React.FC<{
  titulo: string;
  descricao: string;
  ajuda?: string;
  link?: { to: string; label: string };
  children: React.ReactNode;
}> = ({ titulo, descricao, ajuda, link, children }) => (
  <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center text-[15px] font-semibold text-gray-900 dark:text-white">
          {titulo}
          {ajuda && <Tooltip text={ajuda} />}
        </h3>
        <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{descricao}</p>
      </div>
      {link && (
        <Link
          to={link.to}
          className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {link.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
    {children}
  </div>
);

const CarregandoLinhas: React.FC<{ n?: number }> = ({ n = 5 }) => (
  <div className="space-y-4" aria-hidden="true">
    {[...Array(n)].map((_, i) => (
      <div key={i} className="space-y-1.5">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
    ))}
  </div>
);

const SemDados: React.FC<{ titulo: string; texto: string }> = ({ titulo, texto }) => (
  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
    <p className="text-[13.5px] font-medium text-gray-700 dark:text-gray-200">{titulo}</p>
    <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{texto}</p>
  </div>
);

// Linha de ranking: posição, nome, detalhe, valor e barra proporcional ao primeiro.
const LinhaRanking: React.FC<{ pos: number; nome: string; detalhe?: string; valor: string; pct: number; animar: boolean }> = ({
  pos, nome, detalhe, valor, pct, animar,
}) => (
  <li className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
    <span
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-md font-mono text-[11.5px] font-semibold ${
        pos === 1 ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'text-gray-400'
      }`}
    >
      {pos}
    </span>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{nome}</p>
      {detalhe && <p className="text-[11.5px] text-gray-500 dark:text-gray-400">{detalhe}</p>}
    </div>
    <span className="font-mono text-[13px] font-semibold tabular-nums text-gray-900 dark:text-white">{valor}</span>
    <div className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/70">
      <div
        className={`h-full rounded-full bg-blue-600 transition-[width] duration-700 dark:bg-blue-400 ${pos === 1 ? '' : 'opacity-60'}`}
        style={{ width: animar ? `${Math.max(pct, pct > 0 ? 2 : 0)}%` : '0%' }}
      />
    </div>
  </li>
);

// ─── InadimplenciaCard ────────────────────────────────────────────────────────
const FAIXAS_ATRASO = [
  { key: 'ate30', label: 'Até 30 dias', cor: 'bg-amber-300 dark:bg-amber-400/70' },
  { key: 'de30a60', label: '31 a 60 dias', cor: 'bg-orange-400 dark:bg-orange-400/80' },
  { key: 'de60a90', label: '61 a 90 dias', cor: 'bg-red-400 dark:bg-red-400/80' },
  { key: 'acima90', label: 'Mais de 90 dias', cor: 'bg-red-600 dark:bg-red-500' },
];

const InadimplenciaCard: React.FC<{
  data: { faixas: Record<string, number>; totais: Record<string, number> } | null;
  isLoading: boolean;
}> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const total = data ? FAIXAS_ATRASO.reduce((t, f) => t + (data.totais[f.key] || 0), 0) : 0;
  const entregas = data ? FAIXAS_ATRASO.reduce((t, f) => t + (data.faixas[f.key] || 0), 0) : 0;

  return (
    <div ref={ref} className="h-full">
      <CartaoAnalise
        titulo="Inadimplência por faixa"
        descricao="Quanto está em aberto, por tempo de atraso"
        ajuda="Débitos em aberto agrupados pelo tempo desde o retorno da entrega."
        link={{ to: '/devedores', label: 'Ver devedores' }}
      >
        {isLoading || !isVisible ? (
          <CarregandoLinhas n={4} />
        ) : !data || total === 0 ? (
          <SemDados titulo="Nada em aberto" texto="Nenhum débito atrasado no momento." />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Total em aberto</p>
                <p className="font-mono text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{brl(total)}</p>
              </div>
              <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
                {entregas} {entregas === 1 ? 'entrega' : 'entregas'}
              </p>
            </div>
            {/* Barra única dividida pelas faixas */}
            <div
              className="mb-4 flex h-2 gap-px overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/70"
              role="img"
              aria-label="Divisão do total por faixa de atraso"
            >
              {FAIXAS_ATRASO.map((f) => {
                const v = data.totais[f.key] || 0;
                return v > 0 ? <div key={f.key} className={f.cor} style={{ width: `${(v / total) * 100}%` }} /> : null;
              })}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {FAIXAS_ATRASO.map((f) => {
                const v = data.totais[f.key] || 0;
                const n = data.faixas[f.key] || 0;
                return (
                  <li key={f.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${f.cor}`} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-gray-700 dark:text-gray-300">
                      {f.label}
                      <span className="ml-1.5 text-[11.5px] text-gray-400">
                        {n} {n === 1 ? 'entrega' : 'entregas'}
                      </span>
                    </span>
                    <span className="w-10 text-right font-mono text-[11.5px] tabular-nums text-gray-400">
                      {Math.round((v / total) * 100)}%
                    </span>
                    <span className="min-w-[7rem] whitespace-nowrap text-right font-mono text-[13px] font-semibold tabular-nums text-gray-900 dark:text-white">
                      {brl(v)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CartaoAnalise>
    </div>
  );
};

// ─── TopVendedoresCard ────────────────────────────────────────────────────────
const TopVendedoresCard: React.FC<{
  data: { nome: string; entregas: number; total: number }[];
  isLoading: boolean;
}> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const max = Math.max(...data.map((d) => d.total), 0);
  const vazio = data.length === 0 || data.every((d) => !d.total && !d.entregas);

  return (
    <div ref={ref} className="h-full">
      <CartaoAnalise
        titulo="Melhores vendedores"
        descricao="Valor vendido no período atual"
        ajuda="Os 5 vendedores com maior valor total no período atual (baseado no dia de fechamento)."
        link={{ to: '/vendedores', label: 'Ver todos' }}
      >
        {isLoading || !isVisible ? (
          <CarregandoLinhas />
        ) : vazio ? (
          <SemDados titulo="Sem vendas no período" texto="Os vendedores aparecem aqui conforme registram entregas." />
        ) : (
          <ol className="space-y-3.5">
            {data.map((v, i) => (
              <LinhaRanking
                key={`${v.nome}-${i}`}
                pos={i + 1}
                nome={v.nome}
                detalhe={`${v.entregas} ${v.entregas === 1 ? 'entrega' : 'entregas'}`}
                valor={brl(v.total)}
                pct={max ? (v.total / max) * 100 : 0}
                animar={isVisible}
              />
            ))}
          </ol>
        )}
      </CartaoAnalise>
    </div>
  );
};

// ─── TopProdutosCard ──────────────────────────────────────────────────────────
interface TopProdutoItem { id: string; nome: string; unidade: string; qtd: number; }

const TopProdutosCard: React.FC<{ data: TopProdutoItem[]; isLoading: boolean }> = ({ data, isLoading }) => {
  const { ref, isVisible } = useIsVisible();
  const max = Math.max(...data.map((d) => d.qtd), 0);

  return (
    <div ref={ref} className="h-full">
      <CartaoAnalise
        titulo="Produtos mais entregues"
        descricao="Quantidade que saiu nas cestas no período atual"
        ajuda="Os 5 produtos mais entregues via cestas no período atual de cada vendedor."
        link={{ to: '/estoque/relatorio', label: 'Ver estoque' }}
      >
        {isLoading || !isVisible ? (
          <CarregandoLinhas />
        ) : data.length === 0 ? (
          <SemDados titulo="Sem entregas no período" texto="Nenhuma cesta entregue registrada ainda." />
        ) : (
          <ol className="space-y-3.5">
            {data.map((p, i) => (
              <LinhaRanking
                key={p.id}
                pos={i + 1}
                nome={p.nome}
                valor={`${p.qtd.toLocaleString('pt-BR')} ${p.unidade}`}
                pct={max ? (p.qtd / max) * 100 : 0}
                animar={isVisible}
              />
            ))}
          </ol>
        )}
      </CartaoAnalise>
    </div>
  );
};

// ─── VendedoresPorTipoCard ────────────────────────────────────────────────────
const VendedoresPorTipoCard: React.FC<{
  data: { representados: number; autonomos: number; autonomosPendentes: number } | null;
  isLoading: boolean;
}> = ({ data, isLoading }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
        <Users className="w-4 h-4 text-white" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
        Resumo de Vendedores
      </h3>
      <Tooltip text="Distribuição dos vendedores ativos por tipo de vínculo de cobrança." />
    </div>

    {isLoading ? (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-3 gap-3">
        {/* Representados */}
        <div className="flex flex-col items-center text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
            {data?.representados ?? 0}
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">Representados</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">Fatura do admin</span>
        </div>

        {/* Autônomos */}
        <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <span className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
            {data?.autonomos ?? 0}
          </span>
          <span className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">Autônomos</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">Pgto. independente</span>
        </div>

        {/* Autônomos Pendentes */}
        <div className={`flex flex-col items-center text-center p-3 rounded-lg ${
          (data?.autonomosPendentes ?? 0) > 0
            ? 'bg-orange-50 dark:bg-orange-900/20'
            : 'bg-gray-50 dark:bg-gray-700/30'
        }`}>
          <span className={`text-xl sm:text-2xl font-bold ${
            (data?.autonomosPendentes ?? 0) > 0
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {data?.autonomosPendentes ?? 0}
          </span>
          <span className={`text-xs font-medium mt-0.5 ${
            (data?.autonomosPendentes ?? 0) > 0
              ? 'text-orange-500 dark:text-orange-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}>Pendentes</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">Aguard. pagamento</span>
        </div>
      </div>
    )}
  </div>
);

// ─── Dashboard Principal ──────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { userType, permissions, userProfile } = useAuth();
  const isExpedicao = userType !== 'admin' && permissions?.expedicao === true;
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // ── Realtime ─────────────────────────────────────────────────────────────────
  // Atualização em tempo real: feita para o sistema todo em useRealtimeInvalidator (MainLayout).

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const {
    stats, breakdown, entregasHoje, inadimplencia, vendedores,
    topProdutos, estoqueAlerts, charts, isLoading, someLoading, loadingStates,
    vendedoresPorTipo,
  } = useDashboard();

  const { shouldAnimate, markAsPlayed } = useDashboardAnimationFlag();

  useEffect(() => {
    if (shouldAnimate && !isLoading) {
      const temDados =
        stats?.faturamentoAtual !== undefined &&
        stats?.valoresEmFalta !== undefined &&
        breakdown?.fatOrcamentos !== undefined;

      if (temDados) markAsPlayed();
    }
  }, [stats, breakdown, isLoading, shouldAnimate, markAsPlayed]);

  const faturamentoAnimado = useCountUp({
    target: stats?.faturamentoAtual || 0,
    duration: 1200,
    enabled: shouldAnimate,
  });

  const faltanteAnimado = useCountUp({
    target: stats?.valoresEmFalta || 0,
    duration: 1400,
    enabled: shouldAnimate,
  });

  const orcamentosAnimado = useCountUp({
    target: breakdown?.fatOrcamentos || 0,
    duration: 1000,
    enabled: shouldAnimate,
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);

  const taxaInadimplencia = useMemo(() => {
    if (!stats?.faturamentoAtual || !stats?.valoresEmFalta) return null;
    return ((stats.valoresEmFalta / stats.faturamentoAtual) * 100).toFixed(1);
  }, [stats]);

  const statsRow1 = [
    {
      title: 'Faturamento Atual',
      tooltip: 'Total faturado no mês somando entregas e vendas atacado.',
      value: fmt(Number(faturamentoAnimado)),
      change: `${stats?.percentualFaturamento >= 0 ? '+' : ''}${stats?.percentualFaturamento}%`,
      changeType: stats?.percentualFaturamento >= 0 ? 'increase' : 'decrease',
      icon: DollarSign, color: 'bg-emerald-500',
      isLoading, showChange: true,
    },
    {
      title: 'Valores em Falta',
      tooltip: 'Débitos em aberto de entregas já retornadas e vendas atacado com pagamento pendente.',
      value: fmt(Number(faltanteAnimado)),
      subtitle: taxaInadimplencia ? `${taxaInadimplencia}% do faturamento` : undefined,
      icon: AlertTriangle, color: 'bg-red-500',
      isLoading, showChange: false,
      linkTo: '/devedores',
      linkLabel: 'Ver devedores',
    },
    {
      title: 'Orçamentos PJ',
      tooltip: 'Valor total de orçamentos PJ com status convertido registrados no mês atual.',
      value: fmt(Number(orcamentosAnimado)),
      subtitle: breakdown?.qtdOrcamentos
        ? `${breakdown.qtdOrcamentos} convertido${breakdown.qtdOrcamentos > 1 ? 's' : ''} no mês`
        : 'Nenhum convertido',
      icon: FileText, color: 'bg-purple-500',
      isLoading, showChange: false,
    },
  ] as const;

  const statsRow2 = [
    {
      title: 'Entregas do Mês',
      tooltip: 'Total de entregas e vendas atacado registradas no mês corrente.',
      value: String(stats?.entregasAtual || 0),
      change: `${stats?.percentualEntregas >= 0 ? '+' : ''}${stats?.percentualEntregas}%`,
      changeType: stats?.percentualEntregas >= 0 ? 'increase' : 'decrease',
      icon: Truck, color: 'bg-green-500',
      isLoading, showChange: true,
      linkTo: '/entregas',
      linkLabel: 'Ver entregas',
    },
    {
      title: 'Entregas Hoje',
      tooltip: 'Total de entregas e vendas atacado registradas na data de hoje.',
      value: String(entregasHoje || 0),
      subtitle: 'registradas hoje',
      icon: Calendar, color: 'bg-indigo-500',
      isLoading: loadingStates.entregasHoje, showChange: false,
      linkTo: '/entregas',
      linkLabel: 'Ver entregas',
    },
    {
      title: 'Vendedores Ativos',
      tooltip: 'Quantidade de vendedores com status ativo vinculados à sua conta.',
      value: String(stats?.vendedoresAtivos || 0),
      icon: Users, color: 'bg-blue-500',
      isLoading, showChange: false,
      linkTo: '/vendedores',
      linkLabel: 'Ver vendedores',
    },
  ] as const;

  const podeEntregarCesta = userType === 'admin' || !!permissions?.cestas_vendedor || !!permissions?.produtos;
  const primeiroNome = (userProfile?.nome || '').split(' ')[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}`}
        description={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(currentDateTime).replace(/^./, (c) => c.toUpperCase())}
        actions={
          <div className="flex items-center gap-2">
            {someLoading && (
              <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-gray-500" title={formatDateTime(currentDateTime)}>
                <Activity className="h-3 w-3 animate-pulse text-blue-500" /> Atualizando…
              </span>
            )}
            <button
              type="button"
              onClick={abrirBusca}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Search className="h-4 w-4" /> Buscar
              <kbd className="hidden rounded border border-gray-200 px-1 font-mono text-[10px] text-gray-400 dark:border-gray-600 sm:inline">Ctrl K</kbd>
            </button>
            {podeEntregarCesta && (
              <Link
                to="/produtos/cestas"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <ShoppingBasket className="h-4 w-4" /> Entregar cesta
              </Link>
            )}
          </div>
        }
      >
        {stats?.periodoInicio && stats?.periodoFim && (
          <span className="bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 text-xs px-2.5 py-0.5 rounded-full inline-flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Período {new Date(stats.periodoInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a {new Date(stats.periodoFim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </PageHeader>

      {/* SEÇÃO 0 — O que fazer agora */}
      <PrecisaDeVoce
        estoqueAlerts={estoqueAlerts}
        inadimplencia={isExpedicao ? null : inadimplencia}
        autonomosPendentes={vendedoresPorTipo?.autonomosPendentes ?? 0}
        carregando={isLoading || loadingStates.estoque || loadingStates.inadimplencia}
      />

      {/* SEÇÃO 1 — O que está acontecendo agora */}
      {!isExpedicao && (
        <DashboardSection title="Visão geral" description="Principais números da operação no período">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {statsRow1.map((stat, index) => <StatCard key={index} {...stat} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {statsRow2.map((stat, index) => <StatCard key={index} {...stat} />)}
          </div>
          {/* Card de resumo de vendedores por tipo de vínculo */}
          <VendedoresPorTipoCard
            data={vendedoresPorTipo}
            isLoading={loadingStates.vendedoresTipo}
          />
        </DashboardSection>
      )}

      {/* SEÇÃO 2 — O que quero analisar */}
      {!isExpedicao && (
        <DashboardSection title="Análises" description="Evolução e desempenho no período">
          <ReceitaMensalChart data={charts.faturamentoMensal} isLoading={loadingStates.grafico} />
          {/* Rankings e a dívida por tempo de atraso (acompanhar a cobrança).
              Os produtos em falta ficam no "Precisa de você", com a ação de compra. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <TopVendedoresCard data={vendedores} isLoading={loadingStates.vendedores} />
            <TopProdutosCard data={topProdutos} isLoading={loadingStates.topProdutos} />
            <div className="grid lg:col-span-2 2xl:col-span-1">
              <InadimplenciaCard data={inadimplencia} isLoading={loadingStates.inadimplencia} />
            </div>
          </div>
        </DashboardSection>
      )}
    </div>
  );
};

export default Dashboard;