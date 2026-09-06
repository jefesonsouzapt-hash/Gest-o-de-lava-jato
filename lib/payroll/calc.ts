// Regras de comissão, vale e fechamento da folha.
//
// Tudo aqui é função pura sobre centavos inteiros: nenhuma consulta ao banco,
// nenhuma data implícita. É o que permite testar o holerite sem subir um
// Postgres, e é onde um erro custa dinheiro de verdade a alguém.

import { fromBps } from "@/lib/locale/money"

// --- Comissão ----------------------------------------------------------------

export type CommissionKind = "nenhuma" | "percentual" | "valor_fixo"

/** Regra de comissão, venha ela do colaborador, do serviço ou da categoria. */
export type CommissionRule = {
  kind: CommissionKind
  bps: number
  fixedCents: number
}

export const SEM_COMISSAO: CommissionRule = { kind: "nenhuma", bps: 0, fixedCents: 0 }

/**
 * Escolhe a regra que vale para um serviço executado por um colaborador.
 *
 * A ordem é do mais específico para o mais geral, e é o que permite dizer
 * "5 % na lavagem completa, 15 % na vitrificação" para um lavador sem mexer
 * na tabela de serviços nem na comissão padrão dos outros:
 *
 * 1. regra do colaborador para **aquela categoria** de serviço;
 * 2. regra do colaborador para **qualquer categoria**;
 * 3. comissão definida no **serviço**;
 * 4. comissão **padrão do colaborador**.
 *
 * Quem não se encaixa em nenhuma não ganha comissão — o silêncio nunca vira
 * um percentual inventado.
 */
export function resolveCommissionRule(input: {
  categoryRule?: CommissionRule | null
  staffGeneralRule?: CommissionRule | null
  serviceCommissionBps?: number | null
  staffDefault?: CommissionRule | null
}): CommissionRule {
  const { categoryRule, staffGeneralRule, serviceCommissionBps, staffDefault } = input

  if (isPayingRule(categoryRule)) return categoryRule
  if (isPayingRule(staffGeneralRule)) return staffGeneralRule

  if (serviceCommissionBps && serviceCommissionBps > 0) {
    return { kind: "percentual", bps: serviceCommissionBps, fixedCents: 0 }
  }

  if (isPayingRule(staffDefault)) return staffDefault

  return SEM_COMISSAO
}

function isPayingRule(rule: CommissionRule | null | undefined): rule is CommissionRule {
  if (!rule || rule.kind === "nenhuma") return false
  return rule.kind === "percentual" ? rule.bps > 0 : rule.fixedCents > 0
}

/**
 * Quanto o colaborador ganha por um item da ordem de serviço.
 *
 * `baseCents` é o valor do item já multiplicado pela quantidade; o valor fixo,
 * ao contrário, é por serviço executado — três lavagens simples pagam três
 * vezes o fixo.
 */
export function commissionForItem(rule: CommissionRule, baseCents: number, quantity = 1): number {
  const qtd = Math.max(Math.trunc(Number.isFinite(quantity) ? quantity : 1), 0)
  const base = Math.max(Math.trunc(Number.isFinite(baseCents) ? baseCents : 0), 0)

  if (rule.kind === "percentual") return fromBps(base, rule.bps)
  if (rule.kind === "valor_fixo") return Math.max(Math.trunc(rule.fixedCents), 0) * qtd
  return 0
}

// --- Vale / adiantamento -----------------------------------------------------

/**
 * Divide um vale em parcelas iguais, sobrando o resto na **última**.
 *
 * R$ 100,00 em 3 parcelas dá 33,33 + 33,33 + 33,34: a soma tem de bater com o
 * total ao centavo, senão a empresa cobra a menos e o saldo devedor nunca
 * zera, ou cobra a mais e o funcionário paga por um centavo que não pegou.
 */
export function splitInstallments(totalCents: number, installments: number): number[] {
  const total = Math.max(Math.trunc(Number.isFinite(totalCents) ? totalCents : 0), 0)
  const n = Math.min(Math.max(Math.trunc(Number.isFinite(installments) ? installments : 1), 1), 60)
  if (total === 0) return Array.from({ length: n }, () => 0)

  const base = Math.floor(total / n)
  const parcelas = Array.from({ length: n }, () => base)
  parcelas[n - 1] += total - base * n
  return parcelas
}

