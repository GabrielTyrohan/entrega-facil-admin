import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, Store } from 'lucide-react';
import { toast } from '@/utils/toast';
import { useClientesPJ, useDefinirModeloVendedor, type ModeloVenda } from '@/hooks/useRevendedores';

interface Props {
  vendedorId: string;
  modeloAtual: ModeloVenda;
  clientePjAtual: string | null;
  /** vendedores.cpf_cnpj: preenche o campo quando o revendedor ainda não tem cadastro PJ ligado. */
  cnpjVendedor?: string | null;
  /** Só o dono troca o modelo; funcionárias veem a informação. */
  podeAlterar: boolean;
  onAlterado?: () => void;
}

function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Erro desconhecido';
}

const nomeCliente = (c: { razao_social: string | null; nome_fantasia: string | null; nome: string | null }) =>
  c.razao_social || c.nome_fantasia || c.nome || 'Sem nome';

const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/** 00.000.000/0000-00 enquanto digita. */
export function mascaraCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Fase 9 — modelo de venda do vendedor.
 * Consignado: recebe cestas e avulsos do dono, o dinheiro das vendas é do dono e ganha comissão.
 * Revendedor: compra do dono por Venda PJ (pelo valor dos produtos da cesta) e fica com o dinheiro.
 */
const ModeloVendaCard: React.FC<Props> = ({ vendedorId, modeloAtual, clientePjAtual, cnpjVendedor, podeAlterar, onAlterado }) => {
  const [modelo, setModelo] = useState<ModeloVenda>(modeloAtual);
  const { data: clientesPJ = [] } = useClientesPJ(!!clientePjAtual);
  const definir = useDefinirModeloVendedor();

  // Cadastro PJ já ligado ao revendedor (só para mostrar).
  const ligado = useMemo(() => clientesPJ.find((c) => c.id === clientePjAtual) ?? null, [clientesPJ, clientePjAtual]);
  const cnpjLigado = soDigitos(ligado?.cnpj);
  const cnpjInicial = cnpjLigado || (soDigitos(cnpjVendedor).length === 14 ? soDigitos(cnpjVendedor) : '');
  const [cnpj, setCnpj] = useState<string>(mascaraCnpj(cnpjInicial));

  useEffect(() => {
    setModelo(modeloAtual);
  }, [modeloAtual]);
  useEffect(() => {
    setCnpj(mascaraCnpj(cnpjInicial));
  }, [cnpjInicial]);

  const digitos = soDigitos(cnpj);
  const mudou = modelo !== modeloAtual || (modelo === 'revendedor' && digitos !== cnpjLigado);

  const salvar = async () => {
    if (modelo === 'revendedor' && digitos.length !== 14) {
      toast.error('Informe o CNPJ do revendedor (14 números)');
      return;
    }
    try {
      await definir.mutateAsync({ vendedorId, modelo, cnpj: modelo === 'revendedor' ? digitos : null });
      toast.success(modelo === 'revendedor' ? 'Vendedor agora é revendedor' : 'Vendedor voltou ao modelo consignado');
      onAlterado?.();
    } catch (e) {
      toast.error('Não foi possível trocar o modelo: ' + mensagemErro(e));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3 mb-4">
        <Repeat className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Modelo de venda</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Modelo de venda">
        {([
          {
            valor: 'consignado' as const,
            titulo: 'Consignado',
            texto: 'Recebe cestas e avulsos da empresa. O dinheiro das vendas é da empresa e ele ganha comissão.',
          },
          {
            valor: 'revendedor' as const,
            titulo: 'Revendedor (com CNPJ)',
            texto: 'Compra da empresa pelo valor dos produtos da cesta, define o próprio preço e fica com o dinheiro das vendas.',
          },
        ]).map((op) => {
          const ativo = modelo === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={!podeAlterar || definir.isPending}
              onClick={() => setModelo(op.valor)}
              className={`rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                ativo
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
              }`}
            >
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">{op.titulo}</span>
              <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-400">{op.texto}</span>
            </button>
          );
        })}
      </div>

      {modelo === 'revendedor' && (
        <div className="mt-4 space-y-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              CNPJ do revendedor *
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(mascaraCnpj(e.target.value))}
              disabled={!podeAlterar || definir.isPending}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          {ligado && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Ligado ao cadastro <span className="font-medium">{nomeCliente(ligado)}</span>.
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            É o CNPJ da empresa do próprio revendedor: as compras dele são vendas PJ para esse CNPJ. O sistema usa o
            cadastro PJ com esse CNPJ ou cria um com os dados do vendedor. Esse cadastro não aparece como cliente no
            app dele. Para completar os dados fiscais, edite em{' '}
            <Link to="/clientes" className="text-blue-600 hover:underline dark:text-blue-400">Clientes</Link>.
          </p>
        </div>
      )}

      {podeAlterar && mudou && (
        <div className="mt-4 space-y-3">
          <div className="rounded-md bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Store className="mr-1.5 inline h-4 w-4" />
            {modelo === 'revendedor'
              ? 'Para trocar, o vendedor precisa estar sem cestas e itens em estoque. Depois da troca: as entregas novas dele não entram no faturamento nem na comissão, ele paga a própria assinatura do app e só recebe mercadoria por venda. As entregas antigas continuam da empresa.'
              : 'Para voltar ao consignado, o vendedor precisa estar sem cestas e itens em estoque. As entregas feitas como revendedor continuam dele.'}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={salvar}
              disabled={definir.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {definir.isPending ? 'Salvando…' : 'Confirmar modelo de venda'}
            </button>
          </div>
        </div>
      )}

      {!podeAlterar && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Só o dono da empresa pode trocar o modelo de venda.</p>
      )}
    </div>
  );
};

export default ModeloVendaCard;
