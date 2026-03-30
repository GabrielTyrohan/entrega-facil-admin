import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  Plus,
  Trash2,
  User as UserIcon,
  Users,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdicionarClienteAdmin } from '../hooks/useAdicionarClienteAdmin';
import { useVendedoresByAdmin } from '../hooks/useVendedores';
import { supabase } from '../lib/supabase';
import { toast } from '../utils/toast';

interface NovoClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PessoaAutorizada { nome: string; }
interface Responsavel { nome: string; cpf: string; telefone: string; parentesco: string; }

interface FormData {
  autorizou_cadastro: boolean;
  tipo_pessoa: 'PF' | 'PJ';
  menor_idade: boolean;
  vendedor_id: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  sexo: string;
  estado_civil: string;
  nacionalidade: string;
  nome_pai: string;
  nome_mae: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  responsavel_pj_nome: string;
  responsavel_pj_cpf: string;
  responsavel_pj_cargo: string;
  responsavel_pj_telefone: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  nome_conjuge: string;
  renda_mensal: string;
  ponto_referencia: string;
  pessoas_autorizadas: PessoaAutorizada[];
  responsaveis: Responsavel[];
}

const INITIAL_DATA: FormData = {
  autorizou_cadastro: false,
  tipo_pessoa: 'PF',
  menor_idade: false,
  vendedor_id: '',
  nome: '', sobrenome: '', cpf: '', rg: '', data_nascimento: '',
  sexo: '', estado_civil: '', nacionalidade: 'Brasileira', nome_pai: '', nome_mae: '',
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
  inscricao_municipal: '', responsavel_pj_nome: '', responsavel_pj_cpf: '',
  responsavel_pj_cargo: '', responsavel_pj_telefone: '',
  telefone: '', email: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  nome_conjuge: '', renda_mensal: '', ponto_referencia: '',
  pessoas_autorizadas: [], responsaveis: [],
};

// ─── Máscaras ────────────────────────────────────────────────────────────────
const maskCPF = (v: string) =>
  v.replace(/\D/g,'').slice(0,11)
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d)/,'$1.$2')
   .replace(/(\d{3})(\d{1,2})/,'$1-$2');

const maskCNPJ = (v: string) =>
  v.replace(/\D/g,'').slice(0,14)
   .replace(/^(\d{2})(\d)/,'$1.$2')
   .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
   .replace(/\.(\d{3})(\d)/,'.$1/$2')
   .replace(/(\d{4})(\d)/,'$1-$2');

const maskPhone = (v: string) => {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (!v) return '';
  if (v.length > 10) {
    return v.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
  } else if (v.length > 5) {
    return v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d\d)(\d{0,5}).*/, '($1) $2');
  } else {
    return v.replace(/^(\d*)/, '($1');
  }
};

const maskCEP = (v: string) =>
  v.replace(/\D/g,'').slice(0,8)
   .replace(/(\d{5})(\d)/,'$1-$2');

const maskDate = (v: string) =>
  v.replace(/\D/g,'').slice(0,8)
   .replace(/(\d{2})(\d)/,'$1/$2')
   .replace(/(\d{2})(\d)/,'$1/$2');

const maskCurrency = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (!v) return '';
  v = (Number(v) / 100).toFixed(2);
  return v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// ─── Validadores ─────────────────────────────────────────────────────────────
