import React, { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import {
  ConsumoFiscal,
  nivelConsumo,
  obterConsumoFiscal,
  textoSemLimite,
  percentualUsado,
} from '@/services/contoraConfigService';

const CORES = {
  ok: { barra: 'bg-green-500', texto: 'text-green-700 dark:text-green-400' },
  atencao: { barra: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400' },
  critico: { barra: 'bg-red-500', texto: 'text-red-700 dark:text-red-400' },
  bloqueado: { barra: 'bg-red-700', texto: 'text-red-800 dark:text-red-300' },
};

const MENSAGEM = {
  ok: null,
  atencao: 'Mais de 80% das notas do mês já foram usadas.',
  critico: 'As notas do mês estão quase acabando.',
  bloqueado: 'O limite de notas do mês foi atingido. Novas notas ficam bloqueadas até o próximo mês ou até liberar mais.',
};

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Fase 6e — "Notas do mês": consumo de eventos fiscais na Fiscal Contora.
 * O limite é da conta fiscal do sistema (as empresas dividem); mostramos o
 * total da conta e, quando a Contora informa, quantas foram desta empresa.
 */
const CardNotasDoMes: React.FC = () => {
  const [consumo, setConsumo] = useState<ConsumoFiscal | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await obterConsumoFiscal();
      setConsumo(r.consumo);
      setAviso(r.atualizado ? null : 'Não foi possível consultar agora; mostrando o último valor salvo.');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Erro ao consultar o consumo de notas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nivel = consumo ? nivelConsumo(consumo) : 'ok';
  const pct = consumo ? percentualUsado(consumo) : null;
  const cor = CORES[nivel];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Notas do mês
        </h2>
        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
          aria-label="Atualizar consumo de notas"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {carregando && !consumo ? (
        <p className="text-sm text-gray-500">Consultando…</p>
      ) : !consumo || consumo.limite === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {aviso ?? textoSemLimite(consumo)}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold tabular-nums ${cor.texto}`}>{consumo.restantes ?? '—'}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              restantes · {consumo.usados ?? 0} de {consumo.limite} usadas
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${cor.barra}`} style={{ width: `${pct ?? 0}%` }} />
          </div>
          {consumo.eventos_empresa !== null && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Desta empresa: {consumo.eventos_empresa}</p>
          )}
          {MENSAGEM[nivel] && <p className={`text-sm font-medium ${cor.texto}`}>{MENSAGEM[nivel]}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Limite da conta fiscal do sistema (dividido entre as empresas). Atualizado em {dataHora(consumo.atualizado_em)}.
            {aviso ? ` ${aviso}` : ''}
          </p>
        </>
      )}
    </div>
  );
};

export default CardNotasDoMes;
