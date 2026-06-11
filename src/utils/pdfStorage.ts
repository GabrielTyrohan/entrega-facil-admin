import { supabase } from '../lib/supabase';

export interface SalvarPdfOpts {
  adminId: string;
  vendedorId?: string;
  vendedorNome: string;
  tipo: 'cesta' | 'avulsa';
  numeroPedido: string;
  filename: string;
}

export async function salvarESalvarPdf(blob: Blob, opts: SalvarPdfOpts): Promise<void> {
  const data = new Date().toISOString().slice(0, 10);
  const nomeSeguro = opts.vendedorNome.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  const path = `${opts.adminId}/${opts.tipo}/${data}_${opts.numeroPedido}_${nomeSeguro}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('notas-pdf')
    .upload(path, blob, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    console.error('Erro ao salvar PDF no Storage:', uploadError.message);
  } else {
    await supabase.from('notas_pdf').insert({
      admin_id:      opts.adminId,
      vendedor_id:   opts.vendedorId ?? null,
      vendedor_nome: opts.vendedorNome,
      tipo:          opts.tipo,
      numero_pedido: opts.numeroPedido,
      storage_path:  path,
    });
  }

  // Mantém o download local igual ao comportamento original
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(url);
}
