import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCliente } from '@/hooks/useClientes';
import { useOrcamentoPJById, useUpdateOrcamentoPJ } from '@/hooks/useOrcamentosPJ';
import { supabase } from '@/lib/supabase';
import { nfeService } from '@/services/nfeService';
import { toast } from '@/utils/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileCheck,
  Mail,
  Printer,
  ShoppingCart,
  XCircle
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import Barcode from 'react-barcode';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';

interface NotaFiscalContora {
  id: string;
  status?: string;
  provedor?: string;
  provedor_documento_id?: string;
  provedor_status?: string;
  processamento_status?: string;
  ambiente?: string;
  idempotency_key?: string;
  erro_codigo?: string;
  erro_mensagem?: string;
  protocolo_autorizacao?: string;
  numero?: number;
  chave_acesso?: string;
  [key: string]: unknown;
}

const DetalhesOrcamento: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile, userType } = useAuth();
  const { data: orcamento, isLoading, refetch } = useOrcamentoPJById(id || '');
  const { data: cliente } = useCliente(orcamento?.cliente_id || '', { enabled: !!orcamento?.cliente_id });
  
  // Busca dados da empresa (Admin Profile) para o cabeçalho
  const { data: adminProfile } = useQuery({
    queryKey: ['ADMIN_PROFILE_FOR_INVOICE', userProfile?.id],
    queryFn: async () => {
      if (!userProfile) return null;
      
      // Se for admin, usa o próprio perfil
      if (userType === 'admin') {
        return userProfile;
      }
      
      // Se for funcionário, busca o perfil do administrador
      // @ts-ignore
      if (userType === 'funcionario' && userProfile.administrador_id) {
        const { data, error } = await supabase
          .from('administradores')
          .select('*')
          // @ts-ignore
          .eq('id', userProfile.administrador_id)
          .single();
          
        if (error) return null;
        return data;
      }
      
      return null;
    },
    enabled: !!userProfile
  });

  const updateOrcamento = useUpdateOrcamentoPJ();
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isValidandoNFe, setIsValidandoNFe] = useState(false);

  const { data: notasVinculadas, refetch: refetchNotas } = useQuery({
    queryKey: ['notas-fiscais-orcamento', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('referencia_tipo', 'orcamento')
        .eq('referencia_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as NotaFiscalContora[];
    },
    enabled: !!id,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Rascunho fiscal x NF-e autorizada: somente status === 'autorizada'
  // representa documento autorizado. Qualquer outro status é rascunho/validação.
  const notaAutorizada = notasVinculadas?.find((n) => n.status === 'autorizada');
  const notaRascunho = notasVinculadas?.[0];
  const notaFiscalExibicao = notaAutorizada ?? notaRascunho;
  const isAutorizada = !!notaAutorizada;
  const isFiscalContora = notaFiscalExibicao?.provedor === 'fiscal_contora';

  const handleValidarNFe = async () => {
    if (!orcamento || isValidandoNFe) return;
    setIsValidandoNFe(true);
    try {
      await nfeService.emitirNFe(orcamento.id, orcamento.cliente_id);
      toast.success(
        'NF-e validada pela Fiscal Contora em homologação. Nenhum documento foi transmitido à SEFAZ.',
        { duration: 8000 }
      );
      await refetchNotas();
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais-orcamento', id] });
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao validar NF-e em homologação');
    } finally {
      setIsValidandoNFe(false);
    }
  };

  const formatarChave = (chave: string) => chave.match(/.{1,4}/g)?.join(' ') ?? chave;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `orcamento_nfe_${orcamento?.numero_orcamento || 'documento'}`,
    onBeforePrint: async () => { toast.info('Preparando impressão...'); },
    onAfterPrint: () => { toast.success('Pronto!'); },
  });

  const handleEmail = () => {
    toast.info('Envio por email em breve!');
  };

  const handleConvert = async () => {
    if (!orcamento) return;
    
    try {
      await updateOrcamento.mutateAsync({
        id: orcamento.id,
        data: { status: 'convertido' }
      });
      toast.success('Orçamento convertido em venda com sucesso!');
      refetch();
    } catch (error) {
      console.error('Erro ao converter orçamento:', error);
      toast.error('Erro ao converter orçamento');
    }
  };

  const handleStatusChange = async (newStatus: 'aprovado' | 'rejeitado' | 'pendente') => {
    if (!orcamento) return;

    try {
      await updateOrcamento.mutateAsync({
        id: orcamento.id,
        data: { status: newStatus }
      });
      toast.success(`Status atualizado para ${newStatus}`);
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <span className="flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"><CheckCircle className="w-4 h-4" /> Aprovado</span>;
      case 'rejeitado':
        return <span className="flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"><XCircle className="w-4 h-4" /> Rejeitado</span>;
      case 'convertido':
        return <span className="flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"><ShoppingCart className="w-4 h-4" /> Convertido</span>;
      default:
        return <span className="flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"><Clock className="w-4 h-4" /> Rascunho</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Orçamento não encontrado</h2>
        <button 
          onClick={() => navigate('/orcamentos-pj')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Voltar para a lista
        </button>
      </div>
    );
  }

  // Helpers para dados seguros (case insensitive fallback)
  const getClienteField = (field: string) => {
    if (!cliente) return '';
    // @ts-ignore
    return cliente[field] || cliente[field.toLowerCase()] || cliente[field.charAt(0).toUpperCase() + field.slice(1)] || '';
  };

  const getAdminField = (field: string) => {
    // Se temos o perfil de admin carregado (que vem da tabela administradores), usamos ele
    if (adminProfile) {
      // @ts-ignore
      return adminProfile[field] || adminProfile[field.toLowerCase()] || '';
    }

    // Se o usuário logado É o admin, podemos usar o userProfile provisoriamente
    // pois ele TAMBÉM vem da tabela administradores
    if (userType === 'admin' && userProfile) {
      // @ts-ignore
      return userProfile[field] || userProfile[field.toLowerCase()] || '';
    }

    // Se for funcionário e adminProfile ainda não carregou, NÃO mostrar dados do userProfile
    // pois seriam dados do funcionário (tabela funcionarios), não da empresa.
    return '';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          #invoice-print-area {
            width: 210mm;
            background: white !important;
            margin: 0 auto;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {/* Header de Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/orcamentos-pj')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              Orçamento #{orcamento.numero_orcamento}
              {getStatusBadge(orcamento.status)}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {orcamento.status === 'pendente' && (
            <>
              <button
                onClick={() => handleStatusChange('aprovado')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Aprovar
              </button>
              <button
                onClick={() => handleStatusChange('rejeitado')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Rejeitar
              </button>
            </>
          )}
          
          {(orcamento.status === 'aprovado') && (
            <button
              onClick={handleConvert}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Converter em Venda
            </button>
          )}

          <button
            onClick={handleValidarNFe}
            disabled={isValidandoNFe}
            title="Valida a estrutura fiscal em homologação (Fiscal Contora). Nenhum documento é transmitido à SEFAZ."
            className="flex flex-col items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors leading-tight"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileCheck className="w-4 h-4" />
              {isValidandoNFe ? 'Validando...' : 'Validar NF-e'}
            </span>
            <span className="text-[10px] uppercase tracking-wide opacity-90">Homologação</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            PDF
          </button>
          
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
        </div>
      </div>

      {/* Status fiscal (Fiscal Contora — homologação) */}
      {notaFiscalExibicao && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
            {isAutorizada ? 'Nota Fiscal' : 'Rascunho fiscal — Validação em homologação'}
          </h2>
          {isFiscalContora ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Provedor:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">Fiscal Contora</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Ambiente:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">Homologação</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Status:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{notaFiscalExibicao.provedor_status || notaFiscalExibicao.status || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Processamento:</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{notaFiscalExibicao.processamento_status || '—'}</dd>
              </div>
              {notaFiscalExibicao.provedor_documento_id && (
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-gray-500 dark:text-gray-400">ID Fiscal Contora:</dt>
                  <dd className="font-mono text-xs text-gray-900 dark:text-white break-all text-right">{notaFiscalExibicao.provedor_documento_id}</dd>
                </div>
              )}
              {!isAutorizada && (
                <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Estrutura validada em homologação. Nenhum documento foi transmitido à SEFAZ.
                  {notaFiscalExibicao.erro_mensagem ? ` Detalhe: ${notaFiscalExibicao.erro_mensagem}` : ''}
                </p>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAutorizada
                ? `Status: ${notaFiscalExibicao.status}`
                : 'Rascunho fiscal em validação. Nenhum documento foi transmitido à SEFAZ.'}
            </p>
          )}
        </div>
      )}

      {/* Área de Impressão / Visualização */}
      <div className="rounded-lg shadow-lg overflow-auto border border-gray-200 dark:border-gray-700 flex justify-center bg-gray-50 dark:bg-gray-900 py-8">
        <div 
          ref={printRef} 
          id="invoice-print-area"
          className="bg-white text-gray-900 shadow-xl mx-auto" 
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            padding: '0', 
            margin: '0 auto', 
            boxSizing: 'border-box', 
            backgroundColor: 'white' 
          }} 
        >
          {/* Layout Estilo DANFE — RASCUNHO SEM VALOR FISCAL */}
          <div
            className="border-2 border-gray-800 text-[9px] font-sans leading-tight flex flex-col"
            style={{ padding: '8mm', minHeight: '100%' }}
          >

            {/* Aviso fiscal — nunca tratar rascunho como DANFE oficial */}
            <div className="border-2 border-yellow-600 bg-yellow-50 p-2 mb-2 text-center">
              <div className="font-bold text-[10px] text-yellow-800">Documento sem valor fiscal</div>
              <div className="text-[8px] text-yellow-700">
                {isAutorizada
                  ? 'Documento autorizado — verifique chave e protocolo oficiais.'
                  : 'Rascunho fiscal — Validação em homologação (Fiscal Contora). Nenhum documento foi transmitido à SEFAZ.'}
              </div>
            </div>

            {/* Header: Emitente e DANFE */}
            <div className="border-b-2 border-gray-800">
              {/* Canhoto */}
              <div className="flex border-b border-gray-800 p-1 min-h-[30px]">
                <div className="flex-1 text-[8px] leading-tight">
                  RECEBEMOS DE {getAdminField('nome_empresa').toUpperCase() || 'EMPRESA'} OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
                </div>
                <div style={{ width: '140px' }} className="text-center border-l border-gray-800 pl-2 flex-shrink-0">
                  <div className="font-bold text-[10px]">NF-e</div>
                  <div className="text-[9px]">
                    {isAutorizada && notaAutorizada?.numero
                      ? `Nº ${String(notaAutorizada.numero).padStart(9, '0')}`
                      : `Orçamento Nº ${orcamento.numero_orcamento.toString().padStart(9, '0')}`}
                  </div>
                  {!isAutorizada && (
                    <div className="text-[7px] text-gray-500">(não é número oficial da NF-e)</div>
                  )}
                  <div className="text-[8px]">SÉRIE 1</div>
                </div>
              </div>

              {/* Dados Principais */}
              <div className="flex" style={{ minHeight: '90px' }}>
                {/* Emitente */}
                <div style={{ width: '43%' }} className="p-2 border-r border-gray-800 flex flex-col justify-center">
                  <div className="font-bold text-[10px] mb-1 uppercase" style={{ wordBreak: 'break-word', overflow: 'visible', whiteSpace: 'normal' }}>
                    {getAdminField('nome_empresa') || 'EMPRESA'}
                  </div>
                  <div className="text-[8px] leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal', overflow: 'visible' }}>
                    <div>{getAdminField('endereco') || 'Endereço'}, {getAdminField('numero') || ''}</div>
                    <div>{getAdminField('bairro') || ''} - {getAdminField('cidade') || ''}/{getAdminField('estado') || ''}</div>
                    <div>Fone: {getAdminField('telefone') || ''}</div>
                  </div>
                </div>

                {/* DANFE */}
                <div style={{ width: '20%' }} className="p-2 border-r border-gray-800 text-center flex flex-col justify-center flex-shrink-0">
                  <div className="font-bold text-[14px]">DANFE</div>
                  <div className="text-[7px] leading-tight mb-1">
                    {isAutorizada ? 'Documento Auxiliar da NF-e' : 'Rascunho — sem valor fiscal'}
                  </div>
                  <div className="text-[8px] mb-1">
                    <div>0 - Entrada</div>
                    <div className="font-bold">1 - Saída</div>
                  </div>
                  <div className="font-bold border border-gray-800 py-1 text-[13px]">
                    {isAutorizada && notaAutorizada?.numero
                      ? `Nº ${String(notaAutorizada.numero).padStart(9, '0')}`
                      : `Nº ${orcamento.numero_orcamento.toString().padStart(9, '0')}`}
                  </div>
                  {!isAutorizada && (
                    <div className="text-[7px] text-gray-500">nº do orçamento (não oficial)</div>
                  )}
                  <div className="font-bold text-[9px] mt-1">SÉRIE 1</div>
                  <div className="text-[7px]">Folha 1/1</div>
                </div>

                {/* Chave */}
                <div style={{ width: '37%' }} className="flex flex-col gap-1 justify-center p-2">
                  <div className="flex justify-center items-center w-full mb-1">
                    {isAutorizada && notaAutorizada?.chave_acesso ? (
                      <Barcode
                        value={notaAutorizada.chave_acesso}
                        format="CODE128"
                        width={1}
                        height={35}
                        fontSize={0}
                        margin={0}
                        background="transparent"
                      />
                    ) : (
                      <div className="bg-gray-200 flex items-center justify-center text-gray-500 text-[7px] text-center px-2" style={{ height: '35px', width: '100%' }}>
                        (RASCUNHO FISCAL — SEM VALOR FISCAL)
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-[7px]">CHAVE DE ACESSO</div>
                    <div className="bg-gray-100 p-1 text-center text-[7px] font-mono break-all leading-tight">
                      {isAutorizada && notaAutorizada?.chave_acesso
                        ? formatarChave(notaAutorizada.chave_acesso)
                        : 'Rascunho fiscal — nota ainda não autorizada'}
                    </div>
                  </div>
                  <div className="text-[6px] text-center leading-tight">
                    Consulta: www.nfe.fazenda.gov.br/portal
                  </div>
                </div>
              </div>
            </div>

            {/* Natureza da Operação */}
            <div className="flex border-b-2 border-gray-800 p-1 bg-gray-50">
               <div style={{ width: '58.33%' }}>
                  <div className="font-bold">NATUREZA DA OPERAÇÃO</div>
                  <div>VENDA DE MERCADORIA</div>
               </div>
               <div style={{ width: '41.67%' }}>
                  <div className="font-bold">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                  <div>
                    {isAutorizada && notaAutorizada?.protocolo_autorizacao
                      ? notaAutorizada.protocolo_autorizacao
                      : 'Aguardando autorização — nenhum documento transmitido à SEFAZ'}
                  </div>
               </div>
            </div>

            {/* Dados Cadastrais Emitente (Inscrição) */}
            <div className="flex border-b-2 border-gray-800 p-1">
              <div style={{ width: '33.33%' }} className="border-r border-gray-800 pr-1">
                 <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                 <div>ISENTO</div>
              </div>
              <div style={{ width: '33.33%' }} className="border-r border-gray-800 px-1">
                 <div className="font-bold">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</div>
                 <div></div>
              </div>
              <div style={{ width: '33.33%' }} className="pl-1">
                 <div className="font-bold">CNPJ</div>
                 <div>{getAdminField('cpf_cnpj') || '00.000.000/0000-00'}</div>
              </div>
            </div>

            {/* Destinatário / Remetente */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[9px]">
               DESTINATÁRIO / REMETENTE
            </div>
            <div className="flex flex-wrap border-b-2 border-gray-800">
               {/* Linha 1 */}
               <div style={{ width: '58.33%' }} className="p-1 border-r border-b border-gray-800">
                  <div className="font-bold">NOME / RAZÃO SOCIAL</div>
                  <div className="text-[9px] leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal', overflow: 'visible' }}>
                    {getClienteField('nome') || orcamento.cliente_nome}
                  </div>
               </div>
               <div style={{ width: '25%' }} className="p-1 border-r border-b border-gray-800">
                  <div className="font-bold">CNPJ / CPF</div>
                  <div>{getClienteField('cpf') || getClienteField('cnpj') || ''}</div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-b border-gray-800">
                  <div className="font-bold">DATA DA EMISSÃO</div>
                  <div>{formatDate(orcamento.data_orcamento)}</div>
               </div>

               {/* Linha 2 */}
               <div style={{ width: '50%' }} className="p-1 border-r border-b border-gray-800">
                  <div className="font-bold">ENDEREÇO</div>
                  <div className="text-[8px] leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal', overflow: 'visible' }}>
                    {getClienteField('endereco') || ''}, {getClienteField('numero') || ''}
                  </div>
               </div>
               <div style={{ width: '33.33%' }} className="p-1 border-r border-b border-gray-800">
                  <div className="font-bold">BAIRRO / DISTRITO</div>
                  <div>{getClienteField('Bairro') || ''}</div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-b border-gray-800">
                  <div className="font-bold">DATA SAÍDA/ENTRADA</div>
                  <div>{orcamento.dataSaida ? formatDate(orcamento.dataSaida) : ''}</div>
               </div>

               {/* Linha 3 */}
               <div style={{ width: '33.33%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">MUNICÍPIO</div>
                  <div>{getClienteField('Cidade') || ''}</div>
               </div>
               <div style={{ width: '8.33%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">UF</div>
                  <div>{getClienteField('Estado') || ''}</div>
               </div>
               <div style={{ width: '25%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">FONE / FAX</div>
                  <div>{getClienteField('telefone') || ''}</div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                  <div></div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1">
                   <div className="font-bold">HORA SAÍDA</div>
                   <div>{orcamento.horaSaida || ''}</div>
               </div>
            </div>

            {/* Cálculo do Imposto */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[8px]">
               CÁLCULO DO IMPOSTO
            </div>
            <div className="flex border-b-2 border-gray-800 text-right">
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">BASE DE CÁLC. DO ICMS</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO ICMS</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">BASE CÁLC. ICMS ST</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO ICMS ST</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR TOTAL PRODUTOS</div>
                  <div>{formatCurrency(orcamento.valor_total).replace('R$', '')}</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO FRETE</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO SEGURO</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">DESCONTO</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">OUTRAS DESP.</div>
                  <div>0,00</div>
               </div>
               <div style={{ width: '10%' }} className="p-1">
                  <div className="font-bold text-left">VALOR TOTAL NOTA</div>
                  <div>{formatCurrency(orcamento.valor_total).replace('R$', '')}</div>
               </div>
            </div>

            {/* Transportador / Volumes */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[8px]">
               TRANSPORTADOR / VOLUMES TRANSPORTADOS
            </div>
            <div className="flex flex-wrap border-b-2 border-gray-800">
               <div style={{ width: '33.33%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">RAZÃO SOCIAL</div>
                  <div>O MESMO</div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">FRETE POR CONTA</div>
                  <div>0 - Emitente</div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">CÓDIGO ANTT</div>
                  <div></div>
               </div>
               <div style={{ width: '16.67%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">PLACA DO VEÍCULO</div>
                  <div></div>
               </div>
               <div style={{ width: '8.33%' }} className="p-1 border-r border-gray-800">
                  <div className="font-bold">UF</div>
                  <div></div>
               </div>
               <div style={{ width: '8.33%' }} className="p-1">
                  <div className="font-bold">CNPJ/CPF</div>
                  <div></div>
               </div>
               
               {/* Linha 2 Transporte */}
               <div style={{ width: '33.33%' }} className="p-1 border-r border-t border-gray-800">
                  <div className="font-bold">ENDEREÇO</div>
                  <div></div>
               </div>
               <div style={{ width: '33.33%' }} className="p-1 border-r border-t border-gray-800">
                  <div className="font-bold">MUNICÍPIO</div>
                  <div></div>
               </div>
               <div style={{ width: '8.33%' }} className="p-1 border-r border-t border-gray-800">
                  <div className="font-bold">UF</div>
                  <div></div>
               </div>
               <div style={{ width: '25%' }} className="p-1 border-t border-gray-800">
                  <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                  <div></div>
               </div>
            </div>

            {/* Dados do Produto / Serviço */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[8px]">
               DADOS DO PRODUTO / SERVIÇO
            </div>
            <div className="flex-1" style={{ minHeight: '100px' }}>
               <table className="w-full text-[7px] border-collapse">
                  <thead>
                     <tr className="border-b border-gray-800">
                        <th className="p-1 border-r border-gray-800 text-left" style={{ width: '5%' }}>CÓD</th>
                        <th className="p-1 border-r border-gray-800 text-left" style={{ width: '30%' }}>DESCRIÇÃO</th>
                        <th className="p-1 border-r border-gray-800 text-center" style={{ width: '8%' }}>NCM/SH</th>
                        <th className="p-1 border-r border-gray-800 text-center" style={{ width: '5%' }}>CST</th>
                        <th className="p-1 border-r border-gray-800 text-center" style={{ width: '5%' }}>CFOP</th>
                        <th className="p-1 border-r border-gray-800 text-center" style={{ width: '4%' }}>UN</th>
                        <th className="p-1 border-r border-gray-800 text-right" style={{ width: '6%' }}>QTD</th>
                        <th className="p-1 border-r border-gray-800 text-right" style={{ width: '9%' }}>VLR.UNIT</th>
                        <th className="p-1 border-r border-gray-800 text-right" style={{ width: '10%' }}>VLR.TOTAL</th>
                        <th className="p-1 border-r border-gray-800 text-right" style={{ width: '7%' }}>BC ICMS</th>
                        <th className="p-1 border-r border-gray-800 text-right" style={{ width: '7%' }}>V.ICMS</th>
                        <th className="p-1 text-right" style={{ width: '4%' }}>AL.IC</th>
                     </tr>
                  </thead>
                   <tbody>
                      {orcamento.itens?.map((item, index) => (
                         <tr key={item.id} className="border-b border-gray-200">
                            <td className="p-1 border-r border-gray-200 text-[7px]">{item.produto?.produto_cod || index + 1}</td>
                            <td className="p-1 border-r border-gray-200 text-[7px] truncate" style={{ maxWidth: '200px' }}>{item.descricao}</td>
                            <td className="p-1 border-r border-gray-200 text-center text-[7px]">{item.produto?.ncm || '—'}</td>
                            <td className="p-1 border-r border-gray-200 text-center text-[7px]">—</td>
                            <td className="p-1 border-r border-gray-200 text-center text-[7px]">5102</td>
                            <td className="p-1 border-r border-gray-200 text-center text-[7px]">UN</td>
                            <td className="p-1 border-r border-gray-200 text-right text-[7px]">{item.quantidade}</td>
                            <td className="p-1 border-r border-gray-200 text-right text-[7px]">{formatCurrency(item.valor_venda_unitario).replace('R$', '').trim()}</td>
                            <td className="p-1 border-r border-gray-200 text-right text-[7px]">{formatCurrency(item.valor_total).replace('R$', '').trim()}</td>
                            <td className="p-1 border-r border-gray-200 text-right text-[7px]">0,00</td>
                            <td className="p-1 border-r border-gray-200 text-right text-[7px]">0,00</td>
                            <td className="p-1 text-right text-[7px]">0</td>
                         </tr>
                      ))}
                   </tbody>
               </table>
            </div>

            {/* Dados Adicionais */}
            <div className="bg-gray-100 p-1 font-bold border-t border-b border-gray-800 text-[8px]">
               DADOS ADICIONAIS
            </div>
            <div className="grid grid-cols-12" style={{ minHeight: '60px' }}>
               <div className="col-span-7 p-1 border-r border-gray-800">
                  <div className="text-[8px] font-bold">INFORMAÇÕES COMPLEMENTARES</div>
                  <div className="text-[8px]">
                     Orçamento válido por 7 dias. Documento sem valor fiscal — rascunho para validação em homologação (Fiscal Contora).
                     A DANFE verdadeira será disponibilizada após autorização da NF-e.
                  </div>
               </div>
               <div className="col-span-5 p-1">
                  <div className="text-[8px] font-bold">RESERVADO AO FISCO</div>
                  <div className="text-[7px] text-gray-500">Sem protocolo — nenhum documento transmitido à SEFAZ.</div>
               </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default DetalhesOrcamento;