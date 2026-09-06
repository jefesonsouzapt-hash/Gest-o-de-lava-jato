import { describe, expect, it } from "vitest"
import {
  amountDue,
  durationForVehicle,
  isSettled,
  itemCommission,
  orderTotals,
  priceForVehicle,
} from "@/lib/pricing/calc"

describe("preço por porte do veículo", () => {
  it("a tabela do dono manda sobre a estimativa", () => {
    // Se o dono cadastrou R$ 45,00 para SUV, é 45,00 — mesmo que a conta por
    // fator desse outro número. A tabela é a decisão dele.
    expect(priceForVehicle({ basePriceCents: 6_000, category: "suv", tablePriceCents: 4_500 })).toBe(4_500)
  })

  it("preço zero na tabela é preço, não ausência", () => {
    // Cortesia cadastrada de propósito não pode virar cobrança pelo fator.
    expect(priceForVehicle({ basePriceCents: 6_000, category: "suv", tablePriceCents: 0 })).toBe(0)
  })

  it("sem tabela, estima pelo porte e arredonda para cima ao real", () => {
    // R$ 60,00 num SUV: 60 × 1,35 = 81,00.
    expect(priceForVehicle({ basePriceCents: 6_000, category: "suv" })).toBe(8_100)
    // R$ 35,00 numa moto: 35 × 0,6 = 21,00.
    expect(priceForVehicle({ basePriceCents: 3_500, category: "moto" })).toBe(2_100)
    // O hatch é a referência: sai igual ao preço-base.
    expect(priceForVehicle({ basePriceCents: 3_500, category: "hatch" })).toBe(3_500)
  })

  it("nunca devolve centavo quebrado", () => {
    // No balcão ninguém cobra R$ 40,26.
    for (const base of [1_733, 4_999, 12_345]) {
      for (const cat of ["moto", "hatch", "sedan", "suv", "caminhonete"] as const) {
        expect(priceForVehicle({ basePriceCents: base, category: cat }) % 100).toBe(0)
      }
    }
  })

  it("serviço sem preço continua sem preço", () => {
    expect(priceForVehicle({ basePriceCents: 0, category: "caminhonete" })).toBe(0)
  })
})

describe("duração por porte", () => {
  it("arredonda a 5 minutos", () => {
    expect(durationForVehicle({ baseMinutes: 30, category: "suv" })).toBe(45)
    expect(durationForVehicle({ baseMinutes: 30, category: "hatch" })).toBe(30)
  })

  it("a duração da tabela manda", () => {
    expect(durationForVehicle({ baseMinutes: 30, category: "suv", tableMinutes: 50 })).toBe(50)
  })
})

describe("totais da ordem", () => {
  it("soma quantidade × preço", () => {
    const t = orderTotals([
      { quantity: 1, unitPriceCents: 6_000 },
      { quantity: 2, unitPriceCents: 1_200 },
    ])
    expect(t.subtotalCents).toBe(8_400)
    expect(t.totalCents).toBe(8_400)
  })

  it("desconto maior que o subtotal não vira troco", () => {
    // Um zero a mais no desconto zera a conta; nunca devolve dinheiro.
    const t = orderTotals([{ quantity: 1, unitPriceCents: 5_000 }], 90_000)
    expect(t.discountCents).toBe(5_000)
    expect(t.totalCents).toBe(0)
  })

  it("desconto negativo é ignorado", () => {
    const t = orderTotals([{ quantity: 1, unitPriceCents: 5_000 }], -1_000)
    expect(t.totalCents).toBe(5_000)
  })

  it("o ISS acompanha o total cobrado, não o subtotal", () => {
    // Com R$ 50,00 de desconto, o imposto cai junto: o dinheiro que não entrou
    // não é faturamento.
    const cheio = orderTotals([{ quantity: 1, unitPriceCents: 10_000 }], 0, 5)
    const comDesconto = orderTotals([{ quantity: 1, unitPriceCents: 10_000 }], 5_000, 5)
    expect(comDesconto.issCents).toBeLessThan(cheio.issCents)
  })

  it("ordem vazia fecha em zero", () => {
    const t = orderTotals([])
    expect(t).toMatchObject({ subtotalCents: 0, totalCents: 0, issCents: 0 })
  })
})

describe("comissão do item", () => {
  it("o percentual incide sobre o valor total do item", () => {
    // 2 lavagens de R$ 60,00 a 10 % = R$ 12,00, não R$ 6,00.
    expect(itemCommission({ quantity: 2, unitPriceCents: 6_000, commissionBps: 1_000, commissionFixedCents: 0 })).toBe(1_200)
  })

  it("o valor fixo é por serviço executado", () => {
    expect(itemCommission({ quantity: 3, unitPriceCents: 6_000, commissionBps: 0, commissionFixedCents: 500 })).toBe(1_500)
  })

  it("percentual e fixo somam", () => {
    // "10 % + R$ 5 por carro" sem inventar um terceiro tipo de regra.
    expect(itemCommission({ quantity: 1, unitPriceCents: 10_000, commissionBps: 1_000, commissionFixedCents: 500 })).toBe(1_500)
  })

  it("sem regra, não há comissão", () => {
    expect(itemCommission({ quantity: 2, unitPriceCents: 6_000, commissionBps: 0, commissionFixedCents: 0 })).toBe(0)
  })
})

describe("saldo e quitação da ordem", () => {
  const pg = (amountCents: number, voidedAt: Date | null = null) => ({ amountCents, voidedAt })

  it("soma os pagamentos válidos", () => {
    expect(amountDue(10_000, [pg(4_000), pg(3_000)])).toBe(3_000)
  })

  it("pagamento estornado volta a dever", () => {
    // A linha fica no histórico, mas o dinheiro voltou para o cliente.
    expect(amountDue(10_000, [pg(10_000, new Date())])).toBe(10_000)
    expect(isSettled(10_000, [pg(10_000, new Date())])).toBe(false)
  })

  it("quem pagou a mais recebe troco, não vira credor", () => {
    expect(amountDue(10_000, [pg(20_000)])).toBe(0)
  })

  it("ordem sem nenhum recebimento não está quitada", () => {
    // Sem isto, uma ordem de R$ 0,00 apareceria paga e creditaria comissão por
    // dinheiro que nunca entrou.
    expect(isSettled(0, [])).toBe(false)
    expect(isSettled(10_000, [])).toBe(false)
  })

  it("pagamento parcial não quita", () => {
    expect(isSettled(10_000, [pg(9_999)])).toBe(false)
    expect(isSettled(10_000, [pg(10_000)])).toBe(true)
  })
})
