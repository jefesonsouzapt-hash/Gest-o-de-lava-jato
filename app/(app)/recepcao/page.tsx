import Link from "next/link"
import { CalendarClock, Car, Clock, Warehouse } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { listBays, listServices } from "@/lib/queries/catalogo"
import { listVehicles } from "@/lib/queries/clientes"
import { bayOccupancy, listWorkOrders } from "@/lib/queries/ordens"
import { listStaff } from "@/lib/queries/equipe"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { CheckinForm } from "@/components/checkin-form"
import { AdvanceButton } from "@/components/order-actions"
import { PhoneLink } from "@/components/phone-link"
import { formatCurrency } from "@/lib/locale/money"
import { formatDuration, formatTime, minutesSince } from "@/lib/locale/datetime"
import { VEHICLE_CATEGORY_LABELS, WORK_ORDER_STATUS_LABELS, label } from "@/lib/domain"

export default async function RecepcaoPage() {
  const actor = await requirePermissionPage("recepcao.gerir")

  const [veiculos, servicos, pistas, equipe, abertas, ocupacao] = await Promise.all([
    listVehicles(actor.companyId),
    listServices(actor.companyId),
    listBays(actor.companyId),
    listStaff(actor.companyId),
    listWorkOrders(actor.companyId, { abertas: true }),
    bayOccupancy(actor.companyId),
  ])

  const fila = abertas
    .filter((o) => o.status === "em_fila" || o.status === "aguardando_chegada")
    .sort((a, b) => (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0))

  const emServico = abertas.filter((o) => !["em_fila", "aguardando_chegada", "pronto_entrega"].includes(o.status))
  const prontos = abertas.filter((o) => o.status === "pronto_entrega")

  const checkin = (
    <CheckinForm
      veiculos={veiculos.map((v) => ({
        id: v.id,
        plate: v.plate,
        model: v.model,
        brand: v.brand,
        category: v.category,
        customerName: v.customerName,
      }))}
      servicos={servicos.map((s) => ({
        id: s.id,
        name: s.name,
        basePriceCents: s.basePriceCents,
        durationMinutes: s.durationMinutes,
        categoryName: s.categoryName,
        prices: s.prices.map((p) => ({ category: p.category, priceCents: p.priceCents })),
      }))}
      pistas={pistas.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      equipe={equipe.map((c) => ({ id: c.id, name: c.name }))}
    />
  )

  return (
    <>
      <PageHeader
        title="Recepção e fila"
        description="Quem chegou, quem está na pista e quem já pode ser chamado."
        action={veiculos.length > 0 ? checkin : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Na fila" value={fila.length} icon={Clock} money={false} tone={fila.length > 0 ? "warning" : "neutral"} />
        <StatCard label="Em serviço" value={emServico.length} icon={Car} money={false} />
        <StatCard
          label="Prontos para entrega"
          value={prontos.length}
          icon={CalendarClock}
          money={false}
          tone={prontos.length > 0 ? "positive" : "neutral"}
          hint={prontos.length > 0 ? "Avise o cliente" : undefined}
        />
        <StatCard
          label="Pistas livres"
          value={ocupacao.filter((o) => o.orderId == null && o.status !== "manutencao").length}
          icon={Warehouse}
          money={false}
        />
      </div>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">Pistas</h3>
        {ocupacao.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nenhuma pista cadastrada"
            description="Cadastre as pistas em Serviços para acompanhar a ocupação aqui."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ocupacao.map((p) => (
              <li
                key={p.bayId}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{p.bayName}</p>
                  <span
                    className={
                      p.status === "manutencao"
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
                        : p.orderId
                          ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                          : "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"
                    }
                  >
                    {p.status === "manutencao" ? "Manutenção" : p.orderId ? "Ocupada" : "Livre"}
                  </span>
                </div>

                {p.orderId ? (
                  <div className="mt-2">
                    <Link href={`/ordens/${p.orderId}`} className="font-mono text-sm hover:underline">
                      {p.plate}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {label(WORK_ORDER_STATUS_LABELS, p.orderStatus ?? "")}
                      {p.startedAt && ` · há ${formatDuration(minutesSince(p.startedAt))}`}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Sem carro</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">
          Fila de espera <span className="font-normal text-muted-foreground">({fila.length})</span>
        </h3>

        {fila.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Ninguém esperando"
            description={
              veiculos.length === 0
                ? "Cadastre um veículo para registrar a primeira chegada."
                : "Quando um carro chegar, registre a chegada para ele entrar na fila."
            }
            action={veiculos.length > 0 ? checkin : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {fila.map((o, i) => (
              <li key={o.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/ordens/${o.id}`} className="font-mono font-semibold hover:underline">
                      {o.plate}
                    </Link>
                    <span className="text-xs text-muted-foreground">{o.reference}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {o.customerName} · {label(VEHICLE_CATEGORY_LABELS, o.vehicleCategory)}
                    {o.arrivedAt && ` · chegou às ${formatTime(o.arrivedAt)}`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatCurrency(o.totalCents)}</p>
                  {o.arrivedAt && (
                    <p className="text-xs text-muted-foreground">
                      esperando há {formatDuration(minutesSince(o.arrivedAt))}
                    </p>
                  )}
                </div>

                <AdvanceButton orderId={o.id} status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {prontos.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold">
            Prontos para entrega <span className="font-normal text-muted-foreground">({prontos.length})</span>
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {prontos.map((o) => (
              <li key={o.id} className="rounded-xl border border-success/40 bg-success/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/ordens/${o.id}`} className="font-mono font-semibold hover:underline">
                      {o.plate}
                    </Link>
                    <p className="mt-0.5 text-sm">{o.customerName}</p>
                    <div className="mt-1">
                      <PhoneLink
                        phone={o.customerPhone}
                        message={`Olá! O seu ${o.vehicleModel ?? "veículo"} (${o.plate}) está pronto para retirada.`}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{formatCurrency(o.totalCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.settled ? "Pago" : `Falta ${formatCurrency(o.dueCents)}`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
