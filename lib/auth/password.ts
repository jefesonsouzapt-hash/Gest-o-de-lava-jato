import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto"
import { promisify } from "node:util"

// Derivação de chave com scrypt, da biblioteca do Node. Não precisa de bcrypt
// nem argon2 nativos: o scrypt já vem na plataforma, roda no runtime Node da
// Vercel sem compilação, e é uma função de propósito lenta e cara em memória —
// que é exatamente o que trava um ataque de força bruta.

// `promisify` perde a sobrecarga que aceita opções, por isso o tipo é dado à
// mão — sem isso não dava para ajustar o custo nem o limite de memória.
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

// O scrypt do Node se recusa a alocar mais que o limite padrão (32 MB), e
// N=65536 precisa de ~64 MB. Sem isso, o hash falha em produção.
const MAX_MEMORY = 128 * 1024 * 1024

/** Prefixo do formato, para reconhecer o algoritmo se um dia mudar. */
const PREFIX = "scrypt"

/**
 * Devolve `scrypt$N$r$p$salt$hash`, tudo que é preciso para conferir depois.
 * Guardar os parâmetros junto do hash permite subir o custo no futuro sem
 * invalidar as senhas já criadas.
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
 * Confere uma senha contra o hash gravado.
 *
 * A comparação é em tempo constante: um `===` comum retorna mais rápido quando
 * os primeiros bytes diferem, e essa diferença de tempo basta para descobrir o
 * hash byte a byte.
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
    // Parâmetros absurdos num hash corrompido fazem o scrypt estourar.
    return false
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

/**
 * Hash descartável, para gastar o mesmo tempo quando o e-mail não existe.
 *
 * Sem isso, o login responde rápido para e-mail desconhecido e devagar para
 * e-mail conhecido — e essa diferença permite descobrir quem tem conta.
 */
export async function fakeVerify(): Promise<void> {
  await verifyPassword(
    "senha-descartavel",
    `${PREFIX}$${COST}$${BLOCK_SIZE}$${PARALLELISM}$${randomBytes(SALT_LENGTH).toString("base64")}$${randomBytes(
      KEY_LENGTH,
    ).toString("base64")}`,
  )
}
