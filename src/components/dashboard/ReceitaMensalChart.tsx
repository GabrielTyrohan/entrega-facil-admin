// ============================================
// ARQUIVO: src/components/dashboard/ReceitaMensalChart.tsx
// Receita mensal (últimos 6 ou 12 meses) em barras, com detalhe ao passar o mouse.
// Dados: get_faturamento_12_periodos_por_admin (pagamentos das entregas + vendas atacado).
// ============================================

import { useEffect, useState } from 'react';

interface MonthData {
  month: string; // 'MM/YY'
  value: number;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function rotulo(label: string) {
  const [mm, yy] = label.split('/');
  const m = Number(mm);
  return m >= 1 && m <= 12 ? { curto: MESES[m - 1], longo: `${MESES[m - 1]}/20${yy}` } : { curto: label, longo: label };
}

function eixo(v: number) {
  if (v === 0) return 'R$ 0';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v}`;
}

// Passo "redondo" (1, 2, 2,5 ou 5 × 10^k) para o eixo ter 4 divisões com valores fáceis de ler.
function passoRedondo(bruto: number) {
  const base = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

// Largura real do gráfico em px: o SVG é desenhado 1:1, sem ampliar texto em telas largas.
// Ref de callback: a caixa só aparece depois do carregamento, então o observer precisa
// ser ligado quando o elemento surge (um useEffect com [] rodaria antes e nunca mediria).
function useLargura<T extends HTMLElement>(inicial: number) {
  const [el, setEl] = useState<T | null>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, largura] as const;
}

export default function ReceitaMensalChart({ data, isLoading }: { data: MonthData[]; isLoading: boolean }) {
  const [periodo, setPeriodo] = useState<6 | 12>(12);
  const [hover, setHover] = useState<number | null>(null);
  const [caixa, larguraReal] = useLargura<HTMLDivElement>(760);

  const lista = data.slice(-periodo);
  const n = lista.length;
  const total = lista.reduce((t, d) => t + d.value, 0);
  const fechados = lista.slice(0, -1); // o mês atual ainda está em andamento
  const media = fechados.length ? fechados.reduce((t, d) => t + d.value, 0) / fechados.length : 0;
  const melhor = lista.reduce<MonthData | null>((m, d) => (!m || d.value > m.value ? d : m), null);

  const maxBruto = Math.max(...lista.map((d) => d.value), 1);
  const passo = passoRedondo(Math.max(maxBruto / 4, 1));
  const max = passo * 4;
  const marcas = [0, 1, 2, 3, 4].map((k) => passo * k);
  // Margem esquerda do tamanho do maior rótulo (~6,6 px por caractere em 11 px mono).
  const L = Math.ceil(Math.max(...marcas.map((v) => eixo(v).length)) * 6.6) + 10;
  const W = Math.max(larguraReal, 280), H = 240, R = 4, T = 14, B = 28;
  const gw = W - L - R, gh = H - T - B;
  const y = (v: number) => T + gh - (v / max) * gh;
  const slot = n ? gw / n : gw;
  const bw = Math.min(36, slot * 0.56);
  const pulaRotulo = slot < 30; // tela estreita: mostra um mês sim, outro não (o atual sempre)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">Receita mensal</h3>
          <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">
            Tudo que foi recebido por mês: pagamentos das entregas e vendas atacado
          </p>
        </div>
        <div role="group" aria-label="Período do gráfico" className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-900/60">
          {([6, 12] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => setPeriodo(p)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                periodo === p
                  ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {p} meses
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-[280px] animate-pulse rounded-md bg-gray-100 dark:bg-gray-700/50" />
      ) : n === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">Ainda não há recebimentos para mostrar.</p>
      ) : (
        <>
          <dl className="mb-2 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs text-gray-400">Total no período</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{fmt(total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Média por mês fechado</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{fmt(media)}</dd>
            </div>
            {melhor && (
              <div>
                <dt className="text-xs text-gray-400">Melhor mês</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {rotulo(melhor.month).curto} · {fmt(melhor.value)}
                </dd>
              </div>
            )}
          </dl>

          <div ref={caixa} className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`Receita por mês dos últimos ${n} meses`} onMouseLeave={() => setHover(null)}>
              {marcas.map((v) => (
                <g key={v}>
                  <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-gray-200 dark:stroke-gray-700" strokeDasharray={v ? '3 4' : undefined} />
                  <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-400 font-mono text-[11px]">
                    {eixo(v)}
                  </text>
                </g>
              ))}
              {lista.map((d, i) => {
                const cx = L + slot * i + slot / 2;
                const atual = i === n - 1;
                const yy = y(d.value);
                return (
                  <g key={d.month} onMouseEnter={() => setHover(i)}>
                    <rect x={cx - slot / 2 + 2} y={T} width={slot - 4} height={gh} rx={4} className={hover === i ? 'fill-gray-100 dark:fill-gray-700/50' : 'fill-transparent'} />
                    <rect x={cx - bw / 2} y={yy} width={bw} height={Math.max(T + gh - yy, d.value > 0 ? 2 : 0)} rx={3} className={`fill-blue-600 dark:fill-blue-400 ${atual ? 'opacity-50' : ''}`} />
                    <text x={cx} y={H - 8} textAnchor="middle" className={`text-[11.5px] ${atual ? 'fill-gray-900 font-semibold dark:fill-white' : 'fill-gray-400'}`}>
                      {pulaRotulo && !atual && (n - 1 - i) % 2 ? '' : rotulo(d.month).curto}
                    </text>
                  </g>
                );
              })}
            </svg>
            {hover !== null && lista[hover] && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-700"
                style={{ left: `${((L + slot * hover + slot / 2) / W) * 100}%`, top: `${(Math.max(y(lista[hover].value) - 8, 30) / H) * 100}%` }}
              >
                <p className="font-semibold">
                  {rotulo(lista[hover].month).longo}
                  {hover === n - 1 ? ' · em andamento' : ''}
                </p>
                <p className="font-mono tabular-nums">{fmt(lista[hover].value)}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
