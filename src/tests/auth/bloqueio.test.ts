import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = {
  from: mockFrom,
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
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

async function buscarPerfil(userId: string) {
  const supabaseModule = await import('@/lib/supabase');
  const supabase = supabaseModule.supabase;

  const { data: admin } = await supabase.from('administradores').select('*').eq('id', userId).maybeSingle();

  if (admin) {
    if (admin.status_pagamento === 'inativo' || admin.status_pagamento === 'cancelado') {
      throw new Error('PAGAMENTO_INATIVO');
    }
    return { ...admin, type: 'admin' };
  }

  const { data: funcionarioRaw } = await supabase.from('funcionarios').select('*').eq('auth_user_id', userId).maybeSingle();

  if (funcionarioRaw && funcionarioRaw.ativo === false) {
    throw new Error('ACESSO_DESATIVADO');
  }

  if (funcionarioRaw && funcionarioRaw.ativo === true) {
    const { data: adminDoFunc } = await supabase.from('administradores').select('status_pagamento').eq('id', funcionarioRaw.administrador_id).maybeSingle();

    if (adminDoFunc && (adminDoFunc.status_pagamento === 'inativo' || adminDoFunc.status_pagamento === 'cancelado')) {
      throw new Error('PAGAMENTO_INATIVO_FUNCIONARIO');
    }

    return { ...funcionarioRaw, type: 'funcionario' };
  }

  throw new Error('Usuário não autorizado: Perfil não encontrado');
}

describe('Bloqueio de Acesso - Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve lançar PAGAMENTO_INATIVO quando admin está inadimplente', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { status_pagamento: 'inativo' }, error: null });

    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) });

    await expect(buscarPerfil('admin-id')).rejects.toThrow('PAGAMENTO_INATIVO');
  });

  it('deve lançar PAGAMENTO_INATIVO quando admin está cancelado', async () => {
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { status_pagamento: 'cancelado' }, error: null }) }) }) });

    await expect(buscarPerfil('admin-id')).rejects.toThrow('PAGAMENTO_INATIVO');
  });

  it('deve retornar perfil quando admin está ativo', async () => {
    const adminData = { id: 'admin-id', nome: 'Admin', status_pagamento: 'ativo' };
    mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: adminData, error: null }) }) }) });

    const result = await buscarPerfil('admin-id');
    expect(result).toMatchObject({ type: 'admin', status_pagamento: 'ativo' });
  });
});

describe('Bloqueio de Acesso - Funcionário', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar perfil quando funcionário ativo e admin ativo', async () => {
    mockFrom
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'func-id', ativo: true, administrador_id: 'admin-id' }, error: null }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { status_pagamento: 'ativo' }, error: null }) }) }) });

    const result = await buscarPerfil('func-id');
    expect(result).toMatchObject({ type: 'funcionario', ativo: true });
  });

  it('deve lançar PAGAMENTO_INATIVO_FUNCIONARIO quando admin do funcionário está inadimplente', async () => {
    mockFrom
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'func-id', ativo: true, administrador_id: 'admin-id' }, error: null }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { status_pagamento: 'inativo' }, error: null }) }) }) });

    await expect(buscarPerfil('func-id')).rejects.toThrow('PAGAMENTO_INATIVO_FUNCIONARIO');
  });

  it('deve lançar ACESSO_DESATIVADO quando funcionário está desativado', async () => {
    mockFrom
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'func-id', ativo: false }, error: null }) }) }) });

    await expect(buscarPerfil('func-id')).rejects.toThrow('ACESSO_DESATIVADO');
  });
});
