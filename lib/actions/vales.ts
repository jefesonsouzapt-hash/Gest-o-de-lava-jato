"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { advanceDeductions, auditLogs, employeeAdvances, staff } from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { advancePayoutSchema, advanceSchema, parseForm } from "@/lib/validation/schemas"
import type { FieldErrors } from "@/lib/validation/schemas"
import { remainingBalance } from "@/lib/payroll/calc"
import { parseCurrencyToCents } from "@/lib/locale/money"
import { atualizarStatusDoVale, totalAbatido } from "@/lib/payroll/advance-status"

export type ActionState = { ok: true } | { ok: false; errors: FieldErrors; values?: Record<string, string> } | null

function echoValues(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const chave of new Set(formData.keys())) {
    const valor = formData.get(chave)
    if (typeof valor === "string") valores[chave] = valor
  }
  return valores
}

function revalidarVales() {
  revalidatePath("/vales")
  revalidatePath("/equipe")
  revalidatePath("/folha")
}

/**
 * Concede um vale. Nasce `pendente`: o dinheiro ainda não saiu, então ainda
 * não é dívida do colaborador.
 */
export async function createAdvance(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("vale.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(advanceSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const dados = analisado.data

  const [colaborador] = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(and(eq(staff.id, dados.staffId), eq(staff.companyId, actor.companyId)))
    .limit(1)
  if (!colaborador) return { ok: false, errors: { staffId: "Colaborador não encontrado." } }

  const [criado] = await db
    .insert(employeeAdvances)
    .values({
      companyId: actor.companyId,
      staffId: dados.staffId,
      amountCents: dados.amountCents,
      requestedOn: dados.requestedOn,
      paymentMethod: dados.paymentMethod,
      receiptRef: dados.receiptRef,
      installments: dados.installments,
      firstDeductionMonth: dados.firstDeductionMonth,
      notes: dados.notes,
      status: "pendente",
      createdByUserId: actor.userId,
    })
    .returning({ id: employeeAdvances.id })

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "vale.concedido",
    entity: "employee_advances",
    entityId: String(criado.id),
    after: JSON.stringify({
      staff: colaborador.name,
      amountCents: dados.amountCents,
      installments: dados.installments,
    }),
  })

  revalidarVales()
  return { ok: true }
}

/**
 * Registra a entrega do dinheiro. É aqui que o vale vira dívida — antes disso
 * o saldo devedor do colaborador não muda.
 */
export async function payAdvance(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("vale.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(advancePayoutSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const { id, paymentMethod, receiptRef } = analisado.data

  const [vale] = await db
    .select({ id: employeeAdvances.id, paidAt: employeeAdvances.paidAt, canceledAt: employeeAdvances.canceledAt })
    .from(employeeAdvances)
    .where(and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, actor.companyId)))
    .limit(1)

  if (!vale) return { ok: false, errors: { _: "Vale não encontrado." } }
  if (vale.canceledAt) return { ok: false, errors: { _: "Este vale foi cancelado." } }
  // Sem isto, clicar duas vezes reescreveria a data de pagamento e faria
  // parecer que o dinheiro saiu de novo.
  if (vale.paidAt) return { ok: false, errors: { _: "Este vale já foi pago ao colaborador." } }

  await db
    .update(employeeAdvances)
    .set({ paidAt: new Date(), paymentMethod, receiptRef, status: "pago", updatedAt: new Date() })
    .where(and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, actor.companyId)))

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "vale.pago",
    entity: "employee_advances",
    entityId: String(id),
    after: JSON.stringify({ paymentMethod, receiptRef }),
  })

  revalidarVales()
  return { ok: true }
}

/**
 * Cancela um vale. Só antes de ter parcela descontada: depois disso já entrou
 * numa folha fechada, e desfazer reescreveria um holerite já entregue.
 */
export async function cancelAdvance(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const portao = await tryPermission("vale.gerir")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10)
  if (!Number.isFinite(id)) return { ok: false, error: "Vale inválido." }

  const motivo = String(formData.get("reason") ?? "").trim() || null

  const [vale] = await db
    .select({ id: employeeAdvances.id, canceledAt: employeeAdvances.canceledAt })
    .from(employeeAdvances)
    .where(and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, actor.companyId)))
    .limit(1)
  if (!vale) return { ok: false, error: "Vale não encontrado." }
  if (vale.canceledAt) return { ok: false, error: "Este vale já está cancelado." }

  if ((await totalAbatido(id)) > 0) {
    return {
      ok: false,
      error: "Este vale já teve parcela descontada em folha e não pode ser cancelado.",
    }
  }

  await db
    .update(employeeAdvances)
    .set({ canceledAt: new Date(), cancelReason: motivo, status: "cancelado", updatedAt: new Date() })
    .where(and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, actor.companyId)))

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "vale.cancelado",
    entity: "employee_advances",
    entityId: String(id),
    after: JSON.stringify({ reason: motivo }),
  })

  revalidarVales()
  return { ok: true }
}

/**
 * Desconto avulso, fora do fechamento — quando o colaborador devolve parte do
 * vale em dinheiro, por exemplo.
 */
export async function registerManualDeduction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const portao = await tryPermission("vale.gerir")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10)
  const competencia = String(formData.get("competenceMonth") ?? "").trim()
  const valorTexto = String(formData.get("amountCents") ?? "")

  if (!Number.isFinite(id)) return { ok: false, error: "Vale inválido." }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return { ok: false, error: "Competência inválida." }

  const valor = parseCurrencyToCents(valorTexto)
  if (valor <= 0) return { ok: false, error: "Informe um valor maior que zero." }

  const [vale] = await db
    .select({ amountCents: employeeAdvances.amountCents, staffId: employeeAdvances.staffId, paidAt: employeeAdvances.paidAt })
    .from(employeeAdvances)
    .where(and(eq(employeeAdvances.id, id), eq(employeeAdvances.companyId, actor.companyId)))
    .limit(1)
  if (!vale) return { ok: false, error: "Vale não encontrado." }
  if (!vale.paidAt) return { ok: false, error: "O vale ainda não foi pago ao colaborador." }

  const jaAbatido = await totalAbatido(id)
  const restante = remainingBalance({ amountCents: vale.amountCents, deductedCents: jaAbatido })
  if (restante === 0) return { ok: false, error: "Este vale já está quitado." }

  // Nunca abater mais que o saldo devedor: o colaborador não pode terminar
  // com crédito a favor por causa de um valor digitado a mais.
  const cobrado = Math.min(valor, restante)

  try {
    await db.insert(advanceDeductions).values({
      companyId: actor.companyId,
      advanceId: id,
      staffId: vale.staffId,
      competenceMonth: competencia,
      amountCents: cobrado,
    })
  } catch (erro) {
    // Índice único (vale, competência): já há desconto desse vale nesse mês.
    // Qualquer outro erro sobe: engolir uma falha do banco aqui faria o
    // usuário acreditar que o desconto já existia quando ele nunca foi gravado.
    if (isUniqueViolation(erro)) {
      return { ok: false, error: "Este vale já teve desconto registrado nessa competência." }
    }
    throw erro
  }

  await atualizarStatusDoVale(id)
  revalidarVales()
  return { ok: true }
}
