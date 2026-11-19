// Código de barras (EAN-8, UPC-12, EAN-13, GTIN-14): confere o dígito verificador.
// A mesma regra está na Edge Function buscar-produto-ean.
export function gtinValido(codigo: string): boolean {
  const c = codigo.replace(/\D/g, '');
  if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false;
  const d = c.split('').map(Number);
  const verificador = d.pop()!;
  const soma = d.reverse().reduce((t, x, i) => t + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verificador;
}
