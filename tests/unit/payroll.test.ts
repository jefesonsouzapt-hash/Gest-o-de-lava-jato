import { describe, expect, it } from "vitest"
import {
  advanceStatusOf,
  closePayroll,
  commissionForItem,
  nextInstallmentCents,
  remainingBalance,
  resolveCommissionRule,
  SEM_COMISSAO,
  splitInstallments,
  type CommissionRule,
} from "@/lib/payroll/calc"

const percentual = (bps: number): CommissionRule => ({ kind: "percentual", bps, fixedCents: 0 })
const fixo = (cents: number): CommissionRule => ({ kind: "valor_fixo", bps: 0, fixedCents: cents })

describe("qual regra de comissão vale", () => {
  it("a regra da categoria vence todas", () => {
    // "5% na lavagem completa, 15% na vitrificação" para um lavador específico.
    const regra = resolveCommissionRule({
      categoryRule: percentual(1500),
      staffGeneralRule: percentual(1000),
      serviceCommissionBps: 3000,
      staffDefault: percentual(500),
    })
    expect(regra).toEqual(percentual(1500))
  })

  it("sem regra de categoria, vale a regra geral do colaborador", () => {
    const regra = resolveCommissionRule({
      staffGeneralRule: percentual(1000),
      serviceCommissionBps: 3000,
      staffDefault: percentual(500),
    })
    expect(regra).toEqual(percentual(1000))
  })

  it("sem regra do colaborador, vale a comissão do serviço", () => {
    const regra = resolveCommissionRule({ serviceCommissionBps: 3000, staffDefault: percentual(500) })
    expect(regra).toEqual(percentual(3000))
  })

  it("por último, a comissão padrão do colaborador", () => {
    expect(resolveCommissionRule({ staffDefault: percentual(500) })).toEqual(percentual(500))
  })

  it("quem não se encaixa em nada não ganha comissão", () => {
    // O silêncio nunca vira um percentual inventado.
    expect(resolveCommissionRule({})).toEqual(SEM_COMISSAO)
    expect(resolveCommissionRule({ serviceCommissionBps: 0 })).toEqual(SEM_COMISSAO)
    expect(resolveCommissionRule({ staffDefault: SEM_COMISSAO })).toEqual(SEM_COMISSAO)
  })

  it("ignora regra marcada como sem comissão e cai para a próxima", () => {
    const regra = resolveCommissionRule({
      categoryRule: SEM_COMISSAO,
      staffGeneralRule: null,
      serviceCommissionBps: 3000,
    })
    expect(regra).toEqual(percentual(3000))
  })

  it("ignora regra percentual zerada e valor fixo zerado", () => {
    expect(resolveCommissionRule({ categoryRule: percentual(0), staffDefault: percentual(500) })).toEqual(
      percentual(500),
    )
    expect(resolveCommissionRule({ categoryRule: fixo(0), staffDefault: percentual(500) })).toEqual(
      percentual(500),
    )
  })
})

describe("quanto o colaborador ganha por item", () => {
  it("percentual incide sobre o valor do item", () => {
    // R$ 250,00 a 12,5% = R$ 31,25
    expect(commissionForItem(percentual(1250), 25_000)).toBe(3_125)
    expect(commissionForItem(percentual(3000), 25_000)).toBe(7_500)
  })

  it("valor fixo é por serviço executado, não por item", () => {
    // Três lavagens simples pagam três vezes o fixo.
    expect(commissionForItem(fixo(500), 3_600, 3)).toBe(1_500)
    expect(commissionForItem(fixo(500), 1_200, 1)).toBe(500)
  })

  it("sem comissão paga zero", () => {
    expect(commissionForItem(SEM_COMISSAO, 25_000, 2)).toBe(0)
  })

  it("trata valores inválidos como zero em vez de gerar NaN", () => {
    // Um NaN aqui viraria um holerite com "R$ NaN" no lugar do salário.
    expect(commissionForItem(percentual(1250), Number.NaN)).toBe(0)
    expect(commissionForItem(fixo(500), 1000, Number.NaN)).toBe(500)
    expect(commissionForItem(percentual(1250), -5000)).toBe(0)
  })
})

