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
        margin: [5, 5, 5, 5] as [number, number, number, number], // Margens em mm
        filename: `orcamento_nfe_${orcamento.numero_orcamento}.pdf`, 
        image: { type: 'jpeg' as const, quality: 0.98 },  
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const } 
      };

      await html2pdf().set(opt).from(element).save();
      console.log('Gerando PDF...');
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
      <div className="rounded-lg shadow-lg overflow-auto border border-gray-200 dark:border-gray-700 flex justify-center bg-gray-50 dark:bg-gray-900">
        <div 
          ref={printRef} 
          className="bg-white text-gray-900 shadow-xl" 
          style={{ 
            width: '210mm', 
            minHeight: '297mm',
            padding: '10mm',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {/* Layout Estilo DANFE */}
          <div className="border-2 border-gray-800 text-[10px] font-sans leading-tight">
            
            {/* Header: Emitente e DANFE */}
            <div className="grid grid-cols-12 border-b-2 border-gray-800">
              {/* Canhoto (Simulado) */}
              <div className="col-span-12 flex border-b border-gray-800 p-1 min-h-[30px]">
                 <div className="flex-1">
                    RECEBEMOS DE {getAdminField('nome_empresa').toUpperCase() || 'EMPRESA'} OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO
                 </div>
                 <div className="w-40 text-center border-l border-gray-800 pl-2">
                    <div className="font-bold text-sm">NF-e</div>
                    <div>Nº {orcamento.numero_orcamento.toString().padStart(9, '0')}</div>
                    <div>SÉRIE 1</div>
                 </div>
              </div>

              {/* Logo / Dados Emitente */}
              <div className="col-span-5 p-2 border-r border-gray-800 flex flex-col justify-center min-h-[100px]">
                <div className="font-bold text-sm mb-1">{getAdminField('nome_empresa') || getAdminField('nome') || 'NOME DA EMPRESA'}</div>
                <div>{getAdminField('endereco') || 'Endereço da Empresa'}, {getAdminField('numero') || ''}</div>
                <div>{getAdminField('bairro') || ''} - {getAdminField('cidade') || ''} - {getAdminField('estado') || ''}</div>
                <div>Fone: {getAdminField('telefone') || ''}</div>
              </div>

              {/* DANFE Grande */}
              <div className="col-span-2 p-2 border-r border-gray-800 text-center flex flex-col justify-center">
                <div className="font-bold text-lg">DANFE</div>
                <div className="text-[8px]">Documento Auxiliar da Nota Fiscal Eletrônica</div>
                <div className="my-1">
                   <span className="block">0 - Entrada</span>
                   <span className="block font-bold">1 - Saída</span>
                </div>
                <div className="font-bold border border-gray-800 p-1 rounded text-lg">
                   Nº {orcamento.numero_orcamento.toString().padStart(9, '0')}
                </div>
                <div className="font-bold mt-1">SÉRIE 1</div>
                <div className="text-[8px]">Folha 1/1</div>
              </div>

              {/* Chave de Acesso / Codigo Barras */}
              <div className="col-span-5 p-2 flex flex-col gap-2 justify-center">
                <div className="h-10 bg-gray-200 flex items-center justify-center text-gray-400 text-[8px]">
                   (CÓDIGO DE BARRAS SIMULADO)
                </div>
                <div>
                  <div className="font-bold text-[8px]">CHAVE DE ACESSO</div>
                  <div className="bg-gray-100 p-1 text-center text-[9px] font-mono tracking-wider">
                    {/* Chave de acesso fictícia baseada no ID */}
                    3523 01{orcamento.id.replace(/\D/g, '').padEnd(34, '0').slice(0, 34)} 55 001 000 000 000
                  </div>
                </div>
                <div className="text-[8px] text-center">
                   Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
                </div>
              </div>
            </div>

            {/* Natureza da Operação */}
            <div className="grid grid-cols-12 border-b-2 border-gray-800 p-1 bg-gray-50">
               <div className="col-span-7">
                  <div className="font-bold">NATUREZA DA OPERAÇÃO</div>
                  <div>VENDA DE MERCADORIA</div>
               </div>
               <div className="col-span-5">
                  <div className="font-bold">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                  <div>{orcamento.created_at ? new Date(orcamento.created_at).getTime() : ''} - {formatDate(orcamento.data_orcamento)}</div>
               </div>
            </div>

            {/* Dados Cadastrais Emitente (Inscrição) */}
            <div className="grid grid-cols-12 border-b-2 border-gray-800 p-1">
              <div className="col-span-4 border-r border-gray-800 pr-1">
                 <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                 <div>ISENTO</div>
              </div>
              <div className="col-span-4 border-r border-gray-800 px-1">
                 <div className="font-bold">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</div>
                 <div></div>
              </div>
              <div className="col-span-4 pl-1">
                 <div className="font-bold">CNPJ</div>
                 <div>{getAdminField('cpf_cnpj') || '00.000.000/0000-00'}</div>
              </div>
            </div>

            {/* Destinatário / Remetente */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[9px]">
               DESTINATÁRIO / REMETENTE
            </div>
            <div className="grid grid-cols-12 border-b-2 border-gray-800">
               {/* Linha 1 */}
               <div className="col-span-7 p-1 border-r border-b border-gray-800">
                  <div className="font-bold">NOME / RAZÃO SOCIAL</div>
                  <div className="truncate font-medium text-xs">{getClienteField('nome') || orcamento.cliente_nome}</div>
               </div>
               <div className="col-span-3 p-1 border-r border-b border-gray-800">
                  <div className="font-bold">CNPJ / CPF</div>
                  <div>{getClienteField('cpf') || getClienteField('cnpj') || ''}</div>
               </div>
               <div className="col-span-2 p-1 border-b border-gray-800">
                  <div className="font-bold">DATA DA EMISSÃO</div>
                  <div>{formatDate(orcamento.data_orcamento)}</div>
               </div>

               {/* Linha 2 */}
               <div className="col-span-6 p-1 border-r border-b border-gray-800">
                  <div className="font-bold">ENDEREÇO</div>
                  <div className="truncate">{getClienteField('endereco') || ''}, {getClienteField('numero') || ''}</div>
               </div>
               <div className="col-span-4 p-1 border-r border-b border-gray-800">
                  <div className="font-bold">BAIRRO / DISTRITO</div>
                  <div>{getClienteField('Bairro') || ''}</div>
               </div>
               <div className="col-span-2 p-1 border-b border-gray-800">
                  <div className="font-bold">DATA SAÍDA/ENTRADA</div>
                  <div>{formatDate(orcamento.data_orcamento)}</div>
               </div>

               {/* Linha 3 */}
               <div className="col-span-4 p-1 border-r border-gray-800">
                  <div className="font-bold">MUNICÍPIO</div>
                  <div>{getClienteField('Cidade') || ''}</div>
               </div>
               <div className="col-span-1 p-1 border-r border-gray-800">
                  <div className="font-bold">UF</div>
                  <div>{getClienteField('Estado') || ''}</div>
               </div>
               <div className="col-span-3 p-1 border-r border-gray-800">
                  <div className="font-bold">FONE / FAX</div>
                  <div>{getClienteField('telefone') || ''}</div>
               </div>
               <div className="col-span-2 p-1 border-r border-gray-800">
                  <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                  <div></div>
               </div>
               <div className="col-span-2 p-1">
                   <div className="font-bold">HORA SAÍDA</div>
                   <div>{new Date().toLocaleTimeString().slice(0,5)}</div>
               </div>
            </div>

            {/* Cálculo do Imposto */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[9px]">
               CÁLCULO DO IMPOSTO
            </div>
            <div className="grid grid-cols-10 border-b-2 border-gray-800 text-right">
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">BASE DE CÁLC. DO ICMS</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO ICMS</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">BASE CÁLC. ICMS ST</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO ICMS ST</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR TOTAL PRODUTOS</div>
                  <div>{formatCurrency(orcamento.valor_total).replace('R$', '')}</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO FRETE</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">VALOR DO SEGURO</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">DESCONTO</div>
                  <div>0,00</div>
               </div>
               <div className="p-1 border-r border-gray-800">
                  <div className="font-bold text-left">OUTRAS DESP.</div>
                  <div>0,00</div>
               </div>
               <div className="p-1">
                  <div className="font-bold text-left">VALOR TOTAL NOTA</div>
                  <div>{formatCurrency(orcamento.valor_total).replace('R$', '')}</div>
               </div>
            </div>

            {/* Transportador / Volumes */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800 text-[9px]">
               TRANSPORTADOR / VOLUMES TRANSPORTADOS
            </div>
            <div className="grid grid-cols-12 border-b-2 border-gray-800">
               <div className="col-span-4 p-1 border-r border-gray-800">
                  <div className="font-bold">RAZÃO SOCIAL</div>
                  <div>O MESMO</div>
               </div>
               <div className="col-span-2 p-1 border-r border-gray-800">
                  <div className="font-bold">FRETE POR CONTA</div>
                  <div>0 - Emitente</div>
               </div>
               <div className="col-span-2 p-1 border-r border-gray-800">
                  <div className="font-bold">CÓDIGO ANTT</div>
                  <div></div>
               </div>
               <div className="col-span-2 p-1 border-r border-gray-800">
                  <div className="font-bold">PLACA DO VEÍCULO</div>
                  <div></div>
               </div>
               <div className="col-span-1 p-1 border-r border-gray-800">
                  <div className="font-bold">UF</div>
                  <div></div>
               </div>
               <div className="col-span-1 p-1">
                  <div className="font-bold">CNPJ/CPF</div>
                  <div></div>
               </div>
               
               {/* Linha 2 Transporte */}
               <div className="col-span-4 p-1 border-r border-t border-gray-800">
                  <div className="font-bold">ENDEREÇO</div>
                  <div></div>
               </div>
               <div className="col-span-4 p-1 border-r border-t border-gray-800">
                  <div className="font-bold">MUNICÍPIO</div>
                  <div></div>
               </div>
               <div className="col-span-1 p-1 border-r border-t border-gray-800">
                  <div className="font-bold">UF</div>
                  <div></div>
               </div>
               <div className="col-span-3 p-1 border-t border-gray-800">
                  <div className="font-bold">INSCRIÇÃO ESTADUAL</div>
                  <div></div>
               </div>
            </div>

            {/* Dados do Produto / Serviço */}
            <div className="bg-gray-100 p-1 font-bold border-b border-gray-800">
               DADOS DO PRODUTO / SERVIÇO
            </div>
            <div className="min-h-[300px]">
               <table className="w-full text-[10px]">
                  <thead>
                     <tr className="border-b border-gray-800">
                        <th className="p-1 border-r border-gray-800 text-left w-20">CÓDIGO</th>
                        <th className="p-1 border-r border-gray-800 text-left">DESCRIÇÃO</th>
                        <th className="p-1 border-r border-gray-800 text-center w-16">NCM/SH</th>
                        <th className="p-1 border-r border-gray-800 text-center w-10">CST</th>
                        <th className="p-1 border-r border-gray-800 text-center w-10">CFOP</th>
                        <th className="p-1 border-r border-gray-800 text-center w-10">UNID.</th>
                        <th className="p-1 border-r border-gray-800 text-right w-16">QTD.</th>
                        <th className="p-1 border-r border-gray-800 text-right w-20">VLR. UNIT.</th>
                        <th className="p-1 border-r border-gray-800 text-right w-20">VLR. TOTAL</th>
                        <th className="p-1 border-r border-gray-800 text-right w-16">BC ICMS</th>
                        <th className="p-1 border-r border-gray-800 text-right w-16">VLR. ICMS</th>
                        <th className="p-1 border-r border-gray-800 text-right w-16">VLR. IPI</th>
                        <th className="p-1 text-right w-12">ALIQ. ICMS</th>
                     </tr>
                  </thead>
                  <tbody>
                     {orcamento.itens?.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-200">
                           <td className="p-1 border-r border-gray-200">{index + 1}</td>
                           <td className="p-1 border-r border-gray-200">{item.descricao}</td>
                           <td className="p-1 border-r border-gray-200 text-center"></td>
                           <td className="p-1 border-r border-gray-200 text-center">000</td>
                           <td className="p-1 border-r border-gray-200 text-center">5102</td>
                           <td className="p-1 border-r border-gray-200 text-center">UN</td>
                           <td className="p-1 border-r border-gray-200 text-right">{item.quantidade}</td>
                           <td className="p-1 border-r border-gray-200 text-right">{formatCurrency(item.valor_venda_unitario).replace('R$', '')}</td>
                           <td className="p-1 border-r border-gray-200 text-right">{formatCurrency(item.valor_total).replace('R$', '')}</td>
                           <td className="p-1 border-r border-gray-200 text-right">0,00</td>
                           <td className="p-1 border-r border-gray-200 text-right">0,00</td>
                           <td className="p-1 border-r border-gray-200 text-right">0,00</td>
                           <td className="p-1 text-right">0,00</td>
                        </tr>
                     ))}
                     {/* Linhas vazias para preencher espaço se necessário */}
                     {Array.from({ length: Math.max(0, 10 - (orcamento.itens?.length || 0)) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="border-b border-gray-100 text-transparent">
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1 border-r border-gray-100">-</td>
                           <td className="p-1">-</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Dados Adicionais */}
            <div className="bg-gray-100 p-1 font-bold border-t border-b border-gray-800">
               DADOS ADICIONAIS
            </div>
            <div className="grid grid-cols-12 min-h-[100px]">
               <div className="col-span-7 p-1 border-r border-gray-800">
                  <div className="text-[9px] font-bold">INFORMAÇÕES COMPLEMENTARES</div>
                  <div className="text-[9px]">
                     Orçamento válido por 7 dias. Documento sem valor fiscal. 
                     {/* Espaço para mais obs */}
                  </div>
               </div>
               <div className="col-span-5 p-1">
                  <div className="text-[9px] font-bold">RESERVADO AO FISCO</div>
               </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default DetalhesOrcamento;