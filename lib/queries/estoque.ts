import { and, asc, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { inventoryProducts, stockMovements, users, workOrders } from "@/lib/db/schema"

export type ProductRow = typeof inventoryProducts.$inferSelect
export type ProductWithAlert = ProductRow & { belowMin: boolean; valueCents: number }

/**
 * Produtos com o alerta de mínimo já resolvido.
 *
 * O valor em estoque é custo × quantidade — é o que o dono precisa para saber
 * quanto dinheiro está parado na prateleira.
 */
export async function listProducts(
  companyId: number,
  opts: { incluirInativos?: boolean } = {},
): Promise<ProductWithAlert[]> {
  const filtros = [eq(inventoryProducts.companyId, companyId)]
  if (!opts.incluirInativos) filtros.push(eq(inventoryProducts.active, true))

  const linhas = await db
    .select()
    .from(inventoryProducts)
    .where(and(...filtros))
    .orderBy(asc(inventoryProducts.name))

  return linhas.map((p) => ({
    ...p,
    belowMin: p.stockMilli <= p.minStockMilli,
    // Milésimos × centavos: divide por mil no fim para não perder centavo.
    valueCents: Math.round((p.stockMilli * p.unitCostCents) / 1000),
  }))
}

export async function listMovements(companyId: number, opts: { productId?: number; limite?: number } = {}) {
  const filtros = [eq(stockMovements.companyId, companyId)]
  if (opts.productId != null) filtros.push(eq(stockMovements.productId, opts.productId))

  return db
    .select({
      id: stockMovements.id,
      kind: stockMovements.kind,
      quantityMilli: stockMovements.quantityMilli,
      notes: stockMovements.notes,
      createdAt: stockMovements.createdAt,
      productName: inventoryProducts.name,
      unit: inventoryProducts.unit,
      userName: users.name,
      orderReference: workOrders.reference,
    })
    .from(stockMovements)
    .innerJoin(inventoryProducts, eq(stockMovements.productId, inventoryProducts.id))
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .leftJoin(workOrders, eq(stockMovements.workOrderId, workOrders.id))
    .where(and(...filtros))
    .orderBy(desc(stockMovements.id))
    .limit(opts.limite ?? 100)
}

/** Quantos produtos estão no mínimo ou abaixo — o número do painel. */
export async function lowStockCount(companyId: number): Promise<number> {
  const [linha] = await db
    .select({ total: sql<string>`count(*)` })
    .from(inventoryProducts)
    .where(
      and(
        eq(inventoryProducts.companyId, companyId),
        eq(inventoryProducts.active, true),
        sql`${inventoryProducts.stockMilli} <= ${inventoryProducts.minStockMilli}`,
      ),
    )
  return Number.parseInt(linha?.total ?? "0", 10) || 0
}
