"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import {
  auditLogs,
  customers,
  inspectionDamageKind,
  inspectionDamages,
  servicePrices,
  services,
  staff,
  vehicleInspections,
  vehicles,
  washBays,
  workOrderItems,
  workOrders,
} from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import {
  inspectionSchema,
  parseForm,
  workOrderItemSchema,
  workOrderStatusSchema,
} from "@/lib/validation/schemas"
import { orderItems, nextReference } from "@/lib/queries/ordens"
import { orderTotals, priceForVehicle } from "@/lib/pricing/calc"
import { parseCurrencyToCents } from "@/lib/locale/money"
import { todayISO } from "@/lib/locale/datetime"
import { echoValues, intField, type ActionState, type SimpleResult } from "@/lib/actions/form"

function revalidar(id?: number) {
  revalidatePath("/ordens")
  revalidatePath("/recepcao")
  revalidatePath("/painel")
  revalidatePath("/caixa")
  if (id) revalidatePath(`/ordens/${id}`)
}

/**
 * Recalcula e grava os totais da ordem.
 *
 * Os totais ficam **gravados** e não somados na leitura: o preço do item é uma
 * fotografia do momento da venda, e um mês fechado não pode mudar porque a
 * tabela foi reajustada hoje.
 */
async function recalcularTotais(
  tx: typeof db,
  workOrderId: number,
  issRatePercent: number,
  discountCents?: number,
): Promise<void> {
  const [ordem] = await tx
    .select({ discountCents: workOrders.discountCents })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1)
  if (!ordem) return

  const itens = await tx.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, workOrderId))
  const totais = orderTotals(itens, discountCents ?? ordem.discountCents, issRatePercent)

  await tx
    .update(workOrders)
    .set({
      subtotalCents: totais.subtotalCents,
      discountCents: totais.discountCents,
      totalCents: totais.totalCents,
      issCents: totais.issCents,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, workOrderId))
}

async function aliquotaIss(companyId: number): Promise<number> {
  const { companies } = await import("@/lib/db/schema")
  const [empresa] = await db.select({ issBps: companies.issBps }).from(companies).where(eq(companies.id, companyId)).limit(1)
  return (empresa?.issBps ?? 500) / 100
}

const aberturaSchema = z.object({
  vehicleId: z.coerce.number().int().positive("Escolha o veículo."),
  bayId: z.coerce.number().int().positive().nullable().catch(null),
  assignedStaffId: z.coerce.number().int().positive().nullable().catch(null),
  arrival: z.enum(["agendado", "walk_in"]).default("walk_in"),
  notes: z.string().trim().max(500).transform((v) => v || null).nullable().catch(null),
  /** Ids de serviço marcados na recepção. */
  serviceIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]))
    .transform((v) => v.map((s) => Number.parseInt(s, 10)).filter(Number.isFinite)),
})

/**
 * Abre a ordem de serviço quando o carro chega.
 *
 * Tudo numa transação: uma ordem sem itens e sem número não serve para nada, e
 * o balcão não pode ficar com meia ficha se a segunda escrita falhar.
 */
