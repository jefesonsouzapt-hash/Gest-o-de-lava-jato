"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  auditLogs,
  commissionEntries,
  customers,
  inventoryProducts,
  loyaltyTransactions,
  payments,
  serviceConsumables,
  services,
  staff,
  staffCommissionRules,
  stockMovements,
  workOrderItems,
  workOrders,
} from "@/lib/db/schema"
import { tryPermission } from "@/lib/auth/guard"
import { parseForm, paymentSchema } from "@/lib/validation/schemas"
import { amountDue, isSettled, itemCommission } from "@/lib/pricing/calc"
import { resolveCommissionRule } from "@/lib/payroll/calc"
import { currentMonthKey } from "@/lib/locale/datetime"
import { LOYALTY_TARGET } from "@/lib/loyalty"
import { echoValues, intField, type ActionState, type SimpleResult } from "@/lib/actions/form"

function revalidar(orderId?: number) {
  revalidatePath("/caixa")
  revalidatePath("/ordens")
  revalidatePath("/painel")
  revalidatePath("/relatorios")
  revalidatePath("/equipe")
  if (orderId) revalidatePath(`/ordens/${orderId}`)
}

/**
 * Recebe (parte de) uma ordem.
 *
 * Quando o recebimento **quita** a ordem, três coisas acontecem juntas, na
 * mesma transação: a comissão é creditada, o cartão de fidelidade é carimbado
 * e o estoque é baixado. Fora da transação, uma falha no meio deixaria o
 * lavador sem comissão de um serviço que o cliente já pagou.
 *
 * A comissão nasce no **pagamento**, não na conclusão: serviço entregue e não
 * pago é dívida do cliente, não ganho do lavador.
 */
export async function registerPayment(_estado: ActionState, formData: FormData): Promise<ActionState> {
  const portao = await tryPermission("pagamento.receber")
  if (!portao.ok) return { ok: false, errors: { _: portao.message } }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, errors: { _: "Ordem inválida." } }

  const analisado = parseForm(paymentSchema, formData)
  if (!analisado.ok) return { ok: false, errors: analisado.errors, values: echoValues(formData) }

  const [ordem] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, errors: { _: "Ordem não encontrada." } }
  if (ordem.canceledAt) return { ok: false, errors: { _: "Esta ordem está cancelada." } }

  const jaPagos = await db.select().from(payments).where(eq(payments.workOrderId, orderId))
  const falta = amountDue(ordem.totalCents, jaPagos)

  if (falta === 0) return { ok: false, errors: { _: "Esta ordem já está quitada." } }
  if (analisado.data.amountCents > falta) {
    // Cobrar mais do que falta vira crédito que ninguém sabe devolver.
    return {
      ok: false,
      errors: { amountCents: "O valor é maior do que falta receber nesta ordem." },
      values: echoValues(formData),
    }
  }

  const quitou = analisado.data.amountCents === falta

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      companyId: actor.companyId,
      workOrderId: orderId,
      method: analisado.data.method,
      amountCents: analisado.data.amountCents,
      reference: analisado.data.reference,
      receivedByUserId: actor.userId,
    })

    if (quitou) {
      await creditarComissoes(tx as unknown as typeof db, actor.companyId, ordem)
      await carimbarFidelidade(tx as unknown as typeof db, actor.companyId, ordem)
      await baixarEstoque(tx as unknown as typeof db, actor.companyId, actor.userId, ordem)
    }

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "pagamento.recebido",
      entity: "work_orders",
      entityId: String(orderId),
      after: JSON.stringify({
        method: analisado.data.method,
        amountCents: analisado.data.amountCents,
        quitou,
      }),
    })
  })

  revalidar(orderId)
  return { ok: true }
}

/**
 * Estorna um recebimento.
 *
 * A linha **nunca é apagada**: o caixa do dia tem de mostrar que entrou e
 * saiu. A comissão do serviço é estornada junto — o dinheiro voltou, o ganho
 * também.
 */
