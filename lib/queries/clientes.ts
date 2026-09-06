import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { customers, vehicles, workOrders } from "@/lib/db/schema"

export type CustomerRow = typeof customers.$inferSelect
export type VehicleRow = typeof vehicles.$inferSelect

export type CustomerWithStats = CustomerRow & {
  vehicleCount: number
  orderCount: number
  spentCents: number
}

/**
 * Clientes com o que o balcão precisa ver de relance: quantos carros, quantas
 * visitas e quanto já gastou.
 *
 * Só ordens entregues contam no gasto: uma ficha em andamento ainda pode ser
 * cancelada, e mostrar o dinheiro antes da entrega infla o histórico.
 */
export async function listCustomers(
  companyId: number,
  opts: { busca?: string; incluirArquivados?: boolean } = {},
): Promise<CustomerWithStats[]> {
  const filtros = [eq(customers.companyId, companyId)]
  if (!opts.incluirArquivados) filtros.push(isNull(customers.archivedAt))

  const termo = (opts.busca ?? "").trim()
  if (termo) {
    const like = `%${termo}%`
    const digitos = termo.replace(/\D/g, "")
    const alternativas = [ilike(customers.name, like), ilike(customers.email, like)]
    if (digitos) {
      alternativas.push(ilike(customers.phone, `%${digitos}%`), ilike(customers.document, `%${digitos}%`))
    }
    filtros.push(or(...alternativas)!)
  }

  const linhas = await db
    .select({
      cliente: customers,
      veiculos: sql<string>`(select count(*) from ${vehicles} where ${vehicles.customerId} = ${customers.id})`,
      ordens: sql<string>`(select count(*) from ${workOrders} where ${workOrders.customerId} = ${customers.id} and ${workOrders.deliveredAt} is not null)`,
      gasto: sql<string>`coalesce((select sum(${workOrders.totalCents}) from ${workOrders} where ${workOrders.customerId} = ${customers.id} and ${workOrders.deliveredAt} is not null), 0)`,
    })
    .from(customers)
    .where(and(...filtros))
    .orderBy(asc(customers.name))
    .limit(300)

  return linhas.map(({ cliente, veiculos, ordens, gasto }) => ({
    ...cliente,
    vehicleCount: Number.parseInt(veiculos, 10) || 0,
    orderCount: Number.parseInt(ordens, 10) || 0,
    spentCents: Number.parseInt(gasto, 10) || 0,
  }))
}

export async function getCustomer(companyId: number, id: number): Promise<CustomerRow | null> {
  const [linha] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, id)))
    .limit(1)
  return linha ?? null
}

export type VehicleWithOwner = VehicleRow & { customerName: string; customerPhone: string | null }

export async function listVehicles(
  companyId: number,
  opts: { customerId?: number; busca?: string } = {},
): Promise<VehicleWithOwner[]> {
  const filtros = [eq(vehicles.companyId, companyId)]
  if (opts.customerId != null) filtros.push(eq(vehicles.customerId, opts.customerId))

  const termo = (opts.busca ?? "").trim()
  if (termo) {
    // A placa é digitada com ou sem hífen; a busca não pode se importar.
    const semHifen = termo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    filtros.push(
      or(
        ilike(vehicles.plate, `%${semHifen}%`),
        ilike(vehicles.model, `%${termo}%`),
        ilike(vehicles.brand, `%${termo}%`),
        ilike(customers.name, `%${termo}%`),
      )!,
    )
  }

  const linhas = await db
    .select({ veiculo: vehicles, customerName: customers.name, customerPhone: customers.phone })
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customerId, customers.id))
    .where(and(...filtros))
    .orderBy(asc(vehicles.plate))
    .limit(300)

  return linhas.map(({ veiculo, customerName, customerPhone }) => ({ ...veiculo, customerName, customerPhone }))
}

export async function getVehicle(companyId: number, id: number): Promise<VehicleWithOwner | null> {
  const [linha] = await db
    .select({ veiculo: vehicles, customerName: customers.name, customerPhone: customers.phone })
    .from(vehicles)
    .innerJoin(customers, eq(vehicles.customerId, customers.id))
    .where(and(eq(vehicles.companyId, companyId), eq(vehicles.id, id)))
    .limit(1)
  return linha ? { ...linha.veiculo, customerName: linha.customerName, customerPhone: linha.customerPhone } : null
}

/** Histórico de ordens de um cliente, da mais recente para a mais antiga. */
export async function customerHistory(companyId: number, customerId: number) {
  return db
    .select({
      id: workOrders.id,
      reference: workOrders.reference,
      businessDate: workOrders.businessDate,
      status: workOrders.status,
      totalCents: workOrders.totalCents,
      plate: vehicles.plate,
    })
    .from(workOrders)
    .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .where(and(eq(workOrders.companyId, companyId), eq(workOrders.customerId, customerId)))
    .orderBy(desc(workOrders.businessDate), desc(workOrders.id))
    .limit(50)
}