const validateCPF = (cpf: string) => {
  const c = cpf.replace(/\D/g,'');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0, r: number;
  for (let i = 1; i <= 9; i++) s += parseInt(c[i-1]) * (11-i);
  r = (s*10)%11; if (r===10||r===11) r=0;
  if (r !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += parseInt(c[i-1]) * (12-i);
  r = (s*10)%11; if (r===10||r===11) r=0;
  return r === parseInt(c[10]);
};

const validateCNPJ = (cnpj: string) => {
  const c = cnpj.replace(/\D/g,'');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (x: string, n: number) => {
    let sum = 0, pos = n - 7;
    for (let i = n; i >= 1; i--) {
      sum += parseInt(x[n-i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return r;
  };
  return calc(c,12) === parseInt(c[12]) && calc(c,13) === parseInt(c[13]);
};

// ─── Componente auxiliar ──────────────────────────────────────────────────────
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 text-sm";

// ─── Componente principal ─────────────────────────────────────────────────────
export const NovoClienteModal: React.FC<NovoClienteModalProps> = ({ isOpen, onClose }) => {
  const { user, userType, userProfile } = useAuth();
  const { mutateAsync: adicionarCliente, isPending } = useAdicionarClienteAdmin();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [adminId, setAdminId] = useState<string | null>(null);

  // ✅ Ref para evitar auto-seleção repetida de vendedor
  const autoSelecionouVendedor = useRef(false);

  const { data: vendedores = [] } = useVendedoresByAdmin(adminId || '', {
    enabled: !!adminId
  });

  // ✅ Reset da ref ao reabrir o modal
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData(INITIAL_DATA);
      autoSelecionouVendedor.current = false;
      resolveAdminId();
    }
  }, [isOpen]);

  // ✅ Auto-seleciona vendedor apenas uma vez — sem re-render em loop
  useEffect(() => {
    if (autoSelecionouVendedor.current) return;
    if (vendedores.length === 1 && !formData.vendedor_id) {
      autoSelecionouVendedor.current = true;
      setFormData(prev => ({ ...prev, vendedor_id: vendedores[0].id }));
    }
  }, [vendedores, formData.vendedor_id]);

  const resolveAdminId = async () => {
    if (userType === 'admin' && user?.id) {
      setAdminId(user.id);
    } else if (userType === 'funcionario') {
      if ((userProfile as any)?.administrador_id) {
        setAdminId((userProfile as any).administrador_id);
      } else if (user?.id) {
        try {
          const { data } = await supabase
            .from('funcionarios')
            .select('administrador_id')
            .eq('auth_user_id', user.id)
            .single();
          if (data?.administrador_id) setAdminId(data.administrador_id);
        } catch (err) {
          console.error('Erro ao buscar admin ID', err);
        }
      }
    }
  };

  const handleChange = (field: keyof FormData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  // ── Pessoas autorizadas ──
  const addPessoa = () =>
    setFormData(p => ({ ...p, pessoas_autorizadas: [...p.pessoas_autorizadas, { nome: '' }] }));
  const removePessoa = (i: number) =>
    setFormData(p => ({ ...p, pessoas_autorizadas: p.pessoas_autorizadas.filter((_,idx) => idx !== i) }));
  const updatePessoa = (i: number, v: string) => {
    const arr = [...formData.pessoas_autorizadas];
    arr[i].nome = v;
    setFormData(p => ({ ...p, pessoas_autorizadas: arr }));
  };

  // ── Responsáveis ──
  const addResp = () =>
    setFormData(p => ({ ...p, responsaveis: [...p.responsaveis, { nome:'', cpf:'', telefone:'', parentesco:'' }] }));
  const removeResp = (i: number) =>
    setFormData(p => ({ ...p, responsaveis: p.responsaveis.filter((_,idx) => idx !== i) }));
  const updateResp = (i: number, field: keyof Responsavel, v: string) => {
    const arr = [...formData.responsaveis];
    if (field === 'cpf') v = maskCPF(v);
    if (field === 'telefone') v = maskPhone(v);
    arr[i] = { ...arr[i], [field]: v };
    setFormData(p => ({ ...p, responsaveis: arr }));
  };

  // ── Validação por etapa ──
  const validateStep = (step: number): boolean => {
    const isPJ = formData.tipo_pessoa === 'PJ';
    switch (step) {
      case 0:
        if (!formData.autorizou_cadastro) {
          toast.error('É necessário confirmar a autorização.'); return false;
        }
        return true;

      case 1:
        if (isPJ) {
          if (!formData.razao_social || !formData.cnpj) {
            toast.error('Razão Social e CNPJ são obrigatórios.'); return false;
          }
          if (!validateCNPJ(formData.cnpj)) {
            toast.error('CNPJ inválido.'); return false;
          }
          if (!formData.responsavel_pj_nome || !formData.responsavel_pj_telefone) {
            toast.error('Nome e telefone do responsável são obrigatórios.'); return false;
          }
        } else {
          if (!formData.nome || !formData.sobrenome) {
            toast.error('Nome e Sobrenome são obrigatórios.'); return false;
          }
          if (!formData.cpf || !validateCPF(formData.cpf)) {
            toast.error('CPF inválido.'); return false;
          }
          if (!formData.telefone) {
            toast.error('Telefone é obrigatório.'); return false;
          }
        }
        return true;

      case 2:
        if (!formData.cep || !formData.logradouro || !formData.bairro || !formData.cidade || !formData.estado) {
          toast.error('Preencha os campos obrigatórios de endereço.'); return false;
        }
        return true;

      case 3:
        return true;

      case 4:
        if (!isPJ && formData.menor_idade && formData.responsaveis.length === 0) {
          toast.error('Adicione pelo menos um responsável.'); return false;
        }
        return true;

      default:
        return true;
    }
  };

  // ── Navegação ──
  const shouldSkipStep4 = formData.tipo_pessoa === 'PJ' || !formData.menor_idade;

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === 3 && shouldSkipStep4) {
      setCurrentStep(5);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 5 && shouldSkipStep4) {
      setCurrentStep(3);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!adminId) { toast.error('Administrador não identificado.'); return; }

    try {
      const isPJ = formData.tipo_pessoa === 'PJ';
      const [dia, mes, ano] = formData.data_nascimento.split('/');
      const dataNascimentoISO = formData.data_nascimento ? `${ano}-${mes}-${dia}` : undefined;

      const base = {
        administrador_id: adminId,
        vendedor_id: formData.vendedor_id,
        tipo_pessoa: formData.tipo_pessoa,
        telefone: formData.telefone.replace(/\D/g,''),
        email: formData.email || undefined,
        cep: formData.cep.replace(/\D/g,''),
        endereco: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento || undefined,
        Bairro: formData.bairro,
        Cidade: formData.cidade,
        Estado: formData.estado,
        ponto_referencia: formData.ponto_referencia || undefined,
        ativo: true,
      };

      const payload = isPJ
        ? {
            ...base,
            nome: formData.razao_social,
            sobrenome: formData.nome_fantasia || '',
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia || undefined,
            cnpj: formData.cnpj.replace(/\D/g,''),
            inscricao_estadual: formData.inscricao_estadual || undefined,
            inscricao_municipal: formData.inscricao_municipal || undefined,
            responsavel_pj_nome: formData.responsavel_pj_nome,
            responsavel_pj_cpf: formData.responsavel_pj_cpf.replace(/\D/g,'') || undefined,
            responsavel_pj_cargo: formData.responsavel_pj_cargo || undefined,
            responsavel_pj_telefone: formData.responsavel_pj_telefone.replace(/\D/g,'') || undefined,
            cpf: formData.cnpj.replace(/\D/g,''),
            renda_mensal: formData.renda_mensal
              ? parseFloat(formData.renda_mensal.replace(/\./g, '').replace(',', '.'))
              : undefined,
          }
        : {
            ...base,
            nome: formData.nome,
            sobrenome: formData.sobrenome,
            cpf: formData.cpf.replace(/\D/g,''),
            rg: formData.rg || undefined,
            data_nascimento: dataNascimentoISO,
            sexo: formData.sexo || undefined,
            estado_civil: formData.estado_civil || undefined,
            nacionalidade: formData.nacionalidade || 'Brasileira',
            nome_pai: formData.nome_pai || undefined,
            nome_mae: formData.nome_mae || undefined,
            nome_conjuge: formData.nome_conjuge || undefined,
            renda_mensal: formData.renda_mensal
              ? parseFloat(formData.renda_mensal.replace(/\./g, '').replace(',', '.'))
              : undefined,
            menor_idade: formData.menor_idade,
            pessoas_autorizadas: formData.pessoas_autorizadas.map(p => p.nome),
            responsaveis: formData.menor_idade ? formData.responsaveis : [],
          };

      await adicionarCliente(payload as any);
      toast.success('Cliente cadastrado com sucesso!');
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao salvar cliente.');
    }
  };

  if (!isOpen) return null;

  const isPJ = formData.tipo_pessoa === 'PJ';

  const allSteps = [
    { id: 0, icon: AlertCircle,   label: 'Verificação'    },
    { id: 1, icon: isPJ ? Building2 : UserIcon, label: isPJ ? 'Empresa' : 'Dados Pessoais' },
    { id: 2, icon: Home,          label: 'Endereço'       },
    { id: 3, icon: FileText,      label: 'Complementares' },
    { id: 4, icon: Users,         label: 'Responsáveis', hiddenWhen: shouldSkipStep4 },
    { id: 5, icon: CheckCircle2,  label: 'Finalizar'      },
  ];
  const visibleSteps = allSteps.filter(s => !('hiddenWhen' in s && s.hiddenWhen));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Novo Cliente</h2>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              isPJ
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
              {isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex items-center justify-between min-w-max px-2">
            {visibleSteps.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center mx-4 cursor-pointer ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400'
                  }`}
                  onClick={() => { if (step.id < currentStep) setCurrentStep(step.id); }}
                >
                  <div className={`p-2 rounded-full mb-1 ${
                    isActive   ? 'bg-blue-100 dark:bg-blue-900/30'
                    : isCompleted ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">

          {/* ── Step 0: Verificação ── */}
          {currentStep === 0 && (
            <div className="space-y-6 max-w-lg mx-auto py-4">
              <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-300">Antes de começar</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    Certifique-se que o cliente autorizou o cadastro de seus dados.
                  </p>
                </div>
              </div>

              {/* Tipo de Pessoa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Cliente
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['PF', 'PJ'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => handleChange('tipo_pessoa', tipo)}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                        formData.tipo_pessoa === tipo
                          ? tipo === 'PJ'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      {tipo === 'PJ'
                        ? <Building2 className={`w-8 h-8 mb-2 ${formData.tipo_pessoa === 'PJ' ? 'text-purple-600' : 'text-gray-400'}`} />
                        : <UserIcon  className={`w-8 h-8 mb-2 ${formData.tipo_pessoa === 'PF' ? 'text-blue-600'   : 'text-gray-400'}`} />
                      }
                      <span className={`font-semibold text-sm ${
                        formData.tipo_pessoa === tipo
                          ? tipo === 'PJ' ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {tipo === 'PF' ? 'CPF • Individual' : 'CNPJ • Empresa'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.autorizou_cadastro
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    checked={formData.autorizou_cadastro}
                    onChange={e => handleChange('autorizou_cadastro', e.target.checked)}
                  />
                  <span className={`text-sm ${formData.autorizou_cadastro ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    Confirmo que o cliente <strong>autorizou</strong> o cadastro.
                  </span>
                </label>

                {!isPJ && (
                  <label className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.menor_idade
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      checked={formData.menor_idade}
                      onChange={e => handleChange('menor_idade', e.target.checked)}
                    />
                    <span className={`text-sm ${formData.menor_idade ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      O cliente é <strong>menor de idade</strong>?
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ── Step 1: Dados PF ── */}
          {currentStep === 1 && !isPJ && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome *">
                <input className={inputCls} value={formData.nome} onChange={e => handleChange('nome', e.target.value)} />
              </Field>
              <Field label="Sobrenome *">
                <input className={inputCls} value={formData.sobrenome} onChange={e => handleChange('sobrenome', e.target.value)} />
              </Field>
              <Field label="CPF *">
                <input className={inputCls} value={formData.cpf} onChange={e => handleChange('cpf', maskCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
              </Field>
              <Field label="RG">
                <input className={inputCls} value={formData.rg} onChange={e => handleChange('rg', e.target.value)} />
              </Field>
              <Field label="Data de Nascimento">
                <input className={inputCls} value={formData.data_nascimento} onChange={e => handleChange('data_nascimento', maskDate(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} />
              </Field>
              <Field label="Sexo">
                <select className={inputCls} value={formData.sexo} onChange={e => handleChange('sexo', e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
              </Field>
              <Field label="Estado Civil">
                <select className={inputCls} value={formData.estado_civil} onChange={e => handleChange('estado_civil', e.target.value)}>
                  <option value="">Selecione</option>
                  {['Solteiro','Casado','Divorciado','Viuvo','UniaoEstavel'].map(v => (
                    <option key={v} value={v}>
                      {v.replace('Viuvo','Viúvo(a)').replace('UniaoEstavel','União Estável').replace('Solteiro','Solteiro(a)').replace('Casado','Casado(a)').replace('Divorciado','Divorciado(a)')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nacionalidade">
                <input className={inputCls} value={formData.nacionalidade} onChange={e => handleChange('nacionalidade', e.target.value)} />
              </Field>
              <Field label="Telefone/WhatsApp *">
                <input className={inputCls} value={formData.telefone} onChange={e => handleChange('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </Field>
              <Field label="Email">
                <input className={inputCls} type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} />
              </Field>
              <Field label="Nome do Pai">
                <input className={inputCls} value={formData.nome_pai} onChange={e => handleChange('nome_pai', e.target.value)} />
              </Field>
              <Field label="Nome da Mãe">
                <input className={inputCls} value={formData.nome_mae} onChange={e => handleChange('nome_mae', e.target.value)} />
              </Field>
            </div>
          )}

          {/* ── Step 1: Dados PJ ── */}
          {currentStep === 1 && isPJ && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Razão Social *">
                  <input className={inputCls} value={formData.razao_social} onChange={e => handleChange('razao_social', e.target.value)} placeholder="Nome legal da empresa" />
                </Field>
              </div>
              <Field label="Nome Fantasia">
                <input className={inputCls} value={formData.nome_fantasia} onChange={e => handleChange('nome_fantasia', e.target.value)} placeholder="Nome comercial" />
              </Field>
              <Field label="CNPJ *">
                <input className={inputCls} value={formData.cnpj} onChange={e => handleChange('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
              </Field>
              <Field label="Inscrição Estadual">
                <input className={inputCls} value={formData.inscricao_estadual} onChange={e => handleChange('inscricao_estadual', e.target.value)} />
              </Field>
              <Field label="Inscrição Municipal">
                <input className={inputCls} value={formData.inscricao_municipal} onChange={e => handleChange('inscricao_municipal', e.target.value)} />
              </Field>

              <div className="md:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Responsável / Contato
                </p>
              </div>

              <Field label="Nome do Responsável *">
                <input className={inputCls} value={formData.responsavel_pj_nome} onChange={e => handleChange('responsavel_pj_nome', e.target.value)} />
              </Field>
              <Field label="Cargo">
                <input className={inputCls} value={formData.responsavel_pj_cargo} onChange={e => handleChange('responsavel_pj_cargo', e.target.value)} placeholder="Sócio, Diretor, etc." />
              </Field>
              <Field label="CPF do Responsável">
                <input className={inputCls} value={formData.responsavel_pj_cpf} onChange={e => handleChange('responsavel_pj_cpf', maskCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
              </Field>
              <Field label="Telefone do Responsável *">
                <input className={inputCls} value={formData.responsavel_pj_telefone} onChange={e => handleChange('responsavel_pj_telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </Field>

              <div className="md:col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Contato Geral da Empresa
                </p>
              </div>
              <Field label="Telefone Empresa">
                <input className={inputCls} value={formData.telefone} onChange={e => handleChange('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </Field>
              <Field label="Email Empresa">
                <input className={inputCls} type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} />
              </Field>
            </div>
          )}

          {/* ── Step 2: Endereço ── */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <Field label="CEP *">
                  <input className={inputCls} value={formData.cep} onChange={e => handleChange('cep', maskCEP(e.target.value))} placeholder="00000-000" maxLength={9} />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="Logradouro *">
                  <input className={inputCls} value={formData.logradouro} onChange={e => handleChange('logradouro', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-1">
                <Field label="Número">
                  <input className={inputCls} value={formData.numero} onChange={e => handleChange('numero', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Complemento">
                  <input className={inputCls} value={formData.complemento} onChange={e => handleChange('complemento', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Bairro *">
                  <input className={inputCls} value={formData.bairro} onChange={e => handleChange('bairro', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="Cidade *">
                  <input className={inputCls} value={formData.cidade} onChange={e => handleChange('cidade', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Estado (UF) *">
                  <select className={inputCls} value={formData.estado} onChange={e => handleChange('estado', e.target.value)}>
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 3: Vendedor ── */}
          {currentStep === 3 && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
              <Field label="Vendedor Responsável *">
                <select
                  className={inputCls}
                  value={formData.vendedor_id}
                  onChange={e => handleChange('vendedor_id', e.target.value)}
                >
                  <option value="">Selecione um vendedor</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </Field>
              {vendedores.length === 0 && (
                <p className="mt-2 text-xs text-red-500">
                  Nenhum vendedor encontrado. Cadastre um vendedor antes de continuar.
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Complementares PF ── */}
          {currentStep === 3 && !isPJ && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome do Cônjuge">
                  <input className={inputCls} value={formData.nome_conjuge} onChange={e => handleChange('nome_conjuge', e.target.value)} />
                </Field>
                <Field label="Renda Mensal (R$)">
                  <input className={inputCls} value={formData.renda_mensal} onChange={e => handleChange('renda_mensal', maskCurrency(e.target.value))} placeholder="0,00" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Ponto de Referência">
                    <input className={inputCls} value={formData.ponto_referencia} onChange={e => handleChange('ponto_referencia', e.target.value)} placeholder="Próximo a..." />
                  </Field>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pessoas Autorizadas a Receber</label>
                  <button type="button" onClick={addPessoa} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.pessoas_autorizadas.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={`${inputCls} flex-1`} value={p.nome} onChange={e => updatePessoa(i, e.target.value)} placeholder="Nome da pessoa autorizada" />
                      <button type="button" onClick={() => removePessoa(i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {formData.pessoas_autorizadas.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Nenhuma pessoa autorizada adicionada.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Complementares PJ ── */}
          {currentStep === 3 && isPJ && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Faturamento Mensal Estimado (R$)">
                <input className={inputCls} value={formData.renda_mensal} onChange={e => handleChange('renda_mensal', maskCurrency(e.target.value))} placeholder="0,00" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Ponto de Referência / Observações">
                  <input className={inputCls} value={formData.ponto_referencia} onChange={e => handleChange('ponto_referencia', e.target.value)} placeholder="Observações adicionais" />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 4: Responsáveis (PF menor) ── */}
          {currentStep === 4 && !isPJ && formData.menor_idade && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">Responsáveis Legais</h3>
                <button type="button" onClick={addResp} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Adicionar Responsável
                </button>
              </div>
              {formData.responsaveis.length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg dark:border-gray-700">
                  Nenhum responsável adicionado. Obrigatório para menores de idade.
                </div>
              )}
              {formData.responsaveis.map((r, i) => (
                <div key={i} className="p-4 border rounded-lg dark:border-gray-700 space-y-3 relative bg-gray-50 dark:bg-gray-800/50">
                  <button type="button" onClick={() => removeResp(i)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Nome *"><input className={inputCls} value={r.nome} onChange={e => updateResp(i,'nome',e.target.value)} /></Field>
                    <Field label="Parentesco *"><input className={inputCls} value={r.parentesco} onChange={e => updateResp(i,'parentesco',e.target.value)} placeholder="Ex: Pai, Mãe, Avó" /></Field>
                    <Field label="CPF *"><input className={inputCls} value={r.cpf} onChange={e => updateResp(i,'cpf',e.target.value)} placeholder="000.000.000-00" /></Field>
                    <Field label="Telefone *"><input className={inputCls} value={r.telefone} onChange={e => updateResp(i,'telefone',e.target.value)} placeholder="(00) 00000-0000" /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Step 5: Resumo ── */}
          {currentStep === 5 && (
            <div className="py-6 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tudo pronto!</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Confirme para finalizar o cadastro de{' '}
                  <strong>
                    {isPJ ? formData.razao_social : `${formData.nome} ${formData.sobrenome}`}
                  </strong>.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-left max-w-md mx-auto text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{isPJ ? 'CNPJ:' : 'CPF:'}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{isPJ ? formData.cnpj : formData.cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Telefone:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{formData.telefone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Cidade:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{formData.cidade} - {formData.estado}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={currentStep === 0 ? onClose : handleBack}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm"
          >
            {currentStep === 0 ? 'Cancelar' : 'Voltar'}
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md font-medium text-sm flex items-center gap-2"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className={`px-6 py-2 rounded-md text-white font-medium text-sm flex items-center gap-2 ${
                isPending
                  ? 'bg-green-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isPending ? 'Salvando...' : 'Confirmar Cadastro'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};