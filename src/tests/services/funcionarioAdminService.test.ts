import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetSession = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  alterarStatusFuncionarioSeguro,
  atualizarFuncionarioSeguro,
  criarFuncionarioSeguro,
  redefinirSenhaFuncionarioSeguro,
} from '../../services/funcionarioAdminService';

const PERMISSOES = {
  orcamentos_pj: false,
  vendas_atacado: false,
  notas_fiscais: false,
  caixa: false,
  acertos: false,
  relatorios: false,
  vendedores: false,
  expedicao: false,
};

const NOVO = {
  nome: 'João da Silva',
  email: 'joao@empresa.com',
  senha: 'SenhaSegura123',
  telefone: '11999999999',
  cargo: 'Vendedor',
  permissoes: PERMISSOES,
};

function sessaoValida() {
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'fake-access-token' } },
    error: null,
  });
}

function fetchOk(payload: Record<string, unknown> = { success: true }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('funcionarioAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoValida();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. create chama /gerenciar-funcionario com action=create', async () => {
    const fetchMock = fetchOk({ success: true, funcionarioId: 'func-1' });
    const resp = await criarFuncionarioSeguro(NOVO);
    expect(resp.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/gerenciar-funcionario');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.action).toBe('create');
    expect(body).toMatchObject({
      nome: 'João da Silva',
      email: 'joao@empresa.com',
      senha: 'SenhaSegura123',
      telefone: '11999999999',
      cargo: 'Vendedor',
    });
    expect(body.permissoes).toMatchObject({ vendedores: false });
  });

  it('2. usa Authorization Bearer da sessão atual', async () => {
    const fetchMock = fetchOk();
    await criarFuncionarioSeguro(NOVO);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fake-access-token');
  });

  it('3. usa apikey', async () => {
    const fetchMock = fetchOk();
    await criarFuncionarioSeguro(NOVO);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBeTruthy();
  });

  it('4/5/6. create NÃO envia administrador_id, auth_user_id, nome_empresa (nem service_role)', async () => {
    const fetchMock = fetchOk();
    await criarFuncionarioSeguro(NOVO);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('administrador_id');
    expect(body).not.toHaveProperty('auth_user_id');
    expect(body).not.toHaveProperty('nome_empresa');
    expect(JSON.stringify(body)).not.toMatch(/service_role/i);
  });

  it('7. update envia apenas campos permitidos', async () => {
    const fetchMock = fetchOk();
    await atualizarFuncionarioSeguro({ id: 'func-1', ...NOVO });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['action', 'cargo', 'email', 'funcionarioId', 'nome', 'permissoes', 'telefone'].sort(),
    );
    expect(body.action).toBe('update');
    expect(body.funcionarioId).toBe('func-1');
    for (const proibido of [
      'administrador_id',
      'auth_user_id',
      'ativo',
      'bloqueado',
      'created_at',
      'nome_empresa',
    ]) {
      expect(body).not.toHaveProperty(proibido);
    }
  });

  it('8. set_active envia somente funcionarioId + ativo', async () => {
    const fetchMock = fetchOk();
    await alterarStatusFuncionarioSeguro('func-1', false);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ action: 'set_active', funcionarioId: 'func-1', ativo: false });
  });

  it('9. reset_password usa Edge Function e NÃO RPC', async () => {
    const fetchMock = fetchOk();
    await redefinirSenhaFuncionarioSeguro('func-1', 'NovaSenha123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/gerenciar-funcionario');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      action: 'reset_password',
      funcionarioId: 'func-1',
      senha: 'NovaSenha123',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('10. sem sessão retorna erro e não chama fetch', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(criarFuncionarioSeguro(NOVO)).rejects.toThrow(/sessão expirada/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('11. resposta 403 é tratada com mensagem do backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Acesso restrito ao administrador' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(criarFuncionarioSeguro(NOVO)).rejects.toThrow(
      'Acesso restrito ao administrador',
    );
  });

  it('11b. erro desconhecido usa mensagem genérica sanitizada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(criarFuncionarioSeguro(NOVO)).rejects.toThrow(
      'Erro ao gerenciar funcionário',
    );
  });

  it('12. token/senha não são logados', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      fetchOk();
      await criarFuncionarioSeguro(NOVO);
      await atualizarFuncionarioSeguro({ id: 'func-1', ...NOVO });
      await redefinirSenhaFuncionarioSeguro('func-1', 'NovaSenha123');
      const tudo = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls]
        .map((args) => args.map(String).join(' '))
        .join('\n');
      expect(tudo).not.toContain('SenhaSegura123');
      expect(tudo).not.toContain('NovaSenha123');
      expect(tudo).not.toContain('fake-access-token');
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
