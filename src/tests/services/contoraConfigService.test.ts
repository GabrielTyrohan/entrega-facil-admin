import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

import {
  carregarDadosFiscaisEmpresa,
  DADOS_FISCAIS_SELECT,
  enviarCertificadoContora,
  isArquivoCertificadoValido,
  mapearTextoStatusIntegracao,
  sincronizarEmpresaContora,
  validarDadosEmpresaContora,
} from '../../services/contoraConfigService';

const EMPRESA_VALIDA = {
  razao_social: 'Empresa Teste LTDA',
  nome_fantasia: 'Empresa Teste',
  cpf_cnpj: '11222333000181',
  inscricao_estadual: '123456789',
  nfe_indicador_ie: 1 as const,
  nfe_regime_tributario: 1 as const,
  telefone: '11999999999',
  cep: '01310100',
  endereco: 'Av. Paulista',
  numero: '1000',
  complemento: 'Sala 1',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  codigo_municipio: '3550308',
};

describe('contoraConfigService - validações', () => {
  it('aceita payload válido', () => {
    expect(validarDadosEmpresaContora(EMPRESA_VALIDA)).toEqual({});
  });

  it('exige razão social', () => {
    const erros = validarDadosEmpresaContora({ ...EMPRESA_VALIDA, razao_social: ' ' });
    expect(erros.razao_social).toBeTruthy();
  });

  it('exige CNPJ com 14 dígitos', () => {
    expect(validarDadosEmpresaContora({ ...EMPRESA_VALIDA, cpf_cnpj: '123' }).cpf_cnpj).toBeTruthy();
    expect(validarDadosEmpresaContora({ ...EMPRESA_VALIDA, cpf_cnpj: '' }).cpf_cnpj).toBeTruthy();
  });

  it('exige IE quando indicador é 1, dispensa quando 2 ou 9', () => {
    const semIE = { ...EMPRESA_VALIDA, inscricao_estadual: '' };
    expect(validarDadosEmpresaContora(semIE).inscricao_estadual).toBeTruthy();
    expect(
      validarDadosEmpresaContora({ ...semIE, nfe_indicador_ie: 2 as const }).inscricao_estadual,
    ).toBeUndefined();
    expect(
      validarDadosEmpresaContora({ ...semIE, nfe_indicador_ie: 9 as const }).inscricao_estadual,
    ).toBeUndefined();
  });

  it('exige CEP, endereço, bairro, cidade, UF e IBGE', () => {
    const erros = validarDadosEmpresaContora({
      ...EMPRESA_VALIDA,
      cep: '',
      endereco: '',
      bairro: '',
      cidade: '',
      estado: '',
      codigo_municipio: '',
      numero: '',
    });
    expect(erros.cep).toBeTruthy();
    expect(erros.endereco).toBeTruthy();
    expect(erros.bairro).toBeTruthy();
    expect(erros.cidade).toBeTruthy();
    expect(erros.estado).toBeTruthy();
    expect(erros.codigo_municipio).toBeTruthy();
    expect(erros.numero).toBeTruthy();
  });

  it('exige regime e situação da IE', () => {
    const erros = validarDadosEmpresaContora({
      ...EMPRESA_VALIDA,
      nfe_regime_tributario: undefined as never,
      nfe_indicador_ie: undefined as never,
    });
    expect(erros.nfe_regime_tributario).toBeTruthy();
    expect(erros.nfe_indicador_ie).toBeTruthy();
  });
});

describe('contoraConfigService - certificado', () => {
  it('aceita somente .pfx e .p12', () => {
    expect(isArquivoCertificadoValido('cert.pfx')).toBe(true);
    expect(isArquivoCertificadoValido('CERT.P12')).toBe(true);
    expect(isArquivoCertificadoValido('cert.txt')).toBe(false);
    expect(isArquivoCertificadoValido('cert.pem')).toBe(false);
  });

  it('mapeia status da integração sem termos técnicos', () => {
    expect(mapearTextoStatusIntegracao(null, null)).toBe('Empresa não configurada');
    expect(mapearTextoStatusIntegracao('', null)).toBe('Empresa não configurada');
    expect(mapearTextoStatusIntegracao('abc', 'empresa_configurada')).toBe(
      'Empresa configurada — certificado pendente',
    );
    expect(mapearTextoStatusIntegracao('abc', 'pronta_homologacao')).toBe(
      'Pronta para homologação',
    );
  });
});