export async function openWorkOrder(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("recepcao.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(aberturaSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }
  const dados = analisado.data

  // O veículo tem de ser desta empresa — e é dele que sai o cliente e o porte.
  const [veiculo] = await db
    .select({ id: vehicles.id, customerId: vehicles.customerId, category: vehicles.category })
    .from(vehicles)
    .where(and(eq(vehicles.id, dados.vehicleId), eq(vehicles.companyId, actor.companyId)))
    .limit(1)
  if (!veiculo) return { ok: false, errors: { vehicleId: "Veículo não encontrado." }, values: echoValues(formData) }

  if (dados.bayId != null) {
    const [pista] = await db
      .select({ id: washBays.id })
      .from(washBays)
      .where(and(eq(washBays.id, dados.bayId), eq(washBays.companyId, actor.companyId)))
      .limit(1)
    if (!pista) return { ok: false, errors: { bayId: "Pista não encontrada." }, values: echoValues(formData) }
  }

  if (dados.assignedStaffId != null) {
    const [colab] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, dados.assignedStaffId), eq(staff.companyId, actor.companyId)))
      .limit(1)
    if (!colab) return { ok: false, errors: { assignedStaffId: "Colaborador não encontrado." }, values: echoValues(formData) }
  }

  // Serviços marcados, com o preço já resolvido para o porte do carro e a
  // regra de comissão copiada: a ordem guarda o que valia hoje.
  const escolhidos = dados.serviceIds.length
    ? await db
        .select()
        .from(services)
        .where(and(eq(services.companyId, actor.companyId), inArray(services.id, dados.serviceIds), eq(services.active, true)))
    : []

  const tabelas = escolhidos.length
    ? await db.select().from(servicePrices).where(inArray(servicePrices.serviceId, escolhidos.map((s) => s.id)))
    : []

  const iss = await aliquotaIss(actor.companyId)
  const hoje = todayISO()
  const ano = Number(hoje.slice(0, 4))

  let novoId = 0
  try {
    await db.transaction(async (tx) => {
      const referencia = await nextReference(actor.companyId, ano)

      const [criada] = await tx
        .insert(workOrders)
        .values({
          companyId: actor.companyId,
          reference: referencia,
          customerId: veiculo.customerId,
          vehicleId: veiculo.id,
          bayId: dados.bayId,
          assignedStaffId: dados.assignedStaffId,
          createdByUserId: actor.userId,
          status: dados.bayId ? "em_lavagem" : "em_fila",
          arrival: dados.arrival,
          businessDate: hoje,
          notes: dados.notes,
          arrivedAt: new Date(),
          startedAt: dados.bayId ? new Date() : null,
        })
        .returning({ id: workOrders.id })

      novoId = criada.id

      if (escolhidos.length > 0) {
        await tx.insert(workOrderItems).values(
          escolhidos.map((servico) => {
            const tabela = tabelas.find((t) => t.serviceId === servico.id && t.category === veiculo.category)
            return {
              workOrderId: criada.id,
              serviceId: servico.id,
              description: servico.name,
              quantity: 1,
              unitPriceCents: priceForVehicle({
                basePriceCents: servico.basePriceCents,
                category: veiculo.category,
                tablePriceCents: tabela?.priceCents ?? null,
              }),
              commissionBps: servico.commissionBps,
              commissionFixedCents: 0,
            }
          }),
        )
      }

      await recalcularTotais(tx as unknown as typeof db, criada.id, iss)

      await tx.insert(auditLogs).values({
        companyId: actor.companyId,
        userId: actor.userId,
        action: "ordem.aberta",
        entity: "work_orders",
        entityId: String(criada.id),
        after: JSON.stringify({ reference: referencia, servicos: escolhidos.length }),
      })
    })
  } catch (erro) {
    // Duas recepções abrindo ordem no mesmo segundo disputam o mesmo número.
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { _: "Outra ordem foi aberta ao mesmo tempo. Tente de novo." } }
    }
    throw erro
  }

  revalidar(novoId)
  return { ok: true }
}

/** Acrescenta um item à ordem, avulso ou vindo do catálogo. */
export async function addOrderItem(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("ordem.editar")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, errors: { _: "Ordem inválida." } }

  const analisado = parseForm(workOrderItemSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [ordem] = await db
    .select({ id: workOrders.id, status: workOrders.status, canceledAt: workOrders.canceledAt })
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, errors: { _: "Ordem não encontrada." } }
  if (ordem.canceledAt) return { ok: false, errors: { _: "Esta ordem está cancelada." } }
  if (ordem.status === "entregue") {
    // Depois da entrega o cliente já foi embora e já pagou: acrescentar
    // serviço aqui viraria cobrança que ninguém combinou.
    return { ok: false, errors: { _: "Ordem já entregue. Abra uma nova para serviços adicionais." } }
  }

  // A comissão do serviço é copiada agora, e não lida na hora de pagar.
  let commissionBps = 0
  if (analisado.data.serviceId != null) {
    const [servico] = await db
      .select({ bps: services.commissionBps })
      .from(services)
      .where(and(eq(services.id, analisado.data.serviceId), eq(services.companyId, actor.companyId)))
      .limit(1)
    if (!servico) return { ok: false, errors: { serviceId: "Serviço não encontrado." } }
    commissionBps = servico.bps
  }

  const iss = await aliquotaIss(actor.companyId)

  await db.transaction(async (tx) => {
    await tx.insert(workOrderItems).values({
      workOrderId: orderId,
      serviceId: analisado.data.serviceId,
      description: analisado.data.description,
      quantity: analisado.data.quantity,
      unitPriceCents: analisado.data.unitPriceCents,
      commissionBps,
      commissionFixedCents: 0,
    })
    await recalcularTotais(tx as unknown as typeof db, orderId, iss)
  })

  revalidar(orderId)
  return { ok: true }
}

