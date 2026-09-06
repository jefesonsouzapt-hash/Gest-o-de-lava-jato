import { cookies, headers } from "next/headers"
import { and, eq, gt, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { rolePermissions, roles, sessions, users } from "@/lib/db/schema"
import type { Actor } from "@/lib/auth/permissions"
import { generateSessionToken, hashToken } from "@/lib/auth/tokens"

export { hashToken } from "@/lib/auth/tokens"

export const SESSION_COOKIE = "lj_sessao"

/** Trinta dias. Renovada a cada início de sessão, não a cada pedido. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Cria a sessão na base de dados e devolve o token em claro para a cookie. */
export async function createSession(userId: number, userAgent?: string | null): Promise<string> {
  const token = generateSessionToken()
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: userAgent?.slice(0, 300) ?? null,
  })
  return token
}

export async function setSessionCookie(token: string): Promise<void> {
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
  })
}

/** Termina a sessão dos dois lados: apaga a linha e limpa a cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  // Apagar só a cookie deixaria o token válido para quem o tivesse copiado.
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
  jar.delete(SESSION_COOKIE)
}

/**
 * O ator do pedido atual, com as permissões já resolvidas, ou `null`.
 *
 * As permissões vêm da tabela e não da constante do código: uma empresa pode
 * ter um papel personalizado, e o papel de sistema é apenas o que foi semeado.
 */
export async function getActor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const [linha] = await db
    .select({
      userId: users.id,
      companyId: users.companyId,
      active: users.active,
      roleId: roles.id,
      roleKey: roles.key,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  // Conta desativada perde o acesso já, sem esperar que a sessão expire.
  if (!linha || !linha.active) return null

  const concedidas = await db
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, linha.roleId))

  return {
    userId: linha.userId,
    companyId: linha.companyId,
    roleKey: linha.roleKey,
    permissions: concedidas.map((p) => p.key),
  }
}

/** Remove sessões expiradas. Chamada no início de sessão, não a cada pedido. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

export async function currentUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")
}
