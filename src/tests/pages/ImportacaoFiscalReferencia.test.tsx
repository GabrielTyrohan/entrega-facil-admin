import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../../services/importacaoFiscalReferenciaService', () => ({
  importarReferenciaFiscal: (...args: unknown[]) => mockImportarReferenciaFiscal(...args),
}));

vi.mock('../utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockCriarEntrega = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

import ImportacaoFiscalReferencia from '../../pages/ImportacaoFiscalReferencia';

function renderPage() {
  mockUseAuth.mockReturnValue({ userType: 'admin' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ImportacaoFiscalReferencia />
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
    mockCriarEntrega.mockResolvedValue({ id: 'ent-1' });
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('renderiza a página com botão de importação desabilitado sem arquivo', () => {
    renderPage();
    expect(screen.getByText(/Importação Fiscal de Referência/)).toBeInTheDocument();
    const botao = screen.getByRole('button', { name: /Importar arquivo/ });
    expect(botao).toBeDisabled();
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
    expect(mockCriarEntrega).not.toHaveBeenCalled();
  });
});
