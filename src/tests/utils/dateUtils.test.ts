import { describe, it, expect } from 'vitest';
import {
  toSaoPauloDateString,
  getSaoPauloDateRange,
  startOfDayUTC3,
  endOfDayUTC3,
  isDateInRangeUTC3,
  parseToUTC3,
} from '../../utils/dateUtils';

describe('toSaoPauloDateString', () => {
  it('deve formatar Date como YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const result = toSaoPauloDateString(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getSaoPauloDateRange', () => {
  it('deve retornar range de início e fim do dia', () => {
    const result = getSaoPauloDateRange('2024-01-15');
    expect(result.inicio).toBe('2024-01-15T00:00:00-03:00');
    expect(result.fim).toBe('2024-01-15T23:59:59-03:00');
  });
});

describe('startOfDayUTC3', () => {
  it('deve retornar início do dia', () => {
    const date = new Date('2024-01-15T10:30:00');
    const result = startOfDayUTC3(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('endOfDayUTC3', () => {
  it('deve retornar final do dia', () => {
    const date = new Date('2024-01-15T10:30:00');
    const result = endOfDayUTC3(date);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });
});

describe('isDateInRangeUTC3', () => {
  it('deve retornar true quando a data está no intervalo', () => {
    const date = new Date('2024-01-15');
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(isDateInRangeUTC3(date, start, end)).toBe(true);
  });

  it('deve retornar false quando a data está antes do intervalo', () => {
    const date = new Date('2023-12-31');
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(isDateInRangeUTC3(date, start, end)).toBe(false);
  });

  it('deve retornar false quando a data está depois do intervalo', () => {
    const date = new Date('2024-02-01');
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(isDateInRangeUTC3(date, start, end)).toBe(false);
  });

  it('deve retornar true quando a data é igual ao início', () => {
    const date = new Date('2024-01-01');
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(isDateInRangeUTC3(date, start, end)).toBe(true);
  });

  it('deve retornar true quando a data é igual ao fim', () => {
    const date = new Date('2024-01-31');
    const start = new Date('2024-01-01');
    const end = new Date('2024-01-31');
    expect(isDateInRangeUTC3(date, start, end)).toBe(true);
  });
});

describe('parseToUTC3', () => {
  it('deve converter string para Date', () => {
    const result = parseToUTC3('2024-01-15');
    expect(result).toBeInstanceOf(Date);
  });
});
