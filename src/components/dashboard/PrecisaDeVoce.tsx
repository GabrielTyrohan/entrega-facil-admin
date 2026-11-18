// ============================================
// ARQUIVO: src/components/dashboard/PrecisaDeVoce.tsx
// Lista "Precisa de você" do Início: o que está pendente agora, cada item com o botão da ação.
// Usa só dados que o Dashboard já carrega (sem consultas novas, exceto a contagem de pedidos,
// que é a mesma do menu e vem do cache).
// ============================================

import { AlertTriangle, CheckCircle2, Inbox, Package, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePedidosPendentesCount } from '@/hooks/usePedidosVendedor';
import type { EstoqueAtual } from '@/types/estoque';

interface Props {
  estoqueAlerts: EstoqueAtual[];
  inadimplencia: { faixas: Record<string, number>; totais: Record<string, number> } | null;
  autonomosPendentes: number;
  carregando: boolean;
}

type Tom = 'acc' | 'warn' | 'bad';
interface Tarefa {
  id: string;
  tom: Tom;
  icon: typeof Inbox;
  titulo: string;
  detalhe: string;
  acao: string;
  to: string;
  principal?: boolean;
}

const TOM: Record<Tom, string> = {
  acc: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default function PrecisaDeVoce({ estoqueAlerts, inadimplencia, autonomosPendentes, carregando }: Props) {
  const { isAdmin, permissions } = useAuth();
  const podePedidos = isAdmin || !!permissions?.cestas_vendedor || !!permissions?.produtos || !!permissions?.expedicao;
  const podeCobranca = isAdmin || !!permissions?.cobranca;
  const podeEstoque = isAdmin || !!permissions?.produtos;
  const { data: pedidos = 0 } = usePedidosPendentesCount(podePedidos);

  const tarefas: Tarefa[] = [];

  if (podePedidos && pedidos > 0) {
    tarefas.push({
      id: 'pedidos',
      tom: 'acc',
      icon: Inbox,
      titulo: `${plural(pedidos, 'pedido de vendedor esperando', 'pedidos de vendedores esperando')}`,
      detalhe: 'Atenda ou recuse para o vendedor saber se as cestas vão sair.',
      acao: 'Atender',
      to: '/pedidos-vendedores',
      principal: true,
    });
  }

  if (podeEstoque && estoqueAlerts.length > 0) {
    const zerados = estoqueAlerts.filter((p) => p.status_estoque === 'ZERADO');
    const nomes = estoqueAlerts.slice(0, 3).map((p) => `${p.produto_nome} (${p.qtd_estoque} ${p.unidade_medida})`).join(', ');
    tarefas.push({
      id: 'estoque',
      tom: zerados.length ? 'bad' : 'warn',
      icon: Package,
      titulo: zerados.length
        ? `${plural(zerados.length, 'produto sem estoque', 'produtos sem estoque')}${estoqueAlerts.length > zerados.length ? ` e ${estoqueAlerts.length - zerados.length} acabando` : ''}`
        : plural(estoqueAlerts.length, 'produto com estoque baixo', 'produtos com estoque baixo'),
      detalhe: nomes + (estoqueAlerts.length > 3 ? '…' : ''),
      acao: 'Registrar compra',
      to: '/estoque/compras/nova',
    });
  }

  if (podeCobranca && inadimplencia) {
    const t = inadimplencia.totais;
    const f = inadimplencia.faixas;
    const atrasoLongo = (t.de30a60 ?? 0) + (t.de60a90 ?? 0) + (t.acima90 ?? 0);
    const qtdLongo = (f.de30a60 ?? 0) + (f.de60a90 ?? 0) + (f.acima90 ?? 0);
    if (qtdLongo > 0) {
      tarefas.push({
        id: 'atraso',
        tom: 'bad',
        icon: AlertTriangle,
        titulo: `${fmt(atrasoLongo)} em atraso há mais de 30 dias`,
        detalhe: `${plural(qtdLongo, 'entrega', 'entregas')} com débito antigo${(f.acima90 ?? 0) > 0 ? `, ${f.acima90} com mais de 90 dias` : ''}.`,
        acao: 'Ver devedores',
        to: '/devedores',
      });
    }
  }

  if (isAdmin && autonomosPendentes > 0) {
    tarefas.push({
      id: 'autonomos',
      tom: 'warn',
      icon: Users,
      titulo: plural(autonomosPendentes, 'vendedor autônomo com assinatura pendente', 'vendedores autônomos com assinatura pendente'),
      detalhe: 'Enquanto não pagarem, o app deles pode ser bloqueado.',
      acao: 'Ver vendedores',
      to: '/vendedores',
    });
  }

  return (
    <section aria-labelledby="precisa-titulo" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="precisa-titulo" className="text-[15px] font-semibold text-gray-900 dark:text-white">
          Precisa de você
        </h2>
        <span className="text-[13px] text-gray-400">
          {carregando ? 'Verificando…' : tarefas.length ? plural(tarefas.length, 'item', 'itens') : 'Tudo em dia'}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {carregando && tarefas.length === 0 ? (
          <div className="space-y-3 p-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        ) : tarefas.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
              <CheckCircle2 className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white">Nada pendente agora</p>
              <p className="text-[12.5px] text-gray-500 dark:text-gray-400">Sem pedidos esperando, estoque em ordem e sem atrasos antigos.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {tarefas.map((t) => {
              const Icon = t.icon;
              return (
                <li key={t.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${TOM[t.tom]}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white">{t.titulo}</p>
                    <p className="truncate text-[12.5px] text-gray-500 dark:text-gray-400">{t.detalhe}</p>
                  </div>
                  <Link
                    to={t.to}
                    className={`inline-flex h-8 items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium shadow-sm transition-colors ${
                      t.principal
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.acao}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
