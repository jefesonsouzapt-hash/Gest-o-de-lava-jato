"use server"

import { revalidatePath } from "next/cache"
import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { auditLogs, sessions, users } from "@/lib/db/schema"
import { requireActor, guardErrorMessage } from "@/lib/auth/guard"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { hashToken } from "@/lib/auth/tokens"
import { parseForm, passwordSchema } from "@/lib/validation/schemas"
import { echoValues, type ActionState } from "@/lib/actions/form"
import { SESSION_COOKIE } from "@/lib/auth/session"
import { cookies } from "next/headers"

const perfilSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120, "Nome muito longo."),
})

export async function updateProfile(_estado: ActionState, formData: FormData): Promise<ActionState> {
  let actor
  try {
    actor = await requireActor()
  } catch (erro) {
    const msg = guardErrorMessage(erro)
    if (msg) return { ok: false, errors: { _: msg } }
    throw erro
  }

  const analisado = parseForm(perfilSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  await db
    .update(users)
    .set({ name: analisado.data.name, updatedAt: new Date() })
    .where(eq(users.id, actor.userId))

  revalidatePath("/", "layout")
  return { ok: true }
}

const trocaSenhaSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  })

/**
 * Troca a senha.
 *
 * Ao trocar, **todas as outras sessões caem**. É o que faz a troca servir para
 * o que ela existe: alguém entrou na conta, e continuar logado em outro
 * aparelho anularia a defesa. A sessão atual sobrevive para o usuário não se
 * expulsar sozinho no meio da operação.
 */
export async function changePassword(_estado: ActionState, formData: FormData): Promise<ActionState> {
  let actor
  try {
    actor = await requireActor()
  } catch (erro) {
    const msg = guardErrorMessage(erro)
    if (msg) return { ok: false, errors: { _: msg } }
    throw erro
  }

  const analisado = parseForm(trocaSenhaSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors }

  const [conta] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1)
  if (!conta) return { ok: false, errors: { _: "Conta não encontrada." } }

  if (!(await verifyPassword(analisado.data.currentPassword, conta.passwordHash))) {
    return { ok: false, errors: { currentPassword: "Senha atual incorreta." } }
  }

  const novoHash = await hashPassword(analisado.data.password)
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const atual = token ? hashToken(token) : null

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: novoHash, updatedAt: new Date() }).where(eq(users.id, actor.userId))

    await tx
      .delete(sessions)
      .where(
        atual
          ? and(eq(sessions.userId, actor.userId), ne(sessions.tokenHash, atual))
          : eq(sessions.userId, actor.userId),
      )

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "conta.senha_alterada",
      entity: "users",
      entityId: String(actor.userId),
    })
  })

  revalidatePath("/minha-conta")
  return { ok: true }
}
