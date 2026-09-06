"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, staff, staffCommissionRules } from "@/lib/db/schema"
import { requirePermission } from "@/lib/auth/guard"
import { parseForm, resolvePixKind, staffCommissionRuleSchema, staffSchema } from "@/lib/validation/schemas"
import type { FieldErrors } from "@/lib/validation/schemas"

export type ActionState = { ok: true } | { ok: false; errors: FieldErrors; values?: Record<string, string> } | null

/** Devolve o que foi digitado, para o formulário não esvaziar num erro. */
function echoValues(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const chave of new Set(formData.keys())) {
    const valor = formData.get(chave)
    if (typeof valor === "string") valores[chave] = valor
  }
  return valores
}

function revalidarEquipe(staffId?: number) {
  revalidatePath("/equipe")
  revalidatePath("/vales")
  revalidatePath("/folha")
  if (staffId) revalidatePath(`/equipe/${staffId}`)
}

/** O drizzle põe o erro do driver em `cause`; o código não fica na superfície. */
function codigoPostgres(erro: unknown): string | null {
  let atual = erro
  for (let i = 0; i < 5; i++) {
    if (typeof atual !== "object" || atual === null) return null
    const codigo = (atual as { code?: unknown }).code
    if (typeof codigo === "string") return codigo
    atual = (atual as { cause?: unknown }).cause
  }
  return null
}

const CPF_DUPLICADO = "Já existe um colaborador com este CPF."

export async function createStaff(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("equipe.gerir")

  const analisado = parseForm(staffSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const dados = analisado.data

  try {
    const [criado] = await db
      .insert(staff)
      .values({
        companyId: actor.companyId,
        ...dados,
        pixKind: resolvePixKind(dados.pixKey),
      })
      .returning({ id: staff.id })

    await db.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "colaborador.criado",
      entity: "staff",
      entityId: String(criado.id),
      after: JSON.stringify({ name: dados.name, jobTitle: dados.jobTitle }),
    })
  } catch (erro) {
    if (codigoPostgres(erro) === "23505") {
      return { ok: false, errors: { cpf: CPF_DUPLICADO }, values: echoValues(formData) }
    }
    throw erro
  }

  revalidarEquipe()
  return { ok: true }
}

export async function updateStaff(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("equipe.gerir")

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10)
  if (!Number.isFinite(id)) return { ok: false, errors: { _: "Colaborador inválido." } }

  const analisado = parseForm(staffSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const dados = analisado.data

  const [antes] = await db
    .select({ name: staff.name, baseSalaryCents: staff.baseSalaryCents, status: staff.status })
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.companyId, actor.companyId)))
    .limit(1)
  if (!antes) return { ok: false, errors: { _: "Colaborador não encontrado." } }

  try {
    await db
      .update(staff)
      .set({ ...dados, pixKind: resolvePixKind(dados.pixKey), updatedAt: new Date() })
      // O companyId no WHERE impede editar colaborador de outra empresa pelo id.
      .where(and(eq(staff.id, id), eq(staff.companyId, actor.companyId)))
  } catch (erro) {
    if (codigoPostgres(erro) === "23505") {
      return { ok: false, errors: { cpf: CPF_DUPLICADO }, values: echoValues(formData) }
    }
    throw erro
  }

  // Salário e situação mexem em dinheiro e em direito: ficam registrados.
  if (antes.baseSalaryCents !== dados.baseSalaryCents || antes.status !== dados.status) {
    await db.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "colaborador.alterado",
      entity: "staff",
      entityId: String(id),
      before: JSON.stringify({ baseSalaryCents: antes.baseSalaryCents, status: antes.status }),
      after: JSON.stringify({ baseSalaryCents: dados.baseSalaryCents, status: dados.status }),
    })
  }

  revalidarEquipe(id)
  return { ok: true }
}

/**
 * Desativar tira o colaborador das listas do dia a dia. Nunca há exclusão:
 * comissão apurada e vale descontado continuam ligados a ele.
 */
export async function setStaffActive(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("equipe.gerir")

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10)
  if (!Number.isFinite(id)) return { ok: false, error: "Colaborador inválido." }

  const active = String(formData.get("active") ?? "") === "true"

  await db
    .update(staff)
    .set({ active, status: active ? "ativo" : "inativo", updatedAt: new Date() })
    .where(and(eq(staff.id, id), eq(staff.companyId, actor.companyId)))

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: active ? "colaborador.reativado" : "colaborador.desativado",
    entity: "staff",
    entityId: String(id),
  })

  revalidarEquipe(id)
  return { ok: true }
}

// --- Regras de comissão por categoria ---------------------------------------

export async function saveCommissionRule(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("equipe.gerir")

  const analisado = parseForm(staffCommissionRuleSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const dados = analisado.data

  // O colaborador precisa ser desta empresa: o id vem do formulário.
  const [dono] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.id, dados.staffId), eq(staff.companyId, actor.companyId)))
    .limit(1)
  if (!dono) return { ok: false, errors: { staffId: "Colaborador não encontrado." } }

  await db
    .insert(staffCommissionRules)
    .values({ companyId: actor.companyId, ...dados })
    .onConflictDoUpdate({
      target: [staffCommissionRules.staffId, staffCommissionRules.serviceCategoryId],
      set: { kind: dados.kind, bps: dados.bps, fixedCents: dados.fixedCents },
    })

  revalidarEquipe(dados.staffId)
  return { ok: true }
}

export async function deleteCommissionRule(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("equipe.gerir")

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10)
  if (!Number.isFinite(id)) return { ok: false, error: "Regra inválida." }

  const [regra] = await db
    .select({ staffId: staffCommissionRules.staffId })
    .from(staffCommissionRules)
    .where(and(eq(staffCommissionRules.id, id), eq(staffCommissionRules.companyId, actor.companyId)))
    .limit(1)
  if (!regra) return { ok: false, error: "Regra não encontrada." }

  await db
    .delete(staffCommissionRules)
    .where(and(eq(staffCommissionRules.id, id), eq(staffCommissionRules.companyId, actor.companyId)))

  revalidarEquipe(regra.staffId)
  return { ok: true }
}
