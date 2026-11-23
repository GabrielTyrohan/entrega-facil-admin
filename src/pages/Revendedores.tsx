// ============================================
// ARQUIVO: src/pages/Revendedores.tsx
// Fase 9 — revendedores (vendedores com CNPJ que compram da empresa e revendem).
// Consulta: o que compraram da empresa, quanto devem e o que venderam aos clientes deles.
// As vendas dos revendedores aos clientes NÃO entram no faturamento, devedores nem comissão da empresa.
// ============================================

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CabecalhoPagina, Etiqueta, PainelLateral, Resumo, Vazio, cls } from '@/components/ui/lista';
import { formatarBRL, useResumoRevendedores, type ResumoRevendedor } from '@/hooks/useRevendedores';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const inicioMesISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const fmtData = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

interface CompraRevendedor {
  id: string;
  numero_pedido: number | null;
  created_at: string;
  valor_total: number;
  valor_pago: number | null;
  status_pagamento: string | null;
}

interface EntregaRevendedor {
  id: string;
  data_entrega: string;
  valor: number;
  status_pagamento: string | null;
  status_entrega: string | null;
  cliente: { nome: string | null; sobrenome: string | null } | null;
  pagamentos: { valor: number }[] | null;
}

function DetalheRevendedor({ revendedor, inicio, fim }: { revendedor: ResumoRevendedor; inicio: string; fim: string }) {
  const { data: compras = [], isLoading: carregandoCompras } = useQuery({
    queryKey: ['revendedores', 'compras', revendedor.vendedor_id],
    queryFn: async (): Promise<CompraRevendedor[]> => {
      const { data, error } = await supabase
        .from('vendas_atacado')
        .select('id, numero_pedido, created_at, valor_total, valor_pago, status_pagamento')
        .eq('vendedor_id', revendedor.vendedor_id)
        .eq('para_revendedor', true)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as CompraRevendedor[];
    },
  });

  const { data: entregas = [], isLoading: carregandoEntregas } = useQuery({
    queryKey: ['revendedores', 'entregas', revendedor.vendedor_id, inicio, fim],
    queryFn: async (): Promise<EntregaRevendedor[]> => {
      const { data, error } = await supabase
        .from('entregas')
        .select('id, data_entrega, valor, status_pagamento, status_entrega, cliente:clientes(nome, sobrenome), pagamentos(valor)')
        .eq('vendedor_id', revendedor.vendedor_id)
        .eq('revenda', true)
        .gte('data_entrega', inicio)
        .lte('data_entrega', `${fim}T23:59:59`)
        .order('data_entrega', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as EntregaRevendedor[];
    },
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Compras da empresa (vendas PJ)</h3>
        {carregandoCompras ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : compras.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma compra ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {compras.map((c) => {
              const falta = Math.max(Number(c.valor_total) - Number(c.valor_pago ?? 0), 0);
              return (
                <li key={c.id}>
                  <Link to={`/vendas-atacado/${c.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <span className="text-gray-700 dark:text-gray-300">#{c.numero_pedido ?? '—'} · {fmtData(c.created_at)}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-gray-900 dark:text-white">{formatarBRL(c.valor_total)}</span>
                      {c.status_pagamento === 'pago'
                        ? <Etiqueta tom="ok">Pago</Etiqueta>
                        : <Etiqueta tom="atencao">Deve {formatarBRL(falta)}</Etiqueta>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vendas dele aos clientes no período</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Só consulta: esse dinheiro é do revendedor.</p>
        {carregandoEntregas ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : entregas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma venda no período.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {entregas.map((e) => {
              const pago = (e.pagamentos ?? []).reduce((s, p) => s + Number(p.valor || 0), 0);
              const nome = [e.cliente?.nome, e.cliente?.sobrenome].filter(Boolean).join(' ') || 'Cliente';
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">{fmtData(e.data_entrega)} · {nome}</span>
                  <span className="shrink-0 font-mono tabular-nums text-gray-900 dark:text-white">
                    {formatarBRL(pago)} / {formatarBRL(e.valor)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const Revendedores: React.FC = () => {
  const [inicio, setInicio] = useState(inicioMesISO);
  const [fim, setFim] = useState(hojeISO);
  const [selecionado, setSelecionado] = useState<ResumoRevendedor | null>(null);
  const { data: lista = [], isLoading, error } = useResumoRevendedores(inicio, fim);

  const totais = useMemo(() => ({
    compras: lista.reduce((s, r) => s + r.compras_periodo, 0),
    devendo: lista.reduce((s, r) => s + r.saldo_devedor, 0),
  }), [lista]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Revendedores"
        descricao="Vendedores com CNPJ que compram da empresa e revendem. As vendas deles aos clientes ficam fora do faturamento e da comissão."
        acoes={<Resumo itens={[
          { rotulo: 'Compraram no período', valor: formatarBRL(totais.compras) },
          { rotulo: 'Devem à empresa', valor: formatarBRL(totais.devendo), tom: totais.devendo > 0 ? 'perigo' : 'normal' },
        ]} />}
      >
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
          <label className="inline-flex items-center gap-1.5">
            De <input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className={cls.select} />
          </label>
          <label className="inline-flex items-center gap-1.5">
            até <input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className={cls.select} />
          </label>
        </div>
      </CabecalhoPagina>

      <div className={`${cls.card} overflow-x-auto`}>
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">Erro ao carregar: {(error as Error).message}</p>
        ) : lista.length === 0 ? (
          <Vazio
            icone={Store}
            titulo="Nenhum revendedor ainda."
            texto="Para transformar um vendedor em revendedor, abra o cadastro dele em Vendedores › Editar › Modelo de venda."
          />
        ) : (
          <table className="w-full min-w-[760px]">
            <thead className={cls.thead}>
              <tr>
                <th className={cls.th}>Revendedor</th>
                <th className={cls.thR}>Comprou no período</th>
                <th className={cls.thR}>Deve à empresa</th>
                <th className={cls.thR}>Vendeu aos clientes</th>
                <th className={cls.thR}>Recebeu dos clientes</th>
                <th className={cls.thR}>Cestas em estoque</th>
              </tr>
            </thead>
            <tbody className={cls.tbody}>
              {lista.map((r) => (
                <tr key={r.vendedor_id} className={`${cls.tr} cursor-pointer`} onClick={() => setSelecionado(r)}>
                  <td className={cls.td}>
                    <span className="font-medium text-gray-900 dark:text-white">{r.nome}</span>
                    {!r.cliente_pj_id && <Etiqueta tom="perigo" className="ml-2">Sem CNPJ</Etiqueta>}
                  </td>
                  <td className={cls.tdR}>{formatarBRL(r.compras_periodo)}</td>
                  <td className={`${cls.tdR} ${r.saldo_devedor > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{formatarBRL(r.saldo_devedor)}</td>
                  <td className={cls.tdR}>{formatarBRL(r.vendas_clientes_periodo)}</td>
                  <td className={cls.tdR}>{formatarBRL(r.recebido_clientes_periodo)}</td>
                  <td className={cls.tdR}>{r.estoque_cestas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PainelLateral
        aberto={!!selecionado}
        onFechar={() => setSelecionado(null)}
        titulo={selecionado?.nome ?? ''}
        descricao="Compras da empresa e vendas do revendedor"
        largura="max-w-[520px]"
      >
        {selecionado && <DetalheRevendedor revendedor={selecionado} inicio={inicio} fim={fim} />}
      </PainelLateral>
    </div>
  );
};

export default Revendedores;
