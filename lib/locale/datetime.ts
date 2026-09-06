// Datas e horas em America/Sao_Paulo, formato de 24 horas.
//
// O servidor roda em UTC (é o caso na Vercel), por isso nada aqui usa os
// getters locais do `Date`: uma lavagem registrada às 22h em São Paulo cairia
// no dia seguinte se o fuso fosse o da máquina.

export const TIMEZONE = "America/Sao_Paulo"
export const LOCALE = "pt-BR"

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Partes da data já convertidas para o fuso de São Paulo. */
function partsInSaoPaulo(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Em 24h o `Intl` devolve "24" para a meia-noite em alguns motores.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  }
}

/** Data de hoje em São Paulo, no formato ISO `AAAA-MM-DD` usado no banco. */
export function todayISO(now: Date = new Date()): string {
  const { year, month, day } = partsInSaoPaulo(now)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Mês corrente em São Paulo, `AAAA-MM`. */
export function currentMonthKey(now: Date = new Date()): string {
  const { year, month } = partsInSaoPaulo(now)
  return `${year}-${pad(month)}`
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`. */
export function formatDate(iso: string): string {
  const [y, m, d] = String(iso ?? "").split("-")
  if (!y || !m || !d) return iso ?? ""
  return `${d}/${m}/${y}`
}

/** `AAAA-MM-DD` → `12 de março`. */
export function formatDateLong(iso: string): string {
  const [y, m, d] = String(iso ?? "").split("-").map(Number)
  if (!y || !m || !d) return iso ?? ""
  return `${pad(d)} de ${MESES[m - 1]}`
}

/** Hora de um instante, em São Paulo: `14:35`. */
export function formatTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  const d = toDate(value)
  if (!d) return "—"
  const { hour, minute } = partsInSaoPaulo(d)
  return `${pad(hour)}:${pad(minute)}`
}

/** Data e hora de um instante, em São Paulo: `12/03/2026 14:35`. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  const d = toDate(value)
  if (!d) return "—"
  const { year, month, day, hour, minute } = partsInSaoPaulo(d)
  return `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`
}

/** Data ISO de um instante, em São Paulo. */
export function toISODate(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return ""
  const { year, month, day } = partsInSaoPaulo(d)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** `AAAA-MM` → `Março de 2026`. */
export function monthTitle(ym: string): string {
  const [y, m] = String(ym ?? "").split("-").map(Number)
  if (!y || !m) return ym ?? ""
  const nome = MESES[m - 1] ?? ""
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${y}`
}

export function monthLabelShort(monthIndex: number): string {
  return MESES_CURTOS[monthIndex] ?? ""
}

/**
 * Duração em minutos escrita como no balcão: `45 min`, `1h`, `1h20`.
 */
export function formatDuration(minutes: number): string {
  const m = Math.max(Math.round(Number.isFinite(minutes) ? minutes : 0), 0)
  if (m < 60) return `${m} min`
  const horas = Math.floor(m / 60)
  const resto = m % 60
  return resto === 0 ? `${horas}h` : `${horas}h${pad(resto)}`
}

/**
 * Tempo decorrido desde um instante, para o cronômetro do Kanban.
 * Retorna minutos inteiros; negativo é tratado como zero (relógios fora de sincronia).
 */
export function minutesSince(value: Date | string | number, now: Date = new Date()): number {
  const d = toDate(value)
  if (!d) return 0
  return Math.max(Math.floor((now.getTime() - d.getTime()) / 60000), 0)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