export async function removeOrderItem(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("ordem.editar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const itemId = intField(formData, "itemId")
  const orderId = intField(formData, "workOrderId")
  if (itemId == null || orderId == null) return { ok: false, error: "Item inválido." }

  const [ordem] = await db
    .select({ id: workOrders.id, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, error: "Ordem não encontrada." }
  if (ordem.status === "entregue") return { ok: false, error: "Ordem já entregue." }

  const iss = await aliquotaIss(actor.companyId)

  await db.transaction(async (tx) => {
    await tx
      .delete(workOrderItems)
      .where(and(eq(workOrderItems.id, itemId), eq(workOrderItems.workOrderId, orderId)))
    await recalcularTotais(tx as unknown as typeof db, orderId, iss)
  })

  revalidar(orderId)
  return { ok: true }
}

/** Desconto da ordem, conferido contra o subtotal para nunca virar troco. */
export async function setOrderDiscount(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("ordem.editar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, error: "Ordem inválida." }

  const desconto = parseCurrencyToCents(String(formData.get("discountCents") ?? ""))
  if (desconto < 0) return { ok: false, error: "Desconto inválido." }

  const [ordem] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, error: "Ordem não encontrada." }

  const iss = await aliquotaIss(actor.companyId)
  await db.transaction(async (tx) => {
    await recalcularTotais(tx as unknown as typeof db, orderId, iss, desconto)
  })

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "ordem.desconto",
    entity: "work_orders",
    entityId: String(orderId),
    after: JSON.stringify({ discountCents: desconto }),
  })

  revalidar(orderId)
  return { ok: true }
}

/**
 * Avança (ou volta) a ordem no quadro.
 *
 * Cada estado carimba o seu instante: é o que faz o cronômetro do quadro e o
 * tempo médio de atendimento existirem sem uma tabela de eventos à parte.
 */
export async function setOrderStatus(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("ordem.avancar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, error: "Ordem inválida." }

  const status = workOrderStatusSchema.safeParse(String(formData.get("status") ?? ""))
  if (!status.success) return { ok: false, error: "Situação inválida." }

  const [ordem] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, error: "Ordem não encontrada." }
  if (ordem.canceledAt) return { ok: false, error: "Esta ordem está cancelada." }

  const agora = new Date()
  const mudanca: Partial<typeof workOrders.$inferInsert> = { status: status.data, updatedAt: agora }

  if (status.data === "em_lavagem" && !ordem.startedAt) mudanca.startedAt = agora
  if (status.data === "pronto_entrega" && !ordem.finishedAt) mudanca.finishedAt = agora

  if (status.data === "entregue") {
    // Entregar sem receber deixaria o carro sair com a conta em aberto — é o
    // erro que some com o dinheiro do dia sem ninguém perceber.
    const { payments } = await import("@/lib/db/schema")
    const recebimentos = await db.select().from(payments).where(eq(payments.workOrderId, orderId))
    const { isSettled } = await import("@/lib/pricing/calc")
    if (!isSettled(ordem.totalCents, recebimentos)) {
      return { ok: false, error: "Registre o pagamento antes de entregar o veículo." }
    }
    mudanca.deliveredAt = agora
    if (!ordem.finishedAt) mudanca.finishedAt = agora
  }

  await db
    .update(workOrders)
    .set(mudanca)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))

  if (status.data === "entregue") {
    await db
      .update(customers)
      .set({ lastVisitAt: agora, updatedAt: agora })
      .where(and(eq(customers.id, ordem.customerId), eq(customers.companyId, actor.companyId)))
  }

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "ordem.status",
    entity: "work_orders",
    entityId: String(orderId),
    before: JSON.stringify({ status: ordem.status }),
    after: JSON.stringify({ status: status.data }),
  })

  revalidar(orderId)
  return { ok: true }
}

