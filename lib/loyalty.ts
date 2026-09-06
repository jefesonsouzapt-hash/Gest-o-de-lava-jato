// Regras do cartão de fidelidade.
//
// Não é `"use server"`: um arquivo de actions só pode exportar função async, e
// uma constante exportada de lá derruba o build inteiro — sem aparecer no
// typecheck.

/** Carimbos para ganhar o prêmio. */
export const LOYALTY_TARGET = 10

/** Quantos carimbos ainda faltam para o prêmio. Nunca negativo. */
export function stampsToReward(stamps: number): number {
  return Math.max(LOYALTY_TARGET - Math.max(Math.trunc(stamps), 0), 0)
}

/** O cartão está completo? */
export function canRedeem(stamps: number): boolean {
  return stampsToReward(stamps) === 0
}
