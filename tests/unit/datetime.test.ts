import { describe, expect, it } from "vitest"
import {
  currentMonthKey,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDuration,
  formatTime,
  minutesSince,
  monthTitle,
  toISODate,
  todayISO,
} from "@/lib/locale/datetime"

// O processo de teste roda em UTC (ver vitest.config.ts). É de propósito: na
// Vercel o servidor também roda em UTC, e é aí que uma conversão faltando joga
// uma lavagem do fim da tarde para o dia seguinte.

describe("fuso America/Sao_Paulo", () => {
  it("usa a hora de São Paulo e não a do processo", () => {
    // 21/07/2026 02:30 UTC = 20/07/2026 23:30 em São Paulo (UTC-3).
    // Sem a conversão, uma lavagem entregue às 23:30 entraria no faturamento
    // do dia seguinte e o caixa do dia fecharia errado.
    const instante = new Date("2026-07-21T02:30:00Z")
    expect(formatTime(instante)).toBe("23:30")
    expect(toISODate(instante)).toBe("2026-07-20")
    expect(formatDateTime(instante)).toBe("20/07/2026 23:30")
  })

  it("mantém o mesmo dia no meio do expediente", () => {
    const instante = new Date("2026-01-15T17:00:00Z") // 14:00 em São Paulo
    expect(formatTime(instante)).toBe("14:00")
    expect(toISODate(instante)).toBe("2026-01-15")
  })

  it("mostra a meia-noite como 00:00 e não como 24:00", () => {
    expect(formatTime(new Date("2026-01-15T03:00:00Z"))).toBe("00:00")
  })

  it("calcula hoje e o mês corrente em São Paulo", () => {
    // 01/08 02:00 UTC ainda é 31/07 em São Paulo: o fechamento do mês tem de
    // seguir o calendário do lava jato, não o do servidor.
    const instante = new Date("2026-08-01T02:00:00Z")
    expect(todayISO(instante)).toBe("2026-07-31")
    expect(currentMonthKey(instante)).toBe("2026-07")
  })

  it("devolve um traço para instante ausente ou inválido", () => {
    expect(formatTime(null)).toBe("—")
    expect(formatTime(undefined)).toBe("—")
    expect(formatTime("não é data")).toBe("—")
    expect(formatDateTime(null)).toBe("—")
  })
})

describe("formatação de datas", () => {
  it("converte ISO para o formato português", () => {
    expect(formatDate("2026-03-12")).toBe("12/03/2026")
    expect(formatDateLong("2026-03-12")).toBe("12 de março")
  })

  it("devolve a entrada intacta quando não é uma data ISO", () => {
    expect(formatDate("")).toBe("")
    expect(formatDate("qualquer coisa")).toBe("qualquer coisa")
  })

  it("escreve o mês com maiúscula no título", () => {
    expect(monthTitle("2026-03")).toBe("Março de 2026")
    expect(monthTitle("2026-12")).toBe("Dezembro de 2026")
  })
})

describe("duração", () => {
  it("escreve como no balcão", () => {
    expect(formatDuration(15)).toBe("15 min")
    expect(formatDuration(45)).toBe("45 min")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(80)).toBe("1h20")
    expect(formatDuration(180)).toBe("3h")
  })

  it("trata valores inválidos como zero", () => {
    expect(formatDuration(-10)).toBe("0 min")
    expect(formatDuration(Number.NaN)).toBe("0 min")
  })
})

describe("cronômetro do Kanban", () => {
  it("conta os minutos decorridos", () => {
    const agora = new Date("2026-03-12T10:00:00Z")
    expect(minutesSince(new Date("2026-03-12T09:15:00Z"), agora)).toBe(45)
  })

  it("nunca devolve negativo com relógios fora de sincronia", () => {
    const agora = new Date("2026-03-12T10:00:00Z")
    expect(minutesSince(new Date("2026-03-12T10:05:00Z"), agora)).toBe(0)
  })
})
