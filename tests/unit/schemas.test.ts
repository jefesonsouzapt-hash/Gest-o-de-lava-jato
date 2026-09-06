import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  customerSchema,
  loginSchema,
  parseForm,
  passwordSchema,
  paymentSchema,
  serviceSchema,
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

describe("cliente", () => {
  it("normaliza telemóvel e NIF ao validar", () => {
    // A normalização acontece aqui, num sítio só, e não em cada server action.
    const r = customerSchema.parse({
      name: "  Ana Ribeiro ",
      phone: "+351 912 345 678",
      email: "ANA@Exemplo.PT",
      nif: "123 456 789",
      address: "",
      postalCode: "4450-123",
      locality: "Matosinhos",
      notes: "",
    })

    expect(r.name).toBe("Ana Ribeiro")
    expect(r.phone).toBe("+351912345678")
    expect(r.email).toBe("ana@exemplo.pt")
    expect(r.nif).toBe("123456789")
    expect(r.postalCode).toBe("4450123")
    // Campos de texto vazios ficam nulos, não string vazia.
    expect(r.address).toBeNull()
    expect(r.notes).toBeNull()
  })

  it("aceita cliente só com nome", () => {
    const r = customerSchema.safeParse({
      name: "Cliente de passagem",
      phone: "",
      email: "",
      nif: "",
      address: "",
      postalCode: "",
      locality: "",
      notes: "",
    })
    expect(r.success).toBe(true)
  })

  it("recusa nome vazio", () => {
    const r = customerSchema.safeParse({ name: "   ", phone: "", email: "", nif: "", postalCode: "" })
    expect(r.success).toBe(false)
  })

  it("recusa NIF com dígito de controlo errado", () => {
    const r = customerSchema.safeParse({ name: "Ana", phone: "", email: "", nif: "123456788", postalCode: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain("NIF inválido")
  })

  it("recusa telemóvel estrangeiro", () => {
    const r = customerSchema.safeParse({
      name: "Ana",
      phone: "+55 11 98888-7777",
      email: "",
      nif: "",
      postalCode: "",
    })
    expect(r.success).toBe(false)
  })
})

describe("viatura", () => {
  it("guarda a matrícula sem hífenes e em maiúsculas", () => {
    const r = vehicleSchema.parse({
      customerId: "3",
      plate: "aa-00-aa",
      brand: "",
      model: "Golf",
      color: "",
      category: "suv",
      year: "2021",
      notes: "",
    })
    expect(r.plate).toBe("AA00AA")
    expect(r.customerId).toBe(3)
    expect(r.year).toBe(2021)
    expect(r.category).toBe("suv")
  })

  it("recusa matrícula em formato brasileiro", () => {
    const r = vehicleSchema.safeParse({ customerId: "1", plate: "ABC1D23", category: "suv", year: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toContain("Matrícula inválida")
  })

  it("recusa ano no futuro distante", () => {
    const r = vehicleSchema.safeParse({
      customerId: "1",
      plate: "AA-00-AA",
      category: "suv",
      year: "2200",
    })
    expect(r.success).toBe(false)
  })

  it("aceita ano em branco", () => {
    const r = vehicleSchema.parse({ customerId: "1", plate: "AA-00-AA", category: "suv", year: "" })
    expect(r.year).toBeNull()
  })
})

describe("serviço", () => {
  it("converte euros para cêntimos e percentagem para pontos de base", () => {
    const r = serviceSchema.parse({
      name: "Lavagem Completa",
      description: "",
      isPackage: "true",
      basePriceCents: "25,00",
      vatRate: "23",
      durationMinutes: "45",
      commissionBps: "12,5",
      countsForLoyalty: "true",
    })
    expect(r.basePriceCents).toBe(2500)
    expect(r.commissionBps).toBe(1250)
    expect(r.isPackage).toBe(true)
  })

  it("recusa taxa de IVA que não existe em Portugal", () => {
    const r = serviceSchema.safeParse({
      name: "X",
      basePriceCents: "10",
      vatRate: "21",
      durationMinutes: "30",
      commissionBps: "0",
    })
    expect(r.success).toBe(false)
  })

  it("recusa comissão acima de 100 %", () => {
    const r = serviceSchema.safeParse({
      name: "X",
      basePriceCents: "10",
      vatRate: "23",
      durationMinutes: "30",
      commissionBps: "150",
    })
    expect(r.success).toBe(false)
  })

  it("recusa duração fora dos limites", () => {
    for (const duracao of ["0", "3", "2000"]) {
      const r = serviceSchema.safeParse({
        name: "X",
        basePriceCents: "10",
        vatRate: "23",
        durationMinutes: duracao,
        commissionBps: "0",
      })
      expect(r.success).toBe(false)
    }
  })
})

describe("item de ficha e pagamento", () => {
  it("limita a quantidade entre 1 e 99", () => {
    expect(
      workOrderItemSchema.safeParse({ description: "X", quantity: "0", unitPriceCents: "10", vatRate: "23" })
        .success,
    ).toBe(false)
    expect(
      workOrderItemSchema.safeParse({ description: "X", quantity: "100", unitPriceCents: "10", vatRate: "23" })
        .success,
    ).toBe(false)
    expect(
      workOrderItemSchema.safeParse({ description: "X", quantity: "3", unitPriceCents: "10", vatRate: "23" })
        .success,
    ).toBe(true)
  })

  it("recusa recebimento de zero euros", () => {
    // Um pagamento de 0,00 € entraria no caixa como recebimento e desequilibrava
    // a conta de fichas pagas.
    expect(paymentSchema.safeParse({ method: "mbway", amountCents: "0", reference: "" }).success).toBe(false)
    expect(paymentSchema.safeParse({ method: "mbway", amountCents: "12,50", reference: "" }).success).toBe(true)
  })

  it("recusa meio de pagamento que não existe em Portugal", () => {
    expect(paymentSchema.safeParse({ method: "pix", amountCents: "10", reference: "" }).success).toBe(false)
    expect(paymentSchema.safeParse({ method: "boleto", amountCents: "10", reference: "" }).success).toBe(false)
  })
})

describe("palavra-passe", () => {
  it("exige pelo menos doze caracteres", () => {
    expect(passwordSchema.safeParse("curta").success).toBe(false)
    expect(passwordSchema.safeParse("Abc123!").success).toBe(false)
    expect(passwordSchema.safeParse("uma frase-passe longa").success).toBe(true)
  })
})

describe("parseForm", () => {
  it("devolve os dados validados de um FormData", () => {
    const r = parseForm(loginSchema, form({ email: " Ana@Exemplo.pt ", password: "frase-passe-longa" }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.email).toBe("Ana@Exemplo.pt")
  })

  it("devolve uma mensagem por campo, em português", () => {
    const r = parseForm(loginSchema, form({ email: "não-é-email", password: "" }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.email).toBe("Endereço de email inválido.")
      expect(r.errors.password).toBe("Indique a palavra-passe.")
    }
  })

  it("junta campos repetidos numa lista", () => {
    // É assim que chegam as caixas de seleção de serviços de uma ficha: várias
    // entradas com o mesmo nome. Sem isto, só a última seria validada.
    const schema = z.object({ serviceIds: z.array(z.string()) })
    const r = parseForm(schema, form({ serviceIds: ["1", "2", "3"] }))

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.serviceIds).toEqual(["1", "2", "3"])
  })
})
