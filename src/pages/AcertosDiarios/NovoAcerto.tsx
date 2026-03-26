import { toast } from '@/utils/toast';
import { AlertCircle, ArrowLeft, Calculator, CheckCircle, HelpCircle, Plus, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useAcertoPorData, useCreateAcerto } from '../../hooks/useAcertos';
import { useEntregasByVendedorData } from '../../hooks/useEntregas';
import { useVendedoresByAdmin } from '../../hooks/useVendedores';
import { applyCurrencyMask, currencyMaskToNumber, formatCurrency } from '../../utils/currencyUtils';


const CurrencyInput = ({ label, field, value, onChange }: {
  label: string;
  field: string;
  value: number;
  onChange: (field: string, val: string) => void;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    <input
      type="text"
      value={formatCurrency(value)}
      onChange={(e) => onChange(field, e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    />
  </div>
);


interface Venda {
  id: string;
  valor: number;
  label?: string;
  fromEntrega?: boolean; // flag para saber se veio automático
}


const NovoAcerto = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: vendedores } = useVendedoresByAdmin(user?.id || '', {
    enabled: !!user?.id
  });
  const createMutation = useCreateAcerto();
  const [showHelp, setShowHelp] = useState(false);

  const [formData, setFormData] = useState({
    vendedor_id: '',
    data_acerto: new Date().toISOString().split('T')[0],
    valor_pix: 0,
    valor_deposito: 0,
    valor_dinheiro: 0,
    valor_cheque: 0,
    valor_debito: 0,
  valor_credito: 0,
    valor_cartao: 0,
    // DESPESAS 
    valor_gasolina: 0,
    valor_borracharia: 0,
    valor_pedagio: 0,
    valor_mecanico: 0,
    valor_outras_despesas: 0,
    observacoes: ''
  });

  const [vendas, setVendas] = useState<Venda[]>([
    { id: crypto.randomUUID(), valor: 0 }
  ]);

  // Busca entregas do vendedor na data selecionada
  const { data: entregasDoDia, isLoading: loadingEntregas } = useEntregasByVendedorData(
    formData.vendedor_id,
    formData.data_acerto,
    { enabled: !!formData.vendedor_id && !!formData.data_acerto }
  );

  const { data: acertoExistente } = useAcertoPorData(formData.vendedor_id, formData.data_acerto);

  // Preenche vendas automaticamente quando mudar vendedor ou data
  useEffect(() => {
    if (!formData.vendedor_id) return;

    if (!entregasDoDia || entregasDoDia.length === 0) {
      setVendas([{ id: crypto.randomUUID(), valor: 0 }]);
      return;
    }

    const vendasGeradas: Venda[] = entregasDoDia.map((entrega: any) => {
      const nomeCliente = entrega.cliente
        ? `${entrega.cliente.nome}${entrega.cliente.sobrenome ? ' ' + entrega.cliente.sobrenome : ''}`
        : `Entrega #${entrega.id.slice(0, 6)}`;
      return {
        id: entrega.id,
        valor: entrega.valor ?? 0,
        label: nomeCliente,
        fromEntrega: true,
      };
    });

    setVendas(vendasGeradas);
  }, [entregasDoDia, formData.vendedor_id]);

  useEffect(() => {
    if (acertoExistente) {
      toast.error('Já existe acerto para este vendedor nesta data');
    }
  }, [acertoExistente]);

  // ===== CÁLCULOS =====
  const totalRecebido = useMemo(() =>
    formData.valor_pix +
    formData.valor_deposito +
    formData.valor_dinheiro +
    formData.valor_cheque +
    formData.valor_debito +
  formData.valor_credito +
    formData.valor_cartao,
    [formData]
  );

  const totalDespesas = useMemo(() =>
    formData.valor_gasolina +
    formData.valor_borracharia +
    formData.valor_pedagio +
    formData.valor_mecanico +
    formData.valor_outras_despesas,
    [formData]
  );

  const totalVendas = useMemo(() =>
    vendas.reduce((sum, venda) => sum + venda.valor, 0),
    [vendas]
  );

  const valorEsperado = useMemo(() => totalVendas - totalDespesas, [totalVendas, totalDespesas]);

  const saldoLiquido = useMemo(() => totalRecebido - valorEsperado, [totalRecebido, valorEsperado]);

  const handleCurrencyChange = (field: string, rawValue: string) => {
    const masked = applyCurrencyMask(rawValue);
    const number = currencyMaskToNumber(masked);
    setFormData(prev => ({ ...prev, [field]: number }));
  };

  // ===== GERENCIAR VENDAS =====
  const adicionarVenda = () => {
    setVendas(prev => [...prev, { id: crypto.randomUUID(), valor: 0 }]);
  };

  const removerVenda = (id: string) => {
    if (vendas.length > 1) {
      setVendas(prev => prev.filter(v => v.id !== id));
    }
  };

  const atualizarVenda = (id: string, rawValue: string) => {
    const masked = applyCurrencyMask(rawValue);
    const number = currencyMaskToNumber(masked);
    setVendas(prev => prev.map(v => v.id === id ? { ...v, valor: number } : v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendedor_id) {
      toast.error('Selecione um vendedor');
      return;
    }

    if (acertoExistente) {
      toast.error('Já existe acerto para este vendedor nesta data');
      return;
    }

    if (totalVendas <= 0) {
      toast.error('Informe pelo menos uma venda');
      return;
    }

    try {
      await createMutation.mutateAsync({
        ...formData,
        valor_total_vendas: totalVendas,
        vendas: JSON.stringify(vendas),
        administrador_id: user?.id,
        status: 'pendente'
      });
      toast.success('Acerto registrado com sucesso!');
      navigate('/acertos-diarios');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar acerto');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/acertos-diarios')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Novo Acerto Diário
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Como funciona o cálculo?"
            >
              <HelpCircle size={20} />
            </button>
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Principais */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <CheckCircle className="mr-2 text-blue-600 dark:text-blue-400" size={20} />
            Dados Principais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendedor</label>
              <select
                value={formData.vendedor_id}
                onChange={(e) => setFormData(prev => ({ ...prev, vendedor_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="">Selecione um vendedor...</option>
                {vendedores?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data do Acerto</label>
              <input
                type="date"
                value={formData.data_acerto}
                onChange={(e) => setFormData(prev => ({ ...prev, data_acerto: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>
          {acertoExistente && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md flex items-center">
              <AlertCircle size={20} className="mr-2" />
              Já existe um acerto registrado para este vendedor nesta data.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COLUNA 1: RECEBIMENTOS */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Calculator className="mr-2 text-green-600 dark:text-green-400" size={20} />
              Recebimentos
            </h2>
            <div className="space-y-4">
              <CurrencyInput label="Dep. Banco" field="valor_deposito" value={formData.valor_deposito} onChange={handleCurrencyChange} />
              <CurrencyInput label="Dinheiro" field="valor_dinheiro" value={formData.valor_dinheiro} onChange={handleCurrencyChange} />
              <CurrencyInput label="Cheque" field="valor_cheque" value={formData.valor_cheque} onChange={handleCurrencyChange} />
              <CurrencyInput label="PIX" field="valor_pix" value={formData.valor_pix} onChange={handleCurrencyChange} />
              <CurrencyInput label="Débito" field="valor_debito" value={formData.valor_debito} onChange={handleCurrencyChange} />
              <CurrencyInput label="Crédito" field="valor_credito" value={formData.valor_credito} onChange={handleCurrencyChange} />
              <CurrencyInput label="Cartão" field="valor_cartao" value={formData.valor_cartao} onChange={handleCurrencyChange} />
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <span>Total Recebido</span>
                  <span className="text-green-600 dark:text-green-400">{formatCurrency(totalRecebido)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 2: DESPESAS */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <AlertCircle className="mr-2 text-red-600 dark:text-red-400" size={20} />
              Despesas
            </h2>
            <div className="space-y-4">
              <CurrencyInput label="Gasolina" field="valor_gasolina" value={formData.valor_gasolina} onChange={handleCurrencyChange} />
              <CurrencyInput label="Borracharia" field="valor_borracharia" value={formData.valor_borracharia} onChange={handleCurrencyChange} />
              <CurrencyInput label="Pedágio" field="valor_pedagio" value={formData.valor_pedagio} onChange={handleCurrencyChange} />
              <CurrencyInput label="Mecânico" field="valor_mecanico" value={formData.valor_mecanico} onChange={handleCurrencyChange} />
              <CurrencyInput label="Outros" field="valor_outras_despesas" value={formData.valor_outras_despesas} onChange={handleCurrencyChange} />
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center font-medium text-gray-900 dark:text-white">
                  <span>Total Despesas</span>
                  <span className="text-red-600 dark:text-red-400">{formatCurrency(totalDespesas)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 3: VENDAS E RESUMO */}
          <div className="space-y-6">
            {/* Vendas */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Vendas do Dia</h2>
                <button
                  type="button"
                  onClick={adicionarVenda}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title="Adicionar venda manual"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Status da importação automática */}
              {loadingEntregas && formData.vendedor_id && (
                <p className="text-sm text-blue-500 dark:text-blue-400 flex items-center gap-1 mb-3">
                  <span className="animate-spin inline-block">⏳</span> Buscando entregas do dia...
                </p>
              )}
              {!loadingEntregas && formData.vendedor_id && entregasDoDia && entregasDoDia.length > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                  ✅ {entregasDoDia.length} entrega(s) importada(s) automaticamente
                </p>
              )}
              {!loadingEntregas && formData.vendedor_id && entregasDoDia?.length === 0 && (
                <p className="text-xs text-orange-500 dark:text-orange-400 mb-3">
                  ⚠️ Nenhuma entrega encontrada — preencha manualmente
                </p>
              )}

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {vendas.map((venda, index) => (
                  <div key={venda.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      {venda.label && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-0.5" title={venda.label}>
                          {venda.label}
                        </p>
                      )}
                      <input
                        type="text"
                        value={formatCurrency(venda.valor)}
                        onChange={(e) => atualizarVenda(venda.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder="R$ 0,00"
                      />
                    </div>
                    {vendas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerVenda(venda.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center font-medium text-gray-900 dark:text-white">
                  <span>Total Vendas</span>
                  <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totalVendas)}</span>
                </div>
              </div>
            </div>

            {/* Resumo do Acerto */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Resumo do Acerto</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-gray-900 dark:text-white">
                  <span>Total de Vendas</span>
                  <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totalVendas)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>(-) Despesas Autorizadas</span>
                  <span className="text-orange-600 dark:text-orange-400">- {formatCurrency(totalDespesas)}</span>
                </div>
                <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
                  <div className="flex justify-between text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <span>Valor Esperado (a entregar)</span>
                    <span className="text-purple-600 dark:text-purple-400">{formatCurrency(valorEsperado)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-900 dark:text-white">
                  <span>Total Recebido (entregue)</span>
                  <span className="text-green-600 dark:text-green-400">{formatCurrency(totalRecebido)}</span>
                </div>
                <div className="pt-3 border-t-2 border-gray-400 dark:border-gray-500">
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span className="text-gray-900 dark:text-white">
                      {saldoLiquido >= 0 ? 'Sobra' : 'Falta'}
                    </span>
                    <span className={saldoLiquido >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatCurrency(Math.abs(saldoLiquido))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                    {saldoLiquido > 0 && '✅ Vendedor entregou valor A MAIS'}
                    {saldoLiquido < 0 && '❌ Vendedor entregou valor A MENOS'}
                    {saldoLiquido === 0 && '✅ Valor correto (bateu certinho)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/acertos-diarios')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !!acertoExistente}
            className={`px-6 py-2 rounded-md text-white font-medium flex items-center ${
              createMutation.isPending || !!acertoExistente
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            <Save size={20} className="mr-2" />
            {createMutation.isPending ? 'Salvando...' : 'Salvar Acerto'}
          </button>
        </div>
      </form>

      {/* Modal de Ajuda */}
      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Como funciona o Acerto Diário?"
      >
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            O Acerto Diário verifica se o valor entregue pelo vendedor está correto.
          </p>
          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Fórmula do Saldo</h4>
            <div className="text-sm font-mono bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 space-y-1">
              <div>1. Vendas - Despesas = Valor Esperado</div>
              <div>2. Recebido - Valor Esperado = Saldo</div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="font-semibold text-blue-900 dark:text-blue-300 block mb-1">🛒 Total de Vendas</span>
              Quanto o vendedor vendeu no dia. É o valor que ele "deve" ao caixa inicialmente.
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <span className="font-semibold text-orange-900 dark:text-orange-300 block mb-1">💸 Despesas Autorizadas</span>
              Gastos com comprovante (gasolina, pedágio, mecânico). <strong>DIMINUEM</strong> o valor que ele precisa entregar.
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="font-semibold text-purple-900 dark:text-purple-300 block mb-1">📊 Valor Esperado</span>
              Quanto ele deveria entregar: <code>Vendas - Despesas</code>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="font-semibold text-green-900 dark:text-green-300 block mb-1">📥 Total Recebido</span>
              Soma de tudo que o vendedor entregou (dinheiro, PIX, depósito, etc).
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">📌 Exemplos:</h4>
            <div className="space-y-3 text-xs">
              <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded border-l-4 border-green-500">
                <div className="font-semibold text-green-800 dark:text-green-300 mb-1">✅ Cenário: SOBRA</div>
                <div className="space-y-0.5 text-gray-700 dark:text-gray-400">
                  <div>Vendas: R$ 500,00 | Despesas: R$ 50,00</div>
                  <div>Esperado: R$ 450,00 | Recebido: R$ 480,00</div>
                  <div className="font-semibold text-green-700 dark:text-green-400 mt-1">SOBRA: R$ 30,00</div>
                </div>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded border-l-4 border-red-500">
                <div className="font-semibold text-red-800 dark:text-red-300 mb-1">❌ Cenário: FALTA</div>
                <div className="space-y-0.5 text-gray-700 dark:text-gray-400">
                  <div>Vendas: R$ 500,00 | Despesas: R$ 50,00</div>
                  <div>Esperado: R$ 450,00 | Recebido: R$ 420,00</div>
                  <div className="font-semibold text-red-700 dark:text-red-400 mt-1">FALTA: R$ 30,00</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NovoAcerto;
