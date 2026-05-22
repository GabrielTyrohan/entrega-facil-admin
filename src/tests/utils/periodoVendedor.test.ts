import { describe, it, expect } from 'vitest';
import { calcularPeriodoVendedor } from '../../utils/periodoVendedor';

describe('calcularPeriodoVendedor', () => {
  it('deve calcular período corretamente quando diaHoje >= diaFechamento', () => {
    const result = calcularPeriodoVendedor(10);
    expect(result).toHaveProperty('periodoInicio');
    expect(result).toHaveProperty('periodoFim');
    expect(result.periodoInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.periodoFim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('deve retornar strings no formato YYYY-MM-DD', () => {
    const result = calcularPeriodoVendedor(5);
    expect(result.periodoInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.periodoFim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('deve lidar com diaFechamento 1', () => {
    const result = calcularPeriodoVendedor(1);
    expect(result.periodoInicio).toMatch(/^\d{4}-\d{2}-01$/);
    expect(result.periodoFim).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('deve lidar com diaFechamento 28', () => {
    const result = calcularPeriodoVendedor(28);
    expect(result.periodoInicio).toMatch(/^\d{4}-\d{2}-28$/);
    expect(result.periodoFim).toMatch(/^\d{4}-\d{2}-28$/);
  });
});
