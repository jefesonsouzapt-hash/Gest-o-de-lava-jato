import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { customers, payments, services, staff, vehicles, workOrderItems, workOrders } from "@/lib/db/schema"

/**
 * Números do período.
 *
 * Só ordens **não canceladas** entram no faturamento, e o dinheiro sai dos
 * pagamentos, não do total da ordem: uma ficha fechada e não paga não é
 * receita.
 */
export async function revenueSummary(companyId: number, desde: string, ate: string) {
  const [faturamento] = await db
    .select({
      ordens: sql<string>`count(*)`,
      totalCents: sql<string>`coalesce(sum(${workOrders.totalCents}), 0)`,
      descontoCents: sql<string>`coalesce(sum(${workOrders.discountCents}), 0)`,
      issCents: sql<string>`coalesce(sum(${workOrders.issCents}), 0)`,
      ticketCents: sql<string>`coalesce(round(avg(${workOrders.totalCents})), 0)`,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.companyId, companyId),
        isNull(workOrders.canceledAt),
        gte(workOrders.businessDate, desde),
        lte(workOrders.businessDate, ate),
      ),
    )

  const [recebido] = await db
    .select({ recebidoCents: sql<string>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .innerJoin(workOrders, eq(payments.workOrderId, workOrders.id))
    .where(
      and(
        eq(payments.companyId, companyId),
        isNull(payments.voidedAt),
        gte(workOrders.businessDate, desde),
        lte(workOrders.businessDate, ate),
      ),
    )

  const n = (v?: string) => Number.parseInt(v ?? "0", 10) || 0
  return {
    orders: n(faturamento?.ordens),
    totalCents: n(faturamento?.totalCents),
    discountCents: n(faturamento?.descontoCents),
    issCents: n(faturamento?.issCents),
    ticketCents: n(faturamento?.ticketCents),
    receivedCents: n(recebido?.recebidoCents),
  }
}

/** Faturamento por dia, para o gráfico. */
export async function revenueByDay(companyId: number, desde: string, ate: string) {
  const linhas = await db
    .select({
      dia: workOrders.businessDate,
      totalCents: sql<string>`coalesce(sum(${workOrders.totalCents}), 0)`,
      ordens: sql<string>`count(*)`,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.companyId, companyId),
        isNull(workOrders.canceledAt),
        gte(workOrders.businessDate, desde),
        lte(workOrders.businessDate, ate),
      ),
    )
    .groupBy(workOrders.businessDate)
    .orderBy(asc(workOrders.businessDate))

  return linhas.map((l) => ({
    day: l.dia,
    totalCents: Number.parseInt(l.totalCents, 10) || 0,
    orders: Number.parseInt(l.ordens, 10) || 0,
  }))
}

/** Serviços mais vendidos no período. */
export async function topServices(companyId: number, desde: string, ate: string, limite = 10) {
  const linhas = await db
    .select({
      name: workOrderItems.description,
      quantidade: sql<string>`coalesce(sum(${workOrderItems.quantity}), 0)`,
      totalCents: sql<string>`coalesce(sum(${workOrderItems.quantity} * ${workOrderItems.unitPriceCents}), 0)`,
    })
    .from(workOrderItems)
    .innerJoin(workOrders, eq(workOrderItems.workOrderId, workOrders.id))
    .where(
      and(
        eq(workOrders.companyId, companyId),
        isNull(workOrders.canceledAt),
        gte(workOrders.businessDate, desde),
        lte(workOrders.businessDate, ate),
      ),
    )
    .groupBy(workOrderItems.description)
    .orderBy(desc(sql`sum(${workOrderItems.quantity} * ${workOrderItems.unitPriceCents})`))
    .limit(limite)

  return linhas.map((l) => ({
    name: l.name,
    quantity: Number.parseInt(l.quantidade, 10) || 0,
    totalCents: Number.parseInt(l.totalCents, 10) || 0,
  }))
}

/** Recebimentos do dia por forma de pagamento — o fechamento do caixa. */
export async function cashByMethod(companyId: number, dia: string) {
  const linhas = await db
    .select({
      method: payments.method,
      totalCents: sql<string>`coalesce(sum(${payments.amountCents}), 0)`,
      quantidade: sql<string>`count(*)`,
    })
    .from(payments)
    .innerJoin(workOrders, eq(payments.workOrderId, workOrders.id))
    .where(
      and(
        eq(payments.companyId, companyId),
        isNull(payments.voidedAt),
        eq(workOrders.businessDate, dia),
      ),
    )
    .groupBy(payments.method)

  return linhas.map((l) => ({
    method: l.method,
    totalCents: Number.parseInt(l.totalCents, 10) || 0,
    count: Number.parseInt(l.quantidade, 10) || 0,
  }))
}

/** Movimento do caixa no dia, com estornos à vista. */
export async function cashMovements(companyId: number, dia: string) {
  return db
    .select({
      id: payments.id,
      method: payments.method,
      amountCents: payments.amountCents,
      reference: payments.reference,
      createdAt: payments.createdAt,
      voidedAt: payments.voidedAt,
      voidReason: payments.voidReason,
      orderId: workOrders.id,
      orderReference: workOrders.reference,
      customerName: customers.name,
      plate: vehicles.plate,
    })
    .from(payments)
    .innerJoin(workOrders, eq(payments.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .where(and(eq(payments.companyId, companyId), eq(workOrders.businessDate, dia)))
    .orderBy(desc(payments.id))
}

/** Produção por colaborador: quantos carros e quanto de comissão. */
export async function staffProduction(companyId: number, desde: string, ate: string) {
  const linhas = await db
    .select({
      staffId: staff.id,
      name: staff.name,
      ordens: sql<string>`count(distinct ${workOrders.id})`,
      totalCents: sql<string>`coalesce(sum(${workOrders.totalCents}), 0)`,
    })
    .from(workOrders)
    .innerJoin(staff, eq(workOrders.assignedStaffId, staff.id))
    .where(
      and(
        eq(workOrders.companyId, companyId),
        isNull(workOrders.canceledAt),
        gte(workOrders.businessDate, desde),
        lte(workOrders.businessDate, ate),
      ),
    )
    .groupBy(staff.id, staff.name)
    .orderBy(desc(sql`count(distinct ${workOrders.id})`))

  return linhas.map((l) => ({
    staffId: l.staffId,
    name: l.name,
    orders: Number.parseInt(l.ordens, 10) || 0,
    totalCents: Number.parseInt(l.totalCents, 10) || 0,
  }))
}
