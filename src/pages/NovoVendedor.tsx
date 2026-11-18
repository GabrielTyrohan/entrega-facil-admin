import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ArrowLeft, Save, User, Mail, Phone, Lock, MapPin, Calendar, FileText, CreditCard, RefreshCw, CheckCircle2, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PainelLateral } from '../components/ui/lista';
import { useAuth } from '../contexts/AuthContext';
import { QUERY_KEYS } from '../lib/constants/queryKeys';
import { supabase } from '../lib/supabase';
import { toast } from '../utils/toast';

interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix?: string;
}

/** Seção do formulário: grupo simples no painel lateral, cartão na página. */
function Secao({ emPainel, icone: Icone, titulo, children }: { emPainel?: boolean; icone: typeof User; titulo: string; children: React.ReactNode }) {
  if (emPainel) {
    return (
      <fieldset className="space-y-4">
        <legend className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
          <Icone className="h-3.5 w-3.5" /> {titulo}
        </legend>
        {children}
      </fieldset>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-white">
        <Icone className="h-4 w-4 text-gray-400" /> {titulo}
      </h2>
      {children}
    </div>
  );
}

interface NovoVendedorProps {
  /** Abre como painel lateral por cima da lista de Vendedores. */
  emPainel?: boolean;
  aberto?: boolean;
  onFechar?: () => void;
}

const NovoVendedor: React.FC<NovoVendedorProps> = ({ emPainel = false, aberto, onFechar }) => {
  const navigate = useNavigate();
  const [criado, setCriado] = useState<{ nome: string; senha: string } | null>(null);
  const { user, adminId, isAdmin } = useAuth();
  const targetAdminId = adminId || user?.id;
  const queryClient = useQueryClient();

  // Função para gerar senha numérica de 6 dígitos
  const gerarSenhaAleatoria = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Função para obter data atual no formato YYYY-MM-DD
  const obterDataAtual = (): string => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: gerarSenhaAleatoria(), // Gera senha automática de 6 dígitos
    endereco: '',
    dataInicio: obterDataAtual(), // Data atual como padrão
    tipoVinculo: 'representado',  // 'representado' | 'autonomo'
    percentualMinimo: 50, // 50% como padrão
    contrato: '',
    ativo: true,
    status: true,
    diaFechamento: 1,
    comissaoPercentual: 0,
    tipoContrato: '' as '' | 'efetivado' | 'autonomo',
  });

  const [dadosBancarios, setDadosBancarios] = useState<DadosBancarios>({
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'corrente',
    pix: ''
  });

  const [loading, setLoading] = useState(false);

  // Função para formatar telefone com máscara (xx) xxxxx-xxxx
  const formatTelefone = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    const limitedNumbers = numbers.slice(0, 11);
    
    // Aplica a máscara baseada no tamanho
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  // Função para formatar agência (máximo 4 dígitos)
  const formatAgencia = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 4 dígitos
    return numbers.slice(0, 4);
  };

  // Função para formatar conta com máscara (xxxxx-x)
  const formatConta = (value: string): string => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 6 dígitos
    const limitedNumbers = numbers.slice(0, 6);
    
    // Aplica a máscara se tiver mais de 5 dígitos
    if (limitedNumbers.length > 5) {
      return `${limitedNumbers.slice(0, 5)}-${limitedNumbers.slice(5)}`;
    }
    
    return limitedNumbers;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'percentualMinimo' || name === 'comissaoPercentual') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (name === 'telefone') {
      const formatted = formatTelefone(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBankDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'agencia') {
      const formatted = formatAgencia(value);
      setDadosBancarios(prev => ({ ...prev, [name]: formatted }));
    } else if (name === 'conta') {
      const formatted = formatConta(value);
      setDadosBancarios(prev => ({ ...prev, [name]: formatted }));
    } else {
      setDadosBancarios(prev => ({ ...prev, [name]: value }));
    }
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // Validar senha (exatamente 6 dígitos)
    if (!/^\d{6}$/.test(formData.senha)) {
      toast.error('Senha deve conter exatamente 6 números');
      setLoading(false);
      return;
    }

    // Validar campos obrigatórios
    if (!formData.nome || !formData.email) {
      toast.error('Preencha todos os campos obrigatórios');
      setLoading(false);
      return;
    }

    // Chama a RPC function que cria o hash no backend
    const { data, error } = await supabase.rpc('criar_vendedor_com_hash', {
      p_administrador_id: targetAdminId,
      p_nome: formData.nome,
      p_senha_plain: formData.senha, // Envia senha em texto plano (6 dígitos)
      p_telefone: formData.telefone || null,
      p_email: formData.email || null,
      p_endereco: formData.endereco || null,
      p_data_inicio: formData.dataInicio || null,
      p_tipo_vinculo: formData.tipoVinculo || null,
      p_percentual_minimo: formData.percentualMinimo || 0,
      // Representado: o dono paga a assinatura; autônomo: o próprio vendedor paga.
      p_tipo_cobranca: formData.tipoVinculo === 'autonomo' ? 'pago_vendedor' : 'pago_admin',
      p_valor_assinatura: 100,
      p_dia_fechamento: formData.diaFechamento,
    });

    if (error) {
      console.error('Erro do Supabase:', error);
      throw new Error(error.message || 'Erro ao criar vendedor');
    }

    // Verifica o retorno da função
    const resultado = data as { success: boolean; vendedor_id?: string; erro?: string };

    if (!resultado.success) {
      throw new Error(resultado.erro || 'Erro desconhecido ao criar vendedor');
    }

    // Comissão e tipo de contrato (só o dono define)
    if (isAdmin && (formData.comissaoPercentual > 0 || formData.tipoContrato)) {
      const { error: comissaoError } = await supabase
        .from('vendedores')
        .update({
          comissao_percentual: Number(formData.comissaoPercentual) || 0,
          tipo_contrato: formData.tipoContrato || null,
        })
        .eq('id', resultado.vendedor_id);

      if (comissaoError) {
        console.warn('Erro ao salvar comissão:', comissaoError);
        toast.warning('Vendedor criado, mas a comissão não foi salva. Ajuste na edição do vendedor.');
      }
    }

    // Se tiver dados bancários, atualiza o vendedor
    if (dadosBancarios.banco || dadosBancarios.agencia || dadosBancarios.conta) {
      const { error: updateError } = await supabase
        .from('vendedores')
        .update({
          dados_bancarios: dadosBancarios
        })
        .eq('id', resultado.vendedor_id);

      if (updateError) {
        console.warn('Erro ao salvar dados bancários:', updateError);
        // Não impede o sucesso, apenas avisa
      }
    }

    // Mostrar senha ao admin com destaque
    // Invalida a lista de vendedores ANTES de navegar (evita stale de 5 min)
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEYS.VENDEDORES]
    });

    if (emPainel) {
      // No painel, a senha fica na tela com botão de copiar até a pessoa clicar em Concluir.
      setCriado({ nome: formData.nome, senha: formData.senha });
      toast.success('Vendedor cadastrado.');
    } else {
      toast.success(
        `✅ Vendedor criado com sucesso!\n\n🔐 SENHA DE ACESSO: ${formData.senha}\n\n⚠️ Anote esta senha! Ela não poderá ser recuperada.`
      );

      // Aguarda 2 segundos antes de navegar para dar tempo de copiar a senha
      setTimeout(() => {
        navigate('/vendedores');
      }, 2000);
    }

  } catch (error: any) {
    console.error('Erro ao criar vendedor:', error);
    toast.error(`Erro ao criar vendedor: ${error.message}`);
  } finally {
    setLoading(false);
  }
};


  const fechar = () => {
    if (emPainel && onFechar) onFechar();
    else navigate('/vendedores');
  };

  const inputCls =
    'h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const iconInputCls = `${inputCls} pl-9`;
  const labelCls = 'mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-gray-300';
  const dicaCls = 'mt-1 text-xs text-gray-500 dark:text-gray-400';
  const grade = emPainel ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-5 md:grid-cols-2';
  const largo = emPainel ? '' : 'md:col-span-2';
  const campos = (
    <div className={emPainel ? 'space-y-7' : 'space-y-5'}>
      <Secao emPainel={emPainel} icone={User} titulo="Dados pessoais">
        <div className={grade}>
          <div>
            <label htmlFor="nv-nome" className={labelCls}>Nome completo *</label>
            <input id="nv-nome" type="text" name="nome" value={formData.nome} onChange={handleInputChange} required autoFocus={emPainel} className={inputCls} placeholder="Ex.: Carla Souza" />
          </div>
          <div>
            <label htmlFor="nv-email" className={labelCls}>E-mail *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input id="nv-email" type="email" name="email" value={formData.email} onChange={handleInputChange} required className={iconInputCls} placeholder="email@exemplo.com" />
            </div>
          </div>
          <div>
            <label htmlFor="nv-tel" className={labelCls}>Telefone (WhatsApp)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input id="nv-tel" type="tel" name="telefone" value={formData.telefone} onChange={handleInputChange} className={`${iconInputCls} font-mono`} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div>
            <label htmlFor="nv-senha" className={labelCls}>Senha do app (6 números) *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="nv-senha" type="text" inputMode="numeric" name="senha" value={formData.senha} onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value.replace(/\D/g, '').slice(0, 6) }))} required className={`${iconInputCls} font-mono tracking-widest`} />
              </div>
              <button type="button" onClick={() => setFormData((prev) => ({ ...prev, senha: gerarSenhaAleatoria() }))} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" title="Gerar outra senha">
                <RefreshCw className="h-4 w-4" /> Gerar
              </button>
            </div>
            <p className={`${dicaCls} ${formData.senha.length > 0 && formData.senha.length !== 6 ? '!text-red-600' : ''}`}>
              {formData.senha.length > 0 && formData.senha.length !== 6 ? `Faltam ${6 - formData.senha.length} números.` : 'O vendedor usa esta senha para entrar no app.'}
            </p>
          </div>
          <div className={largo}>
            <label htmlFor="nv-end" className={labelCls}>Endereço</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <textarea id="nv-end" name="endereco" value={formData.endereco} onChange={handleInputChange} rows={2} className={`${iconInputCls} h-auto py-2`} placeholder="Rua, número, bairro e cidade" />
            </div>
          </div>
        </div>
      </Secao>

      <Secao emPainel={emPainel} icone={FileText} titulo="Trabalho e cobrança">
        <div className={grade}>
          <div className={largo}>
            <span className={labelCls}>Quem paga a assinatura do app</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quem paga a assinatura do app">
              {([
                ['representado', 'A empresa', '+ R$ 100/mês na sua assinatura'],
                ['autonomo', 'O próprio vendedor', 'Ele paga R$ 100/mês'],
              ] as const).map(([valor, titulo, sub]) => {
                const ativo = formData.tipoVinculo === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setFormData((prev) => ({ ...prev, tipoVinculo: valor }))}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      ativo ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:bg-blue-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">{titulo}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="nv-inicio" className={labelCls}>Data de início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input id="nv-inicio" type="date" name="dataInicio" value={formData.dataInicio} onChange={handleInputChange} className={iconInputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="nv-fech" className={labelCls}>Dia de fechamento</label>
            <select id="nv-fech" name="diaFechamento" value={formData.diaFechamento} onChange={handleInputChange} className={inputCls}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                <option key={dia} value={dia}>Dia {dia}</option>
              ))}
            </select>
            <p className={dicaCls}>Janela de cobrança: do dia {formData.diaFechamento} até o dia anterior do mês seguinte.</p>
          </div>
          <div>
            <label htmlFor="nv-min" className={labelCls}>Percentual mínimo (%)</label>
            <input id="nv-min" type="number" name="percentualMinimo" value={formData.percentualMinimo} onChange={handleInputChange} min="0" max="100" step="0.1" className={`${inputCls} font-mono`} />
            <p className={dicaCls}>Quanto da entrega anterior o cliente precisa ter pago para receber outra. O vendedor também pode mudar no app.</p>
          </div>
          {isAdmin && (
            <>
              <div>
                <label htmlFor="nv-com" className={labelCls}>Comissão (%)</label>
                <input id="nv-com" type="number" name="comissaoPercentual" value={formData.comissaoPercentual} onChange={handleInputChange} min="0" max="100" step="0.1" className={`${inputCls} font-mono`} />
                <p className={dicaCls}>Sobre o total que o vendedor recebeu dos clientes na janela.</p>
              </div>
              <div>
                <label htmlFor="nv-contrato" className={labelCls}>Tipo de contrato</label>
                <select id="nv-contrato" name="tipoContrato" value={formData.tipoContrato} onChange={handleInputChange} className={inputCls}>
                  <option value="">Não informado</option>
                  <option value="efetivado">Efetivado</option>
                  <option value="autonomo">Autônomo</option>
                </select>
              </div>
            </>
          )}
          <div className={largo}>
            <label htmlFor="nv-obs" className={labelCls}>Observações do contrato</label>
            <textarea id="nv-obs" name="contrato" value={formData.contrato} onChange={handleInputChange} rows={2} className={`${inputCls} h-auto py-2`} placeholder="Opcional" />
          </div>
        </div>
      </Secao>

      <Secao emPainel={emPainel} icone={CreditCard} titulo="Dados bancários (opcional)">
        <div className={emPainel ? 'grid grid-cols-2 gap-4' : grade}>
          <div className={emPainel ? 'col-span-2' : ''}>
            <label htmlFor="nv-banco" className={labelCls}>Banco</label>
            <input id="nv-banco" type="text" name="banco" value={dadosBancarios.banco} onChange={handleBankDataChange} className={inputCls} placeholder="Nome do banco" />
          </div>
          <div>
            <label htmlFor="nv-ag" className={labelCls}>Agência</label>
            <input id="nv-ag" type="text" name="agencia" value={dadosBancarios.agencia} onChange={handleBankDataChange} className={`${inputCls} font-mono`} placeholder="0000" />
          </div>
          <div>
            <label htmlFor="nv-conta" className={labelCls}>Conta</label>
            <input id="nv-conta" type="text" name="conta" value={dadosBancarios.conta} onChange={handleBankDataChange} className={`${inputCls} font-mono`} placeholder="00000-0" />
          </div>
          <div className={emPainel ? 'col-span-2' : ''}>
            <label htmlFor="nv-tipoconta" className={labelCls}>Tipo de conta</label>
            <select id="nv-tipoconta" name="tipoConta" value={dadosBancarios.tipoConta} onChange={handleBankDataChange} className={inputCls}>
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="salario">Conta salário</option>
            </select>
          </div>
          <div className={emPainel ? 'col-span-2' : largo}>
            <label htmlFor="nv-pix" className={labelCls}>Chave Pix</label>
            <input id="nv-pix" type="text" name="pix" value={dadosBancarios.pix} onChange={handleBankDataChange} className={inputCls} placeholder="CPF, e-mail, telefone ou chave aleatória" />
          </div>
        </div>
      </Secao>

      <div className="rounded-lg bg-gray-50 px-4 py-3 text-[13px] dark:bg-gray-900/50">
        {formData.tipoVinculo === 'representado' ? (
          <p className="text-gray-700 dark:text-gray-300">
            Este vendedor soma <strong className="font-mono">R$ 100,00/mês</strong> à sua assinatura.
          </p>
        ) : (
          <p className="text-gray-700 dark:text-gray-300">
            Este vendedor paga a própria assinatura (<span className="font-mono">R$ 100,00/mês</span>). A sua não muda.
          </p>
        )}
      </div>
    </div>
  );

  const botoes = (
    <>
      <button type="button" onClick={fechar} className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
        Cancelar
      </button>
      <button type="submit" form="form-novo-vendedor" disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
        <Save className="h-4 w-4" />
        {loading ? 'Salvando…' : 'Cadastrar vendedor'}
      </button>
    </>
  );

  if (emPainel) {
    return (
      <PainelLateral
        aberto={!!aberto}
        onFechar={fechar}
        titulo={criado ? 'Vendedor cadastrado' : 'Novo vendedor'}
        descricao={criado ? undefined : 'O acesso ao app é feito com o e-mail e a senha abaixo.'}
        largura="max-w-[480px]"
        rodape={
          criado ? (
            <button type="button" onClick={fechar} className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              Concluir
            </button>
          ) : (
            botoes
          )
        }
      >
        {criado ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-3 text-green-800 dark:bg-green-500/10 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                <strong>{criado.nome}</strong> já pode entrar no app.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Senha de acesso ao app</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="font-mono text-3xl font-semibold tracking-[0.3em] text-gray-900 dark:text-white">{criado.senha}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(criado.senha).then(
                      () => toast.success('Senha copiada.'),
                      () => toast.info('Não foi possível copiar. Anote a senha.')
                    );
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4" /> Copiar
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Anote ou envie ao vendedor agora: esta senha não aparece de novo.</p>
            </div>
          </div>
        ) : (
          <form id="form-novo-vendedor" onSubmit={handleSubmit}>
            {campos}
          </form>
        )}
      </PainelLateral>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/vendedores')} aria-label="Voltar para Vendedores" className="rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Novo vendedor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cadastre um novo vendedor na equipe</p>
        </div>
      </div>
      <form id="form-novo-vendedor" onSubmit={handleSubmit} className="space-y-5">
        {campos}
        <div className="flex justify-end gap-2">{botoes}</div>
      </form>
    </div>
  );
};

export default NovoVendedor;
