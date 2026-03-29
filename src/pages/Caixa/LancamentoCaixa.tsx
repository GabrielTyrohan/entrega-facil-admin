import { toast } from '@/utils/toast';
import { ArrowLeft, FileText, Save, Upload, X } from 'lucide-react';
import React, { useState } from 'react'; // ✅ useEffect removido do import
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateLancamento, useUploadComprovante } from '../../hooks/useFluxoCaixa';


const CATEGORIAS = {
  entrada: ['Venda', 'Acerto', 'Outros'],
  saida: ['Fornecedor', 'Boleto', 'Salário', 'Combustível', 'Outros']
};


const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Boleto', 'Cartão', 'Transferência'];


const LancamentoCaixa = () => {
  const navigate = useNavigate();
  const { user, adminId } = useAuth();
  const createMutation = useCreateLancamento();
  const uploadMutation = useUploadComprovante();


  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [formData, setFormData] = useState({
    categoria: 'Fornecedor',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    forma_pagamento: 'PIX',
    status: 'pendente' as 'pendente' | 'pago' | 'cancelado'
  });


  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);


  // ✅ CORRIGIDO — useEffect removido, categoria resetada diretamente no onChange do radio
  const handleTipoChange = (novoTipo: 'entrada' | 'saida') => {
    setTipo(novoTipo);
    setFormData(prev => ({
      ...prev,
      categoria: CATEGORIAS[novoTipo][0]
    }));
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id || !adminId) return;

    // ✅ CORRIGIDO — user capturado antes dos awaits para evitar race condition
    const currentUserId = user.id;
    const currentAdminId = adminId;

    const valorNumerico = parseFloat(formData.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error('O valor deve ser maior que zero');
      return;
    }

    if (tipo === 'saida' && formData.categoria === 'Boleto' && !formData.data_vencimento) {
      toast.error('Data de vencimento é obrigatória para Boletos');
      return;
    }

    try {
      let anexoUrl = null;

      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${currentAdminId}/${fileName}`;

        try {
          anexoUrl = await uploadMutation.mutateAsync({ file, path: filePath });
        } catch (error) {
          console.error('Erro no upload:', error);
          toast.error('Erro ao fazer upload do comprovante, mas tentaremos salvar o lançamento.');
        } finally {
          setIsUploading(false);
        }
      }

      await createMutation.mutateAsync({
        administrador_id: currentAdminId,  // ✅ usa valor capturado antes dos awaits
        lancado_por: currentUserId,         // ✅ usa valor capturado antes dos awaits
        tipo,
        categoria: formData.categoria,
        descricao: formData.descricao,
        valor: valorNumerico,
        data_lancamento: formData.data_lancamento,
        data_vencimento: formData.data_vencimento || null,
        forma_pagamento: formData.forma_pagamento,
        status: formData.status,
        anexo_url: anexoUrl,
        referencia_tipo: 'manual'
      });

      navigate('/caixa');
    } catch (error) {
      // Erro já tratado no hook
    }
  };


  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/caixa')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Novo Lançamento</h1>
          <p className="text-gray-500 dark:text-gray-400">Registre uma entrada ou saída no caixa</p>
        </div>
      </div>


      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Tipo de Lançamento */}
        <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'entrada'}
              onChange={() => handleTipoChange('entrada')} // ✅ usa handler unificado
              className="w-4 h-4 text-green-600 focus:ring-green-500"
            />
            <span className="font-medium text-gray-900 dark:text-white">Entrada</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'saida'}
              onChange={() => handleTipoChange('saida')} // ✅ usa handler unificado
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="font-medium text-gray-900 dark:text-white">Saída</span>
          </label>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.valor}
              onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0,00"
            />
          </div>


          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.categoria}
              onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {CATEGORIAS[tipo].map(cat => (
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
              onChange={(e) => setFormData(prev => ({ ...prev, data_lancamento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>


          {/* Data Vencimento (Condicional) */}
          {(tipo === 'saida' && formData.categoria === 'Boleto') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Vencimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data_vencimento}
                onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FORMAS_PAGAMENTO.map(forma => (
                <option key={forma} value={forma}>{forma}</option>
              ))}
            </select>
          </div>


          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>


        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descrição
          </label>
          <textarea
            rows={3}
            value={formData.descricao}
            onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Detalhes do lançamento..."
          />
        </div>


        {/* Anexo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Anexo (Comprovante)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-gray-700/50">
            <div className="space-y-1 text-center">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FileText className="w-6 h-6 text-blue-500" />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-300">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white dark:bg-transparent rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload de arquivo</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                      />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG, PDF até 10MB
                  </p>
                </>
              )}
            </div>
          </div>
        </div>


        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate('/caixa')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || isUploading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={20} className="mr-2" />
            {createMutation.isPending || isUploading ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </form>
    </div>
  );
};


export default LancamentoCaixa;