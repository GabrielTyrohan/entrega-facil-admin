import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/currencyUtils';
import { useAuth } from '@/contexts/AuthContext';
import { lerXmlNfeCompra } from '@/utils/lerXmlNfeCompra';
import {
  buscarVinculosFornecedor,
  ProdutoParaCompra,
  useProdutosParaCompra,
  useRegistrarCompra,
} from '@/hooks/useCompras';

interface Linha {
  chave: string;
  codigo_fornecedor: string;
  ean: string | null;
  ncm: string | null;
  descricao_nota: string;
  unidade_nota: string;
  quantidade_nota: number;
  valor_total: number;
  fator: number;
  produtoId: string | null;
  busca: string;
  /** como o produto foi ligado: vinculo (lembrado), ean ou manual */
  ligadoPor?: 'vinculo' | 'ean' | 'manual';
}

const rotuloProduto = (p: ProdutoParaCompra) =>
  `${p.produto_nome}${p.codigo_barras ? ` · ${p.codigo_barras}` : ''}`;

const novaLinha = (): Linha => ({
  chave: crypto.randomUUID(),
  codigo_fornecedor: '',
  ean: null,
  ncm: null,
  descricao_nota: '',
  unidade_nota: 'UN',
  quantidade_nota: 1,
  valor_total: 0,
  fator: 1,
  produtoId: null,
  busca: '',
});

const inputClass =
  'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white';

function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Erro desconhecido';
}

