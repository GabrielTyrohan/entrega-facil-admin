import { describe, it, expect } from 'vitest';
import {
  getInicioPeriodo,
  getFimPeriodo,
  getPeriodoAtual,
  formatDateSQL,
  formatDateBR,
} from '../../utils/periodoFechamento';

describe('getInicioPeriodo', () => {
  it('deve calcular início do período com base no dia de fechamento', () => {
    const data = new Date(2024, 3, 15);
    const result = getInicioPeriodo(data, 10);
    expect(result).toBeInstanceOf(Date);
  });

  it('deve retornar dia 1 para diaFechamento inválido', () => {
    const data = new Date(2024, 3, 15);
    const result = getInicioPeriodo(data, 0);
    expect(result.getDate()).toBe(1);
  });

  it('deve retornar dia 1 para diaFechamento > 28', () => {
    const data = new Date(2024, 3, 15);
    const result = getInicioPeriodo(data, 30);
    expect(result.getDate()).toBe(1);
  });
});

describe('getFimPeriodo', () => {
  it('deve calcular fim do período corretamente', () => {
    const inicio = new Date(2024, 3, 10);
    const result = getFimPeriodo(inicio, 10);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(10);
  });
});

describe('getPeriodoAtual', () => {
  it('deve retornar objeto com inicio e fim', () => {
    const result = getPeriodoAtual(10);
    expect(result).toHaveProperty('inicio');
    expect(result).toHaveProperty('fim');
    expect(result.inicio).toBeInstanceOf(Date);
    expect(result.fim).toBeInstanceOf(Date);
  });
});

describe('formatDateSQL', () => {
  it('deve formatar Date como YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDateSQL(date);
    expect(result).toBe('2024-01-15');
  });

  it('deve adicionar padding zero para mês e dia', () => {
    const date = new Date(2024, 2, 5);
    const result = formatDateSQL(date);
    expect(result).toBe('2024-03-05');
  });
});

describe('formatDateBR', () => {
  it('deve formatar Date como DD/MM', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDateBR(date);
    expect(result).toBe('15/01');
  });

  it('deve adicionar padding zero', () => {
    const date = new Date(2024, 2, 5);
    const result = formatDateBR(date);
    expect(result).toBe('05/03');
  });
});
