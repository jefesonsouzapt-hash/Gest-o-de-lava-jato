import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  customers,
  payments,
  staff,
  vehicleInspections,
  vehicles,
  washBays,
  workOrderItems,
  workOrders,
} from "@/lib/db/schema"
import { amountDue, isSettled } from "@/lib/pricing/calc"

export type WorkOrderRow = typeof workOrders.$inferSelect
export type WorkOrderItemRow = typeof workOrderItems.$inferSelect
export type PaymentRow = typeof payments.$inferSelect

export type WorkOrderCard = WorkOrderRow & {
  customerName: string
  customerPhone: string | null
  plate: string
  vehicleModel: string | null
  vehicleCategory: string
  bayName: string | null
  staffName: string | null
  paidCents: number
  dueCents: number
  settled: boolean
}

const ABERTAS = ["aguardando_chegada", "em_fila", "em_lavagem", "acabamento", "detalhe", "controle_qualidade", "pronto_entrega"] as const

/**
 * Ordens com tudo que um cartão do quadro precisa mostrar.
 *
 * O valor pago vem de uma subconsulta em vez de um `join`: com `join`, uma
 * ordem paga em duas formas apareceria duas vezes no quadro.
 */
export async function listWorkOrders(
  companyId: number,
  opts: { status?: string[]; abertas?: boolean; date?: string; desde?: string; ate?: string; limite?: number } = {},
): Promise<WorkOrderCard[]> {
  const filtros = [eq(workOrders.companyId, companyId)]
  if (opts.abertas) filtros.push(inArray(workOrders.status, [...ABERTAS]), isNull(workOrders.canceledAt))
  if (opts.status?.length) filtros.push(inArray(workOrders.status, opts.status as typeof ABERTAS[number][]))
  if (opts.date) filtros.push(eq(workOrders.businessDate, opts.date))
  if (opts.desde) filtros.push(gte(workOrders.businessDate, opts.desde))
  if (opts.ate) filtros.push(lte(workOrders.businessDate, opts.ate))

  const linhas = await db
    .select({
      ordem: workOrders,
      customerName: customers.name,
      customerPhone: customers.phone,
      plate: vehicles.plate,
      vehicleModel: vehicles.model,
      vehicleCategory: vehicles.category,
      bayName: washBays.name,
      staffName: staff.name,
      pago: sql<string>`coalesce((
        select sum(${payments.amountCents}) from ${payments}
        where ${payments.workOrderId} = ${workOrders.id} and ${payments.voidedAt} is null
      ), 0)`,
    })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .leftJoin(washBays, eq(workOrders.bayId, washBays.id))
    .leftJoin(staff, eq(workOrders.assignedStaffId, staff.id))
    .where(and(...filtros))
    .orderBy(desc(workOrders.businessDate), desc(workOrders.id))
    .limit(opts.limite ?? 200)

  return linhas.map(({ ordem, pago, ...resto }) => {
    const paidCents = Number.parseInt(pago, 10) || 0
    const fake = [{ amountCents: paidCents, voidedAt: null }]
    return {
      ...ordem,
      ...resto,
      paidCents,
      dueCents: amountDue(ordem.totalCents, fake),
      settled: paidCents > 0 && isSettled(ordem.totalCents, fake),
    }
  })
}

export type WorkOrderFull = WorkOrderCard & {
  items: WorkOrderItemRow[]
  payments: PaymentRow[]
  hasInspection: boolean
}

export async function getWorkOrder(companyId: number, id: number): Promise<WorkOrderFull | null> {
  const [cartao] = await listWorkOrdersByIds(companyId, [id])
  if (!cartao) return null

  const [itens, recebimentos, vistoria] = await Promise.all([
    db.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, id)).orderBy(asc(workOrderItems.id)),
    db.select().from(payments).where(eq(payments.workOrderId, id)).orderBy(asc(payments.id)),
    db.select({ id: vehicleInspections.id }).from(vehicleInspections).where(eq(vehicleInspections.workOrderId, id)).limit(1),
  ])

  // O saldo é recalculado das linhas de pagamento, não do total agregado: é a
  // tela onde o estorno precisa aparecer na hora.
  return {
    ...cartao,
    items: itens,
    payments: recebimentos,
    hasInspection: vistoria.length > 0,
    paidCents: recebimentos.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountCents, 0),
    dueCents: amountDue(cartao.totalCents, recebimentos),
    settled: isSettled(cartao.totalCents, recebimentos),
  }
}

async function listWorkOrdersByIds(companyId: number, ids: number[]): Promise<WorkOrderCard[]> {
  if (ids.length === 0) return []
  const linhas = await db
    .select({
      ordem: workOrders,
      customerName: customers.name,
      customerPhone: customers.phone,
      plate: vehicles.plate,
      vehicleModel: vehicles.model,
      vehicleCategory: vehicles.category,
      bayName: washBays.name,
      staffName: staff.name,
    })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .leftJoin(washBays, eq(workOrders.bayId, washBays.id))
    .leftJoin(staff, eq(workOrders.assignedStaffId, staff.id))
    .where(and(eq(workOrders.companyId, companyId), inArray(workOrders.id, ids)))

  return linhas.map(({ ordem, ...resto }) => ({
    ...ordem,
    ...resto,
    paidCents: 0,
    dueCents: ordem.totalCents,
    settled: false,
  }))
}

/** Itens de uma ordem, para recalcular os totais depois de mexer na lista. */
export async function orderItems(workOrderId: number): Promise<WorkOrderItemRow[]> {
  return db.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, workOrderId))
}

/**
 * Próximo número de ordem do ano, por empresa: `2026/0001`.
 *
 * A numeração é por empresa e recomeça a cada ano — é o número que o cliente
 * vê no comprovante, e ninguém quer explicar por que a primeira ordem do ano
 * é a 3.482.
 */
export async function nextReference(companyId: number, ano: number): Promise<string> {
  const prefixo = `${ano}/`
  const [linha] = await db
    .select({ maior: sql<string>`coalesce(max(substring(${workOrders.reference} from 6)), '0')` })
    .from(workOrders)
    .where(and(eq(workOrders.companyId, companyId), sql`${workOrders.reference} like ${prefixo + "%"}`))

  const proximo = (Number.parseInt(linha?.maior ?? "0", 10) || 0) + 1
  return `${prefixo}${String(proximo).padStart(4, "0")}`
}

/** Fila de espera e pistas ocupadas, para a tela de recepção. */
export async function bayOccupancy(companyId: number) {
  return db
    .select({
      bayId: washBays.id,
      bayName: washBays.name,
      status: washBays.status,
      orderId: workOrders.id,
      reference: workOrders.reference,
      plate: vehicles.plate,
      orderStatus: workOrders.status,
      startedAt: workOrders.startedAt,
    })
    .from(washBays)
    .leftJoin(
      workOrders,
      and(
        eq(workOrders.bayId, washBays.id),
        inArray(workOrders.status, ["em_lavagem", "acabamento", "detalhe", "controle_qualidade"]),
        isNull(workOrders.canceledAt),
      ),
    )
    .leftJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .where(and(eq(washBays.companyId, companyId), eq(washBays.active, true)))
    .orderBy(asc(washBays.position), asc(washBays.name))
}
