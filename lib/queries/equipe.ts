import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  advanceDeductions,
  commissionEntries,
  employeeAdvances,
  payrollEntries,
  payrollPeriods,
  serviceCategories,
  staff,
  staffCommissionRules,
} from "@/lib/db/schema"
import { advanceStatusOf, nextInstallmentCents, remainingBalance } from "@/lib/payroll/calc"

export type StaffRow = typeof staff.$inferSelect
export type AdvanceRow = typeof employeeAdvances.$inferSelect

// --- Colaboradores -----------------------------------------------------------

export async function listStaff(companyId: number, incluirInativos = false): Promise<StaffRow[]> {
  const filtros = [eq(staff.companyId, companyId)]
  if (!incluirInativos) filtros.push(eq(staff.active, true))

  return db
    .select()
    .from(staff)
    .where(and(...filtros))
    .orderBy(asc(staff.name))
}

export async function getStaff(companyId: number, id: number): Promise<StaffRow | null> {
  const [linha] = await db
    .select()
    .from(staff)
    // O companyId no WHERE e não só o id: sem ele, trocar o número na barra de
    // endereço abriria a ficha de um colaborador de outro lava jato.
    .where(and(eq(staff.id, id), eq(staff.companyId, companyId)))
    .limit(1)
  return linha ?? null
}

export type CommissionRuleRow = typeof staffCommissionRules.$inferSelect & { categoryName: string | null }

export async function listCommissionRules(companyId: number, staffId: number): Promise<CommissionRuleRow[]> {
  const linhas = await db
    .select({
      id: staffCommissionRules.id,
      companyId: staffCommissionRules.companyId,
      staffId: staffCommissionRules.staffId,
      serviceCategoryId: staffCommissionRules.serviceCategoryId,
      kind: staffCommissionRules.kind,
      bps: staffCommissionRules.bps,
      fixedCents: staffCommissionRules.fixedCents,
      createdAt: staffCommissionRules.createdAt,
      categoryName: serviceCategories.name,
    })
    .from(staffCommissionRules)
    .leftJoin(serviceCategories, eq(staffCommissionRules.serviceCategoryId, serviceCategories.id))
    .where(and(eq(staffCommissionRules.companyId, companyId), eq(staffCommissionRules.staffId, staffId)))
    .orderBy(asc(serviceCategories.name))

  return linhas as CommissionRuleRow[]
}

// --- Vales e saldo devedor ---------------------------------------------------

export type AdvanceWithBalance = AdvanceRow & {
  staffName: string
  deductedCents: number
  /** Quantas parcelas já saíram em folhas anteriores. */
  deductionsCount: number
  remainingCents: number
  installmentCents: number
  derivedStatus: ReturnType<typeof advanceStatusOf>
}

/**
 * Vales com o saldo devedor **calculado** a partir das parcelas efetivamente
 * descontadas. O saldo nunca é lido de um campo: um estorno de folha faria
 * um campo gravado sair do lugar sem ninguém perceber.
 */
export async function listAdvances(
  companyId: number,
  opts: { staffId?: number; incluirQuitados?: boolean } = {},
): Promise<AdvanceWithBalance[]> {
  const filtros = [eq(employeeAdvances.companyId, companyId)]
  if (opts.staffId != null) filtros.push(eq(employeeAdvances.staffId, opts.staffId))

  const linhas = await db
    .select({
      vale: employeeAdvances,
      staffName: staff.name,
      abatido: sql<string>`coalesce((
        select sum(${advanceDeductions.amountCents})
        from ${advanceDeductions}
        where ${advanceDeductions.advanceId} = ${employeeAdvances.id}
      ), 0)`,
      parcelasFeitas: sql<string>`coalesce((
        select count(*)
        from ${advanceDeductions}
        where ${advanceDeductions.advanceId} = ${employeeAdvances.id}
      ), 0)`,
    })
    .from(employeeAdvances)
    .innerJoin(staff, eq(employeeAdvances.staffId, staff.id))
    .where(and(...filtros))
    .orderBy(desc(employeeAdvances.requestedOn), desc(employeeAdvances.id))

  const resultado = linhas.map(({ vale, staffName, abatido, parcelasFeitas }) => {
    const deductedCents = Number.parseInt(abatido, 10) || 0
    const deductionsCount = Number.parseInt(parcelasFeitas, 10) || 0
    const restante = remainingBalance({ amountCents: vale.amountCents, deductedCents })
    return {
      ...vale,
      staffName,
      deductedCents,
      deductionsCount,
      remainingCents: restante,
      // A parcela é sempre recalculada, nunca guardada: assim o centavo de
      // resto cai mesmo na última e o vale fecha no número de parcelas
      // combinado.
      installmentCents: nextInstallmentCents({
        amountCents: vale.amountCents,
        installments: vale.installments,
        deductedCents,
        deductionsCount,
      }),
      derivedStatus: advanceStatusOf({
        amountCents: vale.amountCents,
        deductedCents,
        paidAt: vale.paidAt,
        canceledAt: vale.canceledAt,
      }),
    }
  })

  return opts.incluirQuitados ? resultado : resultado.filter((v) => v.derivedStatus !== "cancelado")
}

export type AdvanceDeductionRow = typeof advanceDeductions.$inferSelect