export async function voidPayment(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("pagamento.estornar")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const paymentId = intField(formData, "paymentId")
  if (paymentId == null) return { ok: false, error: "Pagamento inválido." }
  const motivo = String(formData.get("reason") ?? "").trim() || null

  const [pagamento] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.companyId, actor.companyId)))
    .limit(1)
  if (!pagamento) return { ok: false, error: "Pagamento não encontrado." }
  if (pagamento.voidedAt) return { ok: false, error: "Este pagamento já foi estornado." }

  const [ordem] = await db
    .select({ id: workOrders.id, deliveredAt: workOrders.deliveredAt })
    .from(workOrders)
    .where(eq(workOrders.id, pagamento.workOrderId))
    .limit(1)

  if (ordem?.deliveredAt) {
    // O carro já saiu: estornar aqui deixaria a ordem entregue e em aberto,
    // sem ninguém para cobrar.
    return { ok: false, error: "A ordem já foi entregue. Registre uma devolução em vez de estornar." }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ voidedAt: new Date(), voidReason: motivo })
      .where(eq(payments.id, paymentId))

    // Estorna a comissão que este pagamento creditou. A linha fica, marcada.
    await tx
      .update(commissionEntries)
      .set({ reversedAt: new Date(), reverseReason: motivo ?? "Pagamento estornado" })
      .where(
        and(
          eq(commissionEntries.companyId, actor.companyId),
          eq(commissionEntries.workOrderId, pagamento.workOrderId),
          sql`${commissionEntries.reversedAt} is null`,
        ),
      )

    await tx.insert(auditLogs).values({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "pagamento.estornado",
      entity: "payments",
      entityId: String(paymentId),
      after: JSON.stringify({ reason: motivo, amountCents: pagamento.amountCents }),
    })
  })

  revalidar(pagamento.workOrderId)
  return { ok: true }
}

type OrdemLinha = typeof workOrders.$inferSelect

/**
 * Credita a comissão de cada item ao colaborador da ordem.
 *
 * A regra sai da mesma função que a folha usa: categoria do colaborador →
 * regra geral dele → comissão do serviço → padrão dele. O valor é gravado —
 * um reajuste amanhã não muda o que já foi ganho.
 */