describe('contoraConfigService - chamadas às Edge Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'fake-access-token' } },
      error: null,
    });
  });

  it('sincronizarEmpresaContora chama configurar-empresa-contora sem token da Contora', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        created: true,
        companyId: 'company-123',
        hasCertificate: false,
        ambiente: 'homologacao',
        status: 'empresa_configurada',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resp = await sincronizarEmpresaContora(EMPRESA_VALIDA);

    expect(resp.companyId).toBe('company-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/configurar-empresa-contora');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fake-access-token');
    expect(headers.apikey).toBeTruthy();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.cpf_cnpj).toBe('11222333000181');
    // Nenhum segredo da Contora no corpo da requisição do frontend
    expect(JSON.stringify(body)).not.toMatch(/contora[_-]?token|api[_-]?token/i);
    vi.unstubAllGlobals();
  });

  it('enviarCertificadoContora rejeita extensão inválida antes do fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      enviarCertificadoContora({
        certificadoBase64: 'abc',
        senha: '123',
        nomeArquivo: 'cert.txt',
      }),
    ).rejects.toThrow(/pfx|p12/i);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('enviarCertificadoContora chama enviar-certificado-contora', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hasCertificate: true,
        validade: '2027-01-01',
        documento: '11222333000181',
        status: 'pronta_homologacao',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resp = await enviarCertificadoContora({
      certificadoBase64: 'YmFzZTY0',
      senha: 'segredo',
      nomeArquivo: 'certificado.pfx',
    });

    expect(resp.hasCertificate).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/enviar-certificado-contora');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      certificadoBase64: 'YmFzZTY0',
      senha: 'segredo',
      nomeArquivo: 'certificado.pfx',
    });
    vi.unstubAllGlobals();
  });

  it('lança erro amigável quando Edge retorna falha', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'CNPJ inválido' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(sincronizarEmpresaContora(EMPRESA_VALIDA)).rejects.toThrow('CNPJ inválido');
    vi.unstubAllGlobals();
  });
});

describe('contoraConfigService - carregarDadosFiscaisEmpresa (seleção explícita)', () => {
  const CAMPOS_ESPERADOS = [
    'id',
    'razao_social',
    'nome_fantasia',
    'nome_empresa',
    'cpf_cnpj',
    'inscricao_estadual',
    'nfe_indicador_ie',
    'nfe_regime_tributario',
    'telefone',
    'cep',
    'endereco',
    'numero',
    'complemento',
    'bairro',
    'cidade',
    'estado',
    'codigo_municipio',
    'nfe_provedor',
    'nfe_ambiente',
    'nfe_contora_company_id',
    'nfe_integracao_status',
    'nfe_contora_has_certificate',
    'nfe_contora_ultima_sincronizacao',
    'nfe_certificado_configurado',
    'nfe_certificado_validade',
    'nfe_certificado_nome',
    'nfe_certificado_documento',
  ];

  const CAMPOS_SENSIVEIS = [
    'senha_hash',
    'mp_access_token',
    'mp_refresh_token',
    'mp_preapproval_id',
    'mp_payer_email',
  ];

  function montarCadeiaSupabase(retorno: { data: unknown; error: { message: string } | null }) {
    const singleMock = vi.fn().mockResolvedValue(retorno);
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ select: selectMock });
    return { selectMock, eqMock, singleMock };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constante de seleção não usa * nem campos sensíveis', () => {
    expect(DADOS_FISCAIS_SELECT).not.toContain('*');
    for (const campo of CAMPOS_SENSIVEIS) {
      expect(DADOS_FISCAIS_SELECT).not.toContain(campo);
    }
    expect(DADOS_FISCAIS_SELECT).not.toMatch(/mp_/i);
    const colunas = DADOS_FISCAIS_SELECT.split(',').map((c) => c.trim());
    for (const campo of CAMPOS_ESPERADOS) {
      expect(colunas).toContain(campo);
    }
  });

  it('consulta administradores com colunas explícitas, filtro por id e single()', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const { selectMock, eqMock, singleMock } = montarCadeiaSupabase({
      data: { id: 'user-123', razao_social: 'Empresa Teste LTDA' },
      error: null,
    });

    const resultado = await carregarDadosFiscaisEmpresa();

    expect(mockFrom).toHaveBeenCalledWith('administradores');
    expect(selectMock).toHaveBeenCalledTimes(1);
    const colunasSelecionadas = selectMock.mock.calls[0][0] as string;
    expect(colunasSelecionadas).not.toContain('*');
    for (const campo of CAMPOS_SENSIVEIS) {
      expect(colunasSelecionadas).not.toContain(campo);
    }
    expect(colunasSelecionadas).not.toMatch(/mp_/i);
    const colunas = colunasSelecionadas.split(',').map((c) => c.trim());
    for (const campo of CAMPOS_ESPERADOS) {
      expect(colunas).toContain(campo);
    }
    expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
    expect(singleMock).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({ id: 'user-123' });
  });

  it('mantém erro "Não autenticado" sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    // Garante que a cadeia nem chega a ser montada sem usuário.
    mockFrom.mockReturnValue({ select: vi.fn() });

    await expect(carregarDadosFiscaisEmpresa()).rejects.toThrow('Não autenticado');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