/** Histórico de quando cada parcela de um vale foi descontada. */
export async function listAdvanceDeductions(
  companyId: number,
  advanceId: number,
): Promise<AdvanceDeductionRow[]> {
  return db
    .select()
    .from(advanceDeductions)
    .where(and(eq(advanceDeductions.companyId, companyId), eq(advanceDeductions.advanceId, advanceId)))
    .orderBy(asc(advanceDeductions.competenceMonth))
}

export type StaffDebt = {
  staffId: number
  staffName: string
  /** Total já entregue ao colaborador em vales ainda não quitados. */
  totalCents: number
  deductedCents: number
  remainingCents: number
  openAdvances: number
}

/** Painel de saldo devedor: quanto cada colaborador ainda deve à empresa. */
export async function staffDebts(companyId: number): Promise<StaffDebt[]> {
  const vales = await listAdvances(companyId)
  const porColaborador = new Map<number, StaffDebt>()

  for (const vale of vales) {
    // Vale ainda não entregue não é dívida: o dinheiro não saiu.
    if (vale.derivedStatus === "pendente" || vale.derivedStatus === "cancelado") continue

    const atual = porColaborador.get(vale.staffId) ?? {
      staffId: vale.staffId,
      staffName: vale.staffName,
      totalCents: 0,
      deductedCents: 0,
      remainingCents: 0,
      openAdvances: 0,
    }

    atual.totalCents += vale.amountCents
    atual.deductedCents += vale.deductedCents
    atual.remainingCents += vale.remainingCents
    if (vale.remainingCents > 0) atual.openAdvances += 1
    porColaborador.set(vale.staffId, atual)
  }

  return [...porColaborador.values()].sort((a, b) => b.remainingCents - a.remainingCents)
}

/**
 * Vales que devem ser descontados numa competência, do mais antigo para o mais
 * novo — a ordem em que o fechamento os abate.
 */
export async function advancesDueIn(companyId: number, competenceMonth: string) {
  const vales = await listAdvances(companyId)
  return vales
    .filter(
      (v) =>
        (v.derivedStatus === "pago" || v.derivedStatus === "parcialmente_abatido") &&
        v.remainingCents > 0 &&
        // Um vale concedido para começar a descontar em maio não entra na
        // folha de abril.
        v.firstDeductionMonth <= competenceMonth,
    )
    .sort((a, b) => a.requestedOn.localeCompare(b.requestedOn) || a.id - b.id)
}

// --- Comissões ---------------------------------------------------------------

export type CommissionTotal = { staffId: number; amountCents: number; services: number }

/** Comissão apurada por colaborador numa competência, já sem os estornos. */
export async function commissionTotals(
  companyId: number,
  competenceMonth: string,
): Promise<Map<number, CommissionTotal>> {
  const linhas = await db
    .select({
      staffId: commissionEntries.staffId,
      total: sql<string>`coalesce(sum(${commissionEntries.amountCents}), 0)`,
      servicos: sql<string>`count(*)`,
    })
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.companyId, companyId),
        eq(commissionEntries.competenceMonth, competenceMonth),
        // Comissão estornada não entra na folha: o pagamento da ordem foi
        // desfeito, então o ganho também.
        isNull(commissionEntries.reversedAt),
      ),
    )
    .groupBy(commissionEntries.staffId)

  const mapa = new Map<number, CommissionTotal>()
  for (const linha of linhas) {
    mapa.set(linha.staffId, {
      staffId: linha.staffId,
      amountCents: Number.parseInt(linha.total, 10) || 0,
      services: Number.parseInt(linha.servicos, 10) || 0,
    })
  }
  return mapa
}

/** Extrato de comissões do colaborador no mês, para ele conferir linha a linha. */
export async function listCommissions(companyId: number, staffId: number, competenceMonth: string) {
  return db
    .select()
    .from(commissionEntries)
    .where(
      and(
        eq(commissionEntries.companyId, companyId),
        eq(commissionEntries.staffId, staffId),
        eq(commissionEntries.competenceMonth, competenceMonth),
      ),
    )
    .orderBy(desc(commissionEntries.createdAt))
}

// --- Folha -------------------------------------------------------------------

export type PayrollPeriodRow = typeof payrollPeriods.$inferSelect
export type PayrollEntryRow = typeof payrollEntries.$inferSelect

export async function getPayrollPeriod(
  companyId: number,
  competenceMonth: string,
): Promise<PayrollPeriodRow | null> {
  const [linha] = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(eq(payrollPeriods.companyId, companyId), eq(payrollPeriods.competenceMonth, competenceMonth)),
    )
    .limit(1)
  return linha ?? null
}

export async function listPayrollEntries(
  companyId: number,
  periodId: number,
): Promise<(PayrollEntryRow & { staffName: string; jobTitle: string })[]> {
  const linhas = await db
    .select({ entrada: payrollEntries, staffName: staff.name, jobTitle: staff.jobTitle })
    .from(payrollEntries)
    .innerJoin(staff, eq(payrollEntries.staffId, staff.id))
    .where(and(eq(payrollEntries.companyId, companyId), eq(payrollEntries.payrollPeriodId, periodId)))
    .orderBy(asc(staff.name))

  return linhas.map(({ entrada, staffName, jobTitle }) => ({ ...entrada, staffName, jobTitle }))
}

export async function listPayrollPeriods(companyId: number, limite = 12): Promise<PayrollPeriodRow[]> {
  return db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.companyId, companyId))
    .orderBy(desc(payrollPeriods.competenceMonth))
    .limit(limite)
}
