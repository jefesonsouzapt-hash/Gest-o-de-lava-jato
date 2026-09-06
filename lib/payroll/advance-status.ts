// Situação e parcela de um vale, do lado do servidor.
//
// Este arquivo **não** é `"use server"` de propósito. Num arquivo de server
// actions toda função exportada vira um endpoint HTTP chamável pelo navegador,
// e estas funções recebem um id de vale: exportá-las de lá abriria uma escrita
// sem autenticação em vale de outro lava jato.

import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { advanceDeductions, employeeAdvances } from "@/lib/db/schema"
import { remainingBalance } from "@/lib/payroll/calc"

/** Soma das parcelas já descontadas de um vale. */
export async function totalAbatido(advanceId: number): Promise<number> {
  const [linha] = await db
    .select({ total: sql<string>`coalesce(sum(${advanceDeductions.amountCents}), 0)` })
    .from(advanceDeductions)
    .where(eq(advanceDeductions.advanceId, advanceId))
  return Number.parseInt(linha?.total ?? "0", 10) || 0
}

/**
 * Recalcula a situação do vale a partir do que já foi abatido.
 *
 * Chamada só por dentro de uma action que já passou pelo portão de permissão
 * e já conferiu que o vale é da empresa do usuário.
 */
export async function atualizarStatusDoVale(advanceId: number): Promise<void> {
  const [vale] = await db
    .select({ amountCents: employeeAdvances.amountCents, paidAt: employeeAdvances.paidAt })
    .from(employeeAdvances)
    .where(eq(employeeAdvances.id, advanceId))
    .limit(1)
  if (!vale) return

  const jaAbatido = await totalAbatido(advanceId)
  const restante = remainingBalance({ amountCents: vale.amountCents, deductedCents: jaAbatido })

  const status = !vale.paidAt ? "pendente" : restante === 0 ? "quitado" : jaAbatido > 0 ? "parcialmente_abatido" : "pago"

  await db
    .update(employeeAdvances)
    .set({ status, updatedAt: new Date() })
    .where(eq(employeeAdvances.id, advanceId))
}
