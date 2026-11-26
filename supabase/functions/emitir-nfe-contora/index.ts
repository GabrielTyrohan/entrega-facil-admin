
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CONTORA_BASE_URL = 'https://fiscal.contora.com.br/api/v1'
const CONTORA_TOKEN = Deno.env.get('CONTORA_API_TOKEN_HOMOLOGACAO') || ''

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function onlyDigits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

function isValidCPF(value: unknown): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const calc = (base: string, factor: number) => {
    let total = 0
    for (const digit of base) total += Number(digit) * factor--
    const result = (total * 10) % 11
    return result === 10 ? 0 : result
  }

  const d1 = calc(cpf.slice(0, 9), 10)
  const d2 = calc(cpf.slice(0, 9) + String(d1), 11)
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2)
}

function isValidCNPJ(value: unknown): boolean {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calc(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const d2 = calc(cnpj.slice(0, 12) + String(d1), [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2)
}

function isValidDocument(value: unknown): boolean {
  const doc = onlyDigits(value)
  if (doc.length === 11) return isValidCPF(doc)
  if (doc.length === 14) return isValidCNPJ(doc)
  return false
}

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function paymentMethod(value: string | null | undefined): string {
  const map: Record<string, string> = {
    dinheiro: '01',
    cheque: '02',
    cartao_credito: '03',
    cartao_debito: '04',
    credito_loja: '05',
    vale_alimentacao: '10',
    vale_refeicao: '11',
    vale_presente: '12',
    vale_combustivel: '13',
    boleto: '15',
    deposito: '16',
    pix: '17',
    transferencia: '18',
    cashback: '19',
    sem_pagamento: '90',
    outros: '99',
  }
  return map[value || ''] || '99'
}

async function registrarLog(input: {
  administrador_id?: string
  tipo: 'info' | 'warning' | 'error'
  servico: string
  mensagem: string
  stack?: string
}) {
  try {
    await supabaseAdmin.from('logs_sistema').insert({
      ...input,
      timestamp: new Date().toISOString(),
    })
  } catch (_) {}
}

/** Rascunho que a Contora recusou (no build ou na criação): precisa de um novo. */
function rascunhoComFalha(nota: { provedor_status?: unknown; processamento_status?: unknown } | null): boolean {
  if (!nota) return false
  const prov = String(nota.provedor_status || '').toLowerCase()
  const proc = String(nota.processamento_status || '').toLowerCase()
  return ['error', 'failed', 'rejected'].includes(prov) ||
    ['failed', 'erro_build', 'erro_draft', 'build_failed'].includes(proc)
}

/** 6 caracteres do SHA-256 (a chave de idempotência da Contora vai até 120). */
async function hashCurto(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(buf)).slice(0, 3).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function contoraFetch(path: string, init: RequestInit, cnpj: string, idempotencyKey?: string) {
  if (!CONTORA_TOKEN) {
    throw new Error('CONTORA_API_TOKEN_HOMOLOGACAO não configurado no Supabase')
  }

  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${CONTORA_TOKEN}`)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')
  headers.set('X-Company-Document', cnpj)
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  const response = await fetch(`${CONTORA_BASE_URL}${path}`, { ...init, headers })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = { raw } }

  if (!response.ok) {
    throw new Error(`Fiscal Contora HTTP ${response.status}: ${JSON.stringify(data)}`)
  }

  return data
}


async function persistirSnapshotItens(input: {
  notaFiscalId: string
  administradorId: string
  itensOrcamento: any[]
  fiscalMap: Map<string, any>
  itensPayload: any[]
}) {
  const { notaFiscalId, administradorId, itensOrcamento, fiscalMap, itensPayload } = input
  const linhas = itensOrcamento.map((item: any, index: number) => {
    const fiscal: any = fiscalMap.get(item.produto_cadastrado_id)
    const payloadItem: any = itensPayload[index]
    if (!fiscal || !payloadItem) {
      throw new Error(`Não foi possível montar o snapshot fiscal do item ${index + 1}`)
    }
    const quantidade = asNumber(item.quantidade)
    const valorUnitario = asNumber(item.valor_venda_unitario)
    return {
      administrador_id: administradorId,
      nota_fiscal_id: notaFiscalId,
      numero_item: index + 1,
      produto_cadastrado_id: item.produto_cadastrado_id || null,
      orcamento_item_id: item.id || null,
      codigo_produto: String(fiscal.produto_cod || item.produto_cadastrado_id || '').slice(0, 60) || null,
      descricao: String(item.descricao || fiscal.produto_nome || 'Item sem descrição').slice(0, 500),
      gtin: fiscal.codigo_barras || null,
      ncm: fiscal.ncm ? onlyDigits(fiscal.ncm) : null,
      cest: fiscal.cest ? onlyDigits(fiscal.cest) : null,
      cfop: payloadItem.cfop || null,
      unidade_comercial: payloadItem.unit || 'UN',
      quantidade,
      valor_unitario: valorUnitario,
      valor_bruto: Math.round(quantidade * valorUnitario * 100) / 100,
      versao_snapshot: 1,
      dados_produto_snapshot: {
        ...fiscal,
        descricao_orcamento: item.descricao ?? null,
        quantidade_orcamento: item.quantidade,
        custo_unitario_orcamento: item.custo_unitario ?? null,
        margem_percentual_orcamento: item.margem_percentual ?? null,
        valor_venda_unitario_orcamento: item.valor_venda_unitario,
        valor_total_orcamento: item.valor_total ?? null,
      },
      dados_tributacao_snapshot: payloadItem.taxes || {},
      payload_item_provedor: payloadItem,
      validacoes: [],
    }
  })

  // Não sobrescreve linhas fiscais já gravadas: somente insere itens ausentes.
  const { error } = await supabaseAdmin
    .from('notas_fiscais_itens')
    .upsert(linhas, {
      onConflict: 'nota_fiscal_id,numero_item',
      ignoreDuplicates: true,
    })
  if (error) {
    throw new Error(`Não foi possível persistir o snapshot fiscal dos itens: ${error.message}`)
  }
}

/**
 * Fase 6d — bloco "ibscbs" por produto. A regra fica no banco
 * (ibscbs_item_payload): devolve null enquanto o grupo não é exigido para o
 * CRT da empresa (Simples: a partir de 04/01/2027) e erro claro quando é
 * exigido e falta CST/cClassTrib ou a alíquota do ano.
 */
async function carregarIbscbs(adminId: string, produtoIds: string[]): Promise<Map<string, any>> {
  const mapa = new Map<string, any>()
  for (const produtoId of [...new Set(produtoIds)]) {
    const { data, error } = await supabaseAdmin.rpc('ibscbs_item_payload', {
      p_administrador_id: adminId,
      p_produto_id: produtoId,
    })
    if (error) throw new Error(error.message)
    if (data) mapa.set(produtoId, data)
  }
  return mapa
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const servico = 'emitir-nfe-contora'
  let adminId = ''

  try {
    if (req.method !== 'POST') throw new Error('Método não permitido')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) throw new Error('Usuário não autenticado')

    const jwt = authHeader.slice(7)
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)
    if (authError || !user) throw new Error('Usuário não autenticado')

    let hasPermission = false

    const { data: adminProfile } = await supabaseAdmin
      .from('administradores')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (adminProfile) {
      adminId = adminProfile.id
      hasPermission = true
    } else {
      const { data: employee } = await supabaseAdmin
        .from('funcionarios')
        .select('administrador_id, permissoes, ativo, bloqueado')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .or('bloqueado.is.null,bloqueado.eq.false')
        .maybeSingle()

      if (employee) {
        adminId = employee.administrador_id
        hasPermission = employee.permissoes?.notas_fiscais === true
      }
    }

    if (!adminId) throw new Error('Usuário não vinculado a uma empresa')
    if (!hasPermission) throw new Error('Sem permissão para emitir NF-e')

    const body = await req.json()
    const orcamentoId = String(body?.orcamentoId || '')
    const clienteIdBody = body?.clienteId ? String(body.clienteId) : null
    const authorize = body?.authorize === true

    if (!orcamentoId) throw new Error('orcamentoId é obrigatório')
    if (authorize) {
      throw new Error('Autorização SEFAZ está bloqueada nesta fase. Use apenas homologação/build.')
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('administradores')
      .select('*')
      .eq('id', adminId)
      .single()

    if (adminError || !admin) throw new Error('Empresa emissora não encontrada')

    const cnpjEmitente = onlyDigits(admin.cpf_cnpj)
    if (!isValidCNPJ(cnpjEmitente)) throw new Error('CNPJ do emitente inválido')
    if (!admin.nfe_contora_company_id) {
      throw new Error('Empresa ainda não cadastrada/sincronizada na Fiscal Contora')
    }
    if (!admin.codigo_municipio) throw new Error('Código IBGE do município do emitente não configurado')
    if (![1, 2, 9].includes(Number(admin.nfe_indicador_ie))) {
      throw new Error('Situação da Inscrição Estadual do emitente não configurada')
    }
    if (Number(admin.nfe_indicador_ie) === 1 && !admin.inscricao_estadual) {
      throw new Error('Inscrição Estadual do emitente não configurada')
    }

    const { data: orcamento, error: orcError } = await supabaseAdmin
      .from('orcamentos_pj')
      .select('*, orcamentos_pj_itens(*)')
      .eq('id', orcamentoId)
      .eq('administrador_id', adminId)
      .single()

    if (orcError || !orcamento) throw new Error('Orçamento PJ não encontrado')
    if (!orcamento.orcamentos_pj_itens?.length) throw new Error('Orçamento não possui itens')
    if (orcamento.consumidor_final === null || orcamento.consumidor_final === undefined) {
      throw new Error('Defina se a operação é para consumidor final antes da validação fiscal')
    }
    if (orcamento.indicador_presenca === null || orcamento.indicador_presenca === undefined) {
      throw new Error('Defina o indicador de presença da operação antes da validação fiscal')
    }

    const clienteId = clienteIdBody || orcamento.cliente_id
    if (!clienteId) throw new Error('Cliente PJ não informado')

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .eq('administrador_id', adminId)
      .single()

    if (clienteError || !cliente) throw new Error('Cliente não encontrado')

    const docCliente = onlyDigits(cliente.cnpj || cliente.cpf)
    if (!isValidDocument(docCliente)) throw new Error('CPF/CNPJ do destinatário inválido')
    if (!cliente.codigo_municipio) throw new Error('Código IBGE do município do destinatário não configurado')

    const indicadorIEDest = Number(cliente.indicador_ie)
    if (![1, 2, 9].includes(indicadorIEDest)) {
      throw new Error('Indicador de Inscrição Estadual do destinatário inválido')
    }
    if (indicadorIEDest === 1 && !String(cliente.inscricao_estadual || '').trim()) {
      throw new Error('Inscrição Estadual do destinatário é obrigatória para contribuinte ICMS')
    }

    const produtoIds = orcamento.orcamentos_pj_itens
      .map((i: any) => i.produto_cadastrado_id)
      .filter(Boolean)

    const { data: produtos, error: produtosError } = await supabaseAdmin
      .from('produtos_cadastrado')
      .select('id, produto_cod, codigo_barras, produto_nome, ncm, cest, cfop_padrao, unidade_medida, cst_icms, aliquota_icms, cst_pis, aliquota_pis, cst_cofins, aliquota_cofins, origem_mercadoria, fiscal_status, cst_ibscbs, cclasstrib')
      .in('id', produtoIds)
      .eq('administrador_id', adminId)

    if (produtosError) throw new Error('Erro ao carregar classificação fiscal dos produtos')
    const fiscalMap = new Map((produtos || []).map((p: any) => [p.id, p]))

    // Fase 6d: IBS/CBS por produto (vazio enquanto não for exigido)
    const ibscbsMap = await carregarIbscbs(adminId, produtoIds)

    const itens = orcamento.orcamentos_pj_itens.map((item: any) => {
      const fiscal: any = fiscalMap.get(item.produto_cadastrado_id)
      if (!fiscal) throw new Error(`Produto fiscal não encontrado: ${item.descricao}`)
      if (fiscal.fiscal_status !== 'validado') {
        throw new Error(`Classificação fiscal pendente de revisão humana: ${item.descricao}. Revise NCM, CEST quando aplicável, CFOP da operação, origem e CST/CSOSN, PIS/COFINS e IBS/CBS antes de validar o produto.`)
      }
      if (!fiscal.ncm || onlyDigits(fiscal.ncm).length !== 8) throw new Error(`NCM inválido: ${item.descricao}`)
      const cfop = onlyDigits(fiscal.cfop_padrao)
      if (cfop.length !== 4) throw new Error(`CFOP inválido: ${item.descricao}`)
      if (!fiscal.cst_icms) throw new Error(`CSOSN/CST ICMS não configurado: ${item.descricao}`)
      if (!fiscal.cst_pis) throw new Error(`CST PIS não configurado: ${item.descricao}`)
      if (!fiscal.cst_cofins) throw new Error(`CST COFINS não configurado: ${item.descricao}`)
      // Formato: CST ICMS com 2 dígitos ou CSOSN com 3 (sem a origem na frente);
      // CST PIS/COFINS com 2 dígitos. Ex.: '0500' e '1' são recusados.
      if (!/^\d{2,3}$/.test(String(fiscal.cst_icms).trim())) {
        throw new Error(`CSOSN/CST ICMS "${fiscal.cst_icms}" inválido em ${item.descricao}: use 2 dígitos (CST) ou 3 (CSOSN), sem a origem na frente. Corrija na Revisão Fiscal.`)
      }
      if (!/^\d{2}$/.test(String(fiscal.cst_pis).trim()) || !/^\d{2}$/.test(String(fiscal.cst_cofins).trim())) {
        throw new Error(`CST PIS/COFINS inválido em ${item.descricao}: use 2 dígitos (ex.: 01, 49). Corrija na Revisão Fiscal.`)
      }

      const quantity = asNumber(item.quantidade)
      const unitPrice = asNumber(item.valor_venda_unitario)
      if (quantity <= 0) throw new Error(`Quantidade inválida: ${item.descricao}`)
      if (unitPrice <= 0) throw new Error(`Valor unitário inválido: ${item.descricao}`)

      const icmsCode = String(fiscal.cst_icms).trim()
      const icmsAliquot = asNumber(fiscal.aliquota_icms)
      const icms: Record<string, unknown> = {
        code: icmsCode,
        origin: fiscal.origem_mercadoria ?? 0,
      }

      if (icmsAliquot > 0) {
        icms.aliquot = icmsAliquot
      }

      // CST 00 destaca ICMS próprio e precisa da alíquota.
      if (icmsCode === '00' && icmsAliquot <= 0) {
        throw new Error(`Alíquota ICMS obrigatória para CST 00: ${item.descricao}`)
      }

      const ibscbs = ibscbsMap.get(item.produto_cadastrado_id)

      return {
        code: String(fiscal.produto_cod || item.produto_cadastrado_id).slice(0, 60),
        name: String(item.descricao || fiscal.produto_nome).slice(0, 120),
        ncm: onlyDigits(fiscal.ncm),
        ...(fiscal.cest ? { cest: onlyDigits(fiscal.cest) } : {}),
        cfop,
        unit: fiscal.unidade_medida || 'UN',
        quantity,
        unit_price: unitPrice,
        taxes: {
          icms,
          pis: {
            code: String(fiscal.cst_pis),
            aliquot: asNumber(fiscal.aliquota_pis),
          },
          cofins: {
            code: String(fiscal.cst_cofins),
            aliquot: asNumber(fiscal.aliquota_cofins),
          },
          ...(ibscbs ? { ibscbs } : {}),
        },
      }
    })

    const total = Math.round(itens.reduce((acc: number, item: any) => acc + item.quantity * item.unit_price, 0) * 100) / 100
    if (total <= 0) throw new Error('Valor total do orçamento inválido')

    const idempotencyKey = `entrega-facil:${adminId}:orcamento:${orcamentoId}:nfe:homologacao`

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('notas_fiscais')
      .select('*')
      .eq('administrador_id', adminId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingError) throw new Error(`Erro ao verificar idempotência local: ${existingError.message}`)

    // Depois do webhook, o build fica em provedor_status ('built_unsigned') e
    // processamento_status vira 'completed'.
    const existingBuilt = existing?.provedor_documento_id && !rascunhoComFalha(existing) && (
      String(existing.provedor_status || '').toLowerCase().startsWith('built') ||
      String(existing.processamento_status || '').toLowerCase().includes('built_unsigned') ||
      String(existing.processamento_status || '').toLowerCase().includes('built') ||
      String(existing.processamento_status || '').toLowerCase().includes('validado')
    )

    if (existingBuilt) {
      await persistirSnapshotItens({
        notaFiscalId: existing.id,
        administradorId: adminId,
        itensOrcamento: orcamento.orcamentos_pj_itens,
        fiscalMap,
        itensPayload: itens,
      })
      return new Response(JSON.stringify({
        success: true,
        reused: true,
        phase: 'build_homologacao',
        transmittedToSefaz: false,
        notaFiscalId: existing.id,
        documentoId: existing.provedor_documento_id,
        numero: Number(existing.numero_nota),
        status: existing.provedor_status,
        processamentoStatus: existing.processamento_status,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let numero: number
    let notaLocal: any = existing || null

    if (existing?.numero_nota) {
      numero = Number(existing.numero_nota)
      if (!Number.isFinite(numero) || numero <= 0) {
        throw new Error('Numeração local da NF-e inválida')
      }
    } else {
      const { data: numeroReservado, error: numeroError } = await supabaseAdmin.rpc('reservar_numero_nfe', {
        p_administrador_id: adminId,
        p_ambiente: 'homologacao',
        p_modelo: '55',
        p_serie: 1,
      })

      if (numeroError || !numeroReservado) throw new Error('Não foi possível reservar a numeração da NF-e')
      numero = Number(numeroReservado)
    }

    const recipientName =
      cliente.razao_social ||
      cliente.nome_fantasia ||
      [cliente.nome, cliente.sobrenome].filter(Boolean).join(' ') ||
      orcamento.cliente_nome

    const bairro = cliente.Bairro || cliente.bairro
    const cidade = cliente.Cidade || cliente.cidade
    const uf = cliente.Estado || cliente.estado

    if (!recipientName || !cliente.endereco || !bairro || !cidade || !uf || !cliente.cep) {
      throw new Error('Endereço fiscal do destinatário está incompleto')
    }

    const payload = {
      document_type: 'nfe',
      environment: 'homologacao',
      series: 1,
      number: numero,
      payload: {
        number: numero,
        series: 1,
        nature_operation: 'Venda de mercadoria',
        operation_type: 'saida',
        consumer_final: Boolean(orcamento.consumidor_final),
        presence_indicator: Number(orcamento.indicador_presenca),
        recipient: {
          name: recipientName,
          document: docCliente,
          state_registration_indicator: indicadorIEDest,
          ...(indicadorIEDest === 1 && cliente.inscricao_estadual
            ? { state_registration: onlyDigits(cliente.inscricao_estadual) }
            : {}),
          ...(cliente.email ? { email: cliente.email } : {}),
          address: {
            street: cliente.endereco,
            number: cliente.numero || 'S/N',
            district: bairro,
            city_name: cidade,
            city_code: String(cliente.codigo_municipio),
            state_code: uf,
            postal_code: onlyDigits(cliente.cep),
          },
        },
        items: itens,
        payments: [{
          method: paymentMethod(orcamento.forma_pagamento),
          amount: paymentMethod(orcamento.forma_pagamento) === '90' ? 0 : total,
          ...(paymentMethod(orcamento.forma_pagamento) === '99'
            ? { description: 'Outros' }
            : {}),
        }],
      },
    }

    if (!notaLocal) {
      const { data: createdLocal, error: insertError } = await supabaseAdmin
        .from('notas_fiscais')
        .insert({
          administrador_id: adminId,
          tipo: 'saida',
          numero_nota: String(numero),
          serie: '1',
          modelo: '55',
          cliente_id: cliente.id,
          data_emissao: new Date().toISOString().slice(0, 10),
          valor_total: total,
          status: 'pendente',
          referencia_tipo: 'orcamento',
          referencia_id: orcamentoId,
          provedor: 'fiscal_contora',
          provedor_status: 'preparando',
          processamento_status: 'preparando',
          ambiente: 'homologacao',
          idempotency_key: idempotencyKey,
          ultima_sincronizacao_em: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError || !createdLocal) {
        throw new Error(`Não foi possível registrar a tentativa fiscal localmente: ${insertError?.message || 'erro desconhecido'}`)
      }
      notaLocal = createdLocal
    }

    await persistirSnapshotItens({
      notaFiscalId: notaLocal.id,
      administradorId: adminId,
      itensOrcamento: orcamento.orcamentos_pj_itens,
      fiscalMap,
      itensPayload: itens,
    })

    let documento: any = null

    // Rascunho que falhou na Contora não pode ser editado nem apagado; a
    // orientação dela é "corrija o payload e reenvie com o mesmo número".
    // Então, depois de uma falha, cria um rascunho novo com o mesmo número.
    const rascunhoFalhou = rascunhoComFalha(notaLocal)

    // A chave muda quando o conteúdo muda: o mesmo pedido repetido devolve a
    // mesma resposta (24 h na Contora), e um pedido corrigido vira um rascunho
    // novo em vez de dar 409 (mesma chave com corpo diferente).
    // Formato curto (≈ 93 caracteres; a Contora aceita até 120).
    const draftKey = `ef:${adminId}:orc:${orcamentoId}:nfe:h:${await hashCurto(JSON.stringify(payload))}`

    if (notaLocal.provedor_documento_id && !rascunhoFalhou) {
      documento = {
        id: notaLocal.provedor_documento_id,
        status: notaLocal.provedor_status,
        processing_status: notaLocal.processamento_status,
      }
    } else {
      await registrarLog({
        administrador_id: adminId,
        tipo: 'info',
        servico,
        mensagem: rascunhoFalhou
          ? `Recriando rascunho Contora (o anterior ${notaLocal.provedor_documento_id} falhou) para orçamento ${orcamentoId}`
          : `Criando rascunho Contora em homologação para orçamento ${orcamentoId}`,
      })

      try {
        const draftResult = await contoraFetch(
          '/nfe/drafts',
          { method: 'POST', body: JSON.stringify(payload) },
          cnpjEmitente,
          draftKey
        )

        documento = draftResult?.data
        if (!documento?.id) throw new Error('Contora não retornou o ID do rascunho')

        const { error: draftUpdateError } = await supabaseAdmin
          .from('notas_fiscais')
          .update({
            provedor_documento_id: documento.id,
            provedor_status: documento.status || 'draft',
            processamento_status: documento.processing_status || 'draft',
            erro_codigo: null,
            erro_mensagem: null,
            ultima_sincronizacao_em: new Date().toISOString(),
          })
          .eq('id', notaLocal.id)

        if (draftUpdateError) {
          throw new Error(`Rascunho criado na Contora, mas falhou ao vincular localmente: ${draftUpdateError.message}`)
        }
      } catch (draftError: any) {
        await supabaseAdmin
          .from('notas_fiscais')
          .update({
            processamento_status: 'erro_draft',
            erro_mensagem: String(draftError?.message || 'Erro ao criar rascunho').slice(0, 2000),
            ultima_sincronizacao_em: new Date().toISOString(),
          })
          .eq('id', notaLocal.id)
        throw draftError
      }
    }

    let buildResult: any
    try {
      buildResult = await contoraFetch(
        `/nfe/drafts/${documento.id}/build`,
        { method: 'POST', body: JSON.stringify({ sign: false }) },
        cnpjEmitente,
        `ef:${documento.id}:build`
      )
    } catch (buildError: any) {
      await supabaseAdmin
        .from('notas_fiscais')
        .update({
          processamento_status: 'erro_build',
          erro_mensagem: String(buildError?.message || 'Erro no build').slice(0, 2000),
          ultima_sincronizacao_em: new Date().toISOString(),
        })
        .eq('id', notaLocal.id)
      throw buildError
    }

    const buildData = buildResult?.data || buildResult

    const { error: updateError } = await supabaseAdmin
      .from('notas_fiscais')
      .update({
        provedor_status: buildData?.status || documento.status || 'draft',
        processamento_status: buildData?.processing_status || 'built_unsigned',
        ultima_sincronizacao_em: new Date().toISOString(),
        erro_codigo: null,
        erro_mensagem: null,
      })
      .eq('id', notaLocal.id)

    if (updateError) throw new Error(`Build concluído, mas falhou ao atualizar status local: ${updateError.message}`)

    await registrarLog({
      administrador_id: adminId,
      tipo: 'info',
      servico,
      mensagem: `Build Contora concluído em homologação para orçamento ${orcamentoId}; documento ${documento.id}`,
    })

    return new Response(JSON.stringify({
      success: true,
      phase: 'build_homologacao',
      transmittedToSefaz: false,
      notaFiscalId: notaLocal.id,
      documentoId: documento.id,
      numero,
      status: buildData?.status || documento.status,
      processamentoStatus: buildData?.processing_status || 'built_unsigned',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    await registrarLog({
      administrador_id: adminId || undefined,
      tipo: 'error',
      servico,
      mensagem: `Erro na validação Contora: ${error.message}`,
      stack: error.stack,
    })

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
