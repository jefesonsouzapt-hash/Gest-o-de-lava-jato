import { describe, expect, it } from "vitest"
import {
  bpsToPercentInput,
  centsToInput,
  DEFAULT_ISS_RATE,
  formatBps,
  formatCurrency,
  formatCurrencyCompact,
  fromBps,
  issFromRevenue,
  parseCurrencyToCents,
  percentInputToBps,
  percentOf,
} from "@/lib/locale/money"

describe("formatCurrency", () => {
  it("usa o padrão brasileiro", () => {
    expect(formatCurrency(1500)).toBe("R$ 15,00")
    expect(formatCurrency(0)).toBe("R$ 0,00")
    expect(formatCurrency(5)).toBe("R$ 0,05")
  })

  it("agrupa milhar com ponto", () => {
    expect(formatCurrency(123456)).toBe("R$ 1.234,56")
    expect(formatCurrency(1234567)).toBe("R$ 12.345,67")
  })

  it("usa espaço normal, não o espaço não separável do Intl", () => {
    // O Intl separa "R$" do número com U+00A0. Deixar passar quebra comparação
    // de texto e a busca na interface.
    expect(formatCurrency(1500)).not.toContain(" ")
    expect(formatCurrency(1500).charCodeAt(2)).toBe(32)
  })

  it("marca valores negativos", () => {
    // Desconto e estorno aparecem negativos no extrato do funcionário.
    expect(formatCurrency(-1500)).toContain("15,00")
    expect(formatCurrency(-1500)).toMatch(/^-/)
  })
})

describe("formatCurrencyCompact", () => {
  it("mantém o valor inteiro abaixo de mil reais", () => {
    expect(formatCurrencyCompact(99900)).toBe("R$ 999,00")
  })

  it("abrevia milhares sem casa decimal inútil", () => {
    expect(formatCurrencyCompact(500_000)).toBe("R$ 5 mil")
    expect(formatCurrencyCompact(550_000)).toBe("R$ 5,5 mil")
  })

  it("abrevia milhões", () => {
    expect(formatCurrencyCompact(200_000_000)).toBe("R$ 2 mi")
  })
})

describe("parseCurrencyToCents", () => {
  it("lê o que se digita no balcão", () => {
    expect(parseCurrencyToCents("15")).toBe(1500)
    expect(parseCurrencyToCents("15,00")).toBe(1500)
    expect(parseCurrencyToCents("15.00")).toBe(1500)
    expect(parseCurrencyToCents("R$ 15,00")).toBe(1500)
    expect(parseCurrencyToCents("15,5")).toBe(1550)
  })

  it("distingue separador decimal de separador de milhar", () => {
    expect(parseCurrencyToCents("1.234,56")).toBe(123456)
    expect(parseCurrencyToCents("1,234.56")).toBe(123456)
  })

  it("arredonda ao centavo", () => {
    expect(parseCurrencyToCents("15,005")).toBe(1501)
    expect(parseCurrencyToCents("15,004")).toBe(1500)
  })

  it("devolve zero para entrada vazia ou inválida", () => {
    expect(parseCurrencyToCents("")).toBe(0)
    expect(parseCurrencyToCents("abc")).toBe(0)
  })

  it("faz ida e volta com centsToInput", () => {
    for (const centavos of [0, 5, 1500, 123456, 999999]) {
      expect(parseCurrencyToCents(centsToInput(centavos))).toBe(centavos)
    }
  })
})

describe("ISS", () => {
  it("calcula o imposto embutido no faturamento", () => {
    // R$ 1.000,00 a 5 % = R$ 50,00
    expect(issFromRevenue(100_000, 5)).toBe(5_000)
    expect(issFromRevenue(100_000, 2)).toBe(2_000)
  })

  it("usa 5 % por padrão, o teto do lava jato", () => {
    expect(DEFAULT_ISS_RATE).toBe(5)
    expect(issFromRevenue(100_000)).toBe(5_000)
  })

  it("arredonda ao centavo", () => {
    expect(issFromRevenue(1999, 5)).toBe(100)
  })
})

describe("percentual", () => {
  it("calcula sobre o valor", () => {
    expect(percentOf(2500, 10)).toBe(250)
    expect(percentOf(2500, 50)).toBe(1250)
  })

  it("limita a 0-100", () => {
    // Um desconto de 150 % transformaria uma venda em saída de caixa.
    expect(percentOf(2500, 150)).toBe(2500)
    expect(percentOf(2500, -10)).toBe(0)
  })
})

describe("pontos-base", () => {
  it("guarda meio ponto percentual sem perder precisão", () => {
    // 12,5 % de comissão é comum e não cabe num inteiro de percentagem.
    expect(percentInputToBps("12,5")).toBe(1250)
    expect(percentInputToBps("30")).toBe(3000)
    expect(percentInputToBps("0")).toBe(0)
  })

  it("limita a 100 %", () => {
    expect(percentInputToBps("150")).toBe(10_000)
    expect(percentInputToBps("-5")).toBe(0)
  })

  it("aplica a comissão sobre um valor", () => {
    // R$ 250,00 a 12,5 % = R$ 31,25
    expect(fromBps(25_000, 1250)).toBe(3_125)
    expect(fromBps(25_000, 3000)).toBe(7_500)
  })

  it("faz ida e volta com o campo do formulário", () => {
    for (const bps of [0, 500, 1250, 3000, 10_000]) {
      expect(percentInputToBps(bpsToPercentInput(bps))).toBe(bps)
    }
  })

  it("exibe sem casas decimais inúteis", () => {
    expect(formatBps(3000)).toBe("30%")
    expect(formatBps(1250)).toBe("12,5%")
  })
})
