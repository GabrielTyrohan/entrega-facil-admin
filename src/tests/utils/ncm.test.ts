import { describe, it, expect } from 'vitest';
import { filtrarNcmCompletos, formatarNcm, termosParaNCM } from '@/utils/ncm';

describe('termosParaNCM', () => {
  it('tira peso, embalagem e marketing e vai do mais específico ao mais geral', () => {
    expect(termosParaNCM('Pão De Forma Panco Premium Pacote 500g')).toEqual(['pão de forma panco', 'pão de forma', 'pão']);
    expect(termosParaNCM('Arroz Camil Tipo 1 5kg')).toEqual(['arroz camil', 'arroz']);
    expect(termosParaNCM('Óleo de Soja Soya 900ml')).toEqual(['óleo de soja soya', 'óleo de soja', 'óleo']);
  });

  it('não termina termo em palavra de ligação nem devolve termo curto', () => {
    const termos = termosParaNCM('Leite de coco');
    expect(termos).toContain('leite de coco');
    expect(termos).not.toContain('leite de');
    expect(termosParaNCM('5kg')).toEqual([]);
  });
});

describe('filtrarNcmCompletos', () => {
  it('fica só com NCM de 8 dígitos, sem repetir e sem HTML', () => {
    const lista = filtrarNcmCompletos([
      { codigo: '19.05', descricao: 'Produtos de padaria' },
      { codigo: '1905.90.10', descricao: 'Pão de forma' },
      { codigo: '0302.4', descricao: '- Arenques (<i>Clupea</i>)' },
      { codigo: '1905.90.10', descricao: 'Pão de forma' },
      { codigo: '0305.54.00', descricao: '-- Arenques (<i>Clupea harengus</i>)' },
    ]);
    expect(lista).toEqual([
      { codigo: '19059010', descricao: 'Pão de forma' },
      { codigo: '03055400', descricao: 'Arenques (Clupea harengus)' },
    ]);
  });

  it('formata para exibir', () => {
    expect(formatarNcm('19059010')).toBe('1905.90.10');
  });
});
