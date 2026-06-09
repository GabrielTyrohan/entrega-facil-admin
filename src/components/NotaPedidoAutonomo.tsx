import React from 'react';


export interface NotaPedidoProps {
  numeroPedido: string;
  dataEmissao: string;
  dataEntrega: string;
  dataVencimento: string;
  vendedor: {
    codigo: string;
    nome: string;
    cpfCnpj: string;
    telefone?: string;
    endereco: string;
  };
  vendedorInterno: string;
  empresa: {
    nome: string;
    telefone: string;
    cnpj?: string;
    aviso: string;
  };
  itens: Array<{
    codigo: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  quantidadeTotal: number;
  valorTotalPedido: number;
}

const NotaPedidoAutonomo: React.FC<NotaPedidoProps> = ({
  numeroPedido,
  dataEmissao,
  dataEntrega,
  dataVencimento,
  vendedor,
  vendedorInterno,
  empresa,
  itens,
  quantidadeTotal,
  valorTotalPedido,
}) => {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #nota-pedido, #nota-pedido * { visibility: visible !important; }
          #nota-pedido {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10px;
          }
        }
      `}</style>

      <div id="nota-pedido" className="bg-white text-black text-xs">
        {/* Cabeçalho */}
        <div className="border border-gray-400 rounded-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-400">
            <div className="font-bold text-sm">{empresa.nome}</div>
            <div className="text-center">
              <div className="text-base font-bold tracking-wide">PEDIDO</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-500">Nº</span>{' '}
              <span className="font-bold text-sm">
                {numeroPedido === '######' ? 'PRÉVIA' : numeroPedido}
              </span>
            </div>
          </div>

          {/* Vendedor + Data */}
          <div className="flex justify-between px-3 py-1.5 border-b border-gray-400 text-[11px]">
            <div>
              <span className="font-semibold">VENDEDOR(A):</span>{' '}
              {vendedorInterno}
            </div>
            <div>
              <span className="font-semibold">DATA DO PEDIDO:</span> {dataEmissao}
            </div>
          </div>

          {/* Dados do Cliente (Vendedor Autônomo) */}
          <div className="px-3 py-2 border-b border-gray-400 space-y-1">
            <div>
              <span className="font-semibold">CLIENTE:</span> {vendedor.nome}
            </div>
            <div className="flex gap-6">
              <div>
                <span className="font-semibold">CPF/CNPJ:</span> {vendedor.cpfCnpj || '—'}
              </div>
              <div>
                <span className="font-semibold">TELEFONE:</span> {vendedor.telefone || '—'}
              </div>
            </div>
            <div>
              <span className="font-semibold">ENDEREÇO:</span> {vendedor.endereco || '—'}
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="border-b border-gray-400">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-1.5 text-left font-semibold border-r border-gray-400 w-20">Código</th>
                  <th className="px-3 py-1.5 text-left font-semibold border-r border-gray-400">Descrição</th>
                  <th className="px-3 py-1.5 text-center font-semibold border-r border-gray-400 w-12">UN</th>
                  <th className="px-3 py-1.5 text-center font-semibold border-r border-gray-400 w-16">Quant.</th>
                  <th className="px-3 py-1.5 text-right font-semibold border-r border-gray-400 w-24">VLR UNIT</th>
                  <th className="px-3 py-1.5 text-right font-semibold w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 border-r border-gray-400 font-mono w-20">{item.codigo}</td>
                    <td className="px-3 py-1.5 border-r border-gray-400">{item.descricao}</td>
                    <td className="px-3 py-1.5 text-center border-r border-gray-400">{item.unidade}</td>
                    <td className="px-3 py-1.5 text-center border-r border-gray-400">{item.quantidade}</td>
                    <td className="px-3 py-1.5 text-right border-r border-gray-400">{formatCurrency(item.valorUnitario)}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(item.valorTotal)}</td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400">Nenhum item</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da tabela */}
          <div className="flex border-b border-gray-400">
            <div className="flex-1 px-3 py-2 border-r border-gray-400 flex items-center">
              <span className="text-[10px] font-semibold text-red-600 uppercase">
                Só aceitamos reclamações no ato da entrega
              </span>
            </div>
            <div className="px-3 py-2 border-r border-gray-400 text-center">
              <div className="text-[10px] font-semibold">QUANTIDADE</div>
              <div className="text-sm font-bold">{quantidadeTotal}</div>
            </div>
            <div className="px-3 py-2 text-right">
              <div className="text-[10px] font-semibold">VALOR TOTAL DO PEDIDO</div>
              <div className="text-sm font-bold">{formatCurrency(valorTotalPedido)}</div>
            </div>
          </div>

          {/* Vencimentos */}
          <div className="flex px-3 py-1.5 border-b border-gray-400 text-[11px]">
            <div className="flex-1">
              <span className="font-semibold">VENCIMENTO:</span> {dataVencimento}
            </div>
            <div className="font-semibold">{formatCurrency(valorTotalPedido)}</div>
          </div>

          {/* Assinatura + Data Entrega */}
          <div className="px-3 py-4 border-b border-gray-400">
            <div className="flex justify-between items-end">
              <div className="flex-1 mr-8">
                <div className="border-b border-gray-400 mb-1 pb-6"></div>
                <div className="text-[10px] font-semibold">ASSINATURA DO CLIENTE</div>
              </div>
              <div className="w-40">
                <div className="border-b border-gray-400 mb-1 pb-6"></div>
                <div className="text-[10px] font-semibold">DATA DA ENTREGA: {dataEntrega}</div>
              </div>
            </div>
          </div>

          {/* Aviso de Pagamento */}
          <div className="px-3 py-2 bg-gray-50">
            <p className="text-[10px] font-bold text-center leading-relaxed">
              ATENÇÃO: {empresa.aviso}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotaPedidoAutonomo;
