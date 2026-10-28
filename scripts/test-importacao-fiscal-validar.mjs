#!/usr/bin/env node
// scripts/test-importacao-fiscal-validar.mjs
//
// Diagnóstico controlado da RPC `importar_produtos_fiscal_lote_seguro`.
//
// Usa EXCLUSIVAMENTE p_modo = "validar" (nenhuma gravação).
// Autentica uma conta de administrador de TESTE no Supabase.
// NÃO cria, altera ou exclui dados no banco.
//
// Uso:
//   1. Crie .env.fiscal-test.local com FISCAL_TEST_ADMIN_EMAIL=<email de teste>
//   2. npm run test:fiscal-import-validate
//   3. Informe a senha quando solicitado (caracteres ocultos).

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';
import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 1. Carregar variáveis de ambiente (sem expor valores em logs)
// ---------------------------------------------------------------------------

// .env fornece VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Constantes de segurança
// ---------------------------------------------------------------------------

export const REAL_ADMIN_ID = '3ec56871-3ba5-469f-8e9b-6c927ce3f6ad';
const MAX_REFERENCIAS = 50;
const MAX_TENTATIVAS = 10;

// ---------------------------------------------------------------------------
// 2. Ler e-mail diretamente do arquivo .env.fiscal-test.local (sem process.env)
// ---------------------------------------------------------------------------

export function lerEmailDoArquivoTeste(caminhoArquivo) {
  const caminho =
    caminhoArquivo || resolve(process.cwd(), '.env.fiscal-test.local');
  let conteudo;
  try {
    conteudo = readFileSync(caminho, 'utf-8');
  } catch {
    return null;
  }

  for (const linha of conteudo.split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const chave = trimmed.slice(0, idx).trim();
    if (chave === 'FISCAL_TEST_ADMIN_EMAIL') {
      const valor = trimmed.slice(idx + 1).trim();
      // Remover aspas opcionais
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        return valor.slice(1, -1);
      }
      return valor;
    }
  }
  return null;
}

// O e-mail esperado vem EXCLUSIVAMENTE do arquivo, nunca de process.env
const testAdminEmail = lerEmailDoArquivoTeste();

// ---------------------------------------------------------------------------
// Helpers de log (nunca expõem segredos)
// ---------------------------------------------------------------------------

function log(msg) {
  process.stdout.write(msg + '\n');
}

function logErro(msg) {
  process.stderr.write('ERRO: ' + msg + '\n');
}

function validarEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env. ' +
        'Verifique o arquivo .env.',
    );
  }
  if (!testAdminEmail) {
    throw new Error(
      'FISCAL_TEST_ADMIN_EMAIL não encontrada. Crie .env.fiscal-test.local com ' +
        'FISCAL_TEST_ADMIN_EMAIL=<email da conta de teste>.',
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Prompt de senha oculta (sem dependências externas)
// ---------------------------------------------------------------------------

function promptHidden(promptText) {
  return new Promise((resolvePromise) => {
    process.stdout.write(promptText);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (key) => {
      if (key === '\n' || key === '\r' || key === '\r\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolvePromise(password);
      } else if (key === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (key === '\u007f' || key === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += key;
      }
    };
    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// 4. Validações locais de referência
// ---------------------------------------------------------------------------

export function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function numeroFinito(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

export function quantidadeInvalidaParaEstoque(valor) {
  if (valor === null || valor === undefined) return true;
  if (!Number.isFinite(valor)) return true;
  if (valor < 0) return true;
  if (!Number.isInteger(valor)) return true;
  return false;
}

/**
 * Reconhece `kit` quando vier como booleano ou como texto válido.
 * Valores aceitos: true, false, "true", "false", "1", "0", "sim", "nao", "não".
 * Valores desconhecidos são rejeitados (sem conversão implícita).
 */
export function kitEhReconhecido(valor) {
  if (typeof valor === 'boolean') return true;
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    return [
      'true',
      'false',
      '1',
      '0',
      'sim',
      'nao',
      'não',
    ].includes(normalizado);
  }
  return false;
}

export function referenciaEhCandidataValida(ref) {
  if (!ref || typeof ref !== 'object') return false;
  // Descrição não vazia
  if (!textoPreenchido(ref.descricao)) return false;
  // Código não vazio
  if (!textoPreenchido(ref.codigo)) return false;
  // Estoque válido (não ausente, não negativo, não fracionário)
  if (quantidadeInvalidaParaEstoque(ref.estoque)) return false;
  // Preço válido (não ausente, não NaN, maior que zero)
  if (ref.preco1 === null || ref.preco1 === undefined) return false;
  if (!Number.isFinite(ref.preco1)) return false;
  if (ref.preco1 <= 0) return false;
  // kit reconhecível (booleano ou texto válido)
  if (!kitEhReconhecido(ref.kit)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 5. Verificação de proteção do administrador real
// ---------------------------------------------------------------------------

export function ehAdministradorReal(userId) {
  return userId === REAL_ADMIN_ID;
}

// ---------------------------------------------------------------------------
// 6. Contagens de integridade
// ---------------------------------------------------------------------------

async function contarTabela(supabase, tabela, adminId, filtroExtra) {
  let query = supabase
    .from(tabela)
    .select('id', { count: 'exact', head: true });

  if (adminId) {
    query = query.eq('administrador_id', adminId);
  }

  if (filtroExtra) {
    query = filtroExtra(query);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Falha ao contar ${tabela}: ${error.message}`);
  }
  return typeof count === 'number' ? count : 0;
}

async function medirEstado(supabase, adminId) {
  const estado = {};

  // 1. Produtos em produtos_cadastrado
  estado.produtosCadastrados = await contarTabela(
    supabase,
    'produtos_cadastrado',
    adminId,
    null,
  );

  // 2. Referências em produtos_fiscal_referencia
  estado.referenciasFiscais = await contarTabela(
    supabase,
    'produtos_fiscal_referencia',
    adminId,
    null,
  );

  // 3. Lotes em importacoes_produtos_fiscal
  try {
    estado.lotesImportacao = await contarTabela(
      supabase,
      'importacoes_produtos_fiscal',
      adminId,
      null,
    );
  } catch (err) {
    // Tentar sem filtro de administrador_id (pode não existir a coluna)
    try {
      estado.lotesImportacao = await contarTabela(
        supabase,
        'importacoes_produtos_fiscal',
        null,
        null,
      );
    } catch (err2) {
      throw new Error(
        `Falha ao contar importacoes_produtos_fiscal: ${err2.message}`,
      );
    }
  }

  // 4. Itens em itens_importacao_produtos_fiscal
  try {
    estado.itensImportacao = await contarTabela(
      supabase,
      'itens_importacao_produtos_fiscal',
      null,
      null,
    );
  } catch (err) {
    throw new Error(
      `Falha ao contar itens_importacao_produtos_fiscal: ${err.message}`,
    );
  }

  // 5. Produtos com importacao_id não nulo
  try {
    estado.produtosComImportacao = await contarTabela(
      supabase,
      'produtos_cadastrado',
      adminId,
      (q) => q.not('importacao_id', 'is', null),
    );
  } catch (err) {
    throw new Error(
      `Falha ao contar produtos com importacao_id: ${err.message}`,
    );
  }

  return estado;
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------

async function main() {
  let password = '';
  let supabase = null;

  try {
    validarEnv();

    log('=== Diagnóstico de importação fiscal (modo validar) ===');
    log('Autenticando conta de teste...');

    // Cliente temporário: sem persistência de sessão
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Prompt de senha oculta
    password = await promptHidden('Senha da conta de teste: ');
    if (!password) {
      throw new Error('Senha não informada. Abortando.');
    }

    // Autenticar
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: testAdminEmail,
        password,
      });

    if (authError) {
      throw new Error(`Falha de autenticação: ${authError.message}`);
    }

    const user = authData?.user;
    if (!user) {
      throw new Error('Autenticação não retornou usuário. Abortando.');
    }

    // Verificar e-mail exato
    if (user.email !== testAdminEmail) {
      throw new Error(
        `E-mail autenticado (${user.email}) não corresponde ao e-mail de teste configurado. Abortando.`,
      );
    }

    // Proteção: bloquear UUID do administrador real
    if (ehAdministradorReal(user.id)) {
      throw new Error(
        'A sessão corresponde ao UUID do administrador real. ' +
          'Este teste é exclusivo para a conta de teste. Abortando imediatamente.',
      );
    }

    log('E-mail verificado. Confirmando registro de administrador...');

    // Verificar se é administrador no banco
    const { data: adminRecord, error: adminError } = await supabase
      .from('administradores')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError) {
      throw new Error(
        `Falha ao verificar registro de administrador: ${adminError.message}`,
      );
    }
    if (!adminRecord) {
      throw new Error(
        'O usuário autenticado não possui registro na tabela administradores. Abortando.',
      );
    }

    log('Administrador confirmado. Buscando referências fiscais...');

    // Buscar referências fiscais do admin de teste (até 50)
    const { data: referencias, error: refError } = await supabase
      .from('produtos_fiscal_referencia')
      .select('*')
      .eq('administrador_id', user.id)
      .order('linha_origem', { ascending: true })
      .limit(MAX_REFERENCIAS);

    if (refError) {
      throw new Error(`Falha ao buscar referências fiscais: ${refError.message}`);
    }

    const todasReferencias = referencias || [];
    log(`Total de referências lidas: ${todasReferencias.length}`);

    // Filtrar candidatos válidos localmente
    const candidatos = todasReferencias.filter(referenciaEhCandidataValida);
    log(`Candidatos válidos após filtro local: ${candidatos.length}`);

    if (candidatos.length === 0) {
      throw new Error(
        'Nenhuma referência acessível ao usuário de teste atende aos critérios ' +
          'mínimos (descrição, código, estoque, preço, kit). ' +
          'O teste não pode prosseguir sem modificar dados.',
      );
    }

    // Medir estado ANTES
    log('Medindo estado do banco antes da chamada...');
    let estadoAntes;
    try {
      estadoAntes = await medirEstado(supabase, user.id);
    } catch (err) {
      throw new Error(
        `Impedimento: não foi possível medir o estado antes da chamada. ${err.message}`,
      );
    }

    log('Estado antes:');
    log(`  produtos_cadastrado: ${estadoAntes.produtosCadastrados}`);
    log(`  produtos_fiscal_referencia: ${estadoAntes.referenciasFiscais}`);
    log(`  importacoes_produtos_fiscal: ${estadoAntes.lotesImportacao}`);
    log(`  itens_importacao_produtos_fiscal: ${estadoAntes.itensImportacao}`);
    log(`  produtos com importacao_id: ${estadoAntes.produtosComImportacao}`);

    // Executar RPC em modo validar (até MAX_TENTATIVAS candidatos)
    log(`\nExecutando RPC em modo "validar" (máx. ${MAX_TENTATIVAS} tentativas)...`);

    let validacaoAprovada = false;
    let ultimoResultado = null;
    let tentativasRealizadas = 0;

    for (let i = 0; i < Math.min(MAX_TENTATIVAS, candidatos.length); i++) {
      const ref = candidatos[i];
      tentativasRealizadas++;
      log(`\n  Tentativa ${tentativasRealizadas}: referência ${ref.id}`);

      let resposta;
      try {
        const { data, error } = await supabase.rpc(
          'importar_produtos_fiscal_lote_seguro',
          {
            p_idempotency_key: null,
            p_modo: 'validar',
            p_itens: [
              {
                referencia_id: ref.id,
                categoria: 'Categoria de teste',
                unidade_medida: 'UN',
                ativo: false,
                confirmar_descricao_duplicada: false,
              },
            ],
          },
        );

        if (error) {
          // Erro de autenticação ou permissão → parar imediatamente
          if (
            error.message?.toLowerCase().includes('permission') ||
            error.message?.toLowerCase().includes('auth') ||
            error.message?.toLowerCase().includes('rls') ||
            error.code === '42501' ||
            error.code === 'PGRST301'
          ) {
            throw new Error(
              `Erro de permissão/autenticação na RPC: ${error.message}. Parando imediatamente.`,
            );
          }
          log(`    RPC retornou erro: ${error.message}`);
          ultimoResultado = { erro: error.message };
          continue;
        }

        resposta = data;
      } catch (err) {
        if (
          err.message?.includes('permissão') ||
          err.message?.includes('autenticação')
        ) {
          throw err;
        }
        log(`    Exceção: ${err.message}`);
        ultimoResultado = { erro: err.message };
        continue;
      }

      // Normalizar resposta (pode ser string JSON)
      let normalizada = resposta;
      if (typeof normalizada === 'string') {
        try {
          normalizada = JSON.parse(normalizada);
        } catch {
          log('    Resposta não é JSON válido.');
          ultimoResultado = { erro: 'JSON inválido' };
          continue;
        }
      }

      if (!normalizada || typeof normalizada !== 'object') {
        log('    Resposta inconclusiva (não é objeto).');
        ultimoResultado = { erro: 'Resposta inconclusiva' };
        continue;
      }

      const sucesso = normalizada.sucesso === true;
      const modo = normalizada.modo || 'validar';
      const podeGravar = normalizada.pode_gravar === true;
      const gravacaoRealizada =
        normalizada.gravacao_realizada === true;

      log(
        `    sucesso=${sucesso}, modo=${modo}, pode_gravar=${podeGravar}, gravacao_realizada=${gravacaoRealizada}`,
      );

      ultimoResultado = normalizada;

      if (sucesso && modo === 'validar' && podeGravar && !gravacaoRealizada) {
        validacaoAprovada = true;
        log('    ✅ Validação aprovada para esta referência.');
        break;
      } else {
        log('    Validação não aprovada. Tentando próximo candidato...');
      }
    }

    // Medir estado DEPOIS
    log('\nMedindo estado do banco depois da chamada...');
    let estadoDepois;
    let integridadeConclusiva = true;
    try {
      estadoDepois = await medirEstado(supabase, user.id);
    } catch (err) {
      integridadeConclusiva = false;
      logErro(`Falha ao medir estado depois: ${err.message}`);
    }

    if (estadoDepois) {
      log('Estado depois:');
      log(`  produtos_cadastrado: ${estadoDepois.produtosCadastrados}`);
      log(`  produtos_fiscal_referencia: ${estadoDepois.referenciasFiscais}`);
      log(`  importacoes_produtos_fiscal: ${estadoDepois.lotesImportacao}`);
      log(`  itens_importacao_produtos_fiscal: ${estadoDepois.itensImportacao}`);
      log(`  produtos com importacao_id: ${estadoDepois.produtosComImportacao}`);

      // Comparar antes e depois
      log('\nComparação antes/depois:');
      const comparacoes = [
        ['produtos_cadastrado', estadoAntes.produtosCadastrados, estadoDepois.produtosCadastrados],
        ['produtos_fiscal_referencia', estadoAntes.referenciasFiscais, estadoDepois.referenciasFiscais],
        ['importacoes_produtos_fiscal', estadoAntes.lotesImportacao, estadoDepois.lotesImportacao],
        ['itens_importacao_produtos_fiscal', estadoAntes.itensImportacao, estadoDepois.itensImportacao],
        ['produtos com importacao_id', estadoAntes.produtosComImportacao, estadoDepois.produtosComImportacao],
      ];

      let todasIguais = true;
      for (const [nome, antes, depois] of comparacoes) {
        const igual = antes === depois;
        if (!igual) todasIguais = false;
        log(`  ${nome}: antes=${antes}, depois=${depois} ${igual ? '✅' : '⚠️ DIFERENÇA'}`);
      }

      if (!todasIguais) {
        log('\n⚠️ ALERTA: Houve diferença nas contagens antes/depois. O teste NÃO passou integralmente.');
      } else {
        log('\n✅ Todas as contagens permaneceram iguais (nenhum dado foi alterado).');
      }
    } else {
      log('\n⚠️ Verificação de integridade inconclusiva (falha de leitura posterior).');
    }

    // Resultado final
    log('\n=== Resultado ===');
    log(`Tentativas realizadas: ${tentativasRealizadas}`);
    if (validacaoAprovada) {
      log('✅ Validação aprovada: sucesso=true, modo=validar, pode_gravar=true, gravacao_realizada=false');
    } else {
      log('❌ Nenhuma validação aprovada nas tentativas realizadas.');
      if (ultimoResultado) {
        log(`Último resultado: ${JSON.stringify(ultimoResultado)}`);
      }
    }

    if (!integridadeConclusiva) {
      log('⚠️ Verificação de integridade inconclusiva.');
    }
  } catch (err) {
    logErro(err.message || String(err));
    process.exitCode = 1;
  } finally {
    // Limpar senha da memória
    password = '';

    // Encerrar sessão
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignorar erros de signOut
      }
    }

    log('\nSessão encerrada. Senha limpa da memória.');
  }
}

// Executar main() apenas quando o arquivo é executado diretamente (não quando importado)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && __filename === process.argv[1].replace(/\\/g, '/')) {
  main();
}
