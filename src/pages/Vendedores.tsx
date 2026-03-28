import { useQueryClient } from '@tanstack/react-query'; // ✅ ADICIONADO
import { ArrowLeft, Calendar, CreditCard, FileText, Lock, Mail, MapPin, Phone, Save, User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from '../utils/toast';

interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix?: string;
}

const NovoVendedor: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient(); // ✅ ADICIONADO

  const gerarSenhaAleatoria = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const obterDataAtual = (): string => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: gerarSenhaAleatoria(),
    endereco: '',
    dataInicio: obterDataAtual(),
    tipoVinculo: 'CLT',
    percentualMinimo: 50,
    contrato: '',
    ativo: true,
    status: true
  });

  const [dadosBancarios, setDadosBancarios] = useState<DadosBancarios>({
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'corrente',
    pix: ''
  });

  const [loading, setLoading] = useState(false);

  const formatTelefone = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const formatAgencia = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

  const formatConta = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 6);
    return numbers.length > 5 ? `${numbers.slice(0, 5)}-${numbers.slice(5)}` : numbers;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'percentualMinimo') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else if (name === 'telefone') {
      setFormData(prev => ({ ...prev, [name]: formatTelefone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleBankDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'agencia') {
      setDadosBancarios(prev => ({ ...prev, [name]: formatAgencia(value) }));
    } else if (name === 'conta') {
      setDadosBancarios(prev => ({ ...prev, [name]: formatConta(value) }));
    } else {
      setDadosBancarios(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!/^\d{6}$/.test(formData.senha)) {
        toast.error('Senha deve conter exatamente 6 números');
        setLoading(false);
        return;
      }

      if (!formData.nome || !formData.email) {
        toast.error('Preencha todos os campos obrigatórios');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('criar_vendedor_com_hash', {
        p_administrador_id: user?.id,
        p_nome: formData.nome,
        p_senha_plain: formData.senha,
        p_telefone: formData.telefone || null,
        p_email: formData.email || null,
        p_endereco: formData.endereco || null,
        p_data_inicio: formData.dataInicio || null,
        p_tipo_vinculo: formData.tipoVinculo || null,
        p_percentual_minimo: formData.percentualMinimo || 0,
        p_tipo_cobranca: 'pago_admin',
        p_valor_assinatura: 100
      });

      if (error) throw new Error(error.message || 'Erro ao criar vendedor');

      const resultado = data as { success: boolean; vendedor_id?: string; erro?: string };

      if (!resultado.success) {
        throw new Error(resultado.erro || 'Erro desconhecido ao criar vendedor');
      }

      // ✅ Invalida o cache — lista de vendedores atualiza automaticamente ao voltar
      await queryClient.invalidateQueries({ queryKey: ['vendedores'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });

      // Salvar dados bancários se preenchidos
      if (dadosBancarios.banco || dadosBancarios.agencia || dadosBancarios.conta) {
        const { error: updateError } = await supabase
          .from('vendedores')
          .update({ dados_bancarios: dadosBancarios })
          .eq('id', resultado.vendedor_id);

        if (updateError) {
          console.warn('Erro ao salvar dados bancários:', updateError);
        }
      }

      toast.success(
        `✅ Vendedor criado com sucesso!\n\n🔐 SENHA DE ACESSO: ${formData.senha}\n\n⚠️ Anote esta senha! Ela não poderá ser recuperada.`,
        { duration: 15000 }
      );

      setTimeout(() => {
        navigate('/vendedores');
      }, 2000);

    } catch (error: any) {
      console.error('Erro ao criar vendedor:', error);
      toast.error(`Erro ao criar vendedor: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/vendedores')}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Novo Vendedor</h1>
            <p className="text-gray-600 dark:text-gray-400">Cadastre um novo vendedor na equipe</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Pessoais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Pessoais</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome Completo *</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite o nome completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" name="telefone" value={formData.telefone} onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Senha de Acesso *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" name="senha" value={formData.senha} onChange={handleInputChange} required
                    min="0" max="999999"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Senha numérica (6 dígitos)" />
                </div>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, senha: gerarSenhaAleatoria() }))}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors" title="Gerar nova senha">
                  🔄
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Senha numérica de 6 dígitos gerada automaticamente</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Endereço</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea name="endereco" value={formData.endereco} onChange={handleInputChange} rows={3}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Endereço completo" />
              </div>
            </div>
          </div>
        </div>

        {/* Informações Profissionais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <FileText className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informações Profissionais</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data de Início</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" name="dataInicio" value={formData.dataInicio} onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Vínculo</label>
              <select name="tipoVinculo" value={formData.tipoVinculo} onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="CLT">CLT</option>
                <option value="PJ">Pessoa Jurídica</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Terceirizado">Terceirizado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Percentual Mínimo (%)</label>
              <input type="number" name="percentualMinimo" value={formData.percentualMinimo} onChange={handleInputChange}
                min="0" max="100" step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.0" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações do Contrato</label>
              <textarea name="contrato" value={formData.contrato} onChange={handleInputChange} rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações sobre o contrato" />
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-6">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Bancários</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Banco</label>
              <input type="text" name="banco" value={dadosBancarios.banco} onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do banco" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agência</label>
              <input type="text" name="agencia" value={dadosBancarios.agencia} onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Número da agência" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conta</label>
              <input type="text" name="conta" value={dadosBancarios.conta} onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Número da conta" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo de Conta</label>
              <select name="tipoConta" value={dadosBancarios.tipoConta} onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="corrente">Conta Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="salario">Conta Salário</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chave PIX (Opcional)</label>
              <input type="text" name="pix" value={dadosBancarios.pix} onChange={handleBankDataChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CPF, email, telefone ou chave aleatória" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h2>
          <div className="flex flex-col space-y-4">
            <label className="flex items-center">
              <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Vendedor ativo</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" name="status" checked={formData.status} onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Status habilitado</span>
            </label>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end space-x-4">
          <button type="button" onClick={() => navigate('/vendedores')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center space-x-2 transition-colors">
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar Vendedor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoVendedor;