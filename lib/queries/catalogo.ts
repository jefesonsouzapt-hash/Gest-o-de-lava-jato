import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { packageItems, serviceCategories, servicePrices, services, washBays } from "@/lib/db/schema"

export type ServiceRow = typeof services.$inferSelect
export type ServicePriceRow = typeof servicePrices.$inferSelect
export type CategoryRow = typeof serviceCategories.$inferSelect
export type BayRow = typeof washBays.$inferSelect

export async function listServiceCategories(companyId: number): Promise<CategoryRow[]> {
  return db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.companyId, companyId))
    .orderBy(asc(serviceCategories.position), asc(serviceCategories.name))
}

export type ServiceWithPrices = ServiceRow & {
  categoryName: string | null
  prices: ServicePriceRow[]
}

/**
 * Catálogo com a tabela de preços por porte já junto.
 *
 * Vem tudo em duas consultas, não uma por serviço: a tela de serviços de um
 * lava jato com trinta itens não pode disparar trinta e uma consultas.
 */
export async function listServices(
  companyId: number,
  opts: { incluirInativos?: boolean } = {},
): Promise<ServiceWithPrices[]> {
  const filtros = [eq(services.companyId, companyId)]
  if (!opts.incluirInativos) filtros.push(eq(services.active, true))

  const linhas = await db
    .select({ servico: services, categoryName: serviceCategories.name })
    .from(services)
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(and(...filtros))
    .orderBy(asc(serviceCategories.position), asc(services.name))

  if (linhas.length === 0) return []

  const precos = await db
    .select()
    .from(servicePrices)
    .where(inArray(servicePrices.serviceId, linhas.map((l) => l.servico.id)))

  const porServico = new Map<number, ServicePriceRow[]>()
  for (const preco of precos) {
    const atual = porServico.get(preco.serviceId) ?? []
    atual.push(preco)
    porServico.set(preco.serviceId, atual)
  }

  return linhas.map(({ servico, categoryName }) => ({
    ...servico,
    categoryName,
    prices: porServico.get(servico.id) ?? [],
  }))
}

export async function getService(companyId: number, id: number): Promise<ServiceWithPrices | null> {
  const [linha] = await db
    .select({ servico: services, categoryName: serviceCategories.name })
    .from(services)
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(and(eq(services.companyId, companyId), eq(services.id, id)))
    .limit(1)
  if (!linha) return null

  const precos = await db.select().from(servicePrices).where(eq(servicePrices.serviceId, id))
  return { ...linha.servico, categoryName: linha.categoryName, prices: precos }
}

/** Serviços que compõem um pacote, para montar a ordem com um clique. */
export async function packageContents(packageId: number) {
  return db
    .select({ serviceId: packageItems.serviceId, name: services.name })
    .from(packageItems)
    .innerJoin(services, eq(packageItems.serviceId, services.id))
    .where(eq(packageItems.packageId, packageId))
}

export async function listBays(companyId: number, opts: { incluirInativas?: boolean } = {}): Promise<BayRow[]> {
  const filtros = [eq(washBays.companyId, companyId)]
  if (!opts.incluirInativas) filtros.push(eq(washBays.active, true))
  return db
    .select()
    .from(washBays)
    .where(and(...filtros))
    .orderBy(asc(washBays.position), asc(washBays.name))
}