async function creditarComissoes(tx: typeof db, companyId: number, ordem: OrdemLinha): Promise<void> {
  if (ordem.assignedStaffId == null) return

  const [colaborador] = await tx
    .select()
    .from(staff)
    .where(and(eq(staff.id, ordem.assignedStaffId), eq(staff.companyId, companyId)))
    .limit(1)
  if (!colaborador) return

  const itens = await tx.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, ordem.id))
  if (itens.length === 0) return

  const regras = await tx
    .select()
    .from(staffCommissionRules)
    .where(eq(staffCommissionRules.staffId, colaborador.id))

  const idsServico = itens.map((i) => i.serviceId).filter((id): id is number => id != null)
  const categoriasPorServico = new Map<number, number | null>()
  if (idsServico.length > 0) {
    const linhas = await tx
      .select({ id: services.id, categoryId: services.categoryId })
      .from(services)
      .where(inArray(services.id, idsServico))
    for (const l of linhas) categoriasPorServico.set(l.id, l.categoryId)
  }

  const padrao = {
    kind: colaborador.commissionKind,
    bps: colaborador.commissionBps,
    fixedCents: colaborador.commissionFixedCents,
  }
  const geral = regras.find((r) => r.serviceCategoryId == null)
  const competencia = currentMonthKey()

  const aInserir = itens
    .map((item) => {
      const categoriaId = item.serviceId != null ? categoriasPorServico.get(item.serviceId) ?? null : null
      const porCategoria = categoriaId != null ? regras.find((r) => r.serviceCategoryId === categoriaId) : undefined

      const regra = resolveCommissionRule({
        categoryRule: porCategoria
          ? { kind: porCategoria.kind, bps: porCategoria.bps, fixedCents: porCategoria.fixedCents }
          : null,
        staffGeneralRule: geral ? { kind: geral.kind, bps: geral.bps, fixedCents: geral.fixedCents } : null,
        serviceCommissionBps: item.commissionBps,
        staffDefault: padrao,
      })

      const valor = itemCommission({
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        commissionBps: regra.kind === "percentual" ? regra.bps : 0,
        commissionFixedCents: regra.kind === "valor_fixo" ? regra.fixedCents : 0,
      })

      return valor > 0
        ? {
            companyId,
            staffId: colaborador.id,
            workOrderId: ordem.id,
            workOrderItemId: item.id,
            // O nome do serviço é copiado para o extrato do colaborador: se o
            // item for apagado, ele ainda vê pelo que ganhou.
            description: item.description,
            competenceMonth: competencia,
            baseCents: item.quantity * item.unitPriceCents,
            kind: regra.kind,
            bps: regra.kind === "percentual" ? regra.bps : 0,
            fixedCents: regra.kind === "valor_fixo" ? regra.fixedCents : 0,
            amountCents: valor,
          }
        : null
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  if (aInserir.length === 0) return

  // Índice único por item: reprocessar a quitação não credita duas vezes.
  await tx.insert(commissionEntries).values(aInserir).onConflictDoNothing()
}

/**
 * Carimba o cartão de fidelidade.
 *
 * Um carimbo por ordem, e só se houve serviço que conta. Ao completar o
 * cartão, os carimbos são resgatados e o saldo recomeça — não acumula um
 * segundo cartão em silêncio.
 */
async function carimbarFidelidade(tx: typeof db, companyId: number, ordem: OrdemLinha): Promise<void> {
  const itens = await tx.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, ordem.id))
  const idsServico = itens.map((i) => i.serviceId).filter((id): id is number => id != null)
  if (idsServico.length === 0) return

  const contam = await tx
    .select({ id: services.id })
    .from(services)
    .where(and(inArray(services.id, idsServico), eq(services.countsForLoyalty, true)))
  if (contam.length === 0) return

  const [cliente] = await tx
    .select({ id: customers.id, loyaltyStamps: customers.loyaltyStamps })
    .from(customers)
    .where(and(eq(customers.id, ordem.customerId), eq(customers.companyId, companyId)))
    .limit(1)
  if (!cliente) return

  const saldo = cliente.loyaltyStamps + 1

  await tx.insert(loyaltyTransactions).values({
    companyId,
    customerId: cliente.id,
    workOrderId: ordem.id,
    kind: "carimbo",
    stamps: 1,
    balanceAfter: saldo,
  })

  await tx
    .update(customers)
    .set({ loyaltyStamps: saldo, updatedAt: new Date() })
    .where(eq(customers.id, cliente.id))
}

/**
 * Baixa do estoque o que o serviço consome.
 *
 * O consumo é o estimado no cadastro do serviço. O saldo pode ficar negativo
 * de propósito: significa que se usou produto que não estava lançado, e o
 * dono precisa ver isso, não descobrir um estoque parado em zero.
 */
async function baixarEstoque(
  tx: typeof db,
  companyId: number,
  userId: number,
  ordem: OrdemLinha,
): Promise<void> {
  const itens = await tx.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, ordem.id))
  const idsServico = itens.map((i) => i.serviceId).filter((id): id is number => id != null)
  if (idsServico.length === 0) return

  const consumos = await tx
    .select()
    .from(serviceConsumables)
    .where(inArray(serviceConsumables.serviceId, idsServico))
  if (consumos.length === 0) return

  // Um produto pode ser consumido por mais de um serviço da mesma ordem.
  const porProduto = new Map<number, number>()
  for (const item of itens) {
    if (item.serviceId == null) continue
    for (const consumo of consumos.filter((c) => c.serviceId === item.serviceId)) {
      const atual = porProduto.get(consumo.productId) ?? 0
      porProduto.set(consumo.productId, atual + consumo.quantityMilli * item.quantity)
    }
  }

  for (const [productId, quantidade] of porProduto) {
    if (quantidade <= 0) continue

    const alterados = await tx
      .update(inventoryProducts)
      .set({ stockMilli: sql`${inventoryProducts.stockMilli} - ${quantidade}`, updatedAt: new Date() })
      .where(and(eq(inventoryProducts.id, productId), eq(inventoryProducts.companyId, companyId)))
      .returning({ id: inventoryProducts.id })

    if (alterados.length === 0) continue

    await tx.insert(stockMovements).values({
      companyId,
      productId,
      kind: "consumo",
      quantityMilli: -quantidade,
      workOrderId: ordem.id,
      userId,
      notes: `Consumo da ordem ${ordem.reference}`,
    })
  }
}

