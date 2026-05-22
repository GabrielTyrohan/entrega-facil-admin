import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      subscribe: vi.fn(),
      track: vi.fn(),
      untrack: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-id' },
    adminId: 'admin-id',
  }),
}));

vi.mock('../../hooks/useCestas', () => ({
  useCestas: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCestaDetalhes: () => ({
    data: null,
  }),
  useEntregarCestas: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

import CestasVendedor from '../../pages/CestasVendedor';

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CestasVendedor />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CestasVendedor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar a página', () => {
    renderComponent();
    expect(screen.getByText('Cestas dos Vendedores')).toBeInTheDocument();
  });

  it('deve exibir mensagem de lista vazia quando não há cestas', () => {
    renderComponent();
    expect(screen.getByText('Nenhuma cesta encontrada')).toBeInTheDocument();
  });
});
