// Dinheiro em reais. Todos os valores circulam como **centavos inteiros**: um
// preço de R$ 15,00 é 1500. Ponto flutuante para dinheiro acumula erro de
// arredondamento a cada soma, e um caixa que fecha em 24,999999 está errado.

/**
 * ISS — imposto municipal sobre serviços. A alíquota varia por município,
 * entre 2 % e 5 % por limite constitucional. Lava jato costuma cair em 5 %.
 *
 * Não é imposto embutido separado na nota: aqui serve para o dono
 * saber quanto do faturamento é imposto, não para compor o preço.
 */
export const ISS_MIN_RATE = 2
export const ISS_MAX_RATE = 5
export const DEFAULT_ISS_RATE = 5

/**
 * Formata centavos como reais: `R$ 15,00`, `R$ 1.234,56`.
 *
 * O `Intl` de pt-BR já entrega o formato certo — símbolo à esquerda, vírgula
 * decimal, ponto de milhar a partir de quatro dígitos. Só normalizamos o
 * espaço: o `Intl` usa espaço não separável (U+00A0) entre `R$` e o número, o
 * que quebra comparações de texto e buscas na interface.
 */
export function formatCurrency(cents: number): string {
  const valor = Number.isFinite(cents) ? cents / 100 : 0
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(valor)
    .replace(/ /g, " ")
}

/** Versão curta para eixos de gráfico: `R$ 1,2 mil`, `R$ 2 mi`. */
export function formatCurrencyCompact(cents: number): string {
  const abs = Math.abs(cents)
  if (abs < 100_000) return formatCurrency(cents)

  const [divisor, sufixo] = abs >= 100_000_000 ? [100_000_000, "mi"] : [100_000, "mil"]
  const reduzido = cents / divisor
  // Sem casa decimal quando ela não acrescenta nada: "R$ 5 mil", não "R$ 5,0 mil".
  const casas = Math.abs(reduzido) % 1 === 0 ? 0 : 1
  const numero = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Math.abs(reduzido))

  return `${reduzido < 0 ? "-" : ""}R$ ${numero} ${sufixo}`
}

/**
 * Converte o que foi digitado no balcão em centavos.
 *
 * Aceita `15`, `15,00`, `15.00`, `1.234,56`, `R$ 15,00`. No Brasil o separador
 * decimal é a vírgula e o de milhar é o ponto, mas teclado numérico costuma dar
 * ponto — por isso é o último separador que decide.
 */
export function parseCurrencyToCents(input: string): number {
  const bruto = String(input ?? "").trim()
  if (!bruto) return 0

  let limpo = bruto.replace(/[^\d.,-]/g, "")
  const negativo = limpo.startsWith("-")
  limpo = limpo.replace(/-/g, "")

  const ultimaVirgula = limpo.lastIndexOf(",")
  const ultimoPonto = limpo.lastIndexOf(".")

  if (ultimaVirgula > -1 && ultimaVirgula > ultimoPonto) {
    limpo = limpo.replace(/\./g, "").replace(",", ".")
  } else if (ultimaVirgula > -1) {
    limpo = limpo.replace(/,/g, "")
  }

  const n = Number.parseFloat(limpo)
  if (!Number.isFinite(n)) return 0

  // Arredonda ao centavo uma única vez.
  const centavos = Math.round(n * 100)
  return negativo ? -centavos : centavos
}

/** Preenche um campo de formulário a partir de centavos: 1500 → `15,00`. */
export function centsToInput(cents: number): string {
  return (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2).replace(".", ",")
}

/** ISS embutido em um faturamento, para o relatório do dono. */
export function issFromRevenue(revenueCents: number, ratePercent: number = DEFAULT_ISS_RATE): number {
  const taxa = Math.min(Math.max(Number.isFinite(ratePercent) ? ratePercent : 0, 0), 100)
  return Math.round(revenueCents * (taxa / 100))
}

/**
 * Percentual sobre um valor, arredondado ao centavo. Serve para desconto e
 * para comissão.
 *
 * O percentual é limitado a 0–100: um desconto de 150 % transformaria uma
 * venda em saída de caixa.
 */
export function percentOf(cents: number, percent: number): number {
  const p = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100)
  return Math.round(cents * (p / 100))
}

/**
 * Percentual guardado em **pontos-base** (1250 = 12,50 %), para não perder
 * precisão em meio ponto percentual de comissão.
 */
export function fromBps(cents: number, bps: number): number {
  const b = Math.min(Math.max(Number.isFinite(bps) ? bps : 0, 0), 10_000)
  return Math.round((cents * b) / 10_000)
}

/** `12,5` (texto do formulário) → `1250` pontos-base. */
export function percentInputToBps(input: string): number {
  const centavos = parseCurrencyToCents(input)
  return Math.min(Math.max(centavos, 0), 10_000)
}

/** `1250` → `12,50` para preencher o formulário. */
export function bpsToPercentInput(bps: number): string {
  return centsToInput(Number.isFinite(bps) ? bps : 0)
}

/** `1250` → `12,5%` para exibição. */
export function formatBps(bps: number): string {
  const valor = (Number.isFinite(bps) ? bps : 0) / 100
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor)}%`
}
