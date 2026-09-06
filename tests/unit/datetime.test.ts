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

// O processo de teste corre em UTC (ver vitest.config.ts). É de propósito: na
// Vercel o servidor também corre em UTC, e é aí que uma conversão em falta
// atira uma lavagem da meia-noite para o dia anterior.

describe("fuso Europe/Lisbon", () => {
  it("usa a hora de Lisboa e não a do processo, no horário de verão", () => {
    // 20/07/2026 23:30 UTC = 21/07/2026 00:30 em Lisboa (WEST, UTC+1).
    const instante = new Date("2026-07-20T23:30:00Z")
    expect(formatTime(instante)).toBe("00:30")
    expect(toISODate(instante)).toBe("2026-07-21")
    expect(formatDateTime(instante)).toBe("21/07/2026 00:30")
  })

  it("acompanha o horário de inverno, em que Lisboa é igual a UTC", () => {
    // Em janeiro Portugal continental está em WET (UTC+0).
    const instante = new Date("2026-01-15T23:30:00Z")
    expect(formatTime(instante)).toBe("23:30")
    expect(toISODate(instante)).toBe("2026-01-15")
  })

  it("mostra a meia-noite como 00:00 e não como 24:00", () => {
    expect(formatTime(new Date("2026-01-15T00:00:00Z"))).toBe("00:00")
  })

  it("calcula hoje e o mês corrente em Lisboa", () => {
    const instante = new Date("2026-07-31T23:45:00Z") // 01/08 em Lisboa
    expect(todayISO(instante)).toBe("2026-08-01")
    expect(currentMonthKey(instante)).toBe("2026-08")
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

describe("cronómetro do Kanban", () => {
  it("conta os minutos decorridos", () => {
    const agora = new Date("2026-03-12T10:00:00Z")
    expect(minutesSince(new Date("2026-03-12T09:15:00Z"), agora)).toBe(45)
  })

  it("nunca devolve negativo com relógios dessincronizados", () => {
    const agora = new Date("2026-03-12T10:00:00Z")
    expect(minutesSince(new Date("2026-03-12T10:05:00Z"), agora)).toBe(0)
  })
})
