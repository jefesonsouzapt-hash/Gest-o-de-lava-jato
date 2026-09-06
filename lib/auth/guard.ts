import { redirect } from "next/navigation"
import { getActor } from "@/lib/auth/session"
import { can, type Actor, type Permission } from "@/lib/auth/permissions"

// Portões do servidor.
//
// Esconder um botão não é segurança: quem souber o endereço chama a server
// action do mesmo jeito. Toda página protegida e toda action que escreve
// começam por um destes.

/** Erro que as server actions convertem numa mensagem, sem expor detalhes. */
export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super("Você não tem permissão para esta operação.")
    this.name = "ForbiddenError"
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sua sessão expirou. Entre de novo.")
    this.name = "UnauthenticatedError"
  }
}

/** Para páginas: sem sessão, vai para a tela de login. */
export async function requireActorPage(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) redirect("/entrar")
  return actor
}

/**
 * Para páginas: exige uma permissão. Quem não tem vai para o painel, e não
 * para o login — está autenticado, só não pode ver aquilo.
 */
export async function requirePermissionPage(permission: Permission): Promise<Actor> {
  const actor = await requireActorPage()
  if (!can(actor, permission)) redirect("/painel")
  return actor
}

/** Para server actions: lança, para a action devolver o erro ao formulário. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new UnauthenticatedError()
  return actor
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor()
  if (!can(actor, permission)) throw new ForbiddenError(permission)
  return actor
}

/**
 * Converte o erro de um portão na mensagem que o formulário mostra. Qualquer
 * outro erro sobe: uma falha do banco não pode ser confundida com falta de
 * permissão.
 */
export function guardErrorMessage(error: unknown): string | null {
  if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) return error.message
  return null
}

/**
 * O portão em forma de resultado, para as actions que respondem a um
 * formulário.
 *
 * `requirePermission` lança, e uma exceção numa server action chega ao
 * navegador como erro genérico: o usuário vê a tela quebrar sem saber que o
 * problema é permissão — ou que a sessão dele expirou e basta entrar de novo.
 * A negação continua acontecendo no servidor; muda só o que ele lê.
 */
export async function tryPermission(
  permission: Permission,
): Promise<{ ok: true; actor: Actor } | { ok: false; message: string }> {
  try {
    return { ok: true, actor: await requirePermission(permission) }
  } catch (erro) {
    const mensagem = guardErrorMessage(erro)
    if (mensagem) return { ok: false, message: mensagem }
    throw erro
  }
}
