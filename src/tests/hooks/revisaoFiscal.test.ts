import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ adminId: 'adm' }) }));

import { camposPreenchidos, pendenciasFiscais, ProdutoFiscalLinha } from '@/hooks/useRevisaoFiscal';

const base: ProdutoFiscalLinha = {
  id: '1', produto_nome: 'ARROZ 5KG', ncm: '10063021', cest: null, cfop_padrao: '5102',
  cst_icms: '102', cst_pis: '49', cst_cofins: '49', origem_mercadoria: 0,
  cst_ibscbs: '200', cclasstrib: '200003', ibscbs_sugestao: 'cesta_basica', fiscal_status: 'pendente_revisao',
};

describe('revisão fiscal em lote', () => {
  it('produto completo não tem pendência', () => {
    expect(pendenciasFiscais(base)).toEqual([]);
  });

  it('aponta o que falta, inclusive IBS/CBS', () => {
    expect(pendenciasFiscais({ ...base, cst_pis: null, cst_ibscbs: null, cclasstrib: null, ncm: '1006' }))
      .toEqual(['NCM', 'PIS', 'CST IBS/CBS', 'cClassTrib']);
  });

  it('só envia os campos preenchidos (vazio = não muda)', () => {
    expect(camposPreenchidos({ cst_pis: ' 49 ', cst_cofins: '', cclasstrib: '200003', ncm: '   ' }))
      .toEqual({ cst_pis: '49', cclasstrib: '200003' });
  });
});
