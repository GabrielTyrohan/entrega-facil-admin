import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';

// Importar funções do script de diagnóstico fiscal
import {
  lerEmailDoArquivoTeste,
  kitEhReconhecido,
  referenciaEhCandidataValida,
  ehAdministradorReal,
  REAL_ADMIN_ID,
} from '../../../scripts/test-importacao-fiscal-validar.mjs';

const DIR_TEMP = resolve(process.cwd(), 'src/tests/scripts/.tmp');

function criarArquivoTemp(nome: string, conteudo: string): string {
  const caminho = resolve(DIR_TEMP, nome);
  try {
    mkdirSync(DIR_TEMP, { recursive: true });
  } catch {
    // já existe
  }
  writeFileSync(caminho, conteudo, 'utf-8');
  return caminho;
}

function removerArquivoTemp(caminho: string): void {
  try {
    if (existsSync(caminho)) unlinkSync(caminho);
  } catch {
    // ignorar
  }
}

describe('test-importacao-fiscal-validar (validações locais)', () => {
  describe('lerEmailDoArquivoTeste', () => {
    it('lê o e-mail diretamente do arquivo .env.fiscal-test.local', () => {
      const caminho = criarArquivoTemp(
        'email-test.local',
        'FISCAL_TEST_ADMIN_EMAIL=email-do-arquivo@teste.com\n',
      );
      const email = lerEmailDoArquivoTeste(caminho);
      expect(email).toBe('email-do-arquivo@teste.com');
      removerArquivoTemp(caminho);
    });

    it('o e-mail do arquivo prevalece sobre valor conflitante no ambiente', () => {
      const valorAnterior = process.env.FISCAL_TEST_ADMIN_EMAIL;
      process.env.FISCAL_TEST_ADMIN_EMAIL = 'email-conflitante@env.com';

      const caminho = criarArquivoTemp(
        'email-prevalece.local',
        'FISCAL_TEST_ADMIN_EMAIL=email-do-arquivo@prevalece.com\n',
      );
      const email = lerEmailDoArquivoTeste(caminho);

      expect(email).toBe('email-do-arquivo@prevalece.com');
      expect(email).not.toBe('email-conflitante@env.com');

      if (valorAnterior === undefined) {
        delete process.env.FISCAL_TEST_ADMIN_EMAIL;
      } else {
        process.env.FISCAL_TEST_ADMIN_EMAIL = valorAnterior;
      }
      removerArquivoTemp(caminho);
    });

    it('retorna null quando o arquivo não existe', () => {
      const email = lerEmailDoArquivoTeste(
        resolve(process.cwd(), 'arquivo-inexistente-12345.local'),
      );
      expect(email).toBeNull();
    });

    it('retorna null quando a chave não está presente', () => {
      const caminho = criarArquivoTemp('sem-chave.local', 'OUTRA_VAR=valor\n');
      const email = lerEmailDoArquivoTeste(caminho);
      expect(email).toBeNull();
      removerArquivoTemp(caminho);
    });

    it('remove aspas do valor', () => {
      const caminho = criarArquivoTemp(
        'aspas.local',
        'FISCAL_TEST_ADMIN_EMAIL="email-com-aspas@teste.com"\n',
      );
      const email = lerEmailDoArquivoTeste(caminho);
      expect(email).toBe('email-com-aspas@teste.com');
      removerArquivoTemp(caminho);
    });

    it('ignora linhas de comentário e vazias', () => {
      const caminho = criarArquivoTemp(
        'comentarios.local',
        '# Comentário\n\nFISCAL_TEST_ADMIN_EMAIL=email-limpo@teste.com\n# Outro comentário\n',
      );
      const email = lerEmailDoArquivoTeste(caminho);
      expect(email).toBe('email-limpo@teste.com');
      removerArquivoTemp(caminho);
    });
  });

  describe('kitEhReconhecido', () => {
    it('reconhece booleano true', () => {
      expect(kitEhReconhecido(true)).toBe(true);
    });

    it('reconhece booleano false', () => {
      expect(kitEhReconhecido(false)).toBe(true);
    });

    it('reconhece texto "true"', () => {
      expect(kitEhReconhecido('true')).toBe(true);
    });

    it('reconhece texto "false"', () => {
      expect(kitEhReconhecido('false')).toBe(true);
    });

    it('reconhece texto "1"', () => {
      expect(kitEhReconhecido('1')).toBe(true);
    });

    it('reconhece texto "0"', () => {
      expect(kitEhReconhecido('0')).toBe(true);
    });

    it('reconhece texto "sim"', () => {
      expect(kitEhReconhecido('sim')).toBe(true);
    });

    it('reconhece texto "nao"', () => {
      expect(kitEhReconhecido('nao')).toBe(true);
    });

    it('reconhece texto "não"', () => {
      expect(kitEhReconhecido('não')).toBe(true);
    });

    it('reconhece valores com espaços e maiúsculas', () => {
      expect(kitEhReconhecido('  TRUE  ')).toBe(true);
      expect(kitEhReconhecido('Sim')).toBe(true);
      expect(kitEhReconhecido('NÃO')).toBe(true);
    });

    it('rejeita null', () => {
      expect(kitEhReconhecido(null)).toBe(false);
    });

    it('rejeita undefined', () => {
      expect(kitEhReconhecido(undefined)).toBe(false);
    });

    it('rejeita número', () => {
      expect(kitEhReconhecido(1)).toBe(false);
      expect(kitEhReconhecido(0)).toBe(false);
    });

    it('rejeita string desconhecida', () => {
      expect(kitEhReconhecido('talvez')).toBe(false);
      expect(kitEhReconhecido('yes')).toBe(false);
      expect(kitEhReconhecido('')).toBe(false);
      expect(kitEhReconhecido('2')).toBe(false);
    });
  });

  describe('referenciaEhCandidataValida', () => {
    const refBase = {
      descricao: 'Produto Teste',
      codigo: 'COD-001',
      estoque: 10,
      preco1: 5.0,
      kit: true,
    };

    it('aceita referência com kit booleano', () => {
      expect(referenciaEhCandidataValida(refBase)).toBe(true);
    });

    it('aceita referência com kit como texto válido', () => {
      expect(referenciaEhCandidataValida({ ...refBase, kit: 'sim' })).toBe(true);
      expect(referenciaEhCandidataValida({ ...refBase, kit: 'não' })).toBe(true);
      expect(referenciaEhCandidataValida({ ...refBase, kit: '1' })).toBe(true);
    });

    it('rejeita referência com kit desconhecido', () => {
      expect(referenciaEhCandidataValida({ ...refBase, kit: 'talvez' })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, kit: null })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, kit: undefined })).toBe(false);
    });

    it('rejeita referência com descrição vazia', () => {
      expect(referenciaEhCandidataValida({ ...refBase, descricao: '' })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, descricao: null })).toBe(false);
    });

    it('rejeita referência com código vazio', () => {
      expect(referenciaEhCandidataValida({ ...refBase, codigo: '' })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, codigo: null })).toBe(false);
    });

    it('rejeita referência com estoque inválido', () => {
      expect(referenciaEhCandidataValida({ ...refBase, estoque: null })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, estoque: -1 })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, estoque: 1.5 })).toBe(false);
    });

    it('rejeita referência com preço inválido', () => {
      expect(referenciaEhCandidataValida({ ...refBase, preco1: null })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, preco1: 0 })).toBe(false);
      expect(referenciaEhCandidataValida({ ...refBase, preco1: -5 })).toBe(false);
    });
  });

  describe('ehAdministradorReal (proteção do UUID real)', () => {
    it('bloqueia o UUID do administrador real', () => {
      expect(ehAdministradorReal('3ec56871-3ba5-469f-8e9b-6c927ce3f6ad')).toBe(true);
    });

    it('REAL_ADMIN_ID é o UUID correto', () => {
      expect(REAL_ADMIN_ID).toBe('3ec56871-3ba5-469f-8e9b-6c927ce3f6ad');
    });

    it('não bloqueia outros UUIDs', () => {
      expect(ehAdministradorReal('00000000-0000-0000-0000-000000000000')).toBe(false);
      expect(ehAdministradorReal('')).toBe(false);
      expect(ehAdministradorReal(null)).toBe(false);
    });
  });
});
