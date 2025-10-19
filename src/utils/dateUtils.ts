/**
 * Utilitários para manipulação de datas com timezone UTC-3 (Brasília)
 */

/**
 * Converte uma data para o timezone UTC-3 (Brasília)
 * @param date - Data a ser convertida
 * @returns Data ajustada para UTC-3
 */
export const toUTC3 = (date: Date): Date => {
  const utc3Offset = -3 * 60; // UTC-3 em minutos
  const localOffset = date.getTimezoneOffset(); // Offset local em minutos
  const offsetDiff = localOffset - utc3Offset;
  
  return new Date(date.getTime() + (offsetDiff * 60 * 1000));
};

/**
 * Cria uma data no início do dia em UTC-3
 * @param date - Data base
 * @returns Data no início do dia em UTC-3
 */
export const startOfDayUTC3 = (date: Date): Date => {
  const utc3Date = toUTC3(date);
  utc3Date.setHours(0, 0, 0, 0);
  return utc3Date;
};

/**
 * Cria uma data no final do dia em UTC-3
 * @param date - Data base
 * @returns Data no final do dia em UTC-3
 */
export const endOfDayUTC3 = (date: Date): Date => {
  const utc3Date = toUTC3(date);
  utc3Date.setHours(23, 59, 59, 999);
  return utc3Date;
};

/**
 * Formata uma data para string no formato YYYY-MM-DD considerando UTC-3
 * @param date - Data a ser formatada
 * @returns String no formato YYYY-MM-DD
 */
export const formatDateForQuery = (date: Date): string => {
  const utc3Date = toUTC3(date);
  return utc3Date.toISOString().split('T')[0];
};

/**
 * Cria uma data no início do mês atual em UTC-3
 * @returns Data no início do mês em UTC-3
 */
export const startOfCurrentMonthUTC3 = (): Date => {
  const now = new Date();
  const utc3Now = toUTC3(now);
  return new Date(utc3Now.getFullYear(), utc3Now.getMonth(), 1);
};

/**
 * Cria uma data no final do mês atual em UTC-3
 * @returns Data no final do mês em UTC-3
 */
export const endOfCurrentMonthUTC3 = (): Date => {
  const now = new Date();
  const utc3Now = toUTC3(now);
  return new Date(utc3Now.getFullYear(), utc3Now.getMonth() + 1, 0, 23, 59, 59, 999);
};

/**
 * Subtrai dias de uma data considerando UTC-3
 * @param date - Data base
 * @param days - Número de dias a subtrair
 * @returns Nova data com os dias subtraídos
 */
export const subtractDaysUTC3 = (date: Date, days: number): Date => {
  const utc3Date = toUTC3(date);
  utc3Date.setDate(utc3Date.getDate() - days);
  return utc3Date;
};

/**
 * Verifica se uma data está dentro de um período considerando UTC-3
 * @param date - Data a ser verificada
 * @param startDate - Data de início do período
 * @param endDate - Data de fim do período
 * @returns true se a data está dentro do período
 */
export const isDateInRangeUTC3 = (date: Date, startDate: Date, endDate: Date): boolean => {
  const utc3Date = toUTC3(date);
  const utc3Start = toUTC3(startDate);
  const utc3End = toUTC3(endDate);
  
  return utc3Date >= utc3Start && utc3Date <= utc3End;
};

/**
 * Converte uma string de data para Date considerando UTC-3
 * @param dateString - String da data (formato ISO ou YYYY-MM-DD)
 * @returns Data convertida considerando UTC-3
 */
export const parseToUTC3 = (dateString: string): Date => {
  const date = new Date(dateString);
  return toUTC3(date);
};
