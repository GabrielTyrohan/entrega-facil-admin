declare module '*/scripts/test-importacao-fiscal-validar.mjs' {
  export function lerEmailDoArquivoTeste(caminhoArquivo?: string): string | null;
  export function kitEhReconhecido(valor: unknown): boolean;
  export function referenciaEhCandidataValida(ref: unknown): boolean;
  export function ehAdministradorReal(userId: unknown): boolean;
  export const REAL_ADMIN_ID: string;
  export function textoPreenchido(valor: unknown): boolean;
  export function numeroFinito(valor: unknown): boolean;
  export function quantidadeInvalidaParaEstoque(valor: unknown): boolean;
}
