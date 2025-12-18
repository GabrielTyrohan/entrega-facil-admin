import React, { useState } from 'react';
import { 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Send,
  FileText,
  Bug,
  Lightbulb,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from '../contexts/AuthContext';
import { useSuporteSolicitacoes } from '../hooks/useSuporteSolicitacoes';

const Suporte: React.FC = () => {
  const { user, loading } = useAuth();
  const { enviarSolicitacao, isSubmitting, error: hookError } = useSuporteSolicitacoes();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState({
    tipo: 'bug' as const,
    urgencia: 'media' as const,
    assunto: '',
    descricao: ''
  });

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Status Card Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="text-right">
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form Skeleton */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>

              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className={`w-full rounded-lg ${i === 3 ? 'h-32' : 'h-10'}`} />
                  </div>
                ))}
                <Skeleton className="h-12 w-full rounded-lg mt-4" />
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-2 space-y-4">
            {/* Support Types Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <Skeleton className="h-5 w-5" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Time Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-40" />
              </div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação dos campos obrigatórios
    const newErrors: { [key: string]: string } = {};
    
    // Verificar se assunto está vazio ou contém apenas espaços
    if (!formData.assunto || formData.assunto.trim() === '') {
      newErrors.assunto = 'O assunto é obrigatório';
    }
    
    // Verificar se descrição está vazia ou contém apenas espaços
    if (!formData.descricao || formData.descricao.trim() === '') {
      newErrors.descricao = 'A descrição é obrigatória';
    }
    
    setErrors(newErrors);
    
    // Se houver erros, não prosseguir
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Verificar autenticação
    if (!user?.id || !user?.email) {
      setSubmitStatus('error');
      return;
    }

    // Enviar solicitação
    const resultado = await enviarSolicitacao(
      {
        tipo: formData.tipo,
        urgencia: formData.urgencia,
        assunto: formData.assunto.trim(),
        descricao: formData.descricao.trim(),
      },
      {
        id: user.id,
        nome: user.name || user.email.split('@')[0],
        email: user.email,
      }
    );

    if (resultado) {
      setSubmitStatus('success');
      // Limpar apenas os campos Assunto e Descrição após envio bem-sucedido
      setFormData(prev => ({ 
        ...prev, 
        assunto: '', 
        descricao: '' 
      }));
      // Limpar erros também
      setErrors({});
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } else {
      setSubmitStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Suporte & Avisos</h1>
          <p className="text-gray-600 dark:text-gray-400">Central de comunicação com o desenvolvedor</p>
        </div>
      </div>

      {/* Card de Status do Sistema */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sistema Operacional</h3>
            <p className="text-gray-600 dark:text-gray-400">Todos os serviços estão funcionando normalmente</p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-4 h-4 mr-1" />
              Última atualização: há 5 min
            </div>
          </div>
        </div>
      </div>

      {/* Grid Principal - 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coluna Esquerda - Formulário de Suporte (60%) */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Formulário de Suporte</h2>
                <p className="text-gray-600 dark:text-gray-400">Descreva seu problema ou sugestão</p>
              </div>
            </div>

            {submitStatus === 'success' && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-800 dark:text-green-200">Solicitação enviada com sucesso!</p>
                </div>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-800 dark:text-red-200">{hookError || 'Erro ao enviar'}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Solicitação
                </label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="bug">🐛 Reportar Bug</option>
                  <option value="feature">💡 Sugestão de Funcionalidade</option>
                  <option value="support">❓ Suporte Técnico</option>
                  <option value="other">📝 Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Urgência *
                </label>
                <select
                  name="urgencia"
                  value={formData.urgencia}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="baixa">🟢 Baixa</option>
                  <option value="media">🟡 Média</option>
                  <option value="alta">🔴 Alta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assunto
                </label>
                <input
                  type="text"
                  name="assunto"
                  value={formData.assunto}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.assunto ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Resumo do problema ou sugestão"
                />
                {errors.assunto && <p className="mt-1 text-sm text-red-600">{errors.assunto}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição Detalhada
                </label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  rows={6}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none ${errors.descricao ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="Descreva detalhadamente o problema, erro ou sugestão..."
                />
                {errors.descricao && <p className="mt-1 text-sm text-red-600">{errors.descricao}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Solicitação</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Coluna Direita - Cards de Contato Rápido (40%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card de Contato Direto */}

          {/* Card de Tipos de Suporte */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tipos de Suporte</h3>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Bug className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Bugs & Erros</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Problemas técnicos do sistema</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Sugestões</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Ideias para melhorias</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Documentação</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Dúvidas sobre funcionalidades</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de Tempo de Resposta */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tempo de Resposta</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Bugs Críticos</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">2-4 horas</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Suporte Geral</span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">1-2 dias</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Sugestões</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">3-5 dias</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Suporte;