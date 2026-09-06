import { describe, expect, it } from "vitest"
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password"

// O scrypt é deliberadamente lento — é isso que trava a força bruta. Cada hash
// leva ~100 ms, por isso este arquivo tem folga no tempo-limite.
const LENTO = 30_000

describe("hash da senha", () => {
  it(
    "confirma a senha correta e recusa a errada",
    async () => {
      const hash = await hashPassword("uma frase-passe longa")
      expect(await verifyPassword("uma frase-passe longa", hash)).toBe(true)
      expect(await verifyPassword("uma frase-passe errada", hash)).toBe(false)
    },
    LENTO,
  )

  it(
    "gera hashes diferentes para a mesma senha",
    async () => {
      // Sem salt por hash, duas contas com a mesma senha ficariam
      // visivelmente iguais na base de dados.
      const a = await hashPassword("a mesma frase-passe")
      const b = await hashPassword("a mesma frase-passe")
      expect(a).not.toBe(b)
      expect(await verifyPassword("a mesma frase-passe", a)).toBe(true)
      expect(await verifyPassword("a mesma frase-passe", b)).toBe(true)
    },
    LENTO,
  )

  it(
    "guarda os parâmetros junto do hash",
    async () => {
      // Permite subir o custo no futuro sem invalidar o que já está criado.
      const hash = await hashPassword("frase-passe qualquer")
      const [algoritmo, n, r, p] = hash.split("$")
      expect(algoritmo).toBe("scrypt")
      expect(Number(n)).toBe(65536)
      expect(Number(r)).toBe(8)
      expect(Number(p)).toBe(1)
      expect(hash.split("$")).toHaveLength(6)
    },
    LENTO,
  )

  it("nunca contém a senha em claro", async () => {
    const hash = await hashPassword("segredo-muito-especifico")
    expect(hash).not.toContain("segredo-muito-especifico")
  }, LENTO)

  it(
    "trata acentos equivalentes como a mesma senha",
    async () => {
      // "ç" pode chegar como um código ou como "c" mais cedilha combinante,
      // dependendo do teclado e o sistema. Sem normalizar, a mesma senha
      // escrita num Mac não abria a conta criada num Windows.
      const composto = "senha-cação"
      const decomposto = "senha-cação"
      expect(composto).not.toBe(decomposto)

      const hash = await hashPassword(composto)
      expect(await verifyPassword(decomposto, hash)).toBe(true)
    },
    LENTO,
  )

  it(
    "recusa hash corrompido, truncado ou de outro algoritmo",
    async () => {
      const hash = await hashPassword("frase-passe qualquer")
      for (const invalido of [
        "",
        "não é um hash",
        "bcrypt$10$abc$def$ghi$jkl",
        hash.split("$").slice(0, 4).join("$"),
        "scrypt$x$y$z$AAAA$BBBB",
        "scrypt$65536$8$1$$",
      ]) {
        expect(await verifyPassword("frase-passe qualquer", invalido)).toBe(false)
      }
    },
    LENTO,
  )

  it(
    "recusa senha vazia contra um hash real",
    async () => {
      const hash = await hashPassword("frase-passe qualquer")
      expect(await verifyPassword("", hash)).toBe(false)
    },
    LENTO,
  )
})

describe("defesa contra enumeração de contas", () => {
  it(
    "gasta tempo comparável ao de uma verificação verdadeira",
    async () => {
      // Se o email desconhecido devolvesse logo, a diferença de tempo dizia a
      // um atacante quem tem conta. `fakeVerify` iguala o custo.
      const hash = await hashPassword("frase-passe qualquer")

      const t0 = performance.now()
      await verifyPassword("outra frase-passe", hash)
      const real = performance.now() - t0

      const t1 = performance.now()
      await fakeVerify()
      const falso = performance.now() - t1

      // Margem generosa: aqui o que interessa é a ordem de grandeza, não o
      // milissegundo — a máquina de CI é partilhada e oscila.
      expect(falso).toBeGreaterThan(real / 5)
      expect(falso).toBeLessThan(real * 5)
    },
    LENTO,
  )
})
