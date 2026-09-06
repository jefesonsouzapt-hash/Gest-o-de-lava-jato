import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { listWorkOrders } from "@/lib/queries/ordens"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { AdvanceButton } from "@/components/order-actions"
import { formatCurrency } from "@/lib/locale/money"
import { formatDate, formatDuration, minutesSince, todayISO } from "@/lib/locale/datetime"
import {
  BOARD_COLUMNS,
  WORK_ORDER_STATUS_CLASSES,
  WORK_ORDER_STATUS_LABELS,
  label,
} from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function OrdensPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const actor = await requirePermissionPage("ordem.ver")
  const podeAvancar = can(actor, "ordem.avancar")

  const { dia } = await searchParams
  const hoje = todayISO()
  const data = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : hoje

  const [abertas, doDia] = await Promise.all([
    listWorkOrders(actor.companyId, { abertas: true }),
    listWorkOrders(actor.companyId, { date: data, status: ["entregue", "cancelada"] }),
  ])

  // Todas as colunas do fluxo aparecem sempre, mesmo vazias: o quadro é um
  // mapa do pátio, e uma coluna que some quando esvazia faz o operador
  // procurar onde está o carro em vez de olhar e ver.
  const colunas = BOARD_COLUMNS.map((status) => ({
    status,
    ordens: abertas.filter((o) => o.status === status),
  }))

  const totalNoPatio = abertas.reduce((s, o) => s + o.totalCents, 0)
  const aReceber = abertas.reduce((s, o) => s + o.dueCents, 0)

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description="O que está acontecendo no pátio agora, coluna por coluna."
        action={
          abertas.length > 0 ? (
            <div className="flex items-center gap-5 rounded-xl border border-border bg-card px-4 py-2.5">
              <div>
                <p className="text-xs text-muted-foreground">No pátio</p>
                <p className="font-bold tabular-nums">{formatCurrency(totalNoPatio)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">A receber</p>
                <p
                  className={cn(
                    "font-bold tabular-nums",
                    aReceber > 0 ? "text-warning" : "text-success",
                  )}
                >
                  {formatCurrency(aReceber)}
                </p>
              </div>
            </div>
          ) : undefined
        }
      />

      {abertas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma ordem em andamento"
          description="Registre a chegada de um carro na recepção para abrir a primeira ordem."
          action={
            <Link href="/recepcao" className="text-sm font-medium text-primary hover:underline">
              Ir para a recepção
            </Link>
          }
        />
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {colunas.map((coluna) => (
            <section
              key={coluna.status}
              className="flex w-64 shrink-0 flex-col gap-2.5 rounded-xl bg-muted/40 p-2.5"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-semibold">{label(WORK_ORDER_STATUS_LABELS, coluna.status)}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    coluna.ordens.length > 0
                      ? "bg-primary/12 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {coluna.ordens.length}
                </span>
              </div>

              {coluna.ordens.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                  Vazio
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {coluna.ordens.map((o) => {
                    // Carro parado há muito tempo na mesma coluna é o que o
                    // operador precisa ver primeiro — e é o que a fila esconde.
                    const parado = minutesSince(o.startedAt ?? o.arrivedAt ?? new Date())
                    const demorado = parado >= 90

                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
                          demorado ? "border-warning/50" : "border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/ordens/${o.id}`}
                            className="font-mono text-sm font-semibold hover:underline"
                          >
                            {o.plate}
                          </Link>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {o.reference}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-muted-foreground">{o.customerName}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {o.bayName ?? "Sem pista"}
                          </span>
                          {o.staffName && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {o.staffName}
                            </span>
                          )}
                          {o.dueCents === 0 && o.totalCents > 0 && (
                            <span className="rounded bg-success/12 px-1.5 py-0.5 text-[11px] font-medium text-success">
                              Pago
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2">
                          <span className="text-sm font-bold tabular-nums">{formatCurrency(o.totalCents)}</span>
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              demorado ? "font-semibold text-warning" : "text-muted-foreground",
                            )}
                          >
                            {formatDuration(parado)}
                          </span>
                        </div>

                        {podeAvancar && (
                          <div className="mt-2">
                            <AdvanceButton orderId={o.id} status={o.status} full />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">
          Encerradas em {formatDate(data)}{" "}
          <span className="font-normal text-muted-foreground">({doDia.length})</span>
        </h3>

        {doDia.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma ordem entregue ou cancelada nesta data.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Ordem</th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doDia.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/ordens/${o.id}`} className="font-medium hover:underline">
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{o.plate}</td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                          WORK_ORDER_STATUS_CLASSES[o.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {label(WORK_ORDER_STATUS_LABELS, o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(o.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