describe("parcelas do vale", () => {
  it("divide igualmente quando dá certo", () => {
    expect(splitInstallments(30_000, 3)).toEqual([10_000, 10_000, 10_000])
  })

  it("sobra o resto na última parcela", () => {
    // R$ 100,00 em 3x = 33,33 + 33,33 + 33,34
    expect(splitInstallments(10_000, 3)).toEqual([3_333, 3_333, 3_334])
  })

  it("a soma bate sempre com o total, ao centavo", () => {
    // Se não bater, ou o saldo devedor nunca zera, ou o funcionário paga por um
    // centavo que não pegou.
    for (const total of [1, 7, 99, 10_000, 33_333, 123_457]) {
      for (const n of [1, 2, 3, 4, 5, 6, 7, 12]) {
        const parcelas = splitInstallments(total, n)
        expect(parcelas).toHaveLength(n)
        expect(parcelas.reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it("uma parcela é o vale inteiro", () => {
    expect(splitInstallments(50_000, 1)).toEqual([50_000])
  })

  it("protege contra número de parcelas absurdo", () => {
    expect(splitInstallments(10_000, 0)).toHaveLength(1)
    expect(splitInstallments(10_000, -3)).toHaveLength(1)
    expect(splitInstallments(10_000, 999)).toHaveLength(60)
  })
})

describe("próxima parcela a descontar", () => {
  const vale = (deductedCents: number, deductionsCount: number) => ({
    amountCents: 10_000,
    installments: 3,
    deductedCents,
    deductionsCount,
  })

  it("cobra a parcela da vez", () => {
    // R$ 100,00 em 3x: as duas primeiras são 33,33.
    expect(nextInstallmentCents(vale(0, 0))).toBe(3_333)
    expect(nextInstallmentCents(vale(3_333, 1))).toBe(3_333)
  })

  it("a última parcela cobra o saldo devedor inteiro", () => {
    // 33,34, não 33,33: senão sobra R$ 0,01 e o vale de 3x arrasta um quarto
    // desconto que ninguém combinou — e o colaborador fica devendo um centavo
    // por meses.
    expect(nextInstallmentCents(vale(6_666, 2))).toBe(3_334)
  })

  it("as três parcelas somam exatamente o vale", () => {
    let abatido = 0
    const cobradas: number[] = []
    for (let i = 0; i < 3; i++) {
      const parcela = nextInstallmentCents(vale(abatido, i))
      cobradas.push(parcela)
      abatido += parcela
    }
    expect(cobradas).toEqual([3_333, 3_333, 3_334])
    expect(abatido).toBe(10_000)
    // E não sobra uma quarta.
    expect(nextInstallmentCents(vale(abatido, 3))).toBe(0)
  })

  it("nunca cobra mais que o saldo devedor", () => {
    // Um desconto avulso adiantou o vale: a parcela seguinte cobra só o que
    // falta, não os 33,33 da tabela.
    expect(nextInstallmentCents(vale(9_990, 1))).toBe(10)
  })

  it("vale quitado não gera parcela", () => {
    expect(nextInstallmentCents(vale(10_000, 3))).toBe(0)
  })

  it("desconto único cobra tudo de uma vez", () => {
    expect(
      nextInstallmentCents({ amountCents: 50_000, installments: 1, deductedCents: 0, deductionsCount: 0 }),
    ).toBe(50_000)
  })
})

describe("saldo devedor e situação do vale", () => {
  it("saldo é o concedido menos o abatido, nunca negativo", () => {
    expect(remainingBalance({ amountCents: 50_000, deductedCents: 20_000 })).toBe(30_000)
    expect(remainingBalance({ amountCents: 50_000, deductedCents: 50_000 })).toBe(0)
    expect(remainingBalance({ amountCents: 50_000, deductedCents: 60_000 })).toBe(0)
  })

  it("deriva a situação dos fatos, não de um campo editado à mão", () => {
    const pago = new Date("2026-03-05T12:00:00Z")
    expect(advanceStatusOf({ amountCents: 50_000, deductedCents: 0, paidAt: null })).toBe("pendente")
    expect(advanceStatusOf({ amountCents: 50_000, deductedCents: 0, paidAt: pago })).toBe("pago")
    expect(advanceStatusOf({ amountCents: 50_000, deductedCents: 20_000, paidAt: pago })).toBe(
      "parcialmente_abatido",
    )
    expect(advanceStatusOf({ amountCents: 50_000, deductedCents: 50_000, paidAt: pago })).toBe("quitado")
  })

  it("cancelado vence tudo", () => {
    expect(
      advanceStatusOf({
        amountCents: 50_000,
        deductedCents: 20_000,
        paidAt: new Date(),
        canceledAt: new Date(),
      }),
    ).toBe("cancelado")
  })
})

describe("fechamento da folha", () => {
  it("soma proventos e subtrai descontos", () => {
    // Salário R$ 1.500 + comissão R$ 480 − vale R$ 200 = R$ 1.780
    const r = closePayroll({
      baseSalaryCents: 150_000,
      commissionCents: 48_000,
      advances: [{ id: 1, installmentCents: 20_000, remainingCents: 20_000 }],
    })
    expect(r.earningsCents).toBe(198_000)
    expect(r.advanceDeductionCents).toBe(20_000)
    expect(r.netCents).toBe(178_000)
    expect(r.deductions).toEqual([{ advanceId: 1, amountCents: 20_000 }])
    expect(r.postponedCents).toBe(0)
  })

  it("o líquido nunca fica negativo", () => {
    // R$ 300,00 a receber e R$ 500,00 em vales: desconta o que cabe, e o resto
    // continua no saldo devedor em vez de virar salário negativo.
    const r = closePayroll({
      baseSalaryCents: 30_000,
      commissionCents: 0,
      advances: [{ id: 1, installmentCents: 50_000, remainingCents: 50_000 }],
    })
    expect(r.netCents).toBe(0)
    expect(r.advanceDeductionCents).toBe(30_000)
    expect(r.postponedCents).toBe(20_000)
  })

  it("abate os vales do mais antigo para o mais novo", () => {
    const r = closePayroll({
      baseSalaryCents: 25_000,
      commissionCents: 0,
      advances: [
        { id: 1, installmentCents: 20_000, remainingCents: 20_000 },
        { id: 2, installmentCents: 20_000, remainingCents: 20_000 },
      ],
    })
    // O primeiro leva a parcela cheia; o segundo, só o que sobrou.
    expect(r.deductions).toEqual([
      { advanceId: 1, amountCents: 20_000 },
      { advanceId: 2, amountCents: 5_000 },
    ])
    expect(r.netCents).toBe(0)
    expect(r.postponedCents).toBe(15_000)
  })

  it("nunca cobra além do saldo devedor do vale", () => {
    // Parcela de R$ 200 num vale que só deve R$ 50: cobra R$ 50.
    const r = closePayroll({
      baseSalaryCents: 150_000,
      commissionCents: 0,
      advances: [{ id: 1, installmentCents: 20_000, remainingCents: 5_000 }],
    })
    expect(r.advanceDeductionCents).toBe(5_000)
    expect(r.netCents).toBe(145_000)
    expect(r.postponedCents).toBe(0)
  })

  it("ignora vale já quitado", () => {
    const r = closePayroll({
      baseSalaryCents: 150_000,
      commissionCents: 0,
      advances: [{ id: 1, installmentCents: 20_000, remainingCents: 0 }],
    })
    expect(r.deductions).toEqual([])
    expect(r.netCents).toBe(150_000)
  })

  it("outros descontos saem antes dos vales", () => {
    // Uma multa ou um dano têm de sair do mês; o vale pode esperar a folha
    // seguinte.
    const r = closePayroll({
      baseSalaryCents: 100_000,
      commissionCents: 0,
      otherDeductionCents: 80_000,
      advances: [{ id: 1, installmentCents: 50_000, remainingCents: 50_000 }],
    })
    expect(r.otherDeductionCents).toBe(80_000)
    expect(r.advanceDeductionCents).toBe(20_000)
    expect(r.netCents).toBe(0)
    expect(r.postponedCents).toBe(30_000)
  })

  it("limita outros descontos aos proventos", () => {
    const r = closePayroll({ baseSalaryCents: 50_000, commissionCents: 0, otherDeductionCents: 90_000 })
    expect(r.otherDeductionCents).toBe(50_000)
    expect(r.netCents).toBe(0)
  })

  it("fecha para quem só ganha comissão", () => {
    const r = closePayroll({ baseSalaryCents: 0, commissionCents: 87_500, bonusCents: 10_000 })
    expect(r.earningsCents).toBe(97_500)
    expect(r.netCents).toBe(97_500)
  })

  it("proventos e descontos sempre fecham a conta", () => {
    const r = closePayroll({
      baseSalaryCents: 120_000,
      commissionCents: 33_333,
      bonusCents: 5_000,
      otherEarningsCents: 1_667,
      otherDeductionCents: 10_000,
      advances: [
        { id: 1, installmentCents: 3_333, remainingCents: 3_333 },
        { id: 2, installmentCents: 25_000, remainingCents: 100_000 },
      ],
    })
    expect(r.earningsCents - r.deductionsCents).toBe(r.netCents)
    expect(r.deductions.reduce((a, d) => a + d.amountCents, 0)).toBe(r.advanceDeductionCents)
  })

  it("trata entradas inválidas como zero em vez de gerar NaN", () => {
    const r = closePayroll({ baseSalaryCents: Number.NaN, commissionCents: 48_000 })
    expect(r.netCents).toBe(48_000)
    expect(Number.isNaN(r.netCents)).toBe(false)
  })
})
