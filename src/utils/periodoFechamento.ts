export function getInicioPeriodo(data: Date, diaFechamento: number): Date {
  const dia = diaFechamento <= 0 || diaFechamento > 28 ? 1 : diaFechamento;
  if (dia === 1) return new Date(data.getFullYear(), data.getMonth(), 1);
  const d = new Date(data.getTime());
  d.setHours(0, 0, 0, 0);
  if (d.getDate() >= dia) return new Date(d.getFullYear(), d.getMonth(), dia);
  return new Date(d.getFullYear(), d.getMonth() - 1, dia);
}

export function getFimPeriodo(inicioPeriodo: Date, diaFechamento: number): Date {
  const dia = diaFechamento <= 0 || diaFechamento > 28 ? 1 : diaFechamento;
  if (dia === 1) return new Date(inicioPeriodo.getFullYear(), inicioPeriodo.getMonth() + 1, 1);
  return new Date(inicioPeriodo.getFullYear(), inicioPeriodo.getMonth() + 1, dia);
}

export function getPeriodoAtual(diaFechamento: number): { inicio: Date; fim: Date } {
  const hoje = new Date();
  const inicio = getInicioPeriodo(hoje, diaFechamento);
  const fim = getFimPeriodo(inicio, diaFechamento);
  return { inicio, fim };
}

export function formatDateSQL(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}
