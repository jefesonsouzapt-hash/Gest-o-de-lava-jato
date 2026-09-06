import { describe, expect, it } from "vitest"
import {
  applyVat,
  centsToInput,
  discountCents,
  extractVat,
  formatCurrency,
  formatCurrencyCompact,
  parseCurrencyToCents,
  VAT_RATES,
} from "@/lib/locale/money"

describe("formatCurrency", () => {
  it("põe o símbolo à esquerda com duas casas", () => {
    expect(formatCurrency(1500)).toBe("€ 15,00")
    expect(formatCurrency(0)).toBe("€ 0,00")
    expect(formatCurrency(5)).toBe("€ 0,05")
  })

  it("agrupa milhares com ponto, como em pt-PT", () => {
    // O Intl usa espaço estreito nalguns motores; normalizamos para comparar.
    expect(formatCurrency(123456).replace(/ | /g, " ")).toMatch(/^€ 1[. ]234,56$/)
  })

  it("marca valores negativos", () => {
    expect(formatCurrency(-1500)).toBe("−€ 15,00")
  })
})

describe("formatCurrencyCompact", () => {
  it("mantém o valor inteiro abaixo de mil euros", () => {
    expect(formatCurrencyCompact(99900)).toBe("€ 999,00")
  })

  it("abrevia milhares sem casa decimal inútil", () => {
    expect(formatCurrencyCompact(500_000)).toBe("€ 5 mil")
    expect(formatCurrencyCompact(550_000)).toBe("€ 5,5 mil")
  })

  it("abrevia milhões", () => {
    expect(formatCurrencyCompact(200_000_000)).toBe("€ 2 M")
  })
})

describe("parseCurrencyToCents", () => {
  it("lê o que se escreve no balcão", () => {
    expect(parseCurrencyToCents("15")).toBe(1500)
    expect(parseCurrencyToCents("15,00")).toBe(1500)
    expect(parseCurrencyToCents("15.00")).toBe(1500)
    expect(parseCurrencyToCents("€ 15,00")).toBe(1500)
    expect(parseCurrencyToCents("15,5")).toBe(1550)
  })

  it("distingue separador decimal de separador de milhares", () => {
    expect(parseCurrencyToCents("1.234,56")).toBe(123456)
    expect(parseCurrencyToCents("1,234.56")).toBe(123456)
  })

  it("arredonda ao cêntimo", () => {
    expect(parseCurrencyToCents("15,005")).toBe(1501)
    expect(parseCurrencyToCents("15,004")).toBe(1500)
  })

  it("devolve zero para entrada vazia ou inválida", () => {
    expect(parseCurrencyToCents("")).toBe(0)
    expect(parseCurrencyToCents("abc")).toBe(0)
  })

  it("faz ida e volta com centsToInput", () => {
    for (const cents of [0, 5, 1500, 123456, 999999]) {
      expect(parseCurrencyToCents(centsToInput(cents))).toBe(cents)
    }
  })
})

describe("IVA", () => {
  it("decompõe um preço com IVA incluído", () => {
    // 25,00 € a 23 % → base 20,33 € + IVA 4,67 €
    const r = extractVat(2500, VAT_RATES.normal)
    expect(r.net).toBe(2033)
    expect(r.vat).toBe(467)
    expect(r.gross).toBe(2500)
  })

  it("garante que base + IVA fecha exatamente no bruto", () => {
    // Sem esta propriedade, um talão fecha com um cêntimo a mais ou a menos.
    for (let gross = 1; gross <= 3000; gross++) {
      const r = extractVat(gross, VAT_RATES.normal)
      expect(r.net + r.vat).toBe(gross)
    }
  })

  it("acrescenta IVA a uma base tributável", () => {
    const r = applyVat(2033, VAT_RATES.normal)
    expect(r.vat).toBe(468)
    expect(r.gross).toBe(2501)
  })

  it("trata a taxa isenta como neutra", () => {
    const r = extractVat(2500, VAT_RATES.isenta)
    expect(r.net).toBe(2500)
    expect(r.vat).toBe(0)
  })
})

describe("desconto", () => {
  it("calcula a percentagem sobre o valor", () => {
    expect(discountCents(2500, 10)).toBe(250)
    expect(discountCents(2500, 50)).toBe(1250)
  })

  it("limita a percentagem a 0-100", () => {
    // Um desconto de 150 % transformaria uma venda em saída de caixa.
    expect(discountCents(2500, 150)).toBe(2500)
    expect(discountCents(2500, -10)).toBe(0)
  })

  it("arredonda ao cêntimo", () => {
    expect(discountCents(1999, 33)).toBe(660)
  })
})
