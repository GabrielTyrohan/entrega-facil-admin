import { applyCurrencyMask, currencyMaskToNumber } from '@/utils/currencyUtils';
import { toast } from '@/utils/toast';
import { addMonths, format } from 'date-fns';
import { ArrowLeft, RefreshCw, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { criarLancamentoRecorrente, criarLancamentoSimples } from '../../services/lancamentoCaixaService';

const CATEGORIAS = {
  entrada: ['Venda', 'Acerto', 'Outros'],
  saida: ['Fornecedor', 'Boleto', 'Salário', 'Combustível', 'Outros'],
};

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Boleto', 'Cartão', 'Transferência'];

const NovoLancamento = () => {
  const navigate = useNavigate();
  const { adminId } = useAuth();

  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [formData, setFormData] = useState({
    categoria: 'Fornecedor',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    forma_pagamento: 'PIX',
    status: 'pendente' as 'pendente' | 'pago' | 'cancelado',
  });

  const [recorrente, setRecorrente]           = useState(false);
  const [parcelas, setParcelas]               = useState(2);
  const [modoRecorrencia, setModoRecorrencia] = useState<'fixo' | 'dividido'>('fixo');
  const [isSubmitting, setIsSubmitting]       = useState(false);

  // Reset categoria + recorrência quando muda o tipo
  useEffect(() => {
    setFormData((prev) => ({ ...prev, categoria: CATEGORIAS[tipo][0] }));
    if (tipo === 'entrada') {
      setRecorrente(false);
      setModoRecorrencia('fixo');
    }
  }, [tipo]);

  const valorNumerico = currencyMaskToNumber(formData.valor) || 0;

  const valorPorParcela =
    modoRecorrencia === 'dividido' && parcelas > 0
      ? valorNumerico / parcelas
      : valorNumerico;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminId) return;

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error('O valor deve ser maior que zero');
      return;
    }

    if (tipo === 'saida' && formData.categoria === 'Boleto' && !formData.data_vencimento) {
      toast.error('Data de vencimento é obrigatória para Boletos');
      return;
    }

    const dadosForm = {
      administrador_id: adminId,
      tipo,
      categoria:       formData.categoria,
      descricao:       formData.descricao,
      valor:           valorPorParcela,
      data_lancamento: formData.data_lancamento,
      data_vencimento: formData.data_vencimento || undefined,
      forma_pagamento: formData.forma_pagamento,
      status:          recorrente ? 'pendente' : formData.status,
    };

    try {
      setIsSubmitting(true);
      if (recorrente && parcelas > 1) {
        await criarLancamentoRecorrente(dadosForm, parcelas);
        toast.success(`${parcelas} lançamentos recorrentes criados com sucesso!`);
      } else {
        await criarLancamentoSimples(dadosForm);
        toast.success('Lançamento criado com sucesso!');
      }
      navigate('/caixa');
    } catch {
      toast.error('Erro ao salvar lançamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/caixa')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Novo Lançamento</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Registre uma entrada ou saída, simples ou recorrente
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        {/* Tipo */}
        <div className="flex gap-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'entrada'}
              onChange={() => setTipo('entrada')}
              className="w-4 h-4 text-green-600 focus:ring-green-500"
            />
            <span className="font-medium text-green-600 dark:text-green-400">Entrada</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'saida'}
              onChange={() => setTipo('saida')}
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="font-medium text-red-600 dark:text-red-400">Saída</span>
          </label>
        </div>

        {/* Campos principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.valor}
              onChange={(e) => setFormData((prev) => ({ ...prev, valor: applyCurrencyMask(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="R$ 0,00"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.categoria}
              onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {CATEGORIAS[tipo].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Data Lançamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data do Lançamento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.data_lancamento}
              onChange={(e) => setFormData((prev) => ({ ...prev, data_lancamento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Data Vencimento — apenas Boleto */}
          {tipo === 'saida' && formData.categoria === 'Boleto' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Vencimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_vencimento}
                onChange={(e) => setFormData((prev) => ({ ...prev, data_vencimento: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Forma de Pagamento
            </label>
            <select
              value={formData.forma_pagamento}
              onChange={(e) => setFormData((prev) => ({ ...prev, forma_pagamento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma} value={forma}>{forma}</option>
              ))}
            </select>
          </div>

          {/* Status — oculto quando recorrente (sempre pendente) */}
          {!recorrente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.value as 'pendente' | 'pago' | 'cancelado',
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descrição
          </label>
          <textarea
            rows={3}
            value={formData.descricao}
            onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Detalhes do lançamento..."
          />
        </div>

        {/* Toggle recorrência — APENAS para saída */}
        {tipo === 'saida' && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <input
              type="checkbox"
              id="recorrente"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label
              htmlFor="recorrente"
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              <RefreshCw size={15} className="text-blue-500" />
              Lançamento recorrente (ex: mensalidade, salário, aluguel)
            </label>
          </div>
        )}

        {/* Opções de recorrência — APENAS para saída + recorrente ativo */}
        {tipo === 'saida' && recorrente && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">

            {/* Número de parcelas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Número de parcelas / meses <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={parcelas}
                onChange={(e) => setParcelas(Math.min(60, Math.max(2, Number(e.target.value))))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Modo de valor */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Modo de valor
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modoRecorrencia"
                    value="fixo"
                    checked={modoRecorrencia === 'fixo'}
                    onChange={() => setModoRecorrencia('fixo')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Valor fixo por parcela{' '}
                    <span className="text-gray-400">(ex: mensalidade, aluguel)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modoRecorrencia"
                    value="dividido"
                    checked={modoRecorrencia === 'dividido'}
                    onChange={() => setModoRecorrencia('dividido')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Dividir valor total{' '}
                    <span className="text-gray-400">(ex: parcelamento de compra)</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1 border-t border-gray-200 dark:border-gray-600">
              {formData.data_lancamento && (
                <p className="mt-2">
                  📅 De{' '}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {format(new Date(formData.data_lancamento + 'T12:00:00'), 'dd/MM/yyyy')}
                  </strong>
                  {' '}até{' '}
                  <strong className="text-gray-700 dark:text-gray-200">
                    {format(
                      addMonths(new Date(formData.data_lancamento + 'T12:00:00'), parcelas - 1),
                      'dd/MM/yyyy'
                    )}
                  </strong>
                </p>
              )}
              {valorNumerico > 0 && (
                <p>
                  💰 Cada parcela:{' '}
                  <strong className="text-blue-600 dark:text-blue-400">
                    R$ {valorPorParcela.toFixed(2).replace('.', ',')}
                  </strong>
                  {modoRecorrencia === 'dividido' && (
                    <span className="ml-1 text-gray-400">
                      (R$ {valorNumerico.toFixed(2).replace('.', ',')} ÷ {parcelas})
                    </span>
                  )}
                </p>
              )}
              <p>⚠️ Todos os lançamentos serão criados com status <em>pendente</em>.</p>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate('/caixa')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Save size={20} className="mr-2" />
            {isSubmitting
              ? 'Salvando...'
              : recorrente
              ? `Criar ${parcelas} Lançamentos`
              : 'Salvar Lançamento'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoLancamento;
