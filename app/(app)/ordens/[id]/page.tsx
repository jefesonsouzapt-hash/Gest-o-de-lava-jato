import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ClipboardCheck, Receipt } from "lucide-react"
import { and, eq } from "drizzle-orm"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { db } from "@/lib/db"
import { customers, inspectionDamages, vehicleInspections } from "@/lib/db/schema"
import { getWorkOrder } from "@/lib/queries/ordens"
import { listBays, listServices } from "@/lib/queries/catalogo"
import { listStaff } from "@/lib/queries/equipe"
import { PageHeader } from "@/components/page-header"
import { PhoneLink } from "@/components/phone-link"
import { AddItemForm, DiscountForm, OrderTotals, RemoveItemButton } from "@/components/order-items"
import { PaymentDialog, RedeemLoyaltyButton, VoidPaymentButton } from "@/components/payment-dialog"
import { InspectionForm } from "@/components/inspection-form"
import { AssignSelects, CancelOrderButton, ReopenOrderButton, StatusSelect } from "@/components/order-actions"
import { LOYALTY_TARGET } from "@/lib/loyalty"
import { formatCurrency } from "@/lib/locale/money"
import { formatDate, formatDateTime } from "@/lib/locale/datetime"
import {
  INSPECTION_DAMAGE_LABELS,
  PAYMENT_METHOD_LABELS,
  VEHICLE_AREAS,
  VEHICLE_CATEGORY_LABELS,
  WORK_ORDER_STATUS_CLASSES,
  WORK_ORDER_STATUS_LABELS,
  label,
} from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function OrdemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("ordem.ver")
  const { id } = await params
  const ordemId = Number.parseInt(id, 10)
  if (!Number.isFinite(ordemId)) notFound()

  const ordem = await getWorkOrder(actor.companyId, ordemId)
  if (!ordem) notFound()

  const podeEditar = can(actor, "ordem.editar") && ordem.status !== "entregue" && !ordem.canceledAt
  const podeAvancar = can(actor, "ordem.avancar") && !ordem.canceledAt
  const podeReceber = can(actor, "pagamento.receber") && !ordem.canceledAt
  const podeEstornar = can(actor, "pagamento.estornar")
  const podeCancelar = can(actor, "ordem.cancelar") && !ordem.canceledAt && ordem.status !== "entregue"
  const podeVistoriar = can(actor, "vistoria.registrar") && !ordem.hasInspection && !ordem.canceledAt

  const [servicos, pistas, equipe, cliente] = await Promise.all([
    podeEditar ? listServices(actor.companyId) : Promise.resolve([]),
    podeAvancar ? listBays(actor.companyId) : Promise.resolve([]),
    podeAvancar ? listStaff(actor.companyId) : Promise.resolve([]),
    db
      .select({ id: customers.id, loyaltyStamps: customers.loyaltyStamps })
      .from(customers)
      .where(and(eq(customers.id, ordem.customerId), eq(customers.companyId, actor.companyId)))
      .limit(1),
  ])

  const carimbos = cliente[0]?.loyaltyStamps ?? 0

  const vistoria = ordem.hasInspection
    ? await db
        .select()
        .from(vehicleInspections)
        .where(eq(vehicleInspections.workOrderId, ordemId))
        .limit(1)
    : []

  const avarias = vistoria[0]
    ? await db.select().from(inspectionDamages).where(eq(inspectionDamages.inspectionId, vistoria[0].id))
    : []

  const nomeArea = (chave: string) => VEHICLE_AREAS.find((a) => a.key === chave)?.label ?? chave

  return (
    <>
      <Link
        href="/ordens"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Todas as ordens
      </Link>

      <PageHeader
        title={`Ordem ${ordem.reference}`}
        description={`${ordem.plate} · ${ordem.customerName} · ${formatDate(ordem.businessDate)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {podeAvancar && ordem.status !== "entregue" ? (
              <StatusSelect orderId={ordem.id} status={ordem.status} />
            ) : (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  WORK_ORDER_STATUS_CLASSES[ordem.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {label(WORK_ORDER_STATUS_LABELS, ordem.status)}
              </span>
            )}
            {podeAvancar && ordem.status === "entregue" && <ReopenOrderButton orderId={ordem.id} />}
            {podeCancelar && <CancelOrderButton orderId={ordem.id} reference={ordem.reference} />}
          </div>
        }
      />

      {ordem.canceledAt && (
        <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Ordem cancelada em {formatDateTime(ordem.canceledAt)}
          {ordem.cancelReason && ` — ${ordem.cancelReason}`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">
              Serviços <span className="font-normal text-muted-foreground">({ordem.items.length})</span>
            </h3>

            {ordem.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum serviço nesta ordem ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                      <th className="pb-2">Serviço</th>
                      <th className="pb-2 text-right">Qtd.</th>
                      <th className="pb-2 text-right">Unitário</th>
                      <th className="pb-2 text-right">Total</th>
                      {podeEditar && <th className="pb-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ordem.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5">{item.description}</td>
                        <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatCurrency(item.unitPriceCents)}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums">
                          {formatCurrency(item.quantity * item.unitPriceCents)}
                        </td>
                        {podeEditar && (
                          <td className="py-2.5 text-right">
                            <RemoveItemButton orderId={ordem.id} itemId={item.id} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {podeEditar && (
              <div className="mt-4 flex flex-col gap-4">
                <AddItemForm
                  orderId={ordem.id}
                  category={ordem.vehicleCategory}
                  servicos={servicos.map((s) => ({
                    id: s.id,
                    name: s.name,
                    basePriceCents: s.basePriceCents,
                    prices: s.prices.map((p) => ({ category: p.category, priceCents: p.priceCents })),
                  }))}
                />
                <DiscountForm orderId={ordem.id} discountCents={ordem.discountCents} />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Vistoria de entrada</h3>
              {podeVistoriar && <InspectionForm orderId={ordem.id} />}
            </div>

            {vistoria[0] ? (
              <div className="flex flex-col gap-3 text-sm">
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Quilometragem</dt>
                    <dd className="tabular-nums">
                      {vistoria[0].odometerKm != null ? `${vistoria[0].odometerKm.toLocaleString("pt-BR")} km` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Combustível</dt>
                    <dd className="tabular-nums">
                      {vistoria[0].fuelLevelPercent != null ? `${vistoria[0].fuelLevelPercent}%` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Conferido com</dt>
                    <dd>{vistoria[0].signedByName ?? "—"}</dd>
                  </div>
                </dl>

                {avarias.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Avarias já existentes na chegada
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {avarias.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning"
                        >
                          {nomeArea(a.area)}: {label(INSPECTION_DAMAGE_LABELS, a.kind)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {vistoria[0].personalItems && (
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Objetos no carro:</strong> {vistoria[0].personalItems}
                  </p>
                )}
                {vistoria[0].notes && <p className="text-xs text-muted-foreground">{vistoria[0].notes}</p>}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardCheck className="size-4 shrink-0" />
                Sem vistoria. Sem ela, uma reclamação por risco preexistente vira palavra contra palavra.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">
              Recebimentos <span className="font-normal text-muted-foreground">({ordem.payments.length})</span>
            </h3>

            {ordem.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada recebido ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ordem.payments.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3",
                      p.voidedAt && "opacity-60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {label(PAYMENT_METHOD_LABELS, p.method)}
                        {p.voidedAt && <span className="ml-2 text-xs text-destructive">estornado</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                        {p.reference && ` · ${p.reference}`}
                        {p.voidReason && ` · ${p.voidReason}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={cn("font-bold tabular-nums", p.voidedAt && "line-through")}>
                        {formatCurrency(p.amountCents)}
                      </span>
                      {podeEstornar && !p.voidedAt && (
                        <VoidPaymentButton paymentId={p.id} amountCents={p.amountCents} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Receipt className="size-4" />
              Conta
            </h3>
            <OrderTotals
              subtotalCents={ordem.subtotalCents}
              discountCents={ordem.discountCents}
              totalCents={ordem.totalCents}
              issCents={ordem.issCents}
              paidCents={ordem.paidCents}
              dueCents={ordem.dueCents}
            />

            <div className="mt-4 flex flex-col gap-2">
              {podeReceber && ordem.dueCents > 0 && ordem.items.length > 0 && (
                <PaymentDialog orderId={ordem.id} dueCents={ordem.dueCents} />
              )}
              {ordem.settled && (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-center text-sm font-medium text-success">
                  Ordem quitada
                </p>
              )}
              {podeReceber &&
                !ordem.loyaltyRewardApplied &&
                carimbos >= LOYALTY_TARGET &&
                ordem.dueCents > 0 && (
                  <RedeemLoyaltyButton orderId={ordem.id} stamps={carimbos} target={LOYALTY_TARGET} />
                )}
              {ordem.loyaltyRewardApplied && (
                <p className="text-center text-xs text-muted-foreground">Prêmio de fidelidade aplicado.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Atendimento</h3>

            {podeAvancar ? (
              <AssignSelects
                orderId={ordem.id}
                bayId={ordem.bayId}
                staffId={ordem.assignedStaffId}
                pistas={pistas.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
                equipe={equipe.map((c) => ({ id: c.id, name: c.name }))}
              />
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Pista</dt>
                  <dd>{ordem.bayName ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>{ordem.staffName ?? "—"}</dd>
                </div>
              </dl>
            )}

            <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Chegou</dt>
                <dd className="tabular-nums">{ordem.arrivedAt ? formatDateTime(ordem.arrivedAt) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Começou</dt>
                <dd className="tabular-nums">{ordem.startedAt ? formatDateTime(ordem.startedAt) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ficou pronto</dt>
                <dd className="tabular-nums">{ordem.finishedAt ? formatDateTime(ordem.finishedAt) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Entregue</dt>
                <dd className="tabular-nums">{ordem.deliveredAt ? formatDateTime(ordem.deliveredAt) : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Cliente e veículo</h3>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="truncate">
                  <Link href={`/clientes/${ordem.customerId}`} className="hover:underline">
                    {ordem.customerName}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Contato</dt>
                <dd>
                  <PhoneLink
                    phone={ordem.customerPhone}
                    message={`Olá! O seu ${ordem.vehicleModel ?? "veículo"} (${ordem.plate}) está pronto.`}
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Placa</dt>
                <dd className="font-mono">{ordem.plate}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Porte</dt>
                <dd>{label(VEHICLE_CATEGORY_LABELS, ordem.vehicleCategory)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Carimbos</dt>
                <dd className="tabular-nums">
                  {carimbos} / {LOYALTY_TARGET}
                </dd>
              </div>
            </dl>

            {ordem.notes && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{ordem.notes}</p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
