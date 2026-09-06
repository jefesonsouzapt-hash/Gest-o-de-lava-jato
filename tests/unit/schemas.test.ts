import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  advanceSchema,
  companySchema,
  customerSchema,
  loginSchema,
  parseForm,
  passwordSchema,
  paymentSchema,
  serviceSchema,
  staffSchema,
  vehicleSchema,
  workOrderItemSchema,
} from "@/lib/validation/schemas"

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) valor.forEach((v) => fd.append(chave, v))
    else fd.set(chave, valor)
  }
  return fd
}

const clienteMinimo = { name: "Ana", phone: "", email: "", document: "", cep: "", uf: "" }

describe("cliente", () => {
  it("normaliza telefone e documento ao validar", () => {
    // A normalização acontece aqui, num lugar só, e não em cada server action.
    const r = customerSchema.parse({
      name: "  Ana Ribeiro ",
      phone: "(11) 98888-7777",
      email: "ANA@Exemplo.COM.BR",
      document: "529.982.247-25",
      cep: "01310-100",
      street: "",
      city: "São Paulo",
      uf: "sp",
      notes: "",
    })

    expect(r.name).toBe("Ana Ribeiro")
    expect(r.phone).toBe("+5511988887777")
    expect(r.email).toBe("ana@exemplo.com.br")
    expect(r.document).toBe("52998224725")
    expect(r.cep).toBe("01310100")
    expect(r.uf).toBe("SP")
    // Campos de texto vazios viram nulos, não string vazia.
    expect(r.street).toBeNull()
    expect(r.notes).toBeNull()
  })

  it("aceita cliente só com nome", () => {
    expect(customerSchema.safeParse(clienteMinimo).success).toBe(true)
  })

  it("recusa CPF com dígito verificador errado", () => {
    const r = customerSchema.safeParse({ ...clienteMinimo, document: "529.982.247-26" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain("CPF ou CNPJ inválido")
  })

  it("aceita CNPJ de frota", () => {
    const r = customerSchema.parse({ ...clienteMinimo, document: "11.222.333/0001-81" })
    expect(r.document).toBe("11222333000181")
  })

  it("recusa telefone estrangeiro", () => {
    // Número português, que era o formato do sistema anterior.
    expect(customerSchema.safeParse({ ...clienteMinimo, phone: "+351912345678" }).success).toBe(false)
  })

  it("recusa UF que não existe", () => {
    expect(customerSchema.safeParse({ ...clienteMinimo, uf: "XX" }).success).toBe(false)
  })
})

describe("veículo", () => {
  it("grava a placa sem hífen e em maiúsculas", () => {
    const r = vehicleSchema.parse({
      customerId: "3",
      plate: "abc-1d23",
      model: "Onix",
      category: "suv",
      year: "2021",
    })
    expect(r.plate).toBe("ABC1D23")
    expect(r.customerId).toBe(3)
    expect(r.year).toBe(2021)
  })

  it("aceita o padrão antigo e recusa o português", () => {
    expect(vehicleSchema.safeParse({ customerId: "1", plate: "ABC1234", year: "" }).success).toBe(true)
    const r = vehicleSchema.safeParse({ customerId: "1", plate: "AA-00-AA", year: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain("Placa inválida")
  })
})

describe("empresa", () => {
  const base = {
    name: "Lava Jato do Zé",
    cnpj: "11.222.333/0001-81",
    phone: "",
    whatsapp: "",
    email: "",
    cep: "",
    uf: "",
    issBps: "5",
    brandColor: "#2F6FD0",
  }

  it("normaliza CNPJ, ISS e cor da marca", () => {
    const r = companySchema.parse(base)
    expect(r.cnpj).toBe("11222333000181")
    expect(r.issBps).toBe(500)
    expect(r.brandColor).toBe("#2f6fd0")
  })

  it("aceita ISS com meio ponto", () => {
    expect(companySchema.parse({ ...base, issBps: "2,5" }).issBps).toBe(250)
  })

  it("recusa ISS fora da faixa legal de 2% a 5%", () => {
    // O teto é constitucional; um 20% digitado por engano distorceria todo o
    // relatório de impostos do dono.
    expect(companySchema.safeParse({ ...base, issBps: "1" }).success).toBe(false)
    expect(companySchema.safeParse({ ...base, issBps: "20" }).success).toBe(false)
  })

  it("recusa cor fora do formato hexadecimal", () => {
    expect(companySchema.safeParse({ ...base, brandColor: "azul" }).success).toBe(false)
    expect(companySchema.safeParse({ ...base, brandColor: "#fff" }).success).toBe(false)
  })
})

describe("serviço", () => {
  const base = {
    name: "Lavagem Completa",
    basePriceCents: "45,00",
    durationMinutes: "45",
    commissionBps: "12,5",
  }

  it("converte reais para centavos e percentual para pontos-base", () => {
    const r = serviceSchema.parse(base)
    expect(r.basePriceCents).toBe(4500)
    expect(r.commissionBps).toBe(1250)
  })

  it("recusa duração fora dos limites", () => {
    for (const duracao of ["0", "3", "2000"]) {
      expect(serviceSchema.safeParse({ ...base, durationMinutes: duracao }).success).toBe(false)
    }
  })

  it("recusa comissão acima de 100%", () => {
    expect(serviceSchema.safeParse({ ...base, commissionBps: "150" }).success).toBe(false)
  })
})

describe("colaborador", () => {
  const base = {
    name: "Rafael Duarte",
    cpf: "529.982.247-25",
    rg: "",
    birthDate: "",
    phone: "(11) 98888-7777",
    email: "",
    cep: "",
    uf: "",
    pixKey: "",
    bankAccountType: "",
    jobTitle: "lavador",
    contractType: "clt",
    status: "ativo",
    hiredAt: "2026-03-01",
    baseSalaryCents: "1.500,00",
    commissionKind: "nenhuma",
    commissionBps: "0",
    commissionFixedCents: "0",
  }

  it("normaliza CPF, telefone e salário", () => {
    const r = staffSchema.parse(base)
    expect(r.cpf).toBe("52998224725")
    expect(r.phone).toBe("+5511988887777")
    expect(r.baseSalaryCents).toBe(150_000)
    expect(r.hiredAt).toBe("2026-03-01")
  })

  it("aceita chave PIX de qualquer tipo", () => {
    for (const chave of [
      "529.982.247-25",
      "rafael@exemplo.com.br",
      "(11) 98888-7777",
      "123e4567-e89b-12d3-a456-426614174000",
    ]) {
      expect(staffSchema.safeParse({ ...base, pixKey: chave }).success).toBe(true)
    }
  })

  it("recusa chave PIX que o banco não reconheceria", () => {
    // Melhor recusar no cadastro do que descobrir na hora de pagar o salário.
    const r = staffSchema.safeParse({ ...base, pixKey: "minha chave" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain("Chave PIX inválida")
  })

  it("exige o percentual quando a comissão é percentual", () => {
    // Escolher "percentual" e deixar em branco criaria um colaborador que
    // parece comissionado e nunca recebe nada.
    const r = staffSchema.safeParse({ ...base, commissionKind: "percentual", commissionBps: "0" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(["commissionBps"])
  })

  it("exige o valor quando a comissão é fixa", () => {
    const r = staffSchema.safeParse({
      ...base,
      commissionKind: "valor_fixo",
      commissionFixedCents: "0",
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(["commissionFixedCents"])
  })

  it("aceita comissionado sem salário base", () => {
    const r = staffSchema.parse({
      ...base,
      contractType: "comissionado",
      baseSalaryCents: "0",
      commissionKind: "percentual",
      commissionBps: "30",
    })
    expect(r.baseSalaryCents).toBe(0)
    expect(r.commissionBps).toBe(3000)
  })

  it("recusa CPF inválido", () => {
    expect(staffSchema.safeParse({ ...base, cpf: "111.111.111-11" }).success).toBe(false)
  })
})

describe("vale / adiantamento", () => {
  const base = {
    staffId: "1",
    amountCents: "300,00",
    requestedOn: "2026-03-10",
    paymentMethod: "pix",
    receiptRef: "",
    installments: "3",
    firstDeductionMonth: "2026-04",
  }

  it("aceita um vale bem formado", () => {
    const r = advanceSchema.parse(base)
    expect(r.amountCents).toBe(30_000)
    expect(r.installments).toBe(3)
    expect(r.firstDeductionMonth).toBe("2026-04")
  })

  it("recusa valor zerado", () => {
    // Um vale de R$ 0,00 vira uma dívida fantasma no painel do colaborador.
    expect(advanceSchema.safeParse({ ...base, amountCents: "0" }).success).toBe(false)
  })

  it("recusa competência mal formada", () => {
    for (const mes of ["2026-13", "2026-00", "abril", "04/2026", ""]) {
      expect(advanceSchema.safeParse({ ...base, firstDeductionMonth: mes }).success).toBe(false)
    }
  })

  it("limita o parcelamento", () => {
    expect(advanceSchema.safeParse({ ...base, installments: "0" }).success).toBe(false)
    expect(advanceSchema.safeParse({ ...base, installments: "36" }).success).toBe(false)
    expect(advanceSchema.safeParse({ ...base, installments: "1" }).success).toBe(true)
  })

  it("recusa forma de pagamento que não entrega dinheiro na mão", () => {
    // Vale não se paga com cartão de crédito nem boleto.
    expect(advanceSchema.safeParse({ ...base, paymentMethod: "credito" }).success).toBe(false)
    expect(advanceSchema.safeParse({ ...base, paymentMethod: "boleto" }).success).toBe(false)
  })
})

describe("pagamento da ordem", () => {
  it("recusa recebimento de zero reais", () => {
    expect(paymentSchema.safeParse({ method: "pix", amountCents: "0" }).success).toBe(false)
    expect(paymentSchema.safeParse({ method: "pix", amountCents: "12,50" }).success).toBe(true)
  })

  it("recusa meio de pagamento que não existe no Brasil", () => {
    // MB WAY e Multibanco eram do sistema português.
    expect(paymentSchema.safeParse({ method: "mbway", amountCents: "10" }).success).toBe(false)
    expect(paymentSchema.safeParse({ method: "multibanco", amountCents: "10" }).success).toBe(false)
  })
})

describe("item da ordem", () => {
  it("limita a quantidade entre 1 e 99", () => {
    const base = { description: "Lavagem", unitPriceCents: "45,00" }
    expect(workOrderItemSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false)
    expect(workOrderItemSchema.safeParse({ ...base, quantity: "100" }).success).toBe(false)
    expect(workOrderItemSchema.safeParse({ ...base, quantity: "3" }).success).toBe(true)
  })
})

describe("senha", () => {
  it("exige pelo menos doze caracteres", () => {
    expect(passwordSchema.safeParse("curta").success).toBe(false)
    expect(passwordSchema.safeParse("Abc123!").success).toBe(false)
    expect(passwordSchema.safeParse("uma frase longa mesmo").success).toBe(true)
  })
})

describe("parseForm", () => {
  it("devolve os dados validados de um FormData", () => {
    const r = parseForm(loginSchema, form({ email: " Ana@Exemplo.com.br ", password: "frase-longa-aqui" }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.email).toBe("Ana@Exemplo.com.br")
  })

  it("devolve uma mensagem por campo, em português do Brasil", () => {
    const r = parseForm(loginSchema, form({ email: "não-é-email", password: "" }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.email).toBe("E-mail inválido.")
      expect(r.errors.password).toBe("Informe a senha.")
    }
  })

  it("junta campos repetidos numa lista", () => {
    // É assim que chegam as caixas de seleção de serviços de uma ordem: várias
    // entradas com o mesmo nome. Sem isso, só a última seria validada.
    const schema = z.object({ serviceIds: z.array(z.string()) })
    const r = parseForm(schema, form({ serviceIds: ["1", "2", "3"] }))

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.serviceIds).toEqual(["1", "2", "3"])
  })
})

describe("campo ausente no formulário", () => {
  it("trata campo de dinheiro que não foi enviado como zero", () => {
    // Um input desabilitado não é enviado pelo navegador. Sem isso, o
    // formulário devolvia "expected string, received undefined" — mensagem de
    // biblioteca, em inglês, apontando para um campo que o usuário nem podia
    // preencher.
    const r = staffSchema.safeParse({
      name: "Rafael",
      cpf: "",
      phone: "",
      email: "",
      cep: "",
      uf: "",
      pixKey: "",
      hiredAt: "",
      birthDate: "",
      baseSalaryCents: "1.500,00",
      commissionKind: "percentual",
      commissionBps: "30",
      // commissionFixedCents ausente de propósito
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.commissionFixedCents).toBe(0)
  })

  it("nunca deixa vazar mensagem crua da biblioteca", () => {
    const schema = z.object({ obrigatorio: z.string() })
    const r = parseForm(schema, form({}))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const mensagem = Object.values(r.errors)[0]
      expect(mensagem).not.toMatch(/Invalid|expected|Required/i)
      expect(mensagem).toBe("Confira este campo.")
    }
  })
})
