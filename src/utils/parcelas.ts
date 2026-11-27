/** Divide o total em parcelas em centavos; a diferença do arredondamento vai na última. */
export function calcularParcelas(total: number, vezes: number): number[] {
  const n = Math.max(1, Math.trunc(vezes) || 1);
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? centavos - base * (n - 1) : base) / 100);
}

/**
 * Valor sugerido para o próximo pagamento de uma venda parcelada: a parcela da vez
 * (pela quantidade de pagamentos já lançados), nunca maior que o que falta pagar.
 */
export function proximaParcela(total: number, vezes: number, pagamentosFeitos: number, saldo: number): number {
  const parcelas = calcularParcelas(total, vezes);
  const valor = parcelas[Math.min(Math.max(0, pagamentosFeitos), parcelas.length - 1)];
  return Math.round(Math.min(valor, Math.max(0, saldo)) * 100) / 100;
}
