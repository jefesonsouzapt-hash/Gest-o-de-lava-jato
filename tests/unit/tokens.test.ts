import { describe, expect, it } from "vitest"
import { generateSessionToken, hashToken } from "@/lib/auth/tokens"

describe("token de sessão", () => {
  it("tem entropia suficiente e cabe numa cookie", () => {
    const token = generateSessionToken()
    // 32 bytes em base64url dão 43 caracteres, sem `+`, `/` nem `=` — que
    // teriam de ser escapados na cookie.
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("nunca repete", () => {
    const emitidos = new Set(Array.from({ length: 500 }, generateSessionToken))
    expect(emitidos.size).toBe(500)
  })
})

describe("hash do token", () => {
  it("devolve sempre o mesmo hash para o mesmo token", () => {
    // É por igualdade exata que a sessão é encontrada na base de dados.
    const token = generateSessionToken()
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it("é um SHA-256 em hexadecimal", () => {
    expect(hashToken("qualquer")).toMatch(/^[0-9a-f]{64}$/)
  })

  it("não deixa o token em claro no resultado", () => {
    // Se a base de dados vazar, os tokens não vão com ela.
    const token = generateSessionToken()
    expect(hashToken(token)).not.toContain(token)
  })

  it("dá hashes diferentes para tokens diferentes", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"))
  })
})
