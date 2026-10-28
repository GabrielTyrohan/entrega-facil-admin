import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
// Holder mutável usado pelo mock do useProdutos, permitindo simular carga
// inicial e refetch de busca (isLoading/data) por meio de re-render no lugar.
const mockState = vi.hoisted(() => ({
  data: [] as any[],
  isLoading: false,
  isSuccess: false,
}));
const mockUseProdutos = vi.fn();
mockUseProdutos.mockImplementation((options: any = {}) => {
  let data = mockState.data;
  if (options.categoria && options.categoria !== 'Todas') {
    data = data.filter((p: any) => p.categoria === options.categoria);
  }
  return {
    data,
    count: data.length,
    isLoading: mockState.isLoading,
    isSuccess: mockState.isSuccess,
    error: null,
    refetch: vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const baseProdutos = [
  { id: '1', produto_nome: 'Arroz 5kg', produto_cod: 'ALI-001', categoria: 'Alimentos', qtd_estoque: 10, preco_unt: 25, fiscal_status: 'pendente_revisao' },
  { id: '2', produto_nome: 'Feijão 1kg', produto_cod: 'ALI-002', categoria: 'Alimentos', qtd_estoque: 5, preco_unt: 8, fiscal_status: null },
  { id: '3', produto_nome: 'Sabão', produto_cod: 'LIM-001', categoria: 'Limpeza', qtd_estoque: 20, preco_unt: 12, fiscal_status: 'validado' },
  { id: '4', produto_nome: 'Detergente', produto_cod: 'LIM-002', categoria: 'Limpeza', qtd_estoque: 0, preco_unt: 3, fiscal_status: 'bloqueado' },
];

vi.mock('../../hooks/useProdutos', () => ({
  useProdutos: (options?: any) => mockUseProdutos(options),
  useDeleteProduto: () => ({ mutateAsync: vi.fn() }),
  useUpdateProduto: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../components/ui/ProdutoModal', () => ({
  default: () => null,
  ORIGEM_MERCADORIA_OPTIONS: [{ value: 0, label: '0 - Nacional' }],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: () => vi.fn(),
  },
}));

import Produtos from '../../pages/Produtos';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockUseAuth.mockReturnValue({
    isLoading: false,
    userType: 'admin',
    adminId: 'admin-1',
    user: { id: 'admin-1' },
    permissions: { produtos: true },
  });
  mockState.data = baseProdutos;
  mockState.isLoading = false;
  mockState.isSuccess = true;
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Produtos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Produtos — pesquisa sem perda de foco', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.data = baseProdutos;
    mockState.isLoading = false;
    mockState.isSuccess = true;
  });

  it('1. O campo de pesquisa permanece montado enquanto o texto é digitado', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Arroz' } });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Arroz');
  });

  it('2. Digitar vários caracteres preserva o valor completo no input', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'Arroz 5kg' } });
    expect(input).toHaveValue('Arroz 5kg');
    expect(input).toBeInTheDocument();
  });

  it('3. Apagar o texto da pesquisa restaura a lista completa', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'Arroz' } });
    expect(input).toHaveValue('Arroz');
    expect(screen.getByText('Arroz 5kg')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('Arroz 5kg')).toBeInTheDocument();
    expect(screen.getByText('Feijão 1kg')).toBeInTheDocument();
    expect(screen.getByText('Sabão')).toBeInTheDocument();
    expect(screen.getByText('Detergente')).toBeInTheDocument();
  });

  it('4. Digitar rapidamente não causa perda de caracteres', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'Arroz' } });
    fireEvent.change(input, { target: { value: 'Arroz 5kg' } });
    fireEvent.change(input, { target: { value: 'Arroz 5kg Integral' } });
    expect(input).toHaveValue('Arroz 5kg Integral');
    expect(input).toBeInTheDocument();
  });

  it('5. O campo permanece no mesmo elemento (mesma identidade) após digitar', () => {
    renderPage();
    const input1 = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input1, { target: { value: 'Arroz' } });
    const input2 = screen.getByPlaceholderText('Buscar por nome ou código...');
    expect(input1).toBe(input2);
  });

  // Teste de interação real: simula um refetch de busca (lista entrando em
  // carregamento com isLoading=true e dados vazios) enquanto o input está
  // focado. O re-render ocorre no lugar (setSearchTerm), como acontece de
  // fato quando o usuário digita. Sem a correção, o esqueleto de carga inicial
  // (que não renderiza o input) seria exibido e o foco seria perdido.
  it('6. Durante refetch de busca (lista carregando), o input permanece montado, com foco e valor preservados', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'Arroz' } });
    expect(input).toHaveValue('Arroz');
    expect(document.activeElement).toBe(input);

    // Simula o refetch provocado pela mudança da chave de query:
    // query começa sem dados e isLoading=true enquanto o resultado volta.
    mockState.isLoading = true;
    mockState.data = [];

    fireEvent.change(input, { target: { value: 'Arroz 5kg' } });

    const inputDeNovo = screen.getByPlaceholderText('Buscar por nome ou código...');
    // Mesmo nó do DOM (não foi desmontado/recriado)
    expect(inputDeNovo).toBe(input);
    // Foco preservado durante o carregamento da lista
    expect(document.activeElement).toBe(inputDeNovo);
    // Valor do texto preservado
    expect(inputDeNovo).toHaveValue('Arroz 5kg');
  });

  // Teste de regressão: primeira consulta concluída com lista vazia.
  // Mesmo sem produtos, a consulta terminou (isSuccess=true), então
  // hasLoadedRef fica true e o esqueleto de carga inicial não reaparece
  // ao iniciar uma nova pesquisa.
  it('10. Primeira consulta vazia concluída: input preserva nó, foco e texto durante refetch de busca', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockUseAuth.mockReturnValue({
      isLoading: false,
      userType: 'admin',
      adminId: 'admin-1',
      user: { id: 'admin-1' },
      permissions: { produtos: true },
    });
    // Primeira consulta concluída com lista vazia (isSuccess=true).
    mockState.data = [];
    mockState.isLoading = false;
    mockState.isSuccess = true;
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Produtos />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    input.focus();
    expect(document.activeElement).toBe(input);

    // Digitar um termo de pesquisa.
    fireEvent.change(input, { target: { value: 'Arroz' } });
    expect(input).toHaveValue('Arroz');
    expect(document.activeElement).toBe(input);

    // Simular o carregamento da nova query (nova chave por searchTerm):
    // isLoading=true, isSuccess=false, dados temporariamente vazios.
    mockState.isLoading = true;
    mockState.isSuccess = false;
    mockState.data = [];

    fireEvent.change(input, { target: { value: 'Arroz 5kg' } });

    const inputDeNovo = screen.getByPlaceholderText('Buscar por nome ou código...');
    // Mesmo nó do DOM (não foi desmontado/recriado)
    expect(inputDeNovo).toBe(input);
    // Foco preservado durante o carregamento da lista
    expect(document.activeElement).toBe(inputDeNovo);
    // Valor do texto preservado
    expect(inputDeNovo).toHaveValue('Arroz 5kg');
  });

  it('7. A pesquisa filtra os produtos corretamente enquanto digita', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'arroz' } });
    expect(screen.getByText('Arroz 5kg')).toBeInTheDocument();
    expect(screen.queryByText('Feijão 1kg')).not.toBeInTheDocument();
    expect(screen.queryByText('Sabão')).not.toBeInTheDocument();
    expect(screen.queryByText('Detergente')).not.toBeInTheDocument();
  });

  it('8. O filtro de categoria continua funcionando junto com a pesquisa', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: 'Limpeza' } });
    expect(screen.getByText('Sabão')).toBeInTheDocument();
    expect(screen.getByText('Detergente')).toBeInTheDocument();
    expect(screen.queryByText('Arroz 5kg')).not.toBeInTheDocument();

    // Pesquisa dentro da categoria selecionada
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'sabão' } });
    expect(screen.getByText('Sabão')).toBeInTheDocument();
    expect(screen.queryByText('Detergente')).not.toBeInTheDocument();
  });

  it('9. Digitar não abre modais automaticamente nem interfere em Editar / Visualizar / Revisão Fiscal', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Buscar por nome ou código...');
    fireEvent.change(input, { target: { value: 'Arroz' } });

    // Nenhum modal é aberto espontaneamente pela digitação.
    expect(screen.queryByText(/revisão fiscal/i)).not.toBeInTheDocument();

    // Os estados de modal só mudam por clique explícito, não são afetados pela pesquisa.
    expect(screen.getByPlaceholderText('Buscar por nome ou código...')).toBeInTheDocument();
  });
});
