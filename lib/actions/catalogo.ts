"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { auditLogs, serviceCategories, servicePrices, services, washBays } from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { parseForm, serviceSchema, vehicleCategorySchema } from "@/lib/validation/schemas"
import { parseCurrencyToCents } from "@/lib/locale/money"
import { echoValues, intField, type ActionState, type SimpleResult } from "@/lib/actions/form"

const CATEGORIAS = ["moto", "hatch", "sedan", "suv", "caminhonete"] as const

function revalidar() {
  revalidatePath("/servicos")
  revalidatePath("/ordens")
  revalidatePath("/recepcao")
}

/**
 * Cria ou atualiza um serviço, junto com a tabela de preço por porte.
 *
 * A tabela vem no mesmo formulário e é gravada na mesma transação: sem isso,
 * um erro no meio deixaria o serviço com o preço novo e a tabela com o antigo,
 * e o balcão cobraria dois valores diferentes pelo mesmo carro.
 */
export async function saveService(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("servico.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(serviceSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const id = intField(formData, "id")

  // Um preço por porte só é gravado quando foi preenchido: campo vazio quer
  // dizer "usa o preço-base", não "de graça".
  const precos = CATEGORIAS.map((categoria) => {
    const bruto = String(formData.get(`price_${categoria}`) ?? "").trim()
    return bruto ? { category: categoria, priceCents: parseCurrencyToCents(bruto) } : null
  }).filter((p): p is { category: (typeof CATEGORIAS)[number]; priceCents: number } => p !== null)

  if (precos.some((p) => p.priceCents < 0)) {
    return { ok: false, errors: { _: "Preço inválido na tabela por porte." }, values: echoValues(formData) }
  }

  // A categoria escolhida tem de ser desta empresa.
  if (analisado.data.categoryId != null) {
    const [cat] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.id, analisado.data.categoryId), eq(serviceCategories.companyId, actor.companyId)))
      .limit(1)
    if (!cat) return { ok: false, errors: { categoryId: "Categoria não encontrada." }, values: echoValues(formData) }
  }

  try {
    await db.transaction(async (tx) => {
      let servicoId = id

      if (servicoId == null) {
        const [criado] = await tx
          .insert(services)
          .values({ ...analisado.data, companyId: actor.companyId })
          .returning({ id: services.id })
        servicoId = criado.id
      } else {
        const alterados = await tx
          .update(services)
          .set({ ...analisado.data, updatedAt: new Date() })
          .where(and(eq(services.id, servicoId), eq(services.companyId, actor.companyId)))
          .returning({ id: services.id })
        if (alterados.length === 0) throw new Error("SERVICO_NAO_ENCONTRADO")
      }

      await tx.delete(servicePrices).where(eq(servicePrices.serviceId, servicoId))
      if (precos.length > 0) {
        await tx.insert(servicePrices).values(precos.map((p) => ({ ...p, serviceId: servicoId })))
      }

      await tx.insert(auditLogs).values({
        companyId: actor.companyId,
        userId: actor.userId,
        action: id == null ? "servico.criado" : "servico.atualizado",
        entity: "services",
        entityId: String(servicoId),
        after: JSON.stringify({ name: analisado.data.name, basePriceCents: analisado.data.basePriceCents }),
      })
    })
  } catch (erro) {
    if (erro instanceof Error && erro.message === "SERVICO_NAO_ENCONTRADO") {
      return { ok: false, errors: { _: "Serviço não encontrado." } }
    }
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { name: "Já existe um serviço com este nome." }, values: echoValues(formData) }
    }
    throw erro
  }

  revalidar()
  return { ok: true }
}

/**
 * Desativa um serviço em vez de apagar.
 *
 * Ordens antigas guardam o nome e o preço copiados, mas a comissão aponta para
 * o serviço: apagar quebraria o histórico de quem ganhou o quê.
 */
export async function setServiceActive(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("servico.gerir")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = intField(formData, "id")
  if (id == null) return { ok: false, error: "Serviço inválido." }
  const ativo = String(formData.get("active") ?? "1") === "1"

  const alterados = await db
    .update(services)
    .set({ active: ativo, updatedAt: new Date() })
    .where(and(eq(services.id, id), eq(services.companyId, actor.companyId)))
    .returning({ id: services.id })

  if (alterados.length === 0) return { ok: false, error: "Serviço não encontrado." }

  revalidar()
  return { ok: true }
}

const categoriaSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria.").max(60, "Nome muito longo."),
})

export async function saveCategory(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("servico.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(categoriaSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const id = intField(formData, "id")

  try {
    if (id == null) {
      await db.insert(serviceCategories).values({ name: analisado.data.name, companyId: actor.companyId })
    } else {
      await db
        .update(serviceCategories)
        .set({ name: analisado.data.name })
        .where(and(eq(serviceCategories.id, id), eq(serviceCategories.companyId, actor.companyId)))
    }
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { name: "Já existe uma categoria com este nome." }, values: echoValues(formData) }
    }
    throw erro
  }

  revalidar()
  revalidatePath("/equipe")
  return { ok: true }
}

const pistaSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da pista.").max(60, "Nome muito longo."),
  status: z.enum(["livre", "ocupada", "manutencao"]).default("livre"),
  notes: z.string().trim().max(300).transform((v) => v || null).nullable().catch(null),
})

export async function saveBay(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("pista.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(pistaSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const id = intField(formData, "id")

  try {
    if (id == null) {
      await db.insert(washBays).values({ ...analisado.data, companyId: actor.companyId })
    } else {
      await db
        .update(washBays)
        .set({ ...analisado.data, updatedAt: new Date() })
        .where(and(eq(washBays.id, id), eq(washBays.companyId, actor.companyId)))
    }
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { name: "Já existe uma pista com este nome." }, values: echoValues(formData) }
    }
    throw erro
  }

  revalidatePath("/recepcao")
  revalidatePath("/servicos")
  return { ok: true }
}

/** Preço de um serviço já resolvido para um porte, usado pela tela de ordem. */
export async function servicePriceFor(serviceId: number, category: string): Promise<number | null> {
  const portao = await tryPermission("ordem.editar")
  if (!portao.ok) return null
  const actor = portao.actor

  const cat = vehicleCategorySchema.safeParse(category)
  if (!cat.success) return null

  const [servico] = await db
    .select({ base: services.basePriceCents })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.companyId, actor.companyId)))
    .limit(1)
  if (!servico) return null

  const [tabela] = await db
    .select({ preco: servicePrices.priceCents })
    .from(servicePrices)
    .where(and(eq(servicePrices.serviceId, serviceId), inArray(servicePrices.category, [cat.data])))
    .limit(1)

  const { priceForVehicle } = await import("@/lib/pricing/calc")
  return priceForVehicle({
    basePriceCents: servico.base,
    category: cat.data,
    tablePriceCents: tabela?.preco ?? null,
  })
}
