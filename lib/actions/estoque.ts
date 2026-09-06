"use server"

import { revalidatePath } from "next/cache"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { auditLogs, inventoryProducts, stockMovements } from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { parseForm } from "@/lib/validation/schemas"
import { parseCurrencyToCents } from "@/lib/locale/money"
import { echoValues, intField, type ActionState, type SimpleResult } from "@/lib/actions/form"

/**
 * Quantidade em milésimos da unidade.
 *
 * Meio litro de cera é 500; três microfibras é 3000. Guardar em milésimos
 * inteiros evita o mesmo problema do dinheiro: 0,1 + 0,2 em ponto flutuante
 * não dá 0,3, e um estoque que erra na terceira casa a cada baixa some sozinho.
 */
const quantidadeSchema = z
  .string()
  .trim()
  .transform((v) => Math.round(parseCurrencyToCents(v || "0") * 10))
  .refine((v) => Number.isFinite(v), "Quantidade inválida.")

const produtoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto.").max(120, "Nome muito longo."),
  kind: z.string().trim().max(40).default("quimico"),
  unit: z.enum(["un", "L", "ml", "kg"]).default("un"),
  minStockMilli: quantidadeSchema.refine((v) => v >= 0, "O estoque mínimo não pode ser negativo."),
  unitCostCents: z
    .string()
    .trim()
    .transform((v) => parseCurrencyToCents(v || "0"))
    .refine((v) => v >= 0, "O custo não pode ser negativo."),
  supplier: z.string().trim().max(120).transform((v) => v || null).nullable().catch(null),
})

function revalidar() {
  revalidatePath("/estoque")
  revalidatePath("/painel")
}

export async function saveProduct(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("estoque.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(produtoSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const id = intField(formData, "id")

  try {
    if (id == null) {
      // O saldo inicial entra como movimento de entrada, não como campo
      // digitado: assim todo número no estoque tem uma linha que o explica.
      const inicial = Math.max(
        Math.round(parseCurrencyToCents(String(formData.get("initialStock") ?? "0")) * 10),
        0,
      )

      await db.transaction(async (tx) => {
        const [criado] = await tx
          .insert(inventoryProducts)
          .values({ ...analisado.data, companyId: actor.companyId, stockMilli: 0 })
          .returning({ id: inventoryProducts.id })

        if (inicial > 0) {
          await tx
            .update(inventoryProducts)
            .set({ stockMilli: inicial })
            .where(eq(inventoryProducts.id, criado.id))

          await tx.insert(stockMovements).values({
            companyId: actor.companyId,
            productId: criado.id,
            kind: "entrada",
            quantityMilli: inicial,
            userId: actor.userId,
            notes: "Saldo inicial do cadastro",
          })
        }
      })
    } else {
      const alterados = await db
        .update(inventoryProducts)
        .set({ ...analisado.data, updatedAt: new Date() })
        .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, actor.companyId)))
        .returning({ id: inventoryProducts.id })
      if (alterados.length === 0) return { ok: false, errors: { _: "Produto não encontrado." } }
    }
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { name: "Já existe um produto com este nome." }, values: echoValues(formData) }
    }
    throw erro
  }

  revalidar()
  return { ok: true }
}

const movimentoSchema = z.object({
  productId: z.coerce.number().int().positive("Escolha o produto."),
  kind: z.enum(["entrada", "consumo", "quebra", "ajuste"]),
  quantityMilli: quantidadeSchema.refine((v) => v !== 0, "Informe uma quantidade maior que zero."),
  notes: z.string().trim().max(300).transform((v) => v || null).nullable().catch(null),
})

/**
 * Lança um movimento de estoque.
 *
 * Entrada soma; consumo e quebra subtraem. O ajuste é o único que aceita
 * sinal negativo digitado — é a contagem física corrigindo o sistema, e às
 * vezes ela corrige para menos.
 */
export async function registerMovement(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("estoque.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(movimentoSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [produto] = await db
    .select({ id: inventoryProducts.id, name: inventoryProducts.name })
    .from(inventoryProducts)
    .where(and(eq(inventoryProducts.id, analisado.data.productId), eq(inventoryProducts.companyId, actor.companyId)))
    .limit(1)
  if (!produto) return { ok: false, errors: { productId: "Produto não encontrado." } }

  const bruto = Math.abs(analisado.data.quantityMilli)
  const negativo = String(formData.get("negative") ?? "") === "1"
  const delta =
    analisado.data.kind === "entrada"
      ? bruto
      : analisado.data.kind === "ajuste"
        ? (negativo ? -bruto : bruto)
        : -bruto

  await db.transaction(async (tx) => {
    await tx
      .update(inventoryProducts)
      .set({ stockMilli: sql`${inventoryProducts.stockMilli} + ${delta}`, updatedAt: new Date() })
      .where(eq(inventoryProducts.id, produto.id))

    await tx.insert(stockMovements).values({
      companyId: actor.companyId,
      productId: produto.id,
      kind: analisado.data.kind,
      quantityMilli: delta,
      userId: actor.userId,
      notes: analisado.data.notes,
    })

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "estoque.movimento",
      entity: "inventory_products",
      entityId: String(produto.id),
      after: JSON.stringify({ kind: analisado.data.kind, quantityMilli: delta }),
    })
  })

  revalidar()
  return { ok: true }
}

export async function setProductActive(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("estoque.gerir")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const id = intField(formData, "id")
  if (id == null) return { ok: false, error: "Produto inválido." }
  const ativo = String(formData.get("active") ?? "1") === "1"

  const alterados = await db
    .update(inventoryProducts)
    .set({ active: ativo, updatedAt: new Date() })
    .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, actor.companyId)))
    .returning({ id: inventoryProducts.id })

  if (alterados.length === 0) return { ok: false, error: "Produto não encontrado." }

  revalidar()
  return { ok: true }
}
