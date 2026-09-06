import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto"
import { promisify } from "node:util"

// Derivação de chave com scrypt, da biblioteca do Node. Não é preciso bcrypt
// nem argon2 nativos: o scrypt está na plataforma, corre no runtime Node da
// Vercel sem compilação, e é uma função deliberadamente lenta e cara em
// memória — que é exatamente o que trava um ataque de força bruta.

// `promisify` perde a sobrecarga que aceita opções, por isso o tipo é dado à
// mão — sem isto não dava para afinar o custo nem o limite de memória.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

// Parâmetros do OWASP para scrypt: N=2^16, r=8, p=1.
const COST = 2 ** 16
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

// O scrypt do Node recusa-se a alocar mais do que o limite por omissão (32 MB)
// e N=65536 precisa de ~64 MB. Sem isto, o hash falha em produção.
const MAX_MEMORY = 128 * 1024 * 1024

/** Prefixo do formato, para reconhecer o algoritmo se um dia mudar. */
const PREFIX = "scrypt"

/**
 * Devolve `scrypt$N$r$p$salt$hash`, tudo o que é preciso para verificar mais
 * tarde. Guardar os parâmetros junto do hash permite subir o custo no futuro
 * sem invalidar as palavras-passe já criadas.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  }))

  return [PREFIX, COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64"), derived.toString("base64")].join("$")
}

/**
 * Confirma uma palavra-passe contra o hash guardado.
 *
 * A comparação é em tempo constante: um `===` normal devolve mais depressa
 * quando os primeiros bytes diferem, e essa diferença de tempo chega para
 * descobrir o hash byte a byte.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const partes = String(stored ?? "").split("$")
  if (partes.length !== 6 || partes[0] !== PREFIX) return false

  const [, n, r, p, saltB64, hashB64] = partes
  const N = Number.parseInt(n, 10)
  const blockSize = Number.parseInt(r, 10)
  const parallelism = Number.parseInt(p, 10)
  if (!Number.isFinite(N) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltB64, "base64")
    expected = Buffer.from(hashB64, "base64")
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false

  let derived: Buffer
  try {
    derived = (await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r: blockSize,
      p: parallelism,
      maxmem: MAX_MEMORY,
    }))
  } catch {
    // Parâmetros absurdos num hash corrompido fazem o scrypt rebentar.
    return false
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

/**
 * Hash descartável, para gastar o mesmo tempo quando o email não existe.
 *
 * Sem isto, um pedido de início de sessão devolve depressa para email
 * desconhecido e devagar para email conhecido — e essa diferença permite
 * enumerar quem tem conta.
 */
export async function fakeVerify(): Promise<void> {
  await verifyPassword(
    "palavra-passe-descartavel",
    `${PREFIX}$${COST}$${BLOCK_SIZE}$${PARALLELISM}$${randomBytes(SALT_LENGTH).toString("base64")}$${randomBytes(
      KEY_LENGTH,
    ).toString("base64")}`,
  )
}
