import Link from "next/link"
import { and, count, eq, inArray, sql } from "drizzle-orm"
import { AlertTriangle, Banknote, CalendarClock, Car, Droplets, HandCoins, Receipt } from "lucide-react"
import { db } from "@/lib/db"
import { payments, workOrders } from "@/lib/db/schema"
import { requireActorPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EmptyState } from "@/components/empty-state"
import { listWorkOrders } from "@/lib/queries/ordens"
import { lowStockCount } from "@/lib/queries/estoque"
import { formatCurrency } from "@/lib/locale/money"
import { formatDuration, minutesSince, todayISO } from "@/lib/locale/datetime"
import { WORK_ORDER_STATUS_LABELS, label } from "@/lib/domain"

/** Situações em que o veículo ainda está no pátio.  */
const NO_PATIO = ["em_fila", "em_lavagem", "acabamento", "detalhe", "controle_qualidade"] as const

export default async function PainelPage() {
  const actor = await requireActorPage()
  const hoje = todayISO()

  const [patio, ordensHoje, recebidoHoje] = await Promise.all([
    db
      .select({ status: workOrders.status, total: count() })
      .from(workOrders)
      .where(and(eq(workOrders.companyId, actor.companyId), inArray(workOrders.status, [...NO_PATIO])))
      .groupBy(workOrders.status),
    db
      .select({ total: count(), faturado: sql<string>`coalesce(sum(${workOrders.totalCents}), 0)` })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.companyId, actor.companyId),
          eq(workOrders.businessDate, hoje),
          sql`${workOrders.status} <> 'cancelada'`,
        ),
      ),
    db
      .select({ recebido: sql<string>`coalesce(sum(${payments.amountCents}), 0)` })
      .from(payments)
      .innerJoin(workOrders, eq(payments.workOrderId, workOrders.id))
      .where(
        and(
          eq(payments.companyId, actor.companyId),
          eq(workOrders.businessDate, hoje),
          sql`${payments.voidedAt} is null`,
        ),
      ),
  ])

  const podeVerEstoque = can(actor, "estoque.ver")
  const [abertas, semEstoque] = await Promise.all([
    can(actor, "ordem.ver") ? listWorkOrders(actor.companyId, { abertas: true }) : Promise.resolve([]),
    podeVerEstoque ? lowStockCount(actor.companyId) : Promise.resolve(0),
  ])

  const prontos = abertas.filter((o) => o.status === "pronto_entrega")

  const noPatio = patio.reduce((soma, linha) => soma + linha.total, 0)
  const emLavagem = patio.find((l) => l.status === "em_lavagem")?.total ?? 0
  const emFila = patio.find((l) => l.status === "em_fila")?.total ?? 0
  const faturadoHoje = Number.parseInt(ordensHoje[0]?.faturado ?? "0", 10)
  const recebido = Number.parseInt(recebidoHoje[0]?.recebido ?? "0", 10)

  return (
    <>
      <PageHeader
        title="Painel"
        description="Como está o pátio agora e como vai o dia."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Veículos no pátio"
          value={noPatio}
          icon={Car}
          money={false}
          hint={`${emFila} na fila · ${emLavagem} em lavagem`}
        />
        <StatCard
          label="Ordens de hoje"
          value={ordensHoje[0]?.total ?? 0}
          icon={CalendarClock}
          money={false}
        />
        {can(actor, "relatorio.ver") ? (
          <>
            <StatCard label="Faturado hoje" value={faturadoHoje} icon={Receipt} tone="positive" />
            <StatCard
              label="Recebido hoje"
              value={recebido}
              icon={Banknote}
              tone={faturadoHoje - recebido > 0 ? "warning" : "positive"}
              hint={
                faturadoHoje - recebido > 0
                  ? `Por receber: ${formatCurrency(faturadoHoje - recebido)}`
                  : "Tudo recebido"
              }
            />
          </>
        ) : (
          <StatCard label="Em lavagem" value={emLavagem} icon={Droplets} money={false} />
        )}
      </div>

      {podeVerEstoque && semEstoque > 0 && (
        <Link
          href="/estoque"
          className="mt-4 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm hover:bg-warning/10"
        >
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <span>
            <strong>{semEstoque}</strong>{" "}
            {semEstoque === 1 ? "produto está" : "produtos estão"} no estoque mínimo ou abaixo.
          </span>
        </Link>
      )}

      {prontos.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold">
            Prontos para entrega{" "}
            <span className="font-normal text-muted-foreground">({prontos.length})</span>
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prontos.map((o) => (
              <li key={o.id} className="rounded-xl border border-success/40 bg-success/5 p-4">
                <Link href={`/ordens/${o.id}`} className="font-mono font-semibold hover:underline">
                  {o.plate}
                </Link>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{o.customerName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.settled ? "Pago" : `Falta ${formatCurrency(o.dueCents)}`}
                  {o.finishedAt && ` · pronto há ${formatDuration(minutesSince(o.finishedAt))}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {abertas.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold">No pátio agora</h3>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Pista</th>
                  <th className="px-4 py-3 text-right">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {abertas.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/ordens/${o.id}`} className="font-mono font-medium hover:underline">
                        {o.plate}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {label(WORK_ORDER_STATUS_LABELS, o.status)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.bayName ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {o.arrivedAt ? formatDuration(minutesSince(o.arrivedAt)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {abertas.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={HandCoins}
            title="Pátio vazio"
            description="Nenhum carro em atendimento agora. Registre uma chegada na recepção para começar o dia."
            action={
              <Link href="/recepcao" className="text-sm font-medium text-primary hover:underline">
                Ir para a recepção
              </Link>
            }
          />
        </div>
      )}
    </>
  )
}
