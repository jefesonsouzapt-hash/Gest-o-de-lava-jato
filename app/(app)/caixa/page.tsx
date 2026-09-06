import Link from "next/link"
import { Suspense } from "react"
import { Banknote, Receipt, RotateCcw, Wallet } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { cashByMethod, cashMovements } from "@/lib/queries/relatorios"
import { listWorkOrders } from "@/lib/queries/ordens"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { DayPicker } from "@/components/day-picker"
import { VoidPaymentButton } from "@/components/payment-dialog"
import { formatCurrency } from "@/lib/locale/money"
import { formatDate, formatTime, todayISO } from "@/lib/locale/datetime"
import { PAYMENT_METHOD_LABELS, label } from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const actor = await requirePermissionPage("relatorio.financeiro")
  const podeEstornar = can(actor, "pagamento.estornar")

  const { dia } = await searchParams
  const data = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : todayISO()

  const [porForma, movimentos, ordensDoDia] = await Promise.all([
    cashByMethod(actor.companyId, data),
    cashMovements(actor.companyId, data),
    listWorkOrders(actor.companyId, { date: data }),
  ])

  const recebido = porForma.reduce((s, f) => s + f.totalCents, 0)
  const estornado = movimentos.filter((m) => m.voidedAt).reduce((s, m) => s + m.amountCents, 0)

  const emAberto = ordensDoDia.filter((o) => !o.canceledAt && o.dueCents > 0)
  const aReceber = emAberto.reduce((s, o) => s + o.dueCents, 0)

  return (
    <>
      <PageHeader
        title="Caixa"
        description="O que entrou no dia, por forma de pagamento, e o que ainda falta receber."
        action={
          <Suspense fallback={null}>
            <DayPicker value={data} />
          </Suspense>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Recebido em ${formatDate(data)}`} value={recebido} icon={Wallet} tone="positive" />
        <StatCard label="A receber" value={aReceber} icon={Receipt} tone={aReceber > 0 ? "warning" : "neutral"} hint={`${emAberto.length} ${emAberto.length === 1 ? "ordem" : "ordens"} em aberto`} />
        <StatCard label="Estornado" value={estornado} icon={RotateCcw} tone={estornado > 0 ? "negative" : "neutral"} />
        <StatCard label="Ordens no dia" value={ordensDoDia.length} icon={Banknote} money={false} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Por forma de pagamento</h3>

        {porForma.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada recebido nesta data.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porForma
              .sort((a, b) => b.totalCents - a.totalCents)
              .map((f) => (
                <li key={f.method} className="rounded-lg bg-muted px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label(PAYMENT_METHOD_LABELS, f.method)}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCurrency(f.totalCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.count} {f.count === 1 ? "recebimento" : "recebimentos"}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">
          Movimento do dia <span className="font-normal text-muted-foreground">({movimentos.length})</span>
        </h3>

        {movimentos.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Caixa sem movimento"
            description="Os recebimentos desta data aparecem aqui, inclusive os estornados."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Ordem</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Forma</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  {podeEstornar && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movimentos.map((m) => (
                  <tr key={m.id} className={cn("hover:bg-muted/40", m.voidedAt && "opacity-60")}>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/ordens/${m.orderId}`} className="font-medium hover:underline">
                        {m.orderReference}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{m.plate}</span>
                    </td>
                    <td className="px-4 py-3">{m.customerName}</td>
                    <td className="px-4 py-3">
                      {label(PAYMENT_METHOD_LABELS, m.method)}
                      {m.voidedAt && (
                        <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          estornado
                        </span>
                      )}
                      {m.reference && <span className="ml-2 text-xs text-muted-foreground">{m.reference}</span>}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        m.voidedAt && "text-muted-foreground line-through",
                      )}
                    >
                      {formatCurrency(m.amountCents)}
                    </td>
                    {podeEstornar && (
                      <td className="px-4 py-3 text-right">
                        {!m.voidedAt && <VoidPaymentButton paymentId={m.id} amountCents={m.amountCents} />}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {emAberto.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold">
            Em aberto <span className="font-normal text-muted-foreground">({emAberto.length})</span>
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emAberto.map((o) => (
              <li key={o.id} className="rounded-xl border border-warning/40 bg-warning/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/ordens/${o.id}`} className="font-medium hover:underline">
                      {o.reference}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customerName} · {o.plate}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums">{formatCurrency(o.dueCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
