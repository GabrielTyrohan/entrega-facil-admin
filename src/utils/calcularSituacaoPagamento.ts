export interface SituacaoPagamento {
  texto: string;
  cor: 'green' | 'red' | 'yellow' | 'gray';
}

/**
 * Calcula a situação do pagamento de uma venda baseado no valor total,
 * valor pago e status atual.
 *
 * Regras:
 * - Cancelado: sempre "Cancelada", independente do valor pago
 * - Saldo <= 0: "Quitada" (verde)
 * - Saldo > 0 e valorPago > 0: "Parcialmente paga" (amarelo)
 * - Saldo > 0 e valorPago = 0: "Em aberto" (vermelho)
 *
 * Não apresenta saldo negativo; pagamentos excedentes resultam em "Quitada".
 */
export function calcularSituacaoPagamento(
  valorTotal: number,
  valorPago: number,
  statusPagamento: string,
): SituacaoPagamento {
  const saldo = Number(valorTotal || 0) - Number(valorPago || 0);

  if (statusPagamento === 'cancelado') {
    return { texto: 'Cancelada', cor: 'gray' };
  }
  if (saldo <= 0) {
    return { texto: 'Quitada', cor: 'green' };
  }
  if (valorPago > 0) {
    return { texto: 'Parcialmente paga', cor: 'yellow' };
  }
  return { texto: 'Em aberto', cor: 'red' };
}
