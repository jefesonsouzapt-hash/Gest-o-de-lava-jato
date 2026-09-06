"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { isUniqueViolation } from "@/lib/db/errors"
import { auditLogs, companies, users } from "@/lib/db/schema"
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password"
import { createSession, currentUserAgent, destroySession, purgeExpiredSessions } from "@/lib/auth/session"
import { hasAnyUser, seedCatalog, seedRoles, syncPermissionCatalog } from "@/lib/auth/seed"
import { loginSchema, parseForm, passwordSchema, type FieldErrors } from "@/lib/validation/schemas"
import { isValidCnpj } from "@/lib/locale/br"

/**
 * O que a server action devolve ao formulário.
 *
 * `values` traz de volta o que foi digitado, sem a senha. O React 19 limpa um
 * formulário não controlado assim que a ação termina, e sem isso um dígito
 * errado no CNPJ obrigava a digitar tudo de novo.
 */
export type FormState =
  | { ok: true }
  | { ok: false; errors: FieldErrors; values?: Record<string, string> }
  | null

/** Devolve os campos digitados, exceto os que nunca voltam ao navegador. */
function echoValues(formData: FormData, omitir: string[] = ["password"]): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const chave of new Set(formData.keys())) {
    if (omitir.includes(chave)) continue
    const valor = formData.get(chave)
    if (typeof valor === "string") valores[chave] = valor
  }
  return valores
}

// Mensagem única para e-mail desconhecido e senha errada. Distinguir os dois
// casos diria a um atacante quais e-mails têm conta.
const CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos."

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
  // Conta desativada dá a mesma resposta: não confirma nem que existe.
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
  companyName: z.string().trim().min(1, "Informe o nome do lava jato.").max(120),
  companyCnpj: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido. Confira os 14 dígitos.")
    .transform((v) => (v === "" ? null : v.replace(/\D/g, ""))),
  name: z.string().trim().min(1, "Informe o seu nome.").max(120),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: passwordSchema,
})

/**
 * Primeiro acesso: cria a empresa, os perfis, o catálogo inicial e a conta de
 * administrador. Só roda enquanto não existir nenhuma conta.
 */
export async function setupFirstCompany(_estado: FormState, formData: FormData): Promise<FormState> {
  const analisado = parseForm(setupSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  if (await hasAnyUser()) {
    return { ok: false, errors: { _: "Este sistema já foi configurado. Faça login." } }
  }

  const { companyName, companyCnpj, name, email, password } = analisado.data
  const passwordHash = await hashPassword(password)

  let userId: number
  try {
    userId = await db.transaction(async (tx) => {
      await syncPermissionCatalog(tx)

      const [empresa] = await tx
        .insert(companies)
        .values({ name: companyName, cnpj: companyCnpj })
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
    // 23505 = violação de unicidade: o e-mail já existe, ou duas configurações
    // chegaram ao mesmo tempo.
    if (isUniqueViolation(erro)) {
      return {
        ok: false,
        errors: { email: "Já existe uma conta com este e-mail." },
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
 * código do Postgres não fica na superfície do que foi lançado.
 */
