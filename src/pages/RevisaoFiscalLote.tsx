import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/utils/toast';
import {
  CamposFiscaisLote,
  camposPreenchidos,
  pendenciasFiscais,
  ProdutoFiscalLinha,
  ResultadoLoteFiscal,
  useAtualizarFiscalLote,
  useProdutosRevisaoFiscal,
} from '@/hooks/useRevisaoFiscal';

const SUGESTAO: Record<string, { rotulo: string; cls: string }> = {
  cesta_basica: { rotulo: 'Cesta básica', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  padrao: { rotulo: 'Padrão', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  verificar: { rotulo: 'Verificar', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  manual: { rotulo: 'Manual', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
};

const CAMPOS: { chave: keyof CamposFiscaisLote; rotulo: string; dica?: string }[] = [
  { chave: 'cfop_padrao', rotulo: 'CFOP', dica: '5102, 5405…' },
  { chave: 'cst_icms', rotulo: 'CSOSN', dica: '102, 400, 500…' },
  { chave: 'cst_pis', rotulo: 'CST PIS', dica: '49…' },
  { chave: 'cst_cofins', rotulo: 'CST COFINS', dica: '49…' },
  { chave: 'cst_ibscbs', rotulo: 'CST IBS/CBS', dica: '000, 200, 410…' },
  { chave: 'cclasstrib', rotulo: 'cClassTrib', dica: '000001, 200003…' },
  { chave: 'ncm', rotulo: 'NCM' },
  { chave: 'cest', rotulo: 'CEST' },
];

const POR_PAGINA = 100;

const input = 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white';

const RevisaoFiscalLote: React.FC = () => {
  const { data: produtos = [], isLoading, error } = useProdutosRevisaoFiscal();
  const salvar = useAtualizarFiscalLote();

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'pendentes' | 'validados' | 'todos'>('pendentes');
  const [sugestao, setSugestao] = useState<string>('todas');
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [campos, setCampos] = useState<CamposFiscaisLote>({});
  const [resultado, setResultado] = useState<ResultadoLoteFiscal | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    return produtos.filter((p) => {
      if (status === 'pendentes' && p.fiscal_status === 'validado') return false;
      if (status === 'validados' && p.fiscal_status !== 'validado') return false;
      if (sugestao !== 'todas' && (p.ibscbs_sugestao ?? 'sem') !== sugestao) return false;
      if (!q) return true;
      return p.produto_nome.toLowerCase().includes(q) || (qd.length >= 2 && (p.ncm ?? '').startsWith(qd));
    });
  }, [produtos, busca, status, sugestao]);

  const paginaItens = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));

  // Pontos que o contador precisa olhar (dados importados)
  const alertas = useMemo(() => {
    const st = produtos.filter((p) => (p.cfop_padrao ?? '').startsWith('5405') && p.cst_icms === '400').length;
    const semPis = produtos.filter((p) => !(p.cst_pis ?? '').trim() || !(p.cst_cofins ?? '').trim()).length;
    const verificar = produtos.filter((p) => p.ibscbs_sugestao === 'verificar').length;
    return { st, semPis, verificar };
  }, [produtos]);

  const validados = produtos.filter((p) => p.fiscal_status === 'validado').length;

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selecionarFiltrados = () => setSel(new Set(filtrados.map((p) => p.id)));

  const aplicar = async (validar: boolean) => {
    if (sel.size === 0) {
      toast.error('Selecione os produtos.');
      return;
    }
    const enviar = camposPreenchidos(campos);
    if (!validar && Object.keys(enviar).length === 0) {
      toast.error('Preencha pelo menos um campo para aplicar.');
      return;
    }
    if (validar && !window.confirm(
      `Validar ${sel.size} produto(s)? Confirme que a classificação foi conferida (de preferência pelo contador). ` +
      'Os que tiverem pendência continuam pendentes.'
    )) return;
    try {
      const r = await salvar.mutateAsync({ ids: Array.from(sel), campos: enviar, validar });
      setResultado(r);
      toast.success(
        validar
          ? `${r.validados} validado(s)${r.erros.length ? `, ${r.erros.length} com pendência` : ''}.`
          : `${r.atualizados} produto(s) atualizado(s).`
      );
      if (validar) setSel(new Set(r.erros.map((e) => e.id)));
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'erro';
      toast.error('Não foi possível salvar: ' + msg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão fiscal em lote"
        description="Confira e valide a classificação dos produtos, inclusive IBS/CBS da reforma tributária. Só produto validado entra em NF-e."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Validados</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
            {validados} <span className="text-base font-normal text-gray-500">de {produtos.length}</span>
          </p>
        </div>
        <div className="lg:col-span-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Para conferir com o contador</p>
          <p>• IBS/CBS: o Simples Nacional só precisa informar a partir de 04/01/2027. Os códigos sugeridos (cesta básica 200/200003, padrão 000/000001) vieram de fontes não oficiais.</p>
          {alertas.st > 0 && <p>• {alertas.st} produto(s) com CFOP 5405 (substituição tributária) e CSOSN 400. Para ST o usual no Simples é CSOSN 500.</p>}
          {alertas.semPis > 0 && <p>• {alertas.semPis} produto(s) sem CST de PIS/COFINS. No Simples costuma ser 49; confirme.</p>}
          {alertas.verificar > 0 && <p>• {alertas.verificar} produto(s) com NCM que só entra na cesta básica conforme a descrição (pão francês, fórmulas, farinhas especiais).</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
            placeholder="Buscar por nome ou início do NCM"
            className={`${input} max-w-xs`}
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPagina(0); }} className={`${input} w-auto`}>
            <option value="pendentes">Pendentes</option>
            <option value="validados">Validados</option>
            <option value="todos">Todos</option>
          </select>
          <select value={sugestao} onChange={(e) => { setSugestao(e.target.value); setPagina(0); }} className={`${input} w-auto`}>
            <option value="todas">Todas as sugestões</option>
            <option value="cesta_basica">Cesta básica</option>
            <option value="padrao">Padrão</option>
            <option value="verificar">Verificar</option>
            <option value="manual">Manual</option>
            <option value="sem">Sem NCM</option>
          </select>
          <span className="text-sm text-gray-500">{filtrados.length} produto(s)</span>
          <button onClick={selecionarFiltrados} className="text-sm text-blue-600 hover:underline">Selecionar todos do filtro</button>
          {sel.size > 0 && (
            <button onClick={() => setSel(new Set())} className="text-sm text-gray-600 hover:underline">Limpar seleção ({sel.size})</button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {CAMPOS.map((c) => (
            <label key={c.chave} className="text-xs text-gray-600 dark:text-gray-400">
              {c.rotulo}
              <input
                value={campos[c.chave] ?? ''}
                onChange={(e) => setCampos((s) => ({ ...s, [c.chave]: e.target.value }))}
                placeholder={c.dica ?? 'manter'}
                className={input}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">{sel.size} selecionado(s). Campo vazio = não muda.</span>
          <button
            onClick={() => aplicar(false)}
            disabled={salvar.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Aplicar nos selecionados
          </button>
          <button
            onClick={() => aplicar(true)}
            disabled={salvar.isPending}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Aplicar e validar
          </button>
        </div>

        {resultado && resultado.erros.length > 0 && (
          <div className="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md p-3 max-h-40 overflow-auto">
            <p className="font-medium mb-1">{resultado.erros.length} produto(s) não validados (continuam selecionados):</p>
            {resultado.erros.slice(0, 50).map((e) => (
              <p key={e.id}>• {e.nome}: falta {e.faltando.join(', ')}</p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Carregando…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">Erro ao carregar os produtos.</p>
        ) : (
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">NCM</th>
                <th className="px-3 py-2 font-medium">CFOP</th>
                <th className="px-3 py-2 font-medium">CSOSN</th>
                <th className="px-3 py-2 font-medium">PIS/COFINS</th>
                <th className="px-3 py-2 font-medium">IBS/CBS</th>
                <th className="px-3 py-2 font-medium">Sugestão</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {paginaItens.map((p: ProdutoFiscalLinha) => {
                const pend = pendenciasFiscais(p);
                const sug = SUGESTAO[p.ibscbs_sugestao ?? ''];
                return (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} aria-label={`Selecionar ${p.produto_nome}`} />
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{p.produto_nome}</td>
                    <td className="px-3 py-2 tabular-nums">{p.ncm ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.cfop_padrao ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.cst_icms ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.cst_pis ?? '—'} / {p.cst_cofins ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{p.cst_ibscbs ?? '—'} / {p.cclasstrib ?? '—'}</td>
                    <td className="px-3 py-2">
                      {sug ? <span className={`px-2 py-0.5 rounded text-xs ${sug.cls}`}>{sug.rotulo}</span> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {p.fiscal_status === 'validado' ? (
                        <span className="text-green-700 dark:text-green-400">Validado</span>
                      ) : pend.length > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400">Falta {pend.join(', ')}</span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300">Pronto para validar</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-end gap-3 p-3 text-sm">
            <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Anterior</button>
            <span>{pagina + 1} / {totalPaginas}</span>
            <button disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Próxima</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevisaoFiscalLote;
