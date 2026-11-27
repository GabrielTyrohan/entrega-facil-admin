import { describe, expect, it } from 'vitest';
import { calcularParcelas, proximaParcela } from '@/utils/parcelas';

describe('calcularParcelas', () => {
  it('divide igualmente quando dá certo', () => {
    expect(calcularParcelas(300, 3)).toEqual([100, 100, 100]);
  });
  it('joga a sobra do arredondamento na última parcela', () => {
    const p = calcularParcelas(100, 3);
    expect(p).toEqual([33.33, 33.33, 33.34]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });
  it('1x é o total', () => {
    expect(calcularParcelas(59.9, 1)).toEqual([59.9]);
  });
  it('quantidade inválida vira 1x', () => {
    expect(calcularParcelas(50, 0)).toEqual([50]);
  });
});

describe('proximaParcela', () => {
  it('primeira parcela', () => {
    expect(proximaParcela(100, 3, 0, 100)).toBe(33.33);
  });
  it('última parcela leva a sobra', () => {
    expect(proximaParcela(100, 3, 2, 33.34)).toBe(33.34);
  });
  it('nunca passa do que falta pagar', () => {
    expect(proximaParcela(300, 3, 1, 50)).toBe(50);
  });
  it('pagamentos a mais que as parcelas usam a última', () => {
    expect(proximaParcela(300, 3, 5, 20)).toBe(20);
  });
});
