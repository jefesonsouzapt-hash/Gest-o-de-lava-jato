import { describe, expect, it } from "vitest"
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatDocument,
  formatPhone,
  formatPixKey,
  formatPlate,
  isMercosulPlate,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  isValidMobile,
  isValidPhone,
  isValidPixKey,
  isValidPlate,
  normalizePhone,
  normalizePlate,
  pixKeyKind,
  whatsappLink,
} from "@/lib/locale/br"

describe("CPF", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("52998224725")).toBe(true)
    expect(isValidCpf("111.444.777-35")).toBe(true)
  })

  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false)
    expect(isValidCpf("111.444.777-36")).toBe(false)
  })

  it("recusa sequências repetidas", () => {
    // Passam na conta dos dígitos, mas não são CPFs. É o erro clássico de quem
    // implementa só a fórmula e deixa entrar cadastro de teste como real.
    for (let d = 0; d <= 9; d++) {
      expect(isValidCpf(String(d).repeat(11))).toBe(false)
    }
  })

  it("recusa comprimento errado", () => {
    expect(isValidCpf("5299822472")).toBe(false)
    expect(isValidCpf("529982247251")).toBe(false)
    expect(isValidCpf("")).toBe(false)
  })

  it("formata com pontos e traço", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25")
  })
})

describe("CNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true)
    expect(isValidCnpj("11222333000181")).toBe(true)
  })

  it("recusa dígito verificador errado e sequências", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false)
    expect(isValidCnpj("11111111111111")).toBe(false)
    expect(isValidCnpj("")).toBe(false)
  })

  it("formata no padrão da Receita", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81")
  })
})

describe("documento do cliente", () => {
  it("aceita pessoa física e frota de empresa", () => {
    expect(isValidDocument("529.982.247-25")).toBe(true)
    expect(isValidDocument("11.222.333/0001-81")).toBe(true)
  })

  it("recusa o que não é nem um nem outro", () => {
    expect(isValidDocument("123")).toBe(false)
    expect(isValidDocument("123456789012")).toBe(false)
  })

  it("formata conforme o tipo", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25")
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81")
  })
})

describe("telefone", () => {
  it("normaliza as várias formas de escrever o mesmo celular", () => {
    for (const entrada of [
      "11988887777",
      "(11) 98888-7777",
      "+55 11 98888-7777",
      "005511988887777",
      "5511988887777",
    ]) {
      expect(normalizePhone(entrada)).toBe("+5511988887777")
    }
  })

  it("aceita telefone fixo de oito dígitos", () => {
    expect(normalizePhone("(11) 3888-7777")).toBe("+551138887777")
    expect(isValidPhone("1138887777")).toBe(true)
    expect(isValidMobile("1138887777")).toBe(false)
  })

  it("exige o nono dígito no celular", () => {
    // Onze dígitos onde o terceiro não é 9 não é celular nem fixo.
    expect(normalizePhone("11888887777")).toBeNull()
    expect(isValidMobile("11988887777")).toBe(true)
  })

  it("recusa DDD que não existe no Brasil", () => {
    // A lista de DDDs é fechada. Aceitar qualquer par 11-99 deixa passar erro
    // de digitação — um "52" no lugar de "51" vira um telefone que nunca toca,
    // e o cliente não recebe o aviso de que o carro ficou pronto.
    for (const ddd of ["01", "10", "20", "23", "26", "29", "52", "60", "70", "90"]) {
      expect(normalizePhone(`${ddd}988887777`)).toBeNull()
    }
  })

  it("aceita os DDDs reais de cada região", () => {
    for (const ddd of ["11", "21", "31", "41", "51", "61", "71", "81", "85", "91", "98"]) {
      expect(normalizePhone(`${ddd}988887777`)).toBe(`+55${ddd}988887777`)
    }
  })

  it("recusa número estrangeiro", () => {
    // Número português, que era o formato do sistema anterior.
    expect(normalizePhone("+351912345678")).toBeNull()
    expect(normalizePhone("")).toBeNull()
  })

  it("formata para exibição", () => {
    expect(formatPhone("+5511988887777")).toBe("(11) 98888-7777")
    expect(formatPhone("+551138887777")).toBe("(11) 3888-7777")
  })

  it("monta link de WhatsApp com o DDI", () => {
    expect(whatsappLink("11988887777")).toBe("https://wa.me/5511988887777")
    expect(whatsappLink("11988887777", "Olá")).toBe("https://wa.me/5511988887777?text=Ol%C3%A1")
    expect(whatsappLink("123")).toBeNull()
  })
})

describe("CEP", () => {
  it("aceita oito dígitos", () => {
    expect(isValidCep("01310-100")).toBe(true)
    expect(isValidCep("01310100")).toBe(true)
  })

  it("recusa comprimento errado", () => {
    expect(isValidCep("0131010")).toBe(false)
    expect(isValidCep("")).toBe(false)
  })

  it("formata com traço", () => {
    expect(formatCep("01310100")).toBe("01310-100")
  })
})

describe("placa", () => {
  it("aceita o padrão antigo e o Mercosul", () => {
    expect(isValidPlate("ABC-1234")).toBe(true)
    expect(isValidPlate("ABC1D23")).toBe(true)
    expect(isValidPlate("abc1d23")).toBe(true)
  })

  it("distingue Mercosul do padrão antigo", () => {
    expect(isMercosulPlate("ABC1D23")).toBe(true)
    expect(isMercosulPlate("ABC1234")).toBe(false)
  })

  it("recusa formatos que não existem no Brasil", () => {
    // Formato português, que era o do sistema anterior.
    expect(isValidPlate("AA-00-AA")).toBe(false)
    expect(isValidPlate("00-AA-00")).toBe(false)
    expect(isValidPlate("AB1234")).toBe(false)
    expect(isValidPlate("ABCD123")).toBe(false)
    expect(isValidPlate("")).toBe(false)
  })

  it("guarda sem hífen e em maiúsculas", () => {
    expect(normalizePlate("abc-1d23")).toBe("ABC1D23")
  })

  it("formata com hífen", () => {
    expect(formatPlate("abc1d23")).toBe("ABC-1D23")
    expect(formatPlate("XYZ")).toBe("XYZ")
  })
})

describe("chave PIX", () => {
  it("descobre o tipo pelo conteúdo, como o banco faz", () => {
    expect(pixKeyKind("529.982.247-25")).toBe("cpf")
    expect(pixKeyKind("11.222.333/0001-81")).toBe("cnpj")
    expect(pixKeyKind("rafael@exemplo.com.br")).toBe("email")
    expect(pixKeyKind("+55 11 98888-7777")).toBe("telefone")
    expect(pixKeyKind("123e4567-e89b-12d3-a456-426614174000")).toBe("aleatoria")
  })

  it("recusa chave que não é reconhecível", () => {
    // Melhor recusar no cadastro do que descobrir na hora de pagar o salário.
    expect(pixKeyKind("qualquer coisa")).toBeNull()
    expect(pixKeyKind("arroba-sem-dominio@")).toBeNull()
    // CPF com dígito errado não vira chave só por ter onze dígitos.
    expect(pixKeyKind("52998224726")).toBeNull()
    expect(isValidPixKey("")).toBe(false)
  })

  it("exibe a chave no formato do seu tipo", () => {
    expect(formatPixKey("52998224725")).toBe("529.982.247-25")
    expect(formatPixKey("11988887777")).toBe("(11) 98888-7777")
    expect(formatPixKey("rafael@exemplo.com.br")).toBe("rafael@exemplo.com.br")
  })
})
