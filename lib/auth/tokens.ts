import { createHash, randomBytes } from "node:crypto"

// Separado de session.ts de propósito: aqui não há conexão com o banco, então
// estas funções podem ser testadas isoladamente.

/**
 * No banco fica só o SHA-256 do token da sessão.
 *
 * Se o banco vazar, os tokens em claro não vão junto — quem os pegasse entrava
 * como qualquer usuário sem precisar da senha. Não leva salt de propósito: o
 * token tem 256 bits de entropia, então não há dicionário a proteger, e a
 * busca precisa ser por igualdade exata.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** 32 bytes de aleatoriedade criptográfica, em base64url para caber no cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url")
}
