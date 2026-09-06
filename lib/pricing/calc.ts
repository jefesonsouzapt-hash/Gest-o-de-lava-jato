// Preço de um serviço e total de uma ordem de serviço.
//
// Funções puras sobre centavos inteiros. Nenhuma consulta ao banco: é o que
// permite testar a conta da nota sem subir um Postgres, e é onde um erro sai
// direto do caixa do lava jato.

import { fromBps, issFromRevenue } from "@/lib/locale/money"
import { VEHICLE_CATEGORY_FACTORS_PCT } from "@/lib/domain"

export type VehicleCategory = "moto" | "hatch" | "sedan" | "suv" | "caminhonete"

/**
 * Preço de um serviço para a categoria do veículo que chegou.
 *
 * A tabela por categoria manda quando existe — é o preço que o dono digitou.
 * Sem linha na tabela, o preço sai do porte, arredondado para cima ao real
 * inteiro: uma caminhonete consome mais produto e mais tempo que um hatch, e
 * cobrar o mesmo dos dois é trabalhar de graça em metade dos carros.
 *
 * Arredondar **para cima** é deliberado: no balcão ninguém cobra R$ 40,26.
 */
export function priceForVehicle(input: {
  basePriceCents: number
  category: VehicleCategory
  /** Preço específico daquela categoria, quando o dono cadastrou um. */
  tablePriceCents?: number | null
}): number {
  if (input.tablePriceCents != null && input.tablePriceCents >= 0) {
    return Math.trunc(input.tablePriceCents)
  }

  const base = Math.max(Math.trunc(input.basePriceCents), 0)
  if (base === 0) return 0

  // Tudo inteiro até o fim: base × porcentagem é exato, e só então divide.
  const pct = VEHICLE_CATEGORY_FACTORS_PCT[input.category] ?? 100
  return Math.ceil((base * pct) / 10_000) * 100
}

/** Duração estimada, mesma lógica de porte, arredondada a 5 minutos. */
export function durationForVehicle(input: {
  baseMinutes: number
  category: VehicleCategory
  tableMinutes?: number | null
}): number {
  if (input.tableMinutes != null && input.tableMinutes > 0) return Math.trunc(input.tableMinutes)

  const base = Math.max(Math.trunc(input.baseMinutes), 0)
  const pct = VEHICLE_CATEGORY_FACTORS_PCT[input.category] ?? 100
  return Math.ceil((base * pct) / 500) * 5
}

export type OrderItem = { quantity: number; unitPriceCents: number }

export type OrderTotals = {
  subtotalCents: number
  discountCents: number
  totalCents: number
  issCents: number
}

/**
 * Totais de uma ordem.
 *
 * O desconto nunca passa do subtotal: uma ordem não termina negativa, e um
 * desconto digitado a mais não vira troco. O ISS incide sobre o total
 * efetivamente cobrado, não sobre o subtotal — o imposto acompanha o dinheiro
 * que entrou.
 */
export function orderTotals(itens: OrderItem[], discountCents = 0, issRatePercent = 5): OrderTotals {
  const subtotal = itens.reduce((soma, item) => {
    const qtd = Math.max(Math.trunc(Number.isFinite(item.quantity) ? item.quantity : 0), 0)
    const preco = Math.max(Math.trunc(Number.isFinite(item.unitPriceCents) ? item.unitPriceCents : 0), 0)
    return soma + qtd * preco
  }, 0)

  const desconto = Math.min(Math.max(Math.trunc(discountCents), 0), subtotal)
  const total = subtotal - desconto

  return {
    subtotalCents: subtotal,
    discountCents: desconto,
    totalCents: total,
    issCents: issFromRevenue(total, issRatePercent),
  }
}

/**
 * Quanto um item rende de comissão, com a regra congelada na venda.
 *
 * O percentual incide sobre o valor do item **já multiplicado pela
 * quantidade**; o valor fixo é por serviço executado. Percentual e fixo somam
 * quando os dois estão preenchidos — é assim que se paga "10 % + R$ 5 por
 * carro" sem inventar um terceiro tipo de regra.
 */
export function itemCommission(item: {
  quantity: number
  unitPriceCents: number
  commissionBps: number
  commissionFixedCents: number
}): number {
  const qtd = Math.max(Math.trunc(item.quantity), 0)
  const preco = Math.max(Math.trunc(item.unitPriceCents), 0)
  const bps = Math.max(Math.trunc(item.commissionBps), 0)
  const fixo = Math.max(Math.trunc(item.commissionFixedCents), 0)

  return fromBps(qtd * preco, bps) + fixo * qtd
}

export type PaymentLike = { amountCents: number; voidedAt?: Date | string | null }

/**
 * O que ainda falta receber de uma ordem.
 *
 * Pagamento estornado não conta: a linha continua no histórico, mas o dinheiro
 * voltou. Nunca negativo — quem pagou a mais recebe troco, não vira credor.
 */
export function amountDue(totalCents: number, pagamentos: PaymentLike[]): number {
  const pago = pagamentos
    .filter((p) => !p.voidedAt)
    .reduce((soma, p) => soma + Math.max(Math.trunc(p.amountCents), 0), 0)
  return Math.max(Math.trunc(totalCents) - pago, 0)
}

/**
 * Uma ordem está quitada quando não falta nada **e** houve recebimento.
 *
 * Sem a segunda metade, uma ordem de R$ 0,00 e uma ordem cujos pagamentos
 * foram todos estornados apareceriam como pagas — e a comissão do lavador
 * seria creditada por dinheiro que não entrou.
 */
export function isSettled(totalCents: number, pagamentos: PaymentLike[]): boolean {
  const validos = pagamentos.filter((p) => !p.voidedAt)
  if (validos.length === 0) return false
  return amountDue(totalCents, pagamentos) === 0
}
