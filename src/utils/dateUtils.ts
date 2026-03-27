/**
 * Utilitários para manipulação de datas com timezone America/Sao_Paulo (Brasília)
 * Usa Intl.DateTimeFormat para garantir que o fuso horário seja sempre correto,
 * independente do timezone da máquina do usuário.
 */

/**
 * Retorna a data no formato YYYY-MM-DD no fuso horário de São Paulo.
 * Usa locale 'sv-SE' pois retorna ISO 8601 (YYYY-MM-DD) nativamente.
 * @param date - Data a ser convertida
 * @returns String no formato YYYY-MM-DD
 */
export const toSaoPauloDateString = (date: Date): string => {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

/**
 * Retorna um range de início e fim do dia em São Paulo com offset fixo.
 * @param dateString - Data no formato YYYY-MM-DD
 * @returns Objeto com início e fim do dia em UTC-3
 */
export const getSaoPauloDateRange = (dateString: string) => {
  return {
    inicio: `${dateString}T00:00:00-03:00`,
    fim: `${dateString}T23:59:59-03:00`
  };
};

/**
 * Converte uma data para o timezone de São Paulo (compatibilidade com código legado).
 * Retorna uma Date que representa o instante correto em SP.
 * @param date - Data a ser convertida
 * @returns Data ajustada para exibição em São Paulo
 */
export const toUTC3 = (date: Date): Date => {
  // Extrair componentes no timezone de São Paulo
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );
};

/**
 * Cria uma data no início do dia em São Paulo
 * @param date - Data base
 * @returns Data no início do dia em São Paulo
 */
export const startOfDayUTC3 = (date: Date): Date => {
  const dateStr = toSaoPauloDateString(date);
  return new Date(`${dateStr}T00:00:00-03:00`);
};

/**
 * Cria uma data no final do dia em São Paulo
 * @param date - Data base
 * @returns Data no final do dia em São Paulo
 */
export const endOfDayUTC3 = (date: Date): Date => {
  const dateStr = toSaoPauloDateString(date);
  return new Date(`${dateStr}T23:59:59.999-03:00`);
};

/**
 * Formata uma data para string no formato YYYY-MM-DD considerando São Paulo
 * @param date - Data a ser formatada
 * @returns String no formato YYYY-MM-DD
 */
export const formatDateForQuery = (date: Date): string => {
  return toSaoPauloDateString(date);
};

/**
 * Cria uma data no início do mês atual em São Paulo
 * @returns Data no início do mês em São Paulo
 */
export const startOfCurrentMonthUTC3 = (): Date => {
  const now = new Date();
  const dateStr = toSaoPauloDateString(now);
  const [year, month] = dateStr.split('-');
  return new Date(`${year}-${month}-01T00:00:00-03:00`);
};

/**
 * Cria uma data no final do mês atual em São Paulo
 * @returns Data no final do mês em São Paulo
 */
export const endOfCurrentMonthUTC3 = (): Date => {
  const now = new Date();
  const dateStr = toSaoPauloDateString(now);
  const [year, month] = dateStr.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return new Date(`${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999-03:00`);
};

/**
 * Subtrai dias de uma data considerando São Paulo
 * @param date - Data base
 * @param days - Número de dias a subtrair
 * @returns Nova data com os dias subtraídos
 */
export const subtractDaysUTC3 = (date: Date, days: number): Date => {
  const result = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  return result;
};

/**
 * Verifica se uma data está dentro de um período
 * @param date - Data a ser verificada
 * @param startDate - Data de início do período
 * @param endDate - Data de fim do período
 * @returns true se a data está dentro do período
 */
export const isDateInRangeUTC3 = (date: Date, startDate: Date, endDate: Date): boolean => {
  return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
};

/**
 * Converte uma string de data para Date
 * @param dateString - String da data (formato ISO ou YYYY-MM-DD)
 * @returns Date object
 */
export const parseToUTC3 = (dateString: string): Date => {
  return new Date(dateString);
};

