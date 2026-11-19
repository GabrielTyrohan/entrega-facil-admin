// Busca dados de um produto pelo código de barras (EAN/GTIN) para preencher o cadastro.
// Fontes, nesta ordem:
//   1. Cosmos (Bluesoft): nome, marca e NCM. Exige a chave no secret COSMOS_TOKEN (sem ela responde 401).
//   2. Open Food Facts: nome e marca, gratuito e sem chave (não traz NCM).
// "Não encontrado" e "código inválido" voltam com status 200 e success:false, para a tela mostrar a mensagem.
// Versão 18 (2026-11-18): avisa a tela quando o Cosmos recusa (limite 429 ou chave 401/403), em `aviso_ncm`.
// Versão 17: a v16 chamava o Cosmos sem chave e devolvia 400 em qualquer falha.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const COSMOS_TOKEN = Deno.env.get('COSMOS_TOKEN') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const registrarLog = async (dados: {
  administrador_id?: string;
  tipo: 'info' | 'warning' | 'error';
  servico: string;
  mensagem: string;
  stack?: string;
}) => {
  try {
    await supabaseAdmin.from('logs_sistema').insert([{ ...dados, timestamp: new Date().toISOString() }]);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
};

// EAN-8, UPC-12, EAN-13 e GTIN-14 com dígito verificador correto.
export function gtinValido(codigo: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(codigo)) return false;
  const d = codigo.split('').map(Number);
  const verificador = d.pop()!;
  const soma = d.reverse().reduce((t, x, i) => t + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verificador;
}

type Produto = {
  descricao: string;
  marca: string;
  ncm: string;
  imagem_url: string | null;
  preco_sugerido: number | null;
  fonte: 'cosmos' | 'openfoodfacts';
};

const comTempo = (ms: number) => AbortSignal.timeout(ms);

// Por que o NCM pode não ter vindo (mostrado na tela).
type AvisoNcm = 'cosmos_sem_chave' | 'cosmos_limite' | 'cosmos_chave_recusada' | 'cosmos_indisponivel' | null;
async function buscarCosmos(ean: string): Promise<{ produto: Produto | null; aviso: AvisoNcm }> {
  if (!COSMOS_TOKEN) return { produto: null, aviso: 'cosmos_sem_chave' };
  try {
    const r = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${ean}.json`, {
      headers: { 'X-Cosmos-Token': COSMOS_TOKEN, 'User-Agent': 'Cosmos-API-Request' },
      signal: comTempo(8000),
    });
    if (!r.ok) {
      if (r.status !== 404) console.warn('Cosmos respondeu', r.status);
      const aviso: AvisoNcm =
        r.status === 429 ? 'cosmos_limite'
        : r.status === 401 || r.status === 403 ? 'cosmos_chave_recusada'
        : r.status === 404 ? null
        : 'cosmos_indisponivel';
      return { produto: null, aviso };
    }
    const p = await r.json();
    if (!p?.description) return { produto: null, aviso: null };
    return { aviso: null, produto: {
      descricao: p.description,
      marca: p.brand?.name || '',
      ncm: p.ncm?.code?.replace(/\./g, '') || '',
      imagem_url: p.thumbnail || null,
      preco_sugerido: p.avg_price || null,
      fonte: 'cosmos',
    } };
  } catch {
    return { produto: null, aviso: 'cosmos_indisponivel' };
  }
}

async function buscarOpenFoodFacts(ean: string): Promise<Produto | null> {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,product_name_pt,brands,image_front_small_url`,
      { headers: { 'User-Agent': 'EntregaFacil/1.0' }, signal: comTempo(8000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const p = j?.product;
    const nome = (p?.product_name_pt || p?.product_name || '').trim();
    if (j?.status !== 1 || !nome) return null;
    return {
      descricao: nome,
      marca: (p.brands || '').split(',')[0]?.trim() || '',
      ncm: '',
      imagem_url: p.image_front_small_url || null,
      preco_sugerido: null,
      fonte: 'openfoodfacts',
    };
  } catch {
    return null;
  }
}

async function buscarNCM(codigo: string) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/ncm/v1/${codigo.replace(/\./g, '')}`, { signal: comTempo(6000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const servico = 'buscar-produto-ean';
  let administrador_id: string | undefined;

  // Autenticação e permissão: erro de acesso continua com status 4xx.
  let ean = '';
  try {
    const bodyText = await req.text();
    if (!bodyText) return json({ error: 'Pedido vazio' }, 400);
    const body = JSON.parse(bodyText);
    ean = String(body.ean ?? '').replace(/\D/g, '');

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.slice(7).trim());
    if (authError || !user) return json({ error: 'Não autenticado' }, 401);

    const { data: adminProfile } = await supabaseAdmin.from('administradores').select('id').eq('id', user.id).maybeSingle();
    let callerAdminId: string | null = adminProfile?.id ?? null;
    if (!callerAdminId) {
      const { data: employee } = await supabaseAdmin
        .from('funcionarios')
        .select('administrador_id,ativo,bloqueado,permissoes')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!employee || employee.ativo !== true || employee.bloqueado === true || employee.permissoes?.produtos !== true) {
        return json({ error: 'Sem permissão para cadastrar produtos' }, 403);
      }
      callerAdminId = employee.administrador_id;
    }
    if (body.administrador_id && body.administrador_id !== callerAdminId) {
      return json({ error: 'Administrador incompatível com a sessão' }, 403);
    }
    administrador_id = callerAdminId ?? undefined;
  } catch (error: any) {
    return json({ error: 'Pedido inválido' }, 400);
  }

  try {
    if (!gtinValido(ean)) {
      return json({ success: false, motivo: 'codigo_invalido' });
    }

    await registrarLog({ tipo: 'info', servico, mensagem: `Buscando EAN: ${ean}`, administrador_id });

    const cosmos = await buscarCosmos(ean);
    const produto = cosmos.produto ?? (await buscarOpenFoodFacts(ean));
    const aviso_ncm = produto?.ncm ? null : cosmos.aviso;
    if (!produto) {
      await registrarLog({ tipo: 'warning', servico, mensagem: `EAN ${ean} não encontrado${aviso_ncm ? ` (${aviso_ncm})` : ''}`, administrador_id });
      return json({ success: false, motivo: 'nao_encontrado', aviso_ncm });
    }

    const ncmInfo = produto.ncm ? await buscarNCM(produto.ncm) : null;
    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Produto encontrado para EAN ${ean} (${produto.fonte}${aviso_ncm ? `, ${aviso_ncm}` : ''}): ${produto.descricao}`,
      administrador_id,
    });
    return json({ success: true, aviso_ncm, produto: { ...produto, ncm_descricao: ncmInfo?.descricao || null } });
  } catch (error: any) {
    await registrarLog({
      tipo: 'error',
      servico,
      mensagem: `Erro ao buscar EAN: ${error.message}`,
      stack: error.stack,
      administrador_id,
    });
    return json({ error: 'Não foi possível consultar agora. Tente de novo ou preencha manualmente.' }, 502);
  }
});
