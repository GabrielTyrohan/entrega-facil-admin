// ============================================
// ARQUIVO: src/components/ui/lista.tsx
// Peças do padrão novo para telas de lista (guia de estilo aprovado em 18/11/2026):
// busca, chips de filtro com contagem, estilos de tabela, botões e painel lateral.
// ============================================

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import React from 'react';

// ---------- estilos reutilizáveis ----------
export const cls = {
  card: 'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800',
  th: 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap',
  thR: 'px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap',
  td: 'px-4 py-3 text-[13px] text-gray-700 dark:text-gray-300',
  tdR: 'px-4 py-3 text-right font-mono text-[13px] tabular-nums text-gray-900 dark:text-white',
  thead: 'border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
  tbody: 'divide-y divide-gray-200 dark:divide-gray-700',
  tr: 'group transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40',
  /** Ações da linha: discretas até passar o mouse ou focar com o teclado. */
  rowActions: 'flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
  btn: 'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  btnPri: 'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50',
  btnGhost: 'inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
  select: 'h-8 rounded-md border border-gray-200 bg-white px-2.5 text-[13px] text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
};

export type Tom = 'neutro' | 'ok' | 'atencao' | 'perigo' | 'destaque';
const TOM: Record<Tom, string> = {
  neutro: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  ok: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  atencao: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  perigo: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  destaque: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
};

/** Etiqueta de estado (sempre com texto, nunca só cor). */
export function Etiqueta({ tom = 'neutro', children, className = '' }: { tom?: Tom; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ${TOM[tom]} ${className}`}>
      {children}
    </span>
  );
}

// ---------- cabeçalho de página ----------
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{titulo}</h1>
          {descricao && <p className="text-sm text-gray-500 dark:text-gray-400">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acoes}</div>}
      </div>
      {children}
    </div>
  );
}

/** Números de resumo ao lado do título (ex.: Total devido · Devedores). */
export function Resumo({ itens }: { itens: { rotulo: string; valor: React.ReactNode; tom?: 'perigo' | 'normal' }[] }) {
  return (
    <dl className="flex items-end gap-6">
      {itens.map((i) => (
        <div key={i.rotulo} className="text-right">
          <dt className="text-xs text-gray-400">{i.rotulo}</dt>
          <dd className={`font-mono text-lg font-semibold tabular-nums ${i.tom === 'perigo' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- barra de filtros ----------
export function Busca({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative flex h-8 min-w-[220px] items-center ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-7 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpar busca" className="absolute right-1.5 rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export interface ChipOpcao<T extends string> {
  valor: T;
  rotulo: string;
  contagem?: number;
}

/** Filtros de um clique com contagem. */
export function Chips<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: ChipOpcao<T>[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.valor)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors ${
              ativo
                ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            {o.rotulo}
            {o.contagem !== undefined && <span className="font-mono text-[11px] opacity-70">{o.contagem}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function BarraFiltros({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

// ---------- estados ----------
export function Vazio({ icone: Icone, titulo, texto, acao }: { icone: React.ComponentType<{ className?: string }>; titulo: string; texto?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
        <Icone className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-[13px] text-gray-500 dark:text-gray-400">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

// ---------- painel lateral ----------
export function PainelLateral({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 'max-w-[440px]',
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-gray-950/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          {...(descricao ? {} : { 'aria-describedby': undefined })}
          className={`fixed inset-y-0 right-0 z-[61] flex w-full ${largura} flex-col border-l border-gray-200 bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8 dark:border-gray-700 dark:bg-gray-800`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-semibold text-gray-900 dark:text-white">{titulo}</DialogPrimitive.Title>
              {descricao && <DialogPrimitive.Description className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{descricao}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close aria-label="Fechar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {rodape && <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">{rodape}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
