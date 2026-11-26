import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { mensagemLimiteNotas, nivelConsumo, percentualUsado, textoSemLimite } from '@/services/contoraConfigService';

describe('Notas do mês (consumo Contora)', () => {
  it('usa o percentual da Contora ou calcula pelo limite', () => {
    expect(percentualUsado({ limite: 500, usados: 125, uso_percentual: null })).toBe(25);
    expect(percentualUsado({ limite: 500, usados: 125, uso_percentual: 30 })).toBe(30);
    expect(percentualUsado({ limite: null, usados: null, uso_percentual: null })).toBeNull();
  });

  it('nível segue o aviso da Contora e o percentual', () => {
    const base = { limite: 500, usados: 100, uso_percentual: null, restantes: 400, aviso: 'none' };
    expect(nivelConsumo(base)).toBe('ok');
    expect(nivelConsumo({ ...base, usados: 420, restantes: 80 })).toBe('atencao');
    expect(nivelConsumo({ ...base, aviso: 'critical' })).toBe('critico');
    expect(nivelConsumo({ ...base, restantes: 0 })).toBe('bloqueado');
    expect(nivelConsumo({ ...base, aviso: 'blocked' })).toBe('bloqueado');
  });

  it('traduz recusa por limite e deixa os outros erros como estão', () => {
    expect(mensagemLimiteNotas('Fiscal Contora HTTP 402: insufficient balance')).toContain('limite de notas');
    expect(mensagemLimiteNotas('NCM inválido: ARROZ')).toBeNull();
  });
});

describe('Notas do mês sem limite informado', () => {
  it('diferencia empresa fora da Contora de empresa cadastrada sem limite', () => {
    expect(textoSemLimite(null)).toContain('depois que a empresa estiver cadastrada');
    expect(textoSemLimite({ empresa_na_contora: false })).toContain('depois que a empresa estiver cadastrada');
    expect(textoSemLimite({ empresa_na_contora: null })).toContain('depois que a empresa estiver cadastrada');
    expect(textoSemLimite({ empresa_na_contora: true })).toContain('ainda não informou o limite');
  });
});
