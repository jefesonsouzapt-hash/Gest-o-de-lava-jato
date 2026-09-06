"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { auditLogs, customers, vehicles, workOrders } from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { customerSchema, parseForm, vehicleSchema } from "@/lib/validation/schemas"
import { echoValues, intField, type ActionState, type SimpleResult } from "@/lib/actions/form"

const PLACA_DUPLICADA = "Já existe um veículo com esta placa nesta empresa."

function revalidar() {
  revalidatePath("/clientes")
  revalidatePath("/veiculos")
  revalidatePath("/recepcao")
}

export async function createCustomer(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("cliente.editar")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(customerSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [criado] = await db
    .insert(customers)
    .values({ ...analisado.data, companyId: actor.companyId })
    .returning({ id: customers.id })

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "cliente.criado",
    entity: "customers",
    entityId: String(criado.id),
    after: JSON.stringify({ name: analisado.data.name }),
  })

  revalidar()
  return { ok: true }
}

export async function updateCustomer(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("cliente.editar")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const id = intField(formData, "id")
  if (id == null) return { ok: false, errors: { _: "Cliente inválido." } }

  const analisado = parseForm(customerSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const alterados = await db
    .update(customers)
    .set({ ...analisado.data, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.companyId, actor.companyId)))
    .returning({ id: customers.id })

  if (alterados.length === 0) return { ok: false, errors: { _: "Cliente não encontrado." } }

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "cliente.atualizado",
    entity: "customers",
    entityId: String(id),
    after: JSON.stringify({ name: analisado.data.name }),
  })

  revalidar()
  revalidatePath(`/clientes/${id}`)
  return { ok: true }
}

/**
 * Arquiva um cliente em vez de apagar.
 *
 * O histórico de ordens aponta para ele: apagar deixaria faturamento órfão e
 * quebraria o relatório do mês passado.
 */
export async function archiveCustomer(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("cliente.editar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = intField(formData, "id")
  if (id == null) return { ok: false, error: "Cliente inválido." }

  const arquivar = String(formData.get("archive") ?? "1") === "1"

  const alterados = await db
    .update(customers)
    .set({ archivedAt: arquivar ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.companyId, actor.companyId)))
    .returning({ id: customers.id })

  if (alterados.length === 0) return { ok: false, error: "Cliente não encontrado." }

  revalidar()
  return { ok: true }
}

export async function saveVehicle(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("cliente.editar")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(vehicleSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  // O dono do veículo tem de ser cliente desta empresa: sem esta conferência,
  // um id de cliente digitado à mão prenderia o carro no cadastro do vizinho.
  const [dono] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, analisado.data.customerId), eq(customers.companyId, actor.companyId)))
    .limit(1)
  if (!dono) return { ok: false, errors: { customerId: "Cliente não encontrado." }, values: echoValues(formData) }

  const id = intField(formData, "id")

  try {
    if (id == null) {
      await db.insert(vehicles).values({ ...analisado.data, companyId: actor.companyId })
    } else {
      const alterados = await db
        .update(vehicles)
        .set({ ...analisado.data, updatedAt: new Date() })
        .where(and(eq(vehicles.id, id), eq(vehicles.companyId, actor.companyId)))
        .returning({ id: vehicles.id })
      if (alterados.length === 0) return { ok: false, errors: { _: "Veículo não encontrado." } }
    }
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { plate: PLACA_DUPLICADA }, values: echoValues(formData) }
    }
    throw erro
  }

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: id == null ? "veiculo.criado" : "veiculo.atualizado",
    entity: "vehicles",
    entityId: String(id ?? ""),
    after: JSON.stringify({ plate: analisado.data.plate }),
  })

  revalidar()
  revalidatePath(`/clientes/${analisado.data.customerId}`)
  return { ok: true }
}

/** Só apaga um veículo que nunca entrou em ordem — senão o histórico fica órfão. */
export async function deleteVehicle(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("cliente.editar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = intField(formData, "id")
  if (id == null) return { ok: false, error: "Veículo inválido." }

  const [usado] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.companyId, actor.companyId), eq(workOrders.vehicleId, id)))
    .limit(1)

  if (usado) {
    return { ok: false, error: "Este veículo já tem ordem de serviço e não pode ser apagado." }
  }

  const apagados = await db
    .delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.companyId, actor.companyId)))
    .returning({ id: vehicles.id })

  if (apagados.length === 0) return { ok: false, error: "Veículo não encontrado." }

  revalidar()
  return { ok: true }
}