const NovaCompra: React.FC = () => {
  const navigate = useNavigate();
  const { adminId } = useAuth();
  const { data: produtos = [] } = useProdutosParaCompra();
  const registrar = useRegistrarCompra();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [origem, setOrigem] = useState<'manual' | 'xml'>('manual');
  const [fornecedor, setFornecedor] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [numeroNota, setNumeroNota] = useState('');
  const [serie, setSerie] = useState('');
  const [chave, setChave] = useState<string | null>(null);
  const [dataEmissao, setDataEmissao] = useState<string | null>(null);
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);

  const porRotulo = useMemo(() => new Map(produtos.map((p) => [rotuloProduto(p), p])), [produtos]);
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const porEan = useMemo(() => {
    const m = new Map<string, ProdutoParaCompra>();
    produtos.forEach((p) => {
      const ean = (p.codigo_barras ?? '').replace(/\D/g, '');
      if (ean) m.set(ean, p);
    });
    return m;
  }, [produtos]);

  const atualizar = (chaveLinha: string, mudanca: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chaveLinha ? { ...l, ...mudanca } : l)));

  const escolherProduto = (l: Linha, texto: string) => {
    const p = porRotulo.get(texto);
    atualizar(l.chave, { busca: texto, produtoId: p?.id ?? null, ligadoPor: p ? 'manual' : undefined });
  };

  const importarXml = async (arquivo: File) => {
    try {
      const nota = lerXmlNfeCompra(await arquivo.text());
      const vinculos = adminId && nota.fornecedor_cnpj
        ? await buscarVinculosFornecedor(adminId, nota.fornecedor_cnpj)
        : [];
      const vinculoPorCodigo = new Map(vinculos.map((v) => [v.codigo_fornecedor, v]));

      setOrigem('xml');
      setFornecedor(nota.fornecedor_nome);
      setCnpj(nota.fornecedor_cnpj ?? '');
      setNumeroNota(nota.numero_nota ?? '');
      setSerie(nota.serie ?? '');
      setChave(nota.chave_acesso);
      setDataEmissao(nota.data_emissao);
      setLinhas(
        nota.itens.map((it) => {
          const vinc = vinculoPorCodigo.get(it.codigo_fornecedor);
          const pVinc = vinc ? porId.get(vinc.produto_cadastrado_id) : undefined;
          const pEan = !pVinc && it.ean ? porEan.get(it.ean) : undefined;
          const p = pVinc ?? pEan;
          return {
            chave: crypto.randomUUID(),
            codigo_fornecedor: it.codigo_fornecedor,
            ean: it.ean,
            ncm: it.ncm,
            descricao_nota: it.descricao,
            unidade_nota: it.unidade,
            quantidade_nota: it.quantidade,
            valor_total: it.valor_total,
            fator: vinc?.fator_conversao ?? 1,
            produtoId: p?.id ?? null,
            busca: p ? rotuloProduto(p) : '',
            ligadoPor: pVinc ? 'vinculo' : pEan ? 'ean' : undefined,
          };
        })
      );
      const semProduto = nota.itens.length - nota.itens.filter((it) =>
        vinculoPorCodigo.has(it.codigo_fornecedor) || (it.ean && porEan.has(it.ean))).length;
      toast.success(
        semProduto > 0
          ? `Nota lida: ${nota.itens.length} itens. Escolha o produto de ${semProduto} item(ns).`
          : `Nota lida: ${nota.itens.length} itens, todos ligados a produtos.`
      );
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const totalCompra = linhas.reduce((a, l) => a + (Number(l.valor_total) || 0), 0);
  const pendentes = linhas.filter((l) => !l.produtoId).length;

  const salvar = async () => {
    if (!fornecedor.trim()) {
      toast.error('Informe o fornecedor.');
      return;
    }
    if (linhas.length === 0 || pendentes > 0) {
      toast.error(pendentes > 0 ? `Escolha o produto de ${pendentes} item(ns).` : 'Adicione pelo menos 1 item.');
      return;
    }
    if (linhas.some((l) => !(l.quantidade_nota > 0) || !(l.fator > 0) || l.valor_total < 0)) {
      toast.error('Confira quantidades, fator e valores dos itens.');
      return;
    }
    try {
      const res = await registrar.mutateAsync({
        compra: {
          origem,
          fornecedor_nome: fornecedor.trim(),
          fornecedor_cnpj: cnpj || null,
          numero_nota: numeroNota || null,
          serie: serie || null,
          chave_acesso: chave,
          data_emissao: dataEmissao,
          data_entrada: dataEntrada,
          observacao: observacao || null,
        },
        itens: linhas.map((l) => ({
          produto_cadastrado_id: l.produtoId!,
          quantidade_nota: Number(l.quantidade_nota),
          fator_conversao: Number(l.fator),
          valor_total: Number(l.valor_total),
          codigo_fornecedor: l.codigo_fornecedor || null,
          ean: l.ean,
          ncm: l.ncm,
          descricao_nota: l.descricao_nota || null,
          unidade_nota: l.unidade_nota || null,
        })),
      });
      toast.success(`Compra lançada: ${res.itens} item(ns), ${formatCurrency(Number(res.valor_total))}. Estoque atualizado.`);
      navigate('/estoque/compras');
    } catch (e) {
      toast.error('Não foi possível lançar: ' + mensagemErro(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lançar compra"
        description="Envie o XML da nota do mercado ou digite os itens. A entrada soma no estoque e atualiza o custo médio."
        actions={
          <button
            onClick={() => navigate('/estoque/compras')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={arquivoRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importarXml(e.target.files[0])}
          />
          <button
            onClick={() => arquivoRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileUp className="w-4 h-4" /> Ler XML da nota
          </button>
          {chave && (
            <span className="text-xs text-gray-500 dark:text-gray-400 break-all">Chave: {chave}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm lg:col-span-2">
            <span className="text-gray-700 dark:text-gray-300">Fornecedor (mercado) *</span>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="text-gray-700 dark:text-gray-300">CNPJ</span>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ''))} className={inputClass} inputMode="numeric" />
          </label>
          <label className="text-sm">
            <span className="text-gray-700 dark:text-gray-300">Data de entrada</span>
            <input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="text-gray-700 dark:text-gray-300">Nº da nota</span>
            <input value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="text-gray-700 dark:text-gray-300">Série</span>
            <input value={serie} onChange={(e) => setSerie(e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm lg:col-span-2">
            <span className="text-gray-700 dark:text-gray-300">Observação</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputClass} />
          </label>
        </div>
      </div>

      <datalist id="produtos-compra">
        {produtos.map((p) => <option key={p.id} value={rotuloProduto(p)} />)}
      </datalist>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="min-w-[120px] px-3 py-2 font-medium">Item da nota</th>
              <th className="px-3 py-2 font-medium w-48 xl:w-72">Produto no estoque *</th>
              <th className="px-3 py-2 font-medium w-20 xl:w-24 text-right whitespace-nowrap">Qtd nota</th>
              <th className="px-3 py-2 font-medium w-20 xl:w-24 text-right" title="Quantas unidades do estoque vêm em cada unidade da nota (ex.: fardo com 10)">Fator</th>
              <th className="px-3 py-2 font-medium text-right xl:w-24">Entra</th>
              <th className="px-3 py-2 font-medium w-24 xl:w-28 text-right whitespace-nowrap">Valor total</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap xl:w-24">Custo un.</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const entra = (Number(l.quantidade_nota) || 0) * (Number(l.fator) || 0);
              const custo = entra > 0 ? (Number(l.valor_total) || 0) / entra : 0;
              const prod = l.produtoId ? porId.get(l.produtoId) : undefined;
              return (
                <tr key={l.chave} className="border-b border-gray-100 dark:border-gray-700/60 align-top">
                  <td className="px-3 py-2">
                    <input
                      value={l.descricao_nota}
                      onChange={(e) => atualizar(l.chave, { descricao_nota: e.target.value })}
                      placeholder="Descrição (opcional)"
                      className={inputClass}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {l.codigo_fornecedor && <>Cód. {l.codigo_fornecedor} · </>}
                      {l.ean && <>EAN {l.ean} · </>}
                      {l.unidade_nota}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      list="produtos-compra"
                      value={l.busca}
                      onChange={(e) => escolherProduto(l, e.target.value)}
                      placeholder="Digite para buscar…"
                      className={`${inputClass} ${!l.produtoId ? 'border-amber-400' : ''}`}
                    />
                    <div className="text-xs mt-1">
                      {prod ? (
                        <span className="text-gray-500">
                          Estoque: {prod.qtd_estoque ?? 0} {prod.unidade_medida ?? ''}
                          {l.ligadoPor === 'vinculo' && ' · ligado pela última compra'}
                          {l.ligadoPor === 'ean' && ' · ligado pelo código de barras'}
                        </span>
                      ) : (
                        <span className="text-amber-600">Escolha o produto</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step="any" value={l.quantidade_nota}
                      onChange={(e) => atualizar(l.chave, { quantidade_nota: Number(e.target.value) })}
                      className={`${inputClass} text-right`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step="any" value={l.fator}
                      onChange={(e) => atualizar(l.chave, { fator: Number(e.target.value) })}
                      className={`${inputClass} text-right`} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white pt-3.5">{entra}</td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step="0.01" value={l.valor_total}
                      onChange={(e) => atualizar(l.chave, { valor_total: Number(e.target.value) })}
                      className={`${inputClass} text-right`} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-300 pt-3.5">{formatCurrency(custo)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          <button
            onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Plus className="w-4 h-4" /> Adicionar item
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Total: <strong className="tabular-nums">{formatCurrency(totalCompra)}</strong>
            </span>
            <button
              onClick={salvar}
              disabled={registrar.isPending}
              className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {registrar.isPending ? 'Lançando…' : 'Lançar no estoque'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NovaCompra;
