import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockCriarComparacao = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../services/sincronizacaoFiscalService', () => ({
  carregarComparacaoFiscal: (...args: unknown[]) => mockCriarComparacao(...args),
}));

vi.mock('../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import SincronizacaoFiscal from '../../pages/SincronizacaoFiscal';

function renderPage() {
  mockUseAuth.mockReturnValue({ userType: 'admin', userProfile: { id: 'admin-1', nome: 'Admin', email: 'admin@test.com' } });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SincronizacaoFiscal />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function criarArquivoOds(nome = 'tmp_prod.ods') {
  return new File(['conteudo fake do ods'], nome, {
    type: 'application/vnd.oasis.opendocument.spreadsheet',
  });
}

function inputArquivo() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('ImportacaoFiscalReferencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCriarComparacao.mockResolvedValue({
      referencia: [],
      produtos: [],
      comparacao: [],
      resumo: {
        total_referencias: 0,
        total_produtos_cadastrados: 0,
        total_correspondencias: 0,
        total_novos_produtos: 0,
        total_divergencias_fiscais: 0,
        total_bloqueados: 0,
        total_duplicados: 0,
      },
    });
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('renderiza a página com título e mensagem de leitura somente', () => {
    renderPage();
    expect(screen.getByText(/Sincronização Fiscal/)).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura de referência/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar arquivo/ })).toBeDisabled();
  });

  it('seleciona um arquivo .ods e habilita o botão', () => {
    renderPage();
    const arquivo = criarArquivoOds();
    fireEvent.change(inputArquivo(), { target: { files: [arquivo] } });
    expect(screen.getByText(arquivo.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar arquivo/})).not.toBeDisabled();
  });

  it('abre o diálogo de confirmação e fecha com Cancelar', async () => {
    renderPage();
    fireEvent.change(inputArquivo(), { target: { files: [criarArquivoOds()] } });
    await userEvent.click(screen.getByRole('button', { name: /Importar arquivo/}));
    expect(await screen.findByRole('button', { name: 'Confirmar importação' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Confirmar importação' })).not.toBeInTheDocument();
    expect(mockCriarComparacao).not.toHaveBeenCalled();
  });

  it('importa via serviço e exibe resumo de sucesso', async () => {
    mockCriarComparacao.mockResolvedValue({
      referencia: [],
      produtos: [],
      comparacao: [],
      resumo: {
        total_referencias: 1,
        total_produtos_cadastrados: 1,
        total_correspondencias: 1,
        total_novos_produtos: 0,
        total_divergencias_fiscais: 0,
        total_bloqueados: 0,
        total_duplicados: 0,
      },
    });

    renderPage();
    fireEvent.change(inputArquivo(), { target: { files: [criarArquivoOds()] } });
    await userEvent.click(screen.getByRole('button', { name: /Importar arquivo/}));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(mockCriarComparacao).toHaveBeenCalledTimes(1));
    const argumento = mockCriarComparacao.mock.calls[0][0] as File;
    expect(argumento.name).toBe('tmp_prod.ods');
    expect(argumento.type).toBe('application/vnd.oasis.opendocument.spreadsheet');

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(await screen.findByText('Resultado da importação')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // lidos/enviados/aceitos
  });

  it('exibe erro quando a RPC falha', async () => {
    mockCriarComparacao.mockRejectedValue(new Error('Falha na RPC'));
    renderPage();
    fireEvent.change(inputArquivo(), { target: { files: [criarArquivoOds()] } });
    await userEvent.click(screen.getByRole('button', { name: /Importar arquivo/}));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(await screen.findByText('Erro ao importar a base fiscal de referência.')).toBeInTheDocument();
    expect(screen.getByText(/Falha na RPC/)).toBeInTheDocument();
  });

  it('filtra por texto de busca', async () => {
    mockCriarComparacao.mockResolvedValue({
      referencia: [
        {
          id: 'ref-1',
          administrador_id: 'admin-1',
          linha_origem: 1,
          codigo: 'PROD-001',
          codigo_barras: '7891234567890',
          descricao: 'Arroz Tio João 5kg',
          ncm: '10063021',
          cest: '1704400',
          cfop_padrao: '5102',
          cst_icms: '102',
          aliquota_icms: 18,
          cst_pis: '01',
          aliquota_pis: 1.65,
          cst_cofins: '01',
          aliquota_cofins: 3.0,
          estoque: 10,
          valor_estoque: 50.0,
          preco1: 12.90,
        },
        {
          id: 'ref-2',
          administrador_id: 'admin-1',
          linha_origem: 2,
          codigo: 'PROD-002',
          codigo_barras: '9991234567890',
          descricao: 'Feijão Carioca 1kg',
          ncm: '10061000',
          cest: '1704400',
          cfop_padrao: '5102',
          cst_icms: '102',
          aliquota_icms: 18,
          cst_pis: '01',
          aliquota_pis: 1.65,
          cst_cofins: '01',
          aliquota_cofins: 3.0,
          estoque: 5,
          valor_estoque: 30.0,
          preco1: 8.50,
        },
      ],
      produtos: [],
      comparacao: [
        {
          referencia: {
            id: 'ref-1',
            administrador_id: 'admin-1',
            linha_origem: 1,
            codigo: 'PROD-001',
            codigo_barras: '7891234567890',
            descricao: 'Arroz Tio João 5kg',
            ncm: '10063021',
            cest: '1704400',
            cfop_padrao: '5102',
            cst_icms: '102',
            aliquota_icms: 18,
            cst_pis: '01',
            aliquota_pis: 1.65,
            cst_cofins: '01',
            aliquota_cofins: 3.0,
            estoque: 10,
            valor_estoque: 50.0,
            preco1: 12.90,
          },
          produto: null,
          tipo: 'nao_encontrada',
          motivo: 'Produto não encontrado no catálogo.',
          estoque_atual: 0,
          quantidade_planilha: 10,
          estoque_proposto: 10,
          estoque_invalido: false,
          diferencas_fiscais: [],
        },
        {
          referencia: {
            id: 'ref-2',
            administrador_id: 'admin-1',
            linha_origem: 2,
            codigo: 'PROD-002',
            codigo_barras: '9991234567890',
            descricao: 'Feijão Carioca 1kg',
            ncm: '10061000',
            cest: '1704400',
            cfop_padrao: '5102',
            cst_icms: '102',
            aliquota_icms: 18,
            cst_pis: '01',
            aliquota_pis: 1.65,
            cst_cofins: '01',
            aliquota_cofins: 3.0,
            estoque: 5,
            valor_estoque: 30.0,
            preco1: 8.50,
          },
          produto: null,
          tipo: 'nao_encontrada',
          motivo: 'Produto não encontrado no catálogo.',
          estoque_atual: 0,
          quantidade_planilha: 5,
          estoque_proposto: 5,
          estoque_invalido: false,
          diferencas_fiscais: [],
        },
      ],
      resumo: {
        total_referencias: 2,
        total_produtos_cadastrados: 0,
        total_correspondencias: 0,
        total_novos_produtos: 2,
        total_divergencias_fiscais: 0,
        total_bloqueados: 0,
        total_duplicados: 0,
      },
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument());
    expect(screen.getByText('Feijão Carioca 1kg')).toBeInTheDocument();

    // Buscar apenas arroz
    const inputBusca = screen.getByRole('textbox', { name: /buscar/i });
    fireEvent.change(inputBusca, { target: { value: 'Arroz' } });

    await waitFor(() => {
      expect(screen.getByText('Arroz Tio João 5kg')).toBeInTheDocument();
      expect(screen.queryByText('Feijão Carioca 1kg')).not.toBeInTheDocument();
    });
  });
});
