import { createHash, randomBytes } from "node:crypto"

// Separado de session.ts de propósito: aqui não há ligação à base de dados,
// por isso estas funções podem ser testadas isoladamente.

/**
 * Na base de dados fica só o SHA-256 do token da sessão.
 *
 * Se a base de dados vazar, os tokens em claro não vão com ela — quem os
 * apanhasse entrava como qualquer utilizador sem precisar da palavra-passe.
 * Não leva salt de propósito: o token tem 256 bits de entropia, portanto não há
 * dicionário a proteger, e a procura tem de ser por igualdade exata.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** 32 bytes de aleatoriedade criptográfica, em base64url para caber na cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url")
}
