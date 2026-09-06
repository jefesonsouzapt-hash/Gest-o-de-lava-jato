// Dinheiro em euros. Todos os valores circulam como **cêntimos inteiros**: um
// preço de 15,00 € é 1500. Vírgula flutuante para dinheiro acumula erro de
// arredondamento a cada soma, e um talão que fecha a 24,999999 € é um talão
// errado.

/** Taxas de IVA em vigor no Continente. */
export const VAT_RATES = {
  normal: 23,
  intermedia: 13,
  reduzida: 6,
  isenta: 0,
} as const

export type VatRateKey = keyof typeof VAT_RATES

/** Taxa aplicada aos serviços de lavagem e detalhe automóvel. */
export const DEFAULT_VAT_RATE = VAT_RATES.normal

// O `Intl` de pt-PT tem duas particularidades que estragam uma coluna de preços:
// põe o símbolo à direita (`15,00 €`) e só agrupa milhares a partir de cinco
// dígitos, por causa do `minimumGroupingDigits: 2` do CLDR — `1234,56` fica sem
// ponto e `12.345,67` fica com, na mesma tabela. Por isso formatamos o número
// com `de-DE`, que usa exatamente a mesma pontuação (vírgula decimal, ponto de
// milhares) e agrupa sempre, e antepomos o símbolo à mão.
const NUMBER_LOCALE = "de-DE"

/**
 * Formata cêntimos como euros no padrão pedido: `€ 15,00`, `€ 1.234,56`.
 */
export function formatCurrency(cents: number): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0
  const numero = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))

  return `${value < 0 ? "−" : ""}€ ${numero}`
}

/** Versão curta para eixos de gráfico: `€ 1,2 mil`. */
export function formatCurrencyCompact(cents: number): string {
  const abs = Math.abs(cents)
  if (abs < 100_000) return formatCurrency(cents)

  const [divisor, sufixo] = abs >= 100_000_000 ? [100_000_000, "M"] : [100_000, "mil"]
  const reduzido = cents / divisor
  const casas = Math.abs(reduzido) % 1 === 0 ? 0 : 1
  const numero = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(reduzido)

  return `€ ${numero} ${sufixo}`
}

/**
 * Converte o que foi escrito no balcão em cêntimos.
 *
 * Aceita `15`, `15,00`, `15.00`, `1.234,56`, `€ 15,00`. Em pt-PT o separador
 * decimal é a vírgula e o de milhares é o ponto, mas um teclado numérico
 * costuma dar ponto — por isso o último separador é que decide.
 */
export function parseCurrencyToCents(input: string): number {
  const raw = String(input ?? "").trim()
  if (!raw) return 0

  let limpo = raw.replace(/[^\d.,-]/g, "")
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

  // Arredonda ao cêntimo uma única vez.
  const cents = Math.round(n * 100)
  return negativo ? -cents : cents
}

/** Preenche um campo de formulário a partir de cêntimos: 1500 → `15,00`. */
export function centsToInput(cents: number): string {
  return (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2).replace(".", ",")
}

/**
 * Decompõe um preço **com IVA incluído** — que é como o preço é anunciado ao
 * cliente — nas suas partes. O IVA é a diferença entre o bruto e a base, e não
 * um arredondamento próprio: assim base + IVA dá sempre exatamente o bruto.
 */
export function extractVat(grossCents: number, ratePercent: number = DEFAULT_VAT_RATE) {
  const net = Math.round(grossCents / (1 + ratePercent / 100))
  return { net, vat: grossCents - net, gross: grossCents, ratePercent }
}

/** Acrescenta IVA a uma base tributável. */
export function applyVat(netCents: number, ratePercent: number = DEFAULT_VAT_RATE) {
  const vat = Math.round(netCents * (ratePercent / 100))
  return { net: netCents, vat, gross: netCents + vat, ratePercent }
}

/**
 * Desconto em percentagem sobre um valor, arredondado ao cêntimo.
 * A percentagem é limitada a 0–100: um desconto de 150 % transformaria uma
 * venda em saída de caixa.
 */
export function discountCents(cents: number, percent: number): number {
  const p = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100)
  return Math.round(cents * (p / 100))
}
