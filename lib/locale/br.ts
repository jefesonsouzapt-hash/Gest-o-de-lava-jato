// Validadores e formatadores dos identificadores brasileiros: CPF, CNPJ,
// telefone, CEP e placa. Tudo que entra no sistema passa por aqui antes de
// chegar ao banco.

// --- CPF ---------------------------------------------------------------------

/**
 * Valida um CPF: 11 dígitos e os dois dígitos verificadores por módulo 11.
 *
 * Sequências repetidas (000.000.000-00, 111.111.111-11 …) passam na conta dos
 * dígitos mas não são CPFs válidos — é o erro clássico de quem implementa só a
 * fórmula, e deixa entrar cadastro de teste como se fosse real.
 */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  for (const [tamanho, posicao] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    // Resto 10 e 11 valem zero.
    const digito = resto >= 10 ? 0 : resto
    if (digito !== Number(cpf[posicao])) return false
  }

  return true
}

export function formatCpf(input: string | null | undefined): string {
  const d = onlyDigits(input)
  if (d.length !== 11) return input ?? ""
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

// --- CNPJ --------------------------------------------------------------------

const CNPJ_PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_PESOS_2 = [6, ...CNPJ_PESOS_1]

/** Valida um CNPJ: 14 dígitos e os dois verificadores por módulo 11. */
export function isValidCnpj(input: string): boolean {
  const cnpj = onlyDigits(input)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  for (const [pesos, posicao] of [
    [CNPJ_PESOS_1, 12],
    [CNPJ_PESOS_2, 13],
  ] as const) {
    let soma = 0
    for (let i = 0; i < pesos.length; i++) soma += Number(cnpj[i]) * pesos[i]
    const resto = soma % 11
    const digito = resto < 2 ? 0 : 11 - resto
    if (digito !== Number(cnpj[posicao])) return false
  }

  return true
}

export function formatCnpj(input: string | null | undefined): string {
  const d = onlyDigits(input)
  if (d.length !== 14) return input ?? ""
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// --- CPF ou CNPJ -------------------------------------------------------------

/** Aceita os dois: cliente pessoa física ou frota de empresa. */
export function isValidDocument(input: string | null | undefined): boolean {
  const d = onlyDigits(input)
  if (d.length === 11) return isValidCpf(d)
  if (d.length === 14) return isValidCnpj(d)
  return false
}

export function formatDocument(input: string | null | undefined): string {
  const d = onlyDigits(input)
  if (d.length === 11) return formatCpf(d)
  if (d.length === 14) return formatCnpj(d)
  return input ?? ""
}

// --- Telefone ----------------------------------------------------------------

/**
 * DDDs em uso no Brasil. A lista é fechada e estável, e vale a pena mantê-la:
 * aceitar qualquer par 11–99 deixa passar erro de digitação no balcão — um
 * "52" no lugar de "51" vira um telefone que nunca vai tocar, e o cliente não
 * recebe o aviso de que o carro ficou pronto.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF e entorno
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 87, // PE
  82, // AL
  83, // PB
  84, // RN
  85, 88, // CE
  86, 89, // PI
  91, 93, 94, // PA
  92, 97, // AM
  95, // RR
  96, // AP
  98, 99, // MA
])

/**
 * Normaliza para E.164: `+55DDNNNNNNNNN`.
 *
 * Aceita o que as pessoas escrevem de fato: `11988887777`, `(11) 98888-7777`,
 * `+55 11 98888-7777`, `005511988887777`. Devolve `null` quando não dá um
 * número brasileiro válido.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let d = onlyDigits(input)
  if (!d) return null

  if (d.startsWith("0055")) d = d.slice(4)
  else if (d.length > 11 && d.startsWith("55")) d = d.slice(2)

  // 10 dígitos = fixo (DD + 8), 11 = celular (DD + 9 começando por 9).
  if (d.length !== 10 && d.length !== 11) return null

  if (!DDDS.has(Number(d.slice(0, 2)))) return null

  // Celular tem sempre o nono dígito, e ele é 9.
  if (d.length === 11 && d[2] !== "9") return null

  return `+55${d}`
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null
}

/** Celular: onze dígitos com o nono dígito. */
export function isValidMobile(input: string | null | undefined): boolean {
  const e164 = normalizePhone(input)
  return e164 !== null && e164.length === 14
}

/** Exibição nacional: `(11) 98888-7777` ou `(11) 3888-7777`. */
export function formatPhone(input: string | null | undefined): string {
  const e164 = normalizePhone(input)
  if (!e164) return input ?? ""
  const d = e164.slice(3)
  const ddd = d.slice(0, 2)
  const numero = d.slice(2)
  const corte = numero.length === 9 ? 5 : 4
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

/** Link de WhatsApp a partir de um número já normalizado. */
export function whatsappLink(input: string | null | undefined, mensagem?: string): string | null {
  const e164 = normalizePhone(input)
  if (!e164) return null
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""
  return `https://wa.me/${e164.replace("+", "")}${texto}`
}

// --- CEP ---------------------------------------------------------------------

export function isValidCep(input: string | null | undefined): boolean {
  return onlyDigits(input).length === 8
}

export function formatCep(input: string | null | undefined): string {
  const d = onlyDigits(input)
  if (d.length !== 8) return input ?? ""
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

// --- Placa -------------------------------------------------------------------

// Os dois formatos em circulação. O antigo continua válido e não vai deixar de
// circular tão cedo, então os dois são aceitos.
const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/ // ABC1234
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/ // ABC1D23

/** Guardada sem hífen e em maiúsculas; é assim que a busca compara. */
export function normalizePlate(input: string | null | undefined): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function isValidPlate(input: string | null | undefined): boolean {
  const p = normalizePlate(input)
  if (p.length !== 7) return false
  return PLACA_ANTIGA.test(p) || PLACA_MERCOSUL.test(p)
}

/** `true` quando a placa está no padrão Mercosul. */
export function isMercosulPlate(input: string | null | undefined): boolean {
  return PLACA_MERCOSUL.test(normalizePlate(input))
}

/** Exibição com hífen: `ABC-1D23`. */
export function formatPlate(input: string | null | undefined): string {
  const p = normalizePlate(input)
  if (p.length !== 7) return String(input ?? "")
  return `${p.slice(0, 3)}-${p.slice(3)}`
}

// --- Chave PIX ---------------------------------------------------------------

export type PixKeyKind = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"

/**
 * Descobre o tipo da chave PIX pelo próprio conteúdo, como fazem os bancos.
 * Devolve `null` quando não é nenhuma chave reconhecível — melhor recusar no
 * cadastro do que descobrir na hora de pagar o salário.
 */
export function pixKeyKind(input: string | null | undefined): PixKeyKind | null {
  const bruto = String(input ?? "").trim()
  if (!bruto) return null

  // Chave aleatória: UUID de 36 caracteres.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bruto)) return "aleatoria"

  if (bruto.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruto) ? "email" : null
  }

  const d = onlyDigits(bruto)
  if (d.length === 11 && isValidCpf(d)) return "cpf"
  if (d.length === 14 && isValidCnpj(d)) return "cnpj"
  // Telefone como chave leva o +55 na frente.
  if (normalizePhone(bruto) !== null) return "telefone"

  return null
}

export function isValidPixKey(input: string | null | undefined): boolean {
  return pixKeyKind(input) !== null
}

export const PIX_KEY_LABELS: Record<PixKeyKind, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
}

/** Exibe a chave já no formato do seu tipo. */
export function formatPixKey(input: string | null | undefined): string {
  const tipo = pixKeyKind(input)
  const bruto = String(input ?? "").trim()
  if (tipo === "cpf") return formatCpf(bruto)
  if (tipo === "cnpj") return formatCnpj(bruto)
  if (tipo === "telefone") return formatPhone(bruto)
  return bruto
}

// --- Auxiliar ----------------------------------------------------------------

function onlyDigits(input: string | null | undefined): string {
  return String(input ?? "").replace(/\D/g, "")
}
