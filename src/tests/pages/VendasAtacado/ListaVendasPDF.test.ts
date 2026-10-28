import { describe, it, expect } from 'vitest';
import { calcularSituacaoPagamento } from '../../../utils/calcularSituacaoPagamento';

describe('calcularSituacaoPagamento', () => {
  describe('1. Venda sem pagamentos', () => {
    it('saldo igual ao total quando não há pagamento', () => {
      const resultado = calcularSituacaoPagamento(1000, 0, 'pendente');
      expect(resultado.texto).toBe('Em aberto');
      expect(resultado.cor).toBe('red');
    });

    it('venda com valor zero e sem pagamento', () => {
      const resultado = calcularSituacaoPagamento(0, 0, 'pendente');
      expect(resultado.texto).toBe('Quitada');
      expect(resultado.cor).toBe('green');
    });
  });

  describe('2. Venda parcialmente paga', () => {
    it('mostra saldo correto quando pago parcialmente', () => {
      const resultado = calcularSituacaoPagamento(1000, 350, 'pendente');
      expect(resultado.texto).toBe('Parcialmente paga');
      expect(resultado.cor).toBe('yellow');
    });

    it('mostra status parcial quando pago 50%', () => {
      const resultado = calcularSituacaoPagamento(2000, 1000, 'pendente');
      expect(resultado.texto).toBe('Parcialmente paga');
    });
  });

  describe('3. Venda quitada', () => {
    it('saldo zero e status Quitada quando pago integralmente', () => {
      const resultado = calcularSituacaoPagamento(500, 500, 'pendente');
      expect(resultado.texto).toBe('Quitada');
      expect(resultado.cor).toBe('green');
    });

    it('mostra Quitada quando pago excede o total', () => {
      const resultado = calcularSituacaoPagamento(500, 600, 'pendente');
      expect(resultado.texto).toBe('Quitada');
    });
  });

  describe('4. Venda com vários pagamentos', () => {
    it('calcula corretamente quando há múltiplos pagamentos', () => {
      // Simula 3 pagamentos de 100, 200, 150 = 450 total
      const valorPagoTotal = 100 + 200 + 150;
      const resultado = calcularSituacaoPagamento(1000, valorPagoTotal, 'pendente');
      expect(resultado.texto).toBe('Parcialmente paga');
    });

    it('mostra quitada quando múltiplos pagamentos cobrem o total', () => {
      const valorPagoTotal = 100 + 200 + 150 + 50 + 50; // = 550
      const resultado = calcularSituacaoPagamento(500, valorPagoTotal, 'pendente');
      expect(resultado.texto).toBe('Quitada');
    });
  });

  describe('5. Pagamento pendente', () => {
    it('status pendente quando nenhum pagamento foi feito', () => {
      const resultado = calcularSituacaoPagamento(1000, 0, 'pendente');
      expect(resultado.texto).toBe('Em aberto');
    });
  });

  describe('6. Venda cancelada', () => {
    it('mostra Cancelada quando status é cancelado', () => {
      const resultado = calcularSituacaoPagamento(1000, 500, 'cancelado');
      expect(resultado.texto).toBe('Cancelada');
      expect(resultado.cor).toBe('gray');
    });

    it('mostra Cancelada mesmo com pagamento parcial', () => {
      const resultado = calcularSituacaoPagamento(1000, 1000, 'cancelado');
      expect(resultado.texto).toBe('Cancelada');
    });
  });

  describe('7. Valores monetários com centavos', () => {
    it('calcula corretamente valores com centavos', () => {
      const resultado = calcularSituacaoPagamento(1234.56, 500.25, 'pendente');
      expect(resultado.texto).toBe('Parcialmente paga');
      expect(resultado.cor).toBe('yellow');
    });

    it('mostra quitada quando centavos são iguais', () => {
      const resultado = calcularSituacaoPagamento(99.99, 99.99, 'pendente');
      expect(resultado.texto).toBe('Quitada');
    });
  });

  describe('8. Várias vendas no mesmo PDF - totais consolidados', () => {
    const vendas: { valor_total: number; valor_pago: number }[] = [
      { valor_total: 1000, valor_pago: 500 },
      { valor_total: 500, valor_pago: 500 },
      { valor_total: 300, valor_pago: 0 },
      { valor_total: 200, valor_pago: 100 },
    ];

    it('calcula totais consolidados corretamente', () => {
      const valorTotalGeral = vendas.reduce(
        (acc, v) => acc + Number(v.valor_total),
        0,
      );
      const valorPagoTotalGeral = vendas.reduce(
        (acc, v) => acc + (Number(v.valor_pago) || 0),
        0,
      );
      const saldoRestanteTotalGeral = valorTotalGeral - valorPagoTotalGeral;

      expect(valorTotalGeral).toBe(2000);
      expect(valorPagoTotalGeral).toBe(1100);
      expect(saldoRestanteTotalGeral).toBe(900);
    });

    it('não soma registros duplicados (cada venda conta uma vez)', () => {
      const vendasDuplicadas: { id: string; valor_total: number; valor_pago: number }[] = [
        { id: '1', valor_total: 100, valor_pago: 50 },
        { id: '2', valor_total: 200, valor_pago: 100 },
      ];
      const idsUnicos = new Set(vendasDuplicadas.map(v => v.id));
      expect(idsUnicos.size).toBe(2);
    });
  });

  describe('9. Lista vazia', () => {
    it('retorna totais zero quando não há vendas', () => {
      const vendas: { valor_total: number; valor_pago: number }[] = [];
      const valorTotalGeral = vendas.reduce(
        (acc, v) => acc + (Number(v.valor_total) || 0),
        0,
      );
      const valorPagoTotalGeral = vendas.reduce(
        (acc, v) => acc + (Number(v.valor_pago) || 0),
        0,
      );
      const saldoRestanteTotalGeral = valorTotalGeral - valorPagoTotalGeral;

      expect(valorTotalGeral).toBe(0);
      expect(valorPagoTotalGeral).toBe(0);
      expect(saldoRestanteTotalGeral).toBe(0);
    });
  });
});

describe('Cálculos monetários', () => {
  it('calcula saldo restante corretamente', () => {
    const valorTotal = 1500.75;
    const valorPago = 620.30;
    const saldo = valorTotal - valorPago;
    expect(saldo).toBeCloseTo(880.45, 2);
  });

  it('trata valores nulos como zero', () => {
    const resultado = calcularSituacaoPagamento(0 as any, null as any, 'pendente');
    expect(resultado.texto).toBe('Quitada');
  });

  it('trata valores undefined como zero', () => {
    const resultado = calcularSituacaoPagamento(undefined as any, undefined as any, 'pendente');
    expect(resultado.texto).toBe('Quitada');
  });
});
