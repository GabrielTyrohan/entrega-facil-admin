/**
 * Calcula o período de cobrança (início e fim) baseado no dia_fechamento do vendedor.
 * O período vai de diaFechamento do mês anterior até diaFechamento do mês atual (exclusive).
 *
 * Exemplo: hoje = 2026-04-28, diaFechamento = 10
 * → periodoInicio = "2026-04-10"
 * → periodoFim    = "2026-05-10"
 */
export function calcularPeriodoVendedor(diaFechamento: number): {
  periodoInicio: string
  periodoFim: string
} {
  const hoje = new Date()
  const diaHoje = hoje.getDate()
  const mes = hoje.getMonth()    // 0-based
  const ano = hoje.getFullYear()

  let inicioMes: number
  let inicioAno: number
  let fimMes: number
  let fimAno: number

  if (diaHoje >= diaFechamento) {
    // Estamos depois do fechamento → período: diaFechamento/mês atual até diaFechamento/próximo mês
    inicioMes = mes
    inicioAno = ano
    fimMes = mes + 1
    fimAno = ano
    if (fimMes > 11) {
      fimMes = 0
      fimAno = ano + 1
    }
  } else {
    // Estamos antes do fechamento → período: diaFechamento/mês anterior até diaFechamento/mês atual
    inicioMes = mes - 1
    inicioAno = ano
    if (inicioMes < 0) {
      inicioMes = 11
      inicioAno = ano - 1
    }
    fimMes = mes
    fimAno = ano
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const periodoInicio = `${inicioAno}-${pad(inicioMes + 1)}-${pad(diaFechamento)}`
  const periodoFim    = `${fimAno}-${pad(fimMes + 1)}-${pad(diaFechamento)}`

  return { periodoInicio, periodoFim }
}
