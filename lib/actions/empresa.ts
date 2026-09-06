"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { auditLogs, companies } from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { companySchema, parseForm } from "@/lib/validation/schemas"
import { echoValues, type ActionState } from "@/lib/actions/form"

/**
 * Dados da empresa e identidade visual.
 *
 * Logo e cor da marca vivem aqui e não num arquivo de configuração porque cada
 * lava jato tem os seus: é um sistema multiempresa, e a marca é do cliente.
 */
export async function updateCompany(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("empresa.gerir")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const analisado = parseForm(companySchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [antes] = await db.select().from(companies).where(eq(companies.id, actor.companyId)).limit(1)

  try {
    await db
      .update(companies)
      .set({ ...analisado.data, updatedAt: new Date() })
      .where(eq(companies.id, actor.companyId))
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { ok: false, errors: { cnpj: "Já existe uma empresa com este CNPJ." }, values: echoValues(formData) }
    }
    throw erro
  }

  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "empresa.atualizada",
    entity: "companies",
    entityId: String(actor.companyId),
    before: JSON.stringify({ name: antes?.name, issBps: antes?.issBps, brandColor: antes?.brandColor }),
    after: JSON.stringify({
      name: analisado.data.name,
      issBps: analisado.data.issBps,
      brandColor: analisado.data.brandColor,
    }),
  })

  // A marca aparece em toda tela: revalida a raiz inteira.
  revalidatePath("/", "layout")
  return { ok: true }
}
