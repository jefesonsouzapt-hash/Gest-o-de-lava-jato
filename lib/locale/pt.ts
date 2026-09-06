// Validadores e formatadores dos identificadores portugueses: NIF, telemóvel,
// código postal e matrícula. Tudo o que entra no sistema passa por aqui antes
// de chegar à base de dados.

// --- NIF ---------------------------------------------------------------------

// Primeiro dígito (ou dois primeiros) válidos segundo a AT.
// 1,2 particulares · 3 outros · 5 pessoas coletivas · 6 organismos públicos
// 8 empresário em nome individual · 9 e 45,70..79,90..99 casos especiais.
const NIF_PREFIXOS_UM_DIGITO = ["1", "2", "3", "5", "6", "8"]
const NIF_PREFIXOS_DOIS_DIGITOS = [
  "45", "70", "71", "72", "74", "75", "77", "78", "79",
  "90", "91", "98", "99",
]

/**
 * Valida um NIF português: 9 dígitos, prefixo reconhecido e dígito de controlo
 * por módulo 11 sobre os oito primeiros.
 */
export function isValidNif(input: string): boolean {
  const nif = onlyDigits(input)
  if (nif.length !== 9) return false

  const prefixoOk =
    NIF_PREFIXOS_UM_DIGITO.includes(nif[0]) || NIF_PREFIXOS_DOIS_DIGITOS.includes(nif.slice(0, 2))
  if (!prefixoOk) return false

  // Pesos decrescentes de 9 a 2 sobre os oito primeiros dígitos.
  let soma = 0
  for (let i = 0; i < 8; i++) soma += Number(nif[i]) * (9 - i)

  const resto = soma % 11
  // Resto 0 ou 1 não tem complemento possível dentro de um dígito: controlo é 0.
  const controlo = resto < 2 ? 0 : 11 - resto

  return controlo === Number(nif[8])
}

/** Exibição do NIF agrupada de três em três: `123 456 789`. */
export function formatNif(input: string | null | undefined): string {
  const nif = onlyDigits(input)
  if (nif.length !== 9) return input ?? ""
  return `${nif.slice(0, 3)} ${nif.slice(3, 6)} ${nif.slice(6)}`
}

// --- Telemóvel / telefone ----------------------------------------------------

/**
 * Normaliza para o formato E.164 português: `+3519XXXXXXXX`.
 *
 * Aceita o que as pessoas escrevem de facto: `912345678`, `912 345 678`,
 * `+351 912 345 678`, `00351912345678`. Devolve `null` quando não dá um número
 * português de 9 dígitos.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let d = onlyDigits(input)
  if (!d) return null

  // Indicativo internacional escrito como 00351 ou 351.
  if (d.startsWith("00351")) d = d.slice(5)
  else if (d.length > 9 && d.startsWith("351")) d = d.slice(3)

  if (d.length !== 9) return null
  // 9 = móvel, 2 = fixo. Qualquer outro início não é número nacional.
  if (!/^[29]/.test(d)) return null

  return `+351${d}`
}

/** Um número português válido, móvel ou fixo. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null
}

/** Telemóvel: 9 dígitos começados por 91, 92, 93 ou 96. */
export function isValidMobile(input: string | null | undefined): boolean {
  const e164 = normalizePhone(input)
  return e164 !== null && /^\+3519[1236]\d{7}$/.test(e164)
}

/** Exibição nacional: `912 345 678`. */
export function formatPhone(input: string | null | undefined): string {
  const e164 = normalizePhone(input)
  if (!e164) return input ?? ""
  const d = e164.slice(4)
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

/** Ligação de WhatsApp a partir de um número já normalizado. */
export function whatsappLink(input: string | null | undefined, mensagem?: string): string | null {
  const e164 = normalizePhone(input)
  if (!e164) return null
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""
  return `https://wa.me/${e164.replace("+", "")}${texto}`
}

// --- Código postal -----------------------------------------------------------

/** Código postal português: quatro dígitos, hífen, três dígitos. */
export function isValidPostalCode(input: string | null | undefined): boolean {
  const d = onlyDigits(input)
  // O primeiro dígito identifica o distrito e nunca é zero.
  return d.length === 7 && d[0] !== "0"
}

export function formatPostalCode(input: string | null | undefined): string {
  const d = onlyDigits(input)
  if (d.length !== 7) return input ?? ""
  return `${d.slice(0, 4)}-${d.slice(4)}`
}

// --- Matrícula ---------------------------------------------------------------

// Os quatro formatos em circulação, do mais antigo ao atual. Todos têm seis
// caracteres em três pares.
const MATRICULA_FORMATOS = [
  /^[A-Z]{2}\d{2}\d{2}$/, // AA-00-00  (até 1992)
  /^\d{2}\d{2}[A-Z]{2}$/, // 00-00-AA  (1992-2005)
  /^\d{2}[A-Z]{2}\d{2}$/, // 00-AA-00  (2005-2020)
  /^[A-Z]{2}\d{2}[A-Z]{2}$/, // AA-00-AA  (desde 2020)
]

/** Guarda-se sem hífenes e em maiúsculas; é assim que a busca compara. */
export function normalizePlate(input: string | null | undefined): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function isValidPlate(input: string | null | undefined): boolean {
  const p = normalizePlate(input)
  if (p.length !== 6) return false
  return MATRICULA_FORMATOS.some((formato) => formato.test(p))
}

/** Exibição com hífenes: `AA-00-AA`. */
export function formatPlate(input: string | null | undefined): string {
  const p = normalizePlate(input)
  if (p.length !== 6) return String(input ?? "")
  return `${p.slice(0, 2)}-${p.slice(2, 4)}-${p.slice(4)}`
}

// --- Auxiliar ----------------------------------------------------------------

function onlyDigits(input: string | null | undefined): string {
  return String(input ?? "").replace(/\D/g, "")
}
