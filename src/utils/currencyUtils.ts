/**
 * Utilitários para formatação de moeda brasileira
 */

/**
 * Formata um valor numérico para o formato de moeda brasileira
 * @param value - Valor numérico
 * @returns String formatada como moeda brasileira
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Remove a formatação de moeda e retorna apenas o valor numérico
 * @param value - String com formatação de moeda
 * @returns Valor numérico
 */
export const parseCurrency = (value: string): number => {
  // Remove todos os caracteres que não são dígitos, vírgula ou ponto
  const cleanValue = value.replace(/[^\d,.-]/g, '');
  
  // Substitui vírgula por ponto para conversão
  const normalizedValue = cleanValue.replace(',', '.');
  
  // Converte para número
  const numericValue = parseFloat(normalizedValue);
  
  // Retorna 0 se não for um número válido
  return isNaN(numericValue) ? 0 : numericValue;
};

/**
 * Aplica máscara de moeda brasileira durante a digitação
 * @param value - Valor digitado
 * @returns String formatada para exibição no input
 */
export const applyCurrencyMask = (value: string): string => {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, '');
  
  // Se não há dígitos, retorna string vazia
  if (!digits) return '';
  
  // Converte para centavos (divide por 100)
  const cents = parseInt(digits, 10);
  const reais = cents / 100;
  
  // Formata como moeda brasileira
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reais);
};

/**
 * Converte valor com máscara de moeda para número
 * @param maskedValue - Valor com máscara de moeda
 * @returns Valor numérico
 */
export const currencyMaskToNumber = (maskedValue: string): number => {
  // Remove símbolos de moeda e espaços
  const cleanValue = maskedValue.replace(/[R$\s]/g, '');
  
  // Substitui vírgula por ponto
  const normalizedValue = cleanValue.replace(',', '.');
  
  // Converte para número
  const numericValue = parseFloat(normalizedValue);
  
  return isNaN(numericValue) ? 0 : numericValue;
};
