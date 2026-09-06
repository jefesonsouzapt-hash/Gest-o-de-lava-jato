import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { Banknote, CalendarClock, Car, Droplets, Receipt } from "lucide-react"
import { db } from "@/lib/db"
import { payments, workOrders } from "@/lib/db/schema"
import { requireActorPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { formatCurrency } from "@/lib/locale/money"
import { todayISO } from "@/lib/locale/datetime"

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
    </>
  )
}
