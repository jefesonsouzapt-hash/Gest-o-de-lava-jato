// Peças que toda server action de formulário usa.
//
// Não é `"use server"`: aqui só vive código auxiliar. Num arquivo de actions
// tudo que é exportado vira endpoint HTTP.

import type { FieldErrors } from "@/lib/validation/schemas"

export type ActionState =
  | { ok: true }
  | { ok: false; errors: FieldErrors; values?: Record<string, string> }
  | null

export type SimpleResult = { ok: boolean; error?: string }

/**
 * Devolve ao formulário o que o usuário digitou.
 *
 * O React 19 limpa um formulário não controlado assim que a ação termina, e
 * sem isto um dígito errado no CPF apagava o cadastro inteiro. Campos de senha
 * nunca voltam.
 */
export function echoValues(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const chave of new Set(formData.keys())) {
    if (/password|senha/i.test(chave)) continue
    const valor = formData.get(chave)
    if (typeof valor === "string") valores[chave] = valor
  }
  return valores
}

/** Inteiro vindo de um campo de formulário; `null` quando não dá para ler. */
export function intField(formData: FormData, chave: string): number | null {
  const bruto = String(formData.get(chave) ?? "").trim()
  if (!bruto) return null
  const n = Number.parseInt(bruto, 10)
  return Number.isFinite(n) ? n : null
}