export type AdvanceState = {
  /** Total concedido, em centavos. */
  amountCents: number
  /** Soma do que já foi descontado em folhas anteriores. */
  deductedCents: number
}

/** Quanto o colaborador ainda deve deste vale. Nunca negativo. */
export function remainingBalance(advance: AdvanceState): number {
  return Math.max(advance.amountCents - advance.deductedCents, 0)
}

export type AdvanceStatus = "pendente" | "pago" | "parcialmente_abatido" | "quitado" | "cancelado"

/**
 * Situação de um vale, derivada dos fatos — nunca um campo editado à mão, que
 * sairia do lugar no primeiro estorno.
 */
export function advanceStatusOf(
  advance: AdvanceState & { paidAt?: Date | string | null; canceledAt?: Date | string | null },
): AdvanceStatus {
  if (advance.canceledAt) return "cancelado"
  if (!advance.paidAt) return "pendente"
  if (advance.deductedCents <= 0) return "pago"
  if (remainingBalance(advance) === 0) return "quitado"
  return "parcialmente_abatido"
}

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  pendente: "Pendente",
  pago: "Pago ao funcionário",
  parcialmente_abatido: "Parcialmente abatido",
  quitado: "Totalmente quitado",
  cancelado: "Cancelado",
}

// --- Fechamento da folha -----------------------------------------------------

export type PayrollInput = {
  baseSalaryCents: number
  commissionCents: number
  bonusCents?: number
  otherEarningsCents?: number
  otherDeductionCents?: number
  /** Vales em aberto, do mais antigo para o mais novo. */
  advances?: { id: number; installmentCents: number; remainingCents: number }[]
}

export type PayrollResult = {
  earningsCents: number
  advanceDeductionCents: number
  otherDeductionCents: number
  deductionsCents: number
  netCents: number
  /** Quanto cada vale desconta nesta folha. */
  deductions: { advanceId: number; amountCents: number }[]
  /**
   * Quanto ficou de fora por não caber no líquido — rola para a folha
   * seguinte em vez de virar salário negativo.
   */
  postponedCents: number
}

/**
 * Fecha a folha de um colaborador.
 *
 * Duas regras que valem por todas as outras:
 *
 * 1. **O líquido nunca é negativo.** Um funcionário com R$ 300,00 a receber e
 *    R$ 500,00 em vales não termina o mês devendo dinheiro à empresa na folha:
 *    desconta-se o que cabe e o resto continua no saldo devedor.
 * 2. **Os vales são abatidos do mais antigo para o mais novo**, e cada um só
 *    até o seu saldo devedor — nunca além, mesmo que a parcela calculada seja
 *    maior por causa de um arredondamento.
 */
export function closePayroll(input: PayrollInput): PayrollResult {
  const base = int(input.baseSalaryCents)
  const comissao = int(input.commissionCents)
  const bonus = int(input.bonusCents)
  const outrosProventos = int(input.otherEarningsCents)
  const outrosDescontos = Math.max(int(input.otherDeductionCents), 0)

  const proventos = Math.max(base + comissao + bonus + outrosProventos, 0)

  // Outros descontos vêm antes dos vales: uma multa ou um dano têm de sair do
  // mês, enquanto o vale pode esperar a folha seguinte.
  const descontoOutros = Math.min(outrosDescontos, proventos)
  let disponivel = proventos - descontoOutros

  const deductions: { advanceId: number; amountCents: number }[] = []
  let descontoVales = 0
  let adiado = 0

  for (const vale of input.advances ?? []) {
    const devido = Math.max(int(vale.remainingCents), 0)
    if (devido === 0) continue

    // A parcela nunca passa do saldo devedor: a última parcela de um vale já
    // quase quitado cobra só o que falta.
    const pretendido = Math.min(Math.max(int(vale.installmentCents), 0), devido)
    const cobrado = Math.min(pretendido, disponivel)

    if (cobrado > 0) {
      deductions.push({ advanceId: vale.id, amountCents: cobrado })
      descontoVales += cobrado
      disponivel -= cobrado
    }
    adiado += pretendido - cobrado
  }

  return {
    earningsCents: proventos,
    advanceDeductionCents: descontoVales,
    otherDeductionCents: descontoOutros,
    deductionsCents: descontoOutros + descontoVales,
    netCents: disponivel,
    deductions,
    postponedCents: adiado,
  }
}

function int(value: number | undefined | null): number {
  return Number.isFinite(value) ? Math.trunc(value as number) : 0
}
