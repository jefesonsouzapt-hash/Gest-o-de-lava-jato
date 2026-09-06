import { describe, expect, it } from "vitest"
import { sslFromUrl } from "@/lib/db/ssl"

const url = (host: string, query = "") => `postgresql://u:p@${host}:5432/postgres${query}`

describe("TLS na conexão com o banco", () => {
  it("host remoto usa TLS", () => {
    // O `pg` não liga TLS sozinho e o Supabase recusa sem ele. Sem esta
    // regra, o sistema roda na máquina do desenvolvedor e cai em produção.
    expect(sslFromUrl(url("aws-1-sa-east-1.pooler.supabase.com"))).toEqual({ rejectUnauthorized: false })
    expect(sslFromUrl(url("db.abc.supabase.co"))).toEqual({ rejectUnauthorized: false })
  })

  it("host local não usa TLS", () => {
    // O Postgres da máquina não tem certificado; exigir TLS quebraria o
    // desenvolvimento.
    for (const host of ["localhost", "127.0.0.1", "meu-pg.local", "banco.internal"]) {
      expect(sslFromUrl(url(host))).toBe(false)
    }
  })

  it("sslmode=disable manda, mesmo remoto", () => {
    // Saída para quem tem Postgres em rede interna sem certificado.
    expect(sslFromUrl(url("banco.empresa.com", "?sslmode=disable"))).toBe(false)
  })

  it("sslmode=verify-full confere o certificado", () => {
    expect(sslFromUrl(url("banco.empresa.com", "?sslmode=verify-full"))).toEqual({ rejectUnauthorized: true })
    expect(sslFromUrl(url("banco.empresa.com", "?sslmode=verify-ca"))).toEqual({ rejectUnauthorized: true })
  })

  it("sslmode=require cifra sem conferir", () => {
    expect(sslFromUrl(url("banco.empresa.com", "?sslmode=require"))).toEqual({ rejectUnauthorized: false })
  })

  it("URL ilegível não derruba a aplicação aqui", () => {
    // O `pg` reclama com mensagem melhor que a nossa.
    expect(sslFromUrl("isso não é uma url")).toBe(false)
  })
})
