import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { auth } = vi.hoisted(() => ({
  auth: { current: { isAdmin: true, permissions: {} as Record<string, boolean> } },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('@/hooks/usePedidosVendedor', () => ({ usePedidosPendentesCount: () => ({ data: 0 }) }));

import PrecisaDeVoce from '../../../components/dashboard/PrecisaDeVoce';
import type { EstoqueAtual } from '@/types/estoque';

const produto = (id: string, nome: string, qtd: number): EstoqueAtual =>
  ({ id, produto_nome: nome, qtd_estoque: qtd, unidade_medida: 'un', status_estoque: qtd === 0 ? 'ZERADO' : 'BAIXO' }) as unknown as EstoqueAtual;

const ALERTAS = [produto('a', 'Óleo', 5), produto('b', 'Arroz', 0), produto('c', 'Café', 12), produto('d', 'Açúcar', 18)];

const renderizar = () =>
  render(
    <MemoryRouter>
      <PrecisaDeVoce estoqueAlerts={ALERTAS} inadimplencia={null} autonomosPendentes={0} carregando={false} />
    </MemoryRouter>
  );

describe('PrecisaDeVoce — estoque', () => {
  beforeEach(() => {
    auth.current = { isAdmin: true, permissions: {} };
  });

  it('resume o estoque e abre a lista completa no próprio item, do menor para o maior', () => {
    renderizar();
    expect(screen.getByText('1 produto sem estoque e 3 acabando')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar compra' })).toHaveAttribute('href', '/estoque/compras/nova');

    const botao = screen.getByRole('button', { name: /Ver os 4 produtos/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);

    const itens = screen.getAllByRole('listitem').filter((li) => li.closest('#lista-estoque'));
    expect(itens.map((li) => li.textContent)).toEqual([
      'ArrozSem estoque · 0 un',
      'Óleo5 un',
      'Café12 un',
      'Açúcar18 un',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Esconder lista/ }));
    expect(document.getElementById('lista-estoque')).toBeNull();
  });

  it('expedição vê os produtos em falta, mas sem o botão de compra', () => {
    auth.current = { isAdmin: false, permissions: { expedicao: true } };
    renderizar();
    expect(screen.getByText('1 produto sem estoque e 3 acabando')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar compra' })).toBeNull();
    expect(screen.getByRole('button', { name: /Ver os 4 produtos/ })).toBeInTheDocument();
  });

  it('quem não cuida de estoque não vê o item', () => {
    auth.current = { isAdmin: false, permissions: { cobranca: true } };
    renderizar();
    expect(screen.queryByText(/sem estoque/)).toBeNull();
  });
});
