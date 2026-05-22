import { describe, it, expect } from 'vitest';
import { ValidationService } from '../../services/validationService';

describe('ValidationService.validateCPF', () => {
  it('deve aceitar CPF no formato XXX.XXX.XXX-XX', () => {
    const result = ValidationService.validateCPF('123.456.789-00');
    expect(result.isValid).toBe(true);
  });

  it('deve rejeitar CPF sem pontuação', () => {
    const result = ValidationService.validateCPF('12345678900');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('formato');
  });

  it('deve rejeitar CPF com formato incorreto', () => {
    const result = ValidationService.validateCPF('abc');
    expect(result.isValid).toBe(false);
  });
});

describe('ValidationService.validatePhone', () => {
  it('deve aceitar telefone no formato (XX) XXXXX-XXXX', () => {
    const result = ValidationService.validatePhone('(11) 91234-5678');
    expect(result.isValid).toBe(true);
  });

  it('deve aceitar telefone fixo (XX) XXXX-XXXX', () => {
    const result = ValidationService.validatePhone('(11) 1234-5678');
    expect(result.isValid).toBe(true);
  });

  it('deve rejeitar telefone sem formato', () => {
    const result = ValidationService.validatePhone('11912345678');
    expect(result.isValid).toBe(false);
  });
});

describe('ValidationService.validateEmail', () => {
  it('deve aceitar email válido', () => {
    const result = ValidationService.validateEmail('teste@exemplo.com');
    expect(result.isValid).toBe(true);
  });

  it('deve rejeitar email inválido', () => {
    const result = ValidationService.validateEmail('invalido');
    expect(result.isValid).toBe(false);
  });
});

describe('ValidationService.validateProduto', () => {
  it('deve retornar erro quando nome está vazio', () => {
    const result = ValidationService.validateProduto({ produto_nome: '' });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('obrigatório');
  });

  it('deve retornar erro quando código está vazio', () => {
    const result = ValidationService.validateProduto({ produto_nome: 'Produto', produto_cod: '' });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Código');
  });

  it('deve retornar erro quando categoria está vazia', () => {
    const result = ValidationService.validateProduto({ produto_nome: 'Produto', produto_cod: 'COD', categoria: '' });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Categoria');
  });

  it('deve retornar erro quando quantidade é negativa', () => {
    const result = ValidationService.validateProduto({ produto_nome: 'Produto', produto_cod: 'COD', categoria: 'Cat', qtd_estoque: -1, preco_unt: 10 });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Quantidade');
  });

  it('deve retornar erro quando preço é zero', () => {
    const result = ValidationService.validateProduto({ produto_nome: 'Produto', produto_cod: 'COD', categoria: 'Cat', qtd_estoque: 10, preco_unt: 0 });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Preço');
  });

  it('deve retornar válido para produto correto', () => {
    const result = ValidationService.validateProduto({ produto_nome: 'Produto Teste', produto_cod: 'COD001', categoria: 'Geral', qtd_estoque: 10, preco_unt: 25.5 });
    expect(result.isValid).toBe(true);
  });
});

describe('ValidationService.getSuccessMessage', () => {
  it('deve retornar mensagem para criar produto', () => {
    const result = ValidationService.getSuccessMessage('create', 'produto');
    expect(result).toBe('Produto cadastrado com sucesso!');
  });

  it('deve retornar mensagem padrão para ação desconhecida', () => {
    const result = ValidationService.getSuccessMessage('unknown', 'action');
    expect(result).toBe('Operação realizada com sucesso!');
  });
});
