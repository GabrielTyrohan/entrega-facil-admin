import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCliente } from '@/hooks/useClientes';
import { useOrcamentoPJById, useUpdateOrcamentoPJ } from '@/hooks/useOrcamentosPJ';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/toast';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Mail,
  Printer,
  ShoppingCart,
  XCircle
} from 'lucide-react';
import React, { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handlePrint = async () => {
    if (!printRef.current || !orcamento) return;

    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const element = printRef.current;
      const opt = { 
        margin: 0, 
        filename: `orcamento_nfe_${orcamento.numero_orcamento}.pdf`, 
        image: { type: 'jpeg' as const, quality: 0.98 },  
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          scrollY: 0, 
          windowWidth: 794, 
          windowHeight: 1123, 
          letterRendering: true 
        }, 
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' as const, 
          compress: true 
        }, 
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } 
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

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

      {/* Área de Impressão / Visualização */}
      <div className="rounded-lg shadow-lg overflow-auto border border-gray-200 dark:border-gray-700 flex justify-center bg-gray-50 dark:bg-gray-900 py-8">
        <div 
          ref={printRef} 
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
          {/* Layout Estilo DANFE */}
          <div 
            className="border-2 border-gray-800 text-[9px] font-sans leading-tight" 
            style={{ padding: '8mm' }} 
          >
            
            {/* Header: Emitente e DANFE */}
            <div className="border-b-2 border-gray-800">
              {/* Canhoto */}
              <div className="flex border-b border-gray-800 p-1 min-h-[30px]">
                <div className="flex-1 text-[8px] leading-tight">
                  RECEBEMOS DE {getAdminField('nome_empresa').toUpperCase() || 'EMPRESA'} OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
                </div>
                <div style={{ width: '140px' }} className="text-center border-l border-gray-800 pl-2 flex-shrink-0">
                  <div className="font-bold text-[10px]">NF-e</div>
                  <div className="text-[9px]">Nº {orcamento.numero_orcamento.toString().padStart(9, '0')}</div>
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
                  <div className="text-[7px] leading-tight mb-1">Documento Auxiliar da NF-e</div>
                  <div className="text-[8px] mb-1">
                    <div>0 - Entrada</div>
                    <div className="font-bold">1 - Saída</div>
                  </div>
                  <div className="font-bold border border-gray-800 py-1 text-[13px]">
                    Nº {orcamento.numero_orcamento.toString().padStart(9, '0')}
                  </div>
                  <div className="font-bold text-[9px] mt-1">SÉRIE 1</div>
                  <div className="text-[7px]">Folha 1/1</div>
                </div>

                {/* Chave */}
                <div style={{ width: '37%' }} className="p-2 flex flex-col gap-1 justify-center">
                  <div style={{ height: '35px' }} className="bg-gray-200 flex items-center justify-center text-gray-400 text-[7px]">
                    (CÓDIGO DE BARRAS)
                  </div>
                  <div>
                    <div className="font-bold text-[7px]">CHAVE DE ACESSO</div>
                    <div className="bg-gray-100 p-1 text-center text-[7px] font-mono break-all leading-tight">
                      3523 01{orcamento.id.replace(/\D/g, '').padEnd(34, '0').slice(0, 34)} 55 001 000
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
                  <div>{orcamento.created_at ? new Date(orcamento.created_at).getTime() : ''} - {formatDate(orcamento.data_orcamento)}</div>
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
                  <div>{orcamento.data_saida ? formatDate(orcamento.data_saida) : ''}</div>
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
                   <div>{orcamento.hora_saida || ''}</div>
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
            <div style={{ minHeight: '280px' }}>
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
                           <td className="p-1 border-r border-gray-200 text-[7px]">{index + 1}</td>
                           <td className="p-1 border-r border-gray-200 text-[7px] truncate" style={{ maxWidth: '200px' }}>{item.descricao}</td>
                           <td className="p-1 border-r border-gray-200 text-center text-[7px]">000</td>
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
                     Orçamento válido por 7 dias. Documento sem valor fiscal. 
                     {/* Espaço para mais obs */}
                  </div>
               </div>
               <div className="col-span-5 p-1">
                  <div className="text-[8px] font-bold">RESERVADO AO FISCO</div>
               </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default DetalhesOrcamento;