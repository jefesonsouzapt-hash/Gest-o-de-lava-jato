"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  advanceDeductions,
  auditLogs,
  employeeAdvances,
  payrollEntries,
  payrollPeriods,
  staff,
} from "@/lib/db/schema"
import { requirePermission } from "@/lib/auth/guard"
import { competenceMonthSchema, parseForm } from "@/lib/validation/schemas"
import type { FieldErrors } from "@/lib/validation/schemas"
import { closePayroll, splitInstallments } from "@/lib/payroll/calc"
import { advancesDueIn, commissionTotals, getPayrollPeriod } from "@/lib/queries/equipe"

export type ActionState = { ok: true } | { ok: false; errors: FieldErrors } | null

// A competência é o único campo do formulário de fechamento.
const payrollFormSchema = z.object({ competenceMonth: competenceMonthSchema })

function revalidarFolha() {
  revalidatePath("/folha")
  revalidatePath("/vales")
  revalidatePath("/equipe")
}

export type PayrollPreviewLine = {
  staffId: number
  staffName: string
  jobTitle: string
  baseSalaryCents: number
  commissionCents: number
  servicesCount: number
  advanceDeductionCents: number
  netCents: number
  postponedCents: number
  deductions: { advanceId: number; amountCents: number }[]
}

/**
 * Simula o fechamento sem gravar nada.
 *
 * É o que a tela mostra antes de o dono confirmar: os mesmos números que serão
 * congelados, calculados pela mesma função — a prévia e o fechamento nunca
 * podem divergir.
 *
 * Num arquivo "use server" toda função exportada é chamável pelo navegador,
 * por isso a empresa vem do ator autenticado e nunca de um parâmetro: receber
 * `companyId` de fora deixaria qualquer um ler a folha de outro lava jato.
 */
export async function previewPayroll(competenceMonth: string): Promise<PayrollPreviewLine[]> {
  const actor = await requirePermission("folha.ver")
  return calcularPrevia(actor.companyId, competenceMonth)
}

/** Cálculo puro da prévia, com a empresa já conferida por quem chamou. */
async function calcularPrevia(
  companyId: number,
  competenceMonth: string,
): Promise<PayrollPreviewLine[]> {
  const [equipe, comissoes, vales] = await Promise.all([
    db
      .select()
      .from(staff)
      .where(and(eq(staff.companyId, companyId), eq(staff.active, true))),
    commissionTotals(companyId, competenceMonth),
    advancesDueIn(companyId, competenceMonth),
  ])

  return equipe.map((colaborador) => {
    const comissao = comissoes.get(colaborador.id)

    const valesDoColaborador = vales
      .filter((v) => v.staffId === colaborador.id)
      .map((v) => ({
        id: v.id,
        installmentCents: splitInstallments(v.amountCents, v.installments)[0] ?? 0,
        remainingCents: v.remainingCents,
      }))

    const resultado = closePayroll({
      baseSalaryCents: colaborador.baseSalaryCents,
      commissionCents: comissao?.amountCents ?? 0,
      advances: valesDoColaborador,
    })

    return {
      staffId: colaborador.id,
      staffName: colaborador.name,
      jobTitle: colaborador.jobTitle,
      baseSalaryCents: colaborador.baseSalaryCents,
      commissionCents: comissao?.amountCents ?? 0,
      servicesCount: comissao?.services ?? 0,
      advanceDeductionCents: resultado.advanceDeductionCents,
      netCents: resultado.netCents,
      postponedCents: resultado.postponedCents,
      deductions: resultado.deductions,
    }
  })
}

/**
 * Fecha a folha do mês: congela um holerite por colaborador e grava as
 * parcelas de vale descontadas.
 *
 * Tudo numa transação. Gravar o holerite sem gravar o desconto do vale
 * deixaria o colaborador pagando de novo no mês seguinte por uma parcela que
 * já saiu do salário dele.
 */
export async function closePayrollPeriod(_estado: ActionState, formData: FormData): Promise<ActionState> {
  // Fechar é do dono: é o ato que transforma apuração em obrigação de pagamento.
  const actor = await requirePermission("folha.fechar")

  const analisado = parseForm(payrollFormSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors }

  const { competenceMonth } = analisado.data

  const existente = await getPayrollPeriod(actor.companyId, competenceMonth)
  if (existente && existente.status !== "aberta") {
    return { ok: false, errors: { _: "Esta competência já está fechada." } }
  }

  const linhas = await calcularPrevia(actor.companyId, competenceMonth)
  if (linhas.length === 0) {
    return { ok: false, errors: { _: "Não há colaboradores ativos para fechar a folha." } }
  }

  await db.transaction(async (tx) => {
    const [periodo] = await tx
      .insert(payrollPeriods)
      .values({
        companyId: actor.companyId,
        competenceMonth,
        status: "fechada",
        closedAt: new Date(),
        closedByUserId: actor.userId,
      })
      .onConflictDoUpdate({
        target: [payrollPeriods.companyId, payrollPeriods.competenceMonth],
        set: { status: "fechada", closedAt: new Date(), closedByUserId: actor.userId, updatedAt: new Date() },
      })
      .returning({ id: payrollPeriods.id })

    for (const linha of linhas) {
      const [holerite] = await tx
        .insert(payrollEntries)
        .values({
          companyId: actor.companyId,
          payrollPeriodId: periodo.id,
          staffId: linha.staffId,
          baseSalaryCents: linha.baseSalaryCents,
          commissionCents: linha.commissionCents,
          advanceDeductionCents: linha.advanceDeductionCents,
          netCents: linha.netCents,
          servicesCount: linha.servicesCount,
        })
        .onConflictDoUpdate({
          target: [payrollEntries.payrollPeriodId, payrollEntries.staffId],
          set: {
            baseSalaryCents: linha.baseSalaryCents,
            commissionCents: linha.commissionCents,
            advanceDeductionCents: linha.advanceDeductionCents,
            netCents: linha.netCents,
            servicesCount: linha.servicesCount,
          },
        })
        .returning({ id: payrollEntries.id })

      for (const desconto of linha.deductions) {
        await tx
          .insert(advanceDeductions)
          .values({
            companyId: actor.companyId,
            advanceId: desconto.advanceId,
            staffId: linha.staffId,
            payrollEntryId: holerite.id,
            competenceMonth,
            amountCents: desconto.amountCents,
          })
          // Índice único (vale, competência): refechar a mesma folha atualiza a
          // parcela em vez de cobrar o vale duas vezes.
          .onConflictDoUpdate({
            target: [advanceDeductions.advanceId, advanceDeductions.competenceMonth],
            set: { amountCents: desconto.amountCents, payrollEntryId: holerite.id },
          })
      }
    }

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "folha.fechada",
      entity: "payroll_periods",
      entityId: String(periodo.id),
      after: JSON.stringify({
        competenceMonth,
        colaboradores: linhas.length,
        liquidoTotal: linhas.reduce((s, l) => s + l.netCents, 0),
      }),
    })
  })

  // Atualiza a situação de cada vale tocado pelo fechamento.
  const { atualizarStatus } = await import("@/lib/actions/vales")
  const valesTocados = new Set(linhas.flatMap((l) => l.deductions.map((d) => d.advanceId)))
  for (const advanceId of valesTocados) await atualizarStatus(advanceId)

  revalidarFolha()
  return { ok: true }
}

/** Marca a folha como paga, depois de o dinheiro sair. */
export async function markPayrollPaid(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("folha.fechar")

  const competencia = String(formData.get("competenceMonth") ?? "").trim()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return { ok: false, error: "Competência inválida." }

  const periodo = await getPayrollPeriod(actor.companyId, competencia)
  if (!periodo) return { ok: false, error: "Folha não encontrada." }
  if (periodo.status === "aberta") return { ok: false, error: "Feche a folha antes de marcar como paga." }
  if (periodo.status === "paga") return { ok: false, error: "Esta folha já está marcada como paga." }

  await db
    .update(payrollPeriods)
    .set({ status: "paga", paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(payrollPeriods.id, periodo.id), eq(payrollPeriods.companyId, actor.companyId)))

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "folha.paga",
    entity: "payroll_periods",
    entityId: String(periodo.id),
  })

  revalidarFolha()
  return { ok: true }
}

/**
 * Reabre uma folha fechada mas ainda não paga.
 *
 * Uma folha já paga nunca reabre: o dinheiro saiu e o holerite foi entregue.
 */
export async function reopenPayrollPeriod(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("folha.fechar")

  const competencia = String(formData.get("competenceMonth") ?? "").trim()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return { ok: false, error: "Competência inválida." }

  const periodo = await getPayrollPeriod(actor.companyId, competencia)
  if (!periodo) return { ok: false, error: "Folha não encontrada." }
  if (periodo.status === "paga") {
    return { ok: false, error: "Esta folha já foi paga e não pode ser reaberta." }
  }

  await db.transaction(async (tx) => {
    // Devolve as parcelas de vale ao saldo devedor antes de reabrir; sem isso
    // o colaborador continuaria "devendo menos" por um desconto desfeito.
    await tx
      .delete(advanceDeductions)
      .where(
        and(
          eq(advanceDeductions.companyId, actor.companyId),
          eq(advanceDeductions.competenceMonth, competencia),
        ),
      )
    await tx
      .delete(payrollEntries)
      .where(
        and(eq(payrollEntries.companyId, actor.companyId), eq(payrollEntries.payrollPeriodId, periodo.id)),
      )
    await tx
      .update(payrollPeriods)
      .set({ status: "aberta", closedAt: null, closedByUserId: null, updatedAt: new Date() })
      .where(eq(payrollPeriods.id, periodo.id))

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "folha.reaberta",
      entity: "payroll_periods",
      entityId: String(periodo.id),
      before: JSON.stringify({ status: periodo.status }),
    })
  })

  const { atualizarStatus } = await import("@/lib/actions/vales")
  const vales = await db
    .select({ id: employeeAdvances.id })
    .from(employeeAdvances)
    .where(eq(employeeAdvances.companyId, actor.companyId))
  for (const vale of vales) await atualizarStatus(vale.id)

  revalidarFolha()
  return { ok: true }
}