/**
 * Resgata o cartão de fidelidade: zera os carimbos e marca o prêmio na ordem.
 *
 * Só com o cartão completo, e só uma vez por ordem — senão o mesmo cartão
 * pagaria duas lavagens.
 */
export async function redeemLoyalty(formData: FormData): Promise<SimpleResult> {
  const portao = await tryPermission("fidelidade.gerir")
  if (!portao.ok) return { ok: false, error: portao.message }
  const actor = portao.actor

  const orderId = intField(formData, "workOrderId")
  if (orderId == null) return { ok: false, error: "Ordem inválida." }

  const [ordem] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, orderId), eq(workOrders.companyId, actor.companyId)))
    .limit(1)
  if (!ordem) return { ok: false, error: "Ordem não encontrada." }
  if (ordem.loyaltyRewardApplied) return { ok: false, error: "Esta ordem já usou o prêmio de fidelidade." }

  const pagos = await db.select().from(payments).where(eq(payments.workOrderId, orderId))
  if (isSettled(ordem.totalCents, pagos)) {
    return { ok: false, error: "Ordem já quitada. O prêmio precisa ser aplicado antes do pagamento." }
  }

  const [cliente] = await db
    .select({ id: customers.id, loyaltyStamps: customers.loyaltyStamps })
    .from(customers)
    .where(and(eq(customers.id, ordem.customerId), eq(customers.companyId, actor.companyId)))
    .limit(1)
  if (!cliente) return { ok: false, error: "Cliente não encontrado." }
  if (cliente.loyaltyStamps < LOYALTY_TARGET) {
    return { ok: false, error: `Faltam ${LOYALTY_TARGET - cliente.loyaltyStamps} carimbos para o prêmio.` }
  }

  const saldo = cliente.loyaltyStamps - LOYALTY_TARGET

  await db.transaction(async (tx) => {
    await tx.insert(loyaltyTransactions).values({
      companyId: actor.companyId,
      customerId: cliente.id,
      workOrderId: orderId,
      kind: "resgate",
      stamps: -LOYALTY_TARGET,
      balanceAfter: saldo,
    })

    await tx
      .update(customers)
      .set({ loyaltyStamps: saldo, updatedAt: new Date() })
      .where(eq(customers.id, cliente.id))

    // O prêmio é a lavagem mais barata da ordem, virada em desconto.
    const itens = await tx.select().from(workOrderItems).where(eq(workOrderItems.workOrderId, orderId))
    const maisBarato = itens.reduce(
      (menor, i) => (menor == null || i.unitPriceCents < menor ? i.unitPriceCents : menor),
      null as number | null,
    )
    const desconto = Math.min(ordem.subtotalCents, (maisBarato ?? 0) + ordem.discountCents)

    const { orderTotals } = await import("@/lib/pricing/calc")
    const { companies } = await import("@/lib/db/schema")
    const [empresa] = await tx.select({ issBps: companies.issBps }).from(companies).where(eq(companies.id, actor.companyId)).limit(1)
    const totais = orderTotals(itens, desconto, (empresa?.issBps ?? 500) / 100)

    await tx
      .update(workOrders)
      .set({
        loyaltyRewardApplied: true,
        discountCents: totais.discountCents,
        totalCents: totais.totalCents,
        issCents: totais.issCents,
        updatedAt: new Date(),
      })
      .where(eq(workOrders.id, orderId))
  })

  revalidar(orderId)
  return { ok: true }
}
