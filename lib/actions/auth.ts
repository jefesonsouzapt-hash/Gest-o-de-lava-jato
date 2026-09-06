"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { auditLogs, companies, users } from "@/lib/db/schema"
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password"
import { createSession, currentUserAgent, destroySession, purgeExpiredSessions } from "@/lib/auth/session"
import { hasAnyUser, seedCatalog, seedRoles, syncPermissionCatalog } from "@/lib/auth/seed"
import { loginSchema, parseForm, passwordSchema, type FieldErrors } from "@/lib/validation/schemas"
import { isValidNif } from "@/lib/locale/pt"

/**
 * O que a server action devolve ao formulário.
 *
 * `values` traz de volta o que foi escrito, sem a palavra-passe. O React 19
 * limpa um formulário não controlado assim que a ação termina, e sem isto um
 * dígito errado no NIF obrigava a reescrever tudo outra vez.
 */
export type FormState =
  | { ok: true }
  | { ok: false; errors: FieldErrors; values?: Record<string, string> }
  | null

/** Devolve os campos escritos, exceto os que nunca voltam ao navegador. */
function echoValues(formData: FormData, omitir: string[] = ["password"]): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const chave of new Set(formData.keys())) {
    if (omitir.includes(chave)) continue
    const valor = formData.get(chave)
    if (typeof valor === "string") valores[chave] = valor
  }
  return valores
}

// Mensagem única para email desconhecido e palavra-passe errada. Distinguir os
// dois casos diria a um atacante quais os emails que têm conta.
const CREDENCIAIS_INVALIDAS = "Email ou palavra-passe incorretos."

export async function login(_estado: FormState, formData: FormData): Promise<FormState> {
  const analisado = parseForm(loginSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const { email, password } = analisado.data

  const [conta] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, active: users.active })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (!conta) {
    // Gasta o mesmo tempo de uma verificação verdadeira antes de recusar.
    await fakeVerify()
    return { ok: false, errors: { _: CREDENCIAIS_INVALIDAS }, values: echoValues(formData) }
  }

  const correta = await verifyPassword(password, conta.passwordHash)
  // Conta desativada dá a mesma resposta: não confirma sequer que existe.
  if (!correta || !conta.active) {
    return { ok: false, errors: { _: CREDENCIAIS_INVALIDAS }, values: echoValues(formData) }
  }

  await purgeExpiredSessions()
  const token = await createSession(conta.id, await currentUserAgent())
  const { setSessionCookie } = await import("@/lib/auth/session")
  await setSessionCookie(token)

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, conta.id))

  redirect("/painel")
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect("/entrar")
}

const setupSchema = z.object({
  companyName: z.string().trim().min(1, "Indique o nome do lava jato.").max(120),
  companyNif: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidNif(v), "NIF inválido. Confirme os nove dígitos.")
    .transform((v) => (v === "" ? null : v.replace(/\D/g, ""))),
  name: z.string().trim().min(1, "Indique o seu nome.").max(120),
  email: z.string().trim().min(1, "Indique o email.").email("Endereço de email inválido."),
  password: passwordSchema,
})

/**
 * Arranque: cria a empresa, os papéis, o catálogo inicial e a conta de
 * administrador. Só corre enquanto não houver nenhuma conta.
 */
export async function setupFirstCompany(_estado: FormState, formData: FormData): Promise<FormState> {
  const analisado = parseForm(setupSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  if (await hasAnyUser()) {
    return { ok: false, errors: { _: "Este sistema já foi configurado. Inicie sessão." } }
  }

  const { companyName, companyNif, name, email, password } = analisado.data
  const passwordHash = await hashPassword(password)

  let userId: number
  try {
    userId = await db.transaction(async (tx) => {
      await syncPermissionCatalog(tx)

      const [empresa] = await tx
        .insert(companies)
        .values({ name: companyName, nif: companyNif })
        .returning({ id: companies.id })

      const papeis = await seedRoles(tx, empresa.id)
      await seedCatalog(tx, empresa.id)

      const [conta] = await tx
        .insert(users)
        .values({
          companyId: empresa.id,
          roleId: papeis.admin,
          name,
          email: email.toLowerCase(),
          passwordHash,
        })
        .returning({ id: users.id })

      await tx.insert(auditLogs).values({
        companyId: empresa.id,
        userId: conta.id,
        action: "empresa.criada",
        entity: "companies",
        entityId: String(empresa.id),
        after: JSON.stringify({ name: companyName }),
      })

      return conta.id
    })
  } catch (erro) {
    // 23505 = violação de unicidade: o email já existe, ou duas configurações
    // chegaram ao mesmo tempo.
    if (codigoPostgres(erro) === "23505") {
      return {
        ok: false,
        errors: { email: "Já existe uma conta com este email." },
        values: echoValues(formData),
      }
    }
    throw erro
  }

  const token = await createSession(userId, await currentUserAgent())
  const { setSessionCookie } = await import("@/lib/auth/session")
  await setSessionCookie(token)

  redirect("/painel")
}

/**
 * O drizzle embrulha o erro do driver e põe o original em `cause`, por isso o
 * código do Postgres não está à superfície do que foi lançado.
 */
function codigoPostgres(erro: unknown): string | null {
  let atual = erro
  for (let i = 0; i < 5; i++) {
    if (typeof atual !== "object" || atual === null) return null
    const codigo = (atual as { code?: unknown }).code
    if (typeof codigo === "string") return codigo
    atual = (atual as { cause?: unknown }).cause
  }
  return null
}
