import { describe, it, expect } from 'vitest';
import { gtinValido } from '@/utils/gtin';

describe('gtinValido', () => {
  it('aceita códigos reais (EAN-13, EAN-8, UPC-12, GTIN-14)', () => {
    expect(gtinValido('7891000100103')).toBe(true); // leite condensado
    expect(gtinValido('96385074')).toBe(true);
    expect(gtinValido('036000291452')).toBe(true);
    expect(gtinValido('17891000100100')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado e letras', () => {
    expect(gtinValido('12354987965416')).toBe(false); // o código do erro relatado
    expect(gtinValido('7891000100104')).toBe(false);
    expect(gtinValido('1234567')).toBe(false);
    expect(gtinValido('123456789')).toBe(false);
    expect(gtinValido('')).toBe(false);
  });

  it('ignora espaços e traços', () => {
    expect(gtinValido('789 1000 100103')).toBe(true);
  });
});
