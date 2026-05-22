import { describe, it, expect } from 'vitest';
import { formatCurrency, parseCurrency, applyCurrencyMask, currencyMaskToNumber } from '../../utils/currencyUtils';

const NBSP = '\u00a0';

describe('formatCurrency', () => {
  it('deve formatar 1500.5 como "R$ 1.500,50"', () => {
    const result = formatCurrency(1500.5);
    expect(result).toBe(`R$${NBSP}1.500,50`);
  });

  it('deve formatar 0 como "R$ 0,00"', () => {
    const result = formatCurrency(0);
    expect(result).toBe(`R$${NBSP}0,00`);
  });

  it('deve formatar valores negativos corretamente', () => {
    const result = formatCurrency(-250.75);
    expect(result).toBe(`-R$${NBSP}250,75`);
  });

  it('deve formatar valores inteiros', () => {
    const result = formatCurrency(100);
    expect(result).toBe(`R$${NBSP}100,00`);
  });

  it('deve formatar valores com muitos decimais', () => {
    const result = formatCurrency(99.999);
    expect(result).toBe(`R$${NBSP}100,00`);
  });
});

describe('parseCurrency', () => {
  it('deve converter valor com vírgula', () => {
    const result = parseCurrency('2500,50');
    expect(result).toBe(2500.5);
  });

  it('deve retornar 0 para string vazia', () => {
    const result = parseCurrency('');
    expect(result).toBe(0);
  });

  it('deve retornar 0 para string inválida', () => {
    const result = parseCurrency('abc');
    expect(result).toBe(0);
  });

  it('deve converter valor sem formatação', () => {
    const result = parseCurrency('2500.75');
    expect(result).toBe(2500.75);
  });

  it('deve retornar valor mesmo com separador de milhar (ponto mantido)', () => {
    const result = parseCurrency('1.500,50');
    expect(result).toBe(1.5);
  });
});

describe('applyCurrencyMask', () => {
  it('deve aplicar máscara para dígitos', () => {
    const result = applyCurrencyMask('150050');
    expect(result).toBe(`R$${NBSP}1.500,50`);
  });

  it('deve retornar string vazia para entrada vazia', () => {
    const result = applyCurrencyMask('');
    expect(result).toBe('');
  });

  it('deve ignorar caracteres não-dígitos', () => {
    const result = applyCurrencyMask('1a2b3c');
    expect(result).toBe(`R$${NBSP}1,23`);
  });
});

describe('currencyMaskToNumber', () => {
  it('deve converter "R$ 1.500,50" para 1500.5', () => {
    const result = currencyMaskToNumber('R$ 1.500,50');
    expect(result).toBe(1500.5);
  });

  it('deve retornar 0 para string vazia', () => {
    const result = currencyMaskToNumber('');
    expect(result).toBe(0);
  });

  it('deve converter valor sem símbolo', () => {
    const result = currencyMaskToNumber('1.500,50');
    expect(result).toBe(1500.5);
  });
});