/** Manda a ordem para uma pista, ou tira dela. */
export async function assignOrder(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("ordem.avancar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, error: "Ordem inválida." }

  const bayId = intField(formData, "bayId")
  const staffId = intField(formData, "assignedStaffId")

  if (bayId != null) {
    const [pista] = await db
      .select({ id: washBays.id })
      .from(washBays)
      .where(and(eq(washBays.id, bayId), eq(washBays.companyId, actor.companyId)))
      .limit(1)
    if (!pista) return { ok: false, error: "Pista não encontrada." }
  }
  if (staffId != null) {
    const [colab] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.companyId, actor.companyId)))
      .limit(1)
    if (!colab) return { ok: false, error: "Colaborador não encontrado." }
  }

  const alterados = await db
    .update(workOrders)
    .set({ bayId, assignedStaffId: staffId, updatedAt: new Date() })
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .returning({ id: workOrders.id })

  if (alterados.length === 0) return { ok: false, error: "Ordem não encontrada." }

  revalidar(orderId)
  return { ok: true }
}

/** Cancela a ordem. Nunca apaga: o número já foi dito ao cliente. */
export async function cancelOrder(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("ordem.cancelar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, error: "Ordem inválida." }
  const motivo = String(formData.get("reason") ?? "").trim() || null

  const [ordem] = await db
    .select({ id: workOrders.id, canceledAt: workOrders.canceledAt, totalCents: workOrders.totalCents })
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, error: "Ordem não encontrada." }
  if (ordem.canceledAt) return { ok: false, error: "Esta ordem já está cancelada." }

  const { payments } = await import("@/lib/db/schema")
  const recebidos = await db.select().from(payments).where(eq(payments.workOrderId, orderId))
  if (recebidos.some((p) => !p.voidedAt)) {
    return { ok: false, error: "Estorne os pagamentos antes de cancelar a ordem." }
  }

  await db
    .update(workOrders)
    .set({ status: "cancelada", canceledAt: new Date(), cancelReason: motivo, updatedAt: new Date() })
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "ordem.cancelada",
    entity: "work_orders",
    entityId: String(orderId),
    after: JSON.stringify({ reason: motivo }),
  })

  revalidar(orderId)
  return { ok: true }
}

/**
 * Vistoria de entrada: o estado do carro quando chegou.
 *
 * É o que protege o lava jato de uma reclamação por um risco que já estava
 * lá. Uma por ordem — índice único no banco.
 */
export async function saveInspection(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("vistoria.registrar")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, errors: { _: "Ordem inválida." } }

  const analisado = parseForm(inspectionSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [ordem] = await db
    .select({ id: workOrders.id, vehicleId: workOrders.vehicleId })
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, errors: { _: "Ordem não encontrada." } }

  // Avarias marcadas na silhueta do carro, no formato `area:tipo`.
  const avarias = formData
    .getAll("damage")
    .map((v) => String(v).split(":"))
    .filter((p) => p.length === 2)
    .map(([area, kind]) => ({ area, kind }))

  // Os tipos vêm do próprio enum do banco: uma avaria nova não pode entrar
  // aqui sem existir lá.
  const tiposValidos = inspectionDamageKind.enumValues

  try {
    await db.transaction(async (tx) => {
      const [vistoria] = await tx
        .insert(vehicleInspections)
        .values({
          companyId: actor.companyId,
          workOrderId: orderId,
          vehicleId: ordem.vehicleId,
          ...analisado.data,
        })
        .returning({ id: vehicleInspections.id })

      const validas = avarias.filter((a): a is { area: string; kind: (typeof tiposValidos)[number] } =>
        (tiposValidos as readonly string[]).includes(a.kind),
      )
      if (validas.length > 0) {
        await tx.insert(inspectionDamages).values(
          validas.map((a) => ({ inspectionId: vistoria.id, kind: a.kind, area: a.area })),
        )
      }
    })
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { _: "Esta ordem já tem vistoria registrada." } }
    }
    throw erro
  }

  revalidar(orderId)
  return { ok: true }
}
