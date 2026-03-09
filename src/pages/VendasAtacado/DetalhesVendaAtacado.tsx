import { format, parseISO } from 'date-fns';
import { ArrowLeft, CheckCircle2, Clock, DollarSign, FileText, MapPin, Printer, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useRegistrarPagamento, useVendaAtacadoById } from '../../hooks/useVendasAtacado';
import { supabase } from '../../lib/supabase';
import { applyCurrencyMask, currencyMaskToNumber, formatCurrency } from '../../utils/currencyUtils';

const DetalhesVendaAtacado = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const componentRef = useRef(null);
  const [cestasInfo, setCestasInfo] = useState<{id: string, nome: string, qtd: number, valor: number}[]>([]);
  
  const [modalPagamento, setModalPagamento] = useState(false);
  const [valorNovoPagamento, setValorNovoPagamento] = useState('');
  const [obsNovoPagamento, setObsNovoPagamento] = useState('');
  const registrarPagamento = useRegistrarPagamento();
  
  const { data: venda, isLoading, error } = useVendaAtacadoById(id || '');

  const valorPagoAtual = Number((venda as any)?.valor_pago || 0);
  const saldoRestante = Number(venda?.valor_total || 0) - valorPagoAtual;

  // Unifica itens: prioriza JSONB, fallback para tabela filha
  const itensUnificados: any[] = useMemo(() => {
    if (venda?.itens && Array.isArray(venda.itens) && venda.itens.length > 0) {
      return venda.itens;
    }
    const filha = (venda as any)?.vendas_atacado_itens;
    if (filha && Array.isArray(filha) && filha.length > 0) {
      return filha;
    }
    return [];
  }, [venda]);

  // Buscar nomes dos produtos quando a venda carregar e calcular quantidades e valores
  useEffect(() => {
    if (!venda) return;

    // Prioridade 1: itens no JSONB (vendas novas)
    if (venda.itens && Array.isArray(venda.itens) && venda.itens.length > 0) {
      setCestasInfo(
        venda.itens.map((item: any) => ({
          id: item.produto_cadastrado_id || item.id || '',
          nome: item.descricao || 'Produto',
          qtd: Number(item.quantidade),
          valor: Number(item.subtotal),
        })).filter((i: any) => i.qtd > 0)
      );
      return;
    }

    // Prioridade 2: tabela filha via JOIN
    const itensFilha = (venda as any).vendas_atacado_itens;
    if (itensFilha && Array.isArray(itensFilha) && itensFilha.length > 0) {
      setCestasInfo(
        itensFilha.map((item: any) => ({
          id: item.produto_cadastrado_id || item.id || '',
          nome: item.descricao || 'Produto',
          qtd: Number(item.quantidade),
          valor: Number(item.subtotal),
        })).filter((i: any) => i.qtd > 0)
      );
      return;
    }

    // Fallback: vendas antigas sem itens, busca só nomes
    const fetchProdutos = async () => {
      if (!venda?.numero_produto?.length) return;
      try {
        const { data } = await supabase
          .from('produtos')
          .select('id, nome, preco')
          .in('id', venda.numero_produto);
        if (data) {
          setCestasInfo(data.map(p => ({
            id: p.id,
            nome: p.nome,
            qtd: 0,
            valor: Number(p.preco || 0),
          })));
        }
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
      }
    };
    fetchProdutos();
  }, [venda]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Pedido_${venda?.numero_pedido || id}`,
  });

  const handleConfirmarPagamento = async () => {
    const valor = currencyMaskToNumber(valorNovoPagamento);
    if (!valor || valor <= 0) {
      return;
    }
    try {
      await registrarPagamento.mutateAsync({
        vendaId: id!,
        valorNovoPagamento: valor,
        valorPagoAtual,
        valorTotal: Number(venda?.valor_total || 0),
      });
      setModalPagamento(false);
      setValorNovoPagamento('');
      setObsNovoPagamento('');
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !venda) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-red-600">Erro ao carregar venda</h2>
        <p className="text-gray-500 mb-4">Não foi possível encontrar os detalhes desta venda.</p>
        <button 
          onClick={() => navigate('/vendas-atacado')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  const cliente = (venda as any).clientes;
  const vendedor = (venda as any).vendedores;
  const vendedorNome = vendedor?.nome || (Array.isArray(vendedor) ? vendedor[0]?.nome : '') || (venda as any).vendedor_nome;
  const clienteNome = cliente 
    ? (cliente.tipo_pessoa === 'PJ' 
        ? (cliente.responsavel_pj_nome || cliente.nome) 
        : `${cliente.nome} ${cliente.sobrenome || ''}`.trim())
    : 'Cliente não identificado';

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24 print:p-0 print:max-w-none print:pb-0">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button 
          onClick={() => navigate('/vendas-atacado')} 
          className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Voltar
        </button>
        <div className="flex gap-2">
          {venda.status_pagamento !== 'pago' && venda.status_pagamento !== 'cancelado' && (
            <button
              onClick={() => setModalPagamento(true)}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
            >
              <DollarSign size={18} className="mr-2" />
              Formalizar Pagamento
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
          >
            <Printer size={18} className="mr-2" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div ref={componentRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        
        {/* Status Banner */}
        <div className={`px-8 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center print:px-4 print:py-2 ${
          venda.status_pagamento === 'pago' ? 'bg-green-50 dark:bg-green-900/20' : 
          venda.status_pagamento === 'atrasado' ? 'bg-red-50 dark:bg-red-900/20' : 
          venda.status_pagamento === 'cancelado' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'
        }`}>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Pedido</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white print:text-xl">#{venda.numero_pedido || 'N/A'}</h1>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide border print:text-xs print:px-2 print:py-1 ${
            venda.status_pagamento === 'pago' ? 'bg-green-100 text-green-800 border-green-200' : 
            venda.status_pagamento === 'atrasado' ? 'bg-red-100 text-red-800 border-red-200' : 
            venda.status_pagamento === 'cancelado' ? 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-blue-100 text-blue-800 border-blue-200'
          }`}>
            {venda.status_pagamento}
          </div>
        </div>

        <div className="p-8 print:p-4">
          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10 print:gap-6 print:mb-6">
            
            {/* Cliente Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center print:mb-2">
                <User size={16} className="mr-2" /> Cliente
              </h3>
              <div className="space-y-3 print:space-y-1">
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white print:text-base">{clienteNome}</p>
                  {cliente?.tipo_pessoa === 'PJ' && <p className="text-sm text-gray-500">{cliente.nome}</p>}
                </div>
                
                {/* Documento (CPF ou CNPJ) */}
                {(cliente?.cpf || cliente?.cnpj) && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Documento:</span> {cliente.tipo_pessoa === 'PJ' ? cliente.cnpj : cliente.cpf}
                  </p>
                )}
                
                {(cliente?.telefone || cliente?.email) && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {cliente.telefone && <p>{cliente.telefone}</p>}
                    {cliente.email && <p>{cliente.email}</p>}
                  </div>
                )}

                {(cliente as any)?.endereco && (
                  <div className="flex items-start text-sm text-gray-600 dark:text-gray-300 mt-2">
                    <MapPin size={16} className="mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                    <p>
                      {(cliente as any).endereco}, {(cliente as any).Bairro} <br />
                      {(cliente as any).Cidade} - {(cliente as any).Estado}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Venda Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center print:mb-2">
                <FileText size={16} className="mr-2" /> Detalhes
              </h3>
              <div className="grid grid-cols-2 gap-4 print:gap-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:p-2 print:border print:border-gray-200">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Data Venda</span>
                  <span className="font-medium text-gray-900 dark:text-white print:text-sm">
                    {venda.created_at ? format(parseISO(venda.created_at), 'dd/MM/yyyy') : '-'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:p-2 print:border print:border-gray-200">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Data Entrega</span>
                  <span className="font-medium text-gray-900 dark:text-white print:text-sm">
                    {venda.data_entrega ? format(parseISO(venda.data_entrega), 'dd/MM/yyyy') : '-'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:p-2 print:border print:border-gray-200">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Vencimento</span>
                  <span className={`font-medium print:text-sm ${
                    venda.status_pagamento !== 'pago' && venda.data_pagamento && new Date(venda.data_pagamento) < new Date() 
                      ? 'text-red-600' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {venda.data_pagamento ? format(parseISO(venda.data_pagamento), 'dd/MM/yyyy') : '-'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:p-2 print:border print:border-gray-200">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Vendedor</span>
                  <span className="font-medium text-gray-900 dark:text-white print:text-sm">
                    {vendedorNome || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:mt-2 print:p-2 print:border print:border-gray-200">
                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Forma de Pagamento</span>
                <span className="font-medium text-gray-900 dark:text-white print:text-sm">{venda.forma_pagamento}</span>
              </div>
            </div>
          </div>

          {/* Itens Table */}
          <div className="mb-8 print:mb-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 print:mb-2">
              Itens do Pedido
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider print:px-3 print:py-2">Produto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider print:px-3 print:py-2">Qtd</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider print:px-3 print:py-2">Preço Unit.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider print:px-3 print:py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {itensUnificados.map((item: any, index: number) => {
                    // Tentar encontrar o nome do produto no array de cestasInfo se a descrição estiver vazia
                    const nomeProduto = item.descricao || item.produto_nome || cestasInfo.find(c => c.id === item.produto_cadastrado_id)?.nome || 'Produto sem nome';
                    
                    return (
                      <tr key={item.id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium print:px-3 print:py-2 print:text-xs">
                          {nomeProduto}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right print:px-3 print:py-2 print:text-xs">
                          {item.quantidade}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right print:px-3 print:py-2 print:text-xs">
                          {formatCurrency(item.preco_unitario)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right print:px-3 print:py-2 print:text-xs">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                  {itensUnificados.length > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700/30 print:bg-gray-50">
                      <td colSpan={3} className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase print:px-3 print:py-2">
                        Total de Cestas
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400 print:px-3 print:py-2 print:text-xs">
                        {itensUnificados.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0)} un.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-100">
                  {valorPagoAtual > 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-500 dark:text-gray-400 print:px-3 print:py-2 print:text-xs">
                        Valor Pago
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400 print:px-3 print:py-2 print:text-xs">
                        {formatCurrency(valorPagoAtual)}
                      </td>
                    </tr>
                  )}
                  {saldoRestante > 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-500 dark:text-gray-400 print:px-3 print:py-2 print:text-xs">
                        Saldo Restante
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-red-600 dark:text-red-400 print:px-3 print:py-2 print:text-xs">
                        {formatCurrency(saldoRestante)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-500 dark:text-gray-400 print:px-3 print:py-2 print:text-xs">
                      Total Geral
                    </td>
                    <td className="px-6 py-4 text-right text-lg font-bold text-gray-900 dark:text-white print:px-3 print:py-2 print:text-sm">
                      {formatCurrency(venda.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">

            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Registrar Pagamento</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pedido #{venda.numero_pedido}</p>
                </div>
              </div>
              <button onClick={() => { setModalPagamento(false); setValorNovoPagamento(''); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(Number(venda.valor_total))}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Já Pago</p>
                  <p className="font-bold text-green-600 dark:text-green-400 text-sm">{formatCurrency(valorPagoAtual)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Restante</p>
                  <p className="font-bold text-red-600 dark:text-red-400 text-sm">{formatCurrency(saldoRestante)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Valor Recebido *</label>
                <input type="text" autoFocus placeholder="R$ 0,00"
                  className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-semibold bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={valorNovoPagamento}
                  onChange={(e) => setValorNovoPagamento(applyCurrencyMask(e.target.value))} />
              </div>

              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setValorNovoPagamento(applyCurrencyMask(String(Math.round(saldoRestante * 100))))}
                  className="flex-1 py-2 text-xs font-medium border border-green-300 text-green-700 dark:text-green-400 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                  Valor Total Restante
                </button>
                <button type="button"
                  onClick={() => setValorNovoPagamento(applyCurrencyMask(String(Math.round((saldoRestante / 2) * 100))))}
                  className="flex-1 py-2 text-xs font-medium border border-gray-300 text-gray-600 dark:text-gray-400 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Metade
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observação (opcional)</label>
                <input type="text" placeholder="Ex: Cheque nº 1234, PIX recebido..."
                  className="block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={obsNovoPagamento}
                  onChange={(e) => setObsNovoPagamento(e.target.value)} />
              </div>

              {valorNovoPagamento && (() => {
                const v = currencyMaskToNumber(valorNovoPagamento);
                const novoTotal = valorPagoAtual + v;
                const novoStatus = novoTotal >= Number(venda.valor_total) ? 'pago' : novoTotal > 0 ? 'parcial' : 'pendente';
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                    novoStatus === 'pago'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {novoStatus === 'pago' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    Novo status: <strong className="uppercase">{novoStatus}</strong>
                    {novoStatus === 'parcial' && (
                      <span className="ml-auto text-xs">
                        Resta: {formatCurrency(Number(venda.valor_total) - novoTotal)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setModalPagamento(false); setValorNovoPagamento(''); }}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleConfirmarPagamento}
                disabled={registrarPagamento.isPending || !valorNovoPagamento || currencyMaskToNumber(valorNovoPagamento) <= 0}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {registrarPagamento.isPending ? (
                  <span>Salvando...</span>
                ) : (
                  <><CheckCircle2 size={16} /> Confirmar</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default DetalhesVendaAtacado;
