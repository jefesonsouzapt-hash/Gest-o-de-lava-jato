import { Suspense } from "react"
import { BarChart3, Receipt, TrendingUp, Users } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { revenueByDay, revenueSummary, staffProduction, topServices } from "@/lib/queries/relatorios"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { RangePicker } from "@/components/day-picker"
import { formatCurrency, formatCurrencyCompact } from "@/lib/locale/money"
import { formatDate, todayISO } from "@/lib/locale/datetime"

/** Primeiro dia do mês corrente em São Paulo, para o intervalo padrão. */
function inicioDoMes(hoje: string): string {
  return `${hoje.slice(0, 7)}-01`
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; ate?: string }>
}) {
  const actor = await requirePermissionPage("relatorio.ver")
  const podeFinanceiro = can(actor, "relatorio.financeiro")

  const hoje = todayISO()
  const { desde: d, ate: a } = await searchParams
  const valida = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

  const desde = valida(d) ?? inicioDoMes(hoje)
  const ate = valida(a) ?? hoje

  const [resumo, porDia, servicos, producao] = await Promise.all([
    revenueSummary(actor.companyId, desde, ate),
    revenueByDay(actor.companyId, desde, ate),
    topServices(actor.companyId, desde, ate),
    staffProduction(actor.companyId, desde, ate),
  ])

  const maiorDia = Math.max(...porDia.map((d) => d.totalCents), 1)
  const maiorServico = Math.max(...servicos.map((s) => s.totalCents), 1)

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`De ${formatDate(desde)} a ${formatDate(ate)}.`}
        action={
          <Suspense fallback={null}>
            <RangePicker desde={desde} ate={ate} />
          </Suspense>
        }
      />

      {resumo.orders === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma ordem no período"
          description="Escolha outro intervalo, ou registre a primeira chegada na recepção."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Faturamento" value={resumo.totalCents} icon={TrendingUp} tone="positive" />
            <StatCard
              label="Ticket médio"
              value={resumo.ticketCents}
              icon={Receipt}
              hint={`${resumo.orders} ordens`}
            />
            {podeFinanceiro && (
              <StatCard
                label="Recebido"
                value={resumo.receivedCents}
                icon={Receipt}
                tone={resumo.receivedCents >= resumo.totalCents ? "positive" : "warning"}
                hint={
                  resumo.receivedCents < resumo.totalCents
                    ? `${formatCurrency(resumo.totalCents - resumo.receivedCents)} em aberto`
                    : "Tudo recebido"
                }
              />
            )}
            <StatCard
              label="ISS do período"
              value={resumo.issCents}
              icon={Receipt}
              hint={resumo.discountCents > 0 ? `${formatCurrency(resumo.discountCents)} em descontos` : undefined}
            />
          </div>

          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">Faturamento por dia</h3>

            {/* Barras em CSS puro: um gráfico aqui não justifica uma biblioteca
                inteira no pacote que o balcão baixa em rede de lava jato. */}
            <ul className="flex flex-col gap-2">
              {porDia.map((dia) => (
                <li key={dia.day} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDate(dia.day).slice(0, 5)}
                  </span>
                  <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                    <span
                      className="flex h-full items-center justify-end rounded bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
                      style={{ width: `${Math.max((dia.totalCents / maiorDia) * 100, 4)}%` }}
                    >
                      {formatCurrencyCompact(dia.totalCents)}
                    </span>
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {dia.orders} {dia.orders === 1 ? "ordem" : "ordens"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Serviços mais vendidos</h3>

              {servicos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum serviço vendido no período.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {servicos.map((s) => (
                    <li key={s.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(s.totalCents)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.max((s.totalCents / maiorServico) * 100, 2)}%` }}
                          />
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {s.quantity}×
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4" />
                Produção por colaborador
              </h3>

              {producao.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ordem com responsável definido. Sem responsável, não há comissão a creditar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                        <th className="pb-2">Colaborador</th>
                        <th className="pb-2 text-right">Carros</th>
                        <th className="pb-2 text-right">Faturado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {producao.map((p) => (
                        <tr key={p.staffId}>
                          <td className="py-2.5 font-medium">{p.name}</td>
                          <td className="py-2.5 text-right tabular-nums">{p.orders}</td>
                          <td className="py-2.5 text-right tabular-nums">{formatCurrency(p.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}
