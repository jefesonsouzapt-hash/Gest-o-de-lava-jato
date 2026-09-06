import { describe, expect, it } from "vitest"
import {
  formatNif,
  formatPhone,
  formatPlate,
  formatPostalCode,
  isValidMobile,
  isValidNif,
  isValidPhone,
  isValidPlate,
  isValidPostalCode,
  normalizePhone,
  normalizePlate,
  whatsappLink,
} from "@/lib/locale/pt"

describe("NIF", () => {
  it("aceita NIF com dígito de controlo correto", () => {
    // Calculados pelo módulo 11: particulares, empresa e ENI.
    expect(isValidNif("123456789")).toBe(true)
    expect(isValidNif("501442600")).toBe(true)
    expect(isValidNif("980405319")).toBe(true)
  })

  it("aceita NIF escrito com espaços", () => {
    expect(isValidNif("123 456 789")).toBe(true)
  })

  it("recusa dígito de controlo errado", () => {
    expect(isValidNif("123456788")).toBe(false)
    expect(isValidNif("501442601")).toBe(false)
  })

  it("recusa prefixo inexistente", () => {
    // 4 sozinho não é prefixo válido (só 45 é).
    expect(isValidNif("400000000")).toBe(false)
    expect(isValidNif("700000000")).toBe(false)
  })

  it("recusa comprimento diferente de nove dígitos", () => {
    expect(isValidNif("12345678")).toBe(false)
    expect(isValidNif("1234567890")).toBe(false)
    expect(isValidNif("")).toBe(false)
  })

  it("formata em grupos de três", () => {
    expect(formatNif("123456789")).toBe("123 456 789")
  })
})

describe("telemóvel", () => {
  it("normaliza as várias formas de escrever o mesmo número", () => {
    for (const entrada of [
      "912345678",
      "912 345 678",
      "+351912345678",
      "+351 912 345 678",
      "00351912345678",
      "351912345678",
    ]) {
      expect(normalizePhone(entrada)).toBe("+351912345678")
    }
  })

  it("aceita número fixo", () => {
    expect(normalizePhone("212345678")).toBe("+351212345678")
    expect(isValidPhone("212345678")).toBe(true)
  })

  it("distingue telemóvel de fixo", () => {
    expect(isValidMobile("912345678")).toBe(true)
    expect(isValidMobile("962345678")).toBe(true)
    expect(isValidMobile("212345678")).toBe(false)
    // 94 não é gama atribuída a telemóveis.
    expect(isValidMobile("942345678")).toBe(false)
  })

  it("recusa comprimento errado e indicativos estrangeiros", () => {
    expect(normalizePhone("91234567")).toBeNull()
    expect(normalizePhone("9123456789")).toBeNull()
    expect(normalizePhone("+5511988887777")).toBeNull()
    expect(normalizePhone("")).toBeNull()
  })

  it("formata para exibição nacional", () => {
    expect(formatPhone("+351912345678")).toBe("912 345 678")
  })

  it("monta ligação de WhatsApp com indicativo", () => {
    expect(whatsappLink("912345678")).toBe("https://wa.me/351912345678")
    expect(whatsappLink("912345678", "Olá")).toBe("https://wa.me/351912345678?text=Ol%C3%A1")
    expect(whatsappLink("123")).toBeNull()
  })
})

describe("código postal", () => {
  it("aceita sete dígitos começados por distrito válido", () => {
    expect(isValidPostalCode("1000-001")).toBe(true)
    expect(isValidPostalCode("4450123")).toBe(true)
  })

  it("recusa o que não é código postal", () => {
    expect(isValidPostalCode("0100-001")).toBe(false)
    expect(isValidPostalCode("100-001")).toBe(false)
    expect(isValidPostalCode("")).toBe(false)
  })

  it("formata com hífen", () => {
    expect(formatPostalCode("4450123")).toBe("4450-123")
  })
})

describe("matrícula", () => {
  it("aceita os quatro formatos portugueses", () => {
    expect(isValidPlate("AA-00-AA")).toBe(true) // desde 2020
    expect(isValidPlate("00-AA-00")).toBe(true) // 2005-2020
    expect(isValidPlate("00-00-AA")).toBe(true) // 1992-2005
    expect(isValidPlate("AA-00-00")).toBe(true) // até 1992
  })

  it("aceita minúsculas e sem hífenes", () => {
    expect(isValidPlate("aa00aa")).toBe(true)
    expect(normalizePlate("aa-00-aa")).toBe("AA00AA")
  })

  it("recusa formatos que não existem em Portugal", () => {
    // Formato brasileiro Mercosul.
    expect(isValidPlate("ABC1D23")).toBe(false)
    expect(isValidPlate("AAA-000")).toBe(false)
    expect(isValidPlate("A0-00-0A")).toBe(false)
    expect(isValidPlate("AA-AA-AA")).toBe(false)
    expect(isValidPlate("00-00-00")).toBe(false)
    expect(isValidPlate("")).toBe(false)
  })

  it("formata com hífenes", () => {
    expect(formatPlate("aa00aa")).toBe("AA-00-AA")
  })

  it("devolve a entrada intacta quando não dá para formatar", () => {
    expect(formatPlate("XYZ")).toBe("XYZ")
  })
})
