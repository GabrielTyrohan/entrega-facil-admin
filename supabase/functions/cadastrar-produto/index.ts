// Cadastra um produto (dono ou funcionária com a permissão "produtos").
// Versão 2026-11-18:
//   - O dono do produto vem da SESSÃO (get_user_admin_id), não do corpo do pedido. Antes a tela mandava o id de
//     quem estava logado; para uma funcionária esse id não é o do dono e o banco recusava (RLS).
//     O campo administrador_id enviado por versões antigas do app é ignorado (não recusado), para elas continuarem
//     funcionando.
//   - O estoque inicial não é mais gravado direto em qtd_estoque: o produto nasce com 0 e o estoque entra por
//     registrar_ajuste_estoque_seguro (entrada_ajuste em movimentacoes_estoque), como manda a regra do estoque.
// verify_jwt continua desligado (como antes); a autenticação é feita aqui, pelo token do usuário.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

class ErroUsuario extends Error {
  constructor(msg: string, public status = 400) {
    super(msg);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const servico = 'cadastrar-produto';
  let administrador_id: string | undefined;

  try {
    const bodyText = await req.text();
    if (!bodyText) throw new ErroUsuario('Pedido vazio');
    const body = JSON.parse(bodyText);
    const { produto } = body;

    // =========================================================
    // AUTENTICAÇÃO E DONO (pela sessão)
    // =========================================================
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) throw new ErroUsuario('Não autenticado', 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ErroUsuario('Não autenticado', 401);

    const { data: podeGerir } = await supabase.rpc('can_manage_produtos');
    if (podeGerir !== true) throw new ErroUsuario('Você não tem permissão para cadastrar produtos', 403);
    const { data: donoId } = await supabase.rpc('get_user_admin_id');
    if (!donoId) throw new ErroUsuario('Não foi possível identificar a empresa do usuário', 403);
    administrador_id = donoId as string;

    // =========================================================
    // VALIDAÇÃO SERVER-SIDE (2ª barreira — independe do frontend)
    // =========================================================
    if (!produto?.produto_nome?.trim()) throw new ErroUsuario('Nome do produto é obrigatório');
    if (!produto?.categoria) throw new ErroUsuario('Categoria é obrigatória');
    if (!produto?.ncm || String(produto.ncm).replace(/\D/g, '').length !== 8) {
      throw new ErroUsuario('NCM deve ter exatamente 8 dígitos');
    }
    if (!produto?.preco_unt || Number(produto.preco_unt) <= 0) {
      throw new ErroUsuario('Preço de venda deve ser maior que zero');
    }
    const estoqueInicial = Number(produto.qtd_estoque ?? 0);
    if (!Number.isFinite(estoqueInicial) || estoqueInicial < 0) {
      throw new ErroUsuario('Estoque inicial inválido');
    }

    await registrarLog({
      tipo: 'info',
      servico,
      mensagem: `Início do cadastro de produto: ${produto.produto_nome}`,
      administrador_id,
    });

    // =========================================================
    // BUSCAR CEST AUTOMATICAMENTE PELO NCM
    // Para cesta básica: CEST é obrigatório na NF-e para produtos
    // com substituição tributária (arroz, feijão, leite, etc.)
    // =========================================================
    const ncmLimpo = String(produto.ncm).replace(/\D/g, '');
    let cestEncontrado: string | null = null;
    let cestLog = 'não encontrado na tabela ncm_cest';

    const { data: ncmCestData } = await supabaseAdmin
      .from('ncm_cest')
      .select('cest, descricao, segmento')
      .eq('ncm', ncmLimpo)
      .maybeSingle();

    if (ncmCestData?.cest) {
      cestEncontrado = ncmCestData.cest;
      cestLog = `CEST ${cestEncontrado} encontrado (${ncmCestData.descricao})`;
    }

    // =========================================================
    // PAYLOAD FINAL COM DADOS FISCAIS
    // CFOP 5102 = venda de mercadoria adquirida de terceiros
    // CST 400   = tributado pelo Simples Nacional sem crédito
    // =========================================================
    const payloadFinal = {
      produto_nome: produto.produto_nome.trim(),
      categoria: produto.categoria,
      ncm: ncmLimpo,
      cest: cestEncontrado ?? produto.cest ?? null,
      cfop_padrao: produto.cfop_padrao || '5102',
      cst_icms: produto.cst_icms || '400',
      aliquota_icms: produto.aliquota_icms ?? 0,
      cst_pis: produto.cst_pis || '07',
      aliquota_pis: produto.aliquota_pis ?? 0,
      cst_cofins: produto.cst_cofins || '07',
      aliquota_cofins: produto.aliquota_cofins ?? 0,
      codigo_barras: produto.codigo_barras || null,
      unidade_medida: produto.unidade_medida || 'UN',
      preco_unt: Number(produto.preco_unt),
      custo_compra: produto.custo_compra ? Number(produto.custo_compra) : null,
      qtd_estoque: 0, // o estoque inicial entra por movimentação, abaixo
      estoque_minimo: produto.estoque_minimo ?? 0,
      estoque_maximo: produto.estoque_maximo ?? 0,
      kit: produto.kit ?? false,
      ativo: produto.ativo ?? true,
      fornecedor_principal: produto.fornecedor_principal || null,
      administrador_id,
    };

    // =========================================================
    // INSERT NO BANCO (com o token do usuário: o RLS confere de novo)
    // =========================================================
    const { data: produtoCriado, error: erroInsert } = await supabase
      .from('produtos_cadastrado')
      .insert(payloadFinal)
      .select('*')
      .single();

    if (erroInsert) {
      if (erroInsert.code === '23505') {
        throw new ErroUsuario('Já existe um produto com este código de barras');
      }
      throw erroInsert;
    }

    const avisos: string[] = [];
    if (!cestEncontrado) {
      avisos.push('CEST não encontrado para este NCM. Verifique o CEST manualmente antes de emitir NF-e.');
    }

    // =========================================================
    // ESTOQUE INICIAL → movimentação de entrada (ajuste)
    // =========================================================
    let produtoFinal = produtoCriado;
    if (estoqueInicial > 0) {
      const { error: erroAjuste } = await supabase.rpc('registrar_ajuste_estoque_seguro', {
        p_produto_id: produtoCriado.id,
        p_tipo_movimentacao: 'entrada_ajuste',
        p_quantidade: estoqueInicial,
        p_motivo: 'Estoque inicial no cadastro do produto',
      });
      if (erroAjuste) {
        avisos.push(
          'O produto foi cadastrado, mas o estoque inicial não foi lançado. Lance a entrada em Movimentações de estoque.'
        );
        await registrarLog({
          tipo: 'warning',
          servico,
          mensagem: `Estoque inicial não lançado para ${produtoCriado.id}: ${erroAjuste.message}`,
          administrador_id,
        });
      } else {
        const { data: atualizado } = await supabase
          .from('produtos_cadastrado')
          .select('*')
          .eq('id', produtoCriado.id)
          .single();
        if (atualizado) produtoFinal = atualizado;
      }
    }

    await registrarLog({
      tipo: cestEncontrado ? 'info' : 'warning',
      servico,
      mensagem: `Produto "${produto.produto_nome}" cadastrado. ID: ${produtoCriado.id}. CEST: ${cestLog}. Estoque inicial: ${estoqueInicial}`,
      administrador_id,
    });

    return json({ success: true, produto: produtoFinal, avisos }, 201);
  } catch (error: any) {
    await registrarLog({
      tipo: 'error',
      servico,
      mensagem: `Erro ao cadastrar produto: ${error.message}`,
      stack: error.stack,
      administrador_id,
    });
    const status = error instanceof ErroUsuario ? error.status : 400;
    const mensagem =
      error instanceof ErroUsuario ? error.message : 'Não foi possível cadastrar o produto. Tente de novo.';
    return json({ error: mensagem }, status);
  }
});
