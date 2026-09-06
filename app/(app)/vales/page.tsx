import { HandCoins, TrendingDown, Users, Wallet } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { AdvanceDialog } from "@/components/advance-dialog"
import { CancelAdvanceButton, PayAdvanceButton } from "@/components/advance-actions"
import { listAdvanceDeductions, listAdvances, listStaff, staffDebts } from "@/lib/queries/equipe"
import { currentMonthKey, formatDate, monthTitle, todayISO } from "@/lib/locale/datetime"
import { formatCurrency } from "@/lib/locale/money"
import { ADVANCE_STATUS_CLASSES, PAYMENT_METHOD_LABELS, label } from "@/lib/domain"
import { ADVANCE_STATUS_LABELS } from "@/lib/payroll/calc"
import { cn } from "@/lib/utils"

export default async function ValesPage() {
  const actor = await requirePermissionPage("vale.gerir")

  const [vales, dividas, equipe] = await Promise.all([
    listAdvances(actor.companyId, { incluirQuitados: true }),
    staffDebts(actor.companyId),
    listStaff(actor.companyId),
  ])

  // O histórico de parcelas de cada vale, para o colaborador conferir quando
  // cada desconto aconteceu.
  const historicos = new Map(
    await Promise.all(
      vales.map(
        async (v) => [v.id, await listAdvanceDeductions(actor.companyId, v.id)] as const,
      ),
    ),
  )

  const totalConcedido = dividas.reduce((s, d) => s + d.totalCents, 0)
  const totalAbatido = dividas.reduce((s, d) => s + d.deductedCents, 0)
  const totalDevido = dividas.reduce((s, d) => s + d.remainingCents, 0)

  const novoVale = (
    <AdvanceDialog
      colaboradores={equipe.map((c) => ({ id: c.id, name: c.name }))}
      hoje={todayISO()}
      competenciaAtual={currentMonthKey()}
    />
  )

  return (
    <>
      <PageHeader
        title="Vales e adiantamentos"
        description="Quanto foi adiantado, quanto já voltou em folha e quanto cada um ainda deve."
        action={equipe.length > 0 ? novoVale : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total adiantado" value={totalConcedido} icon={HandCoins} />
        <StatCard label="Já abatido em folha" value={totalAbatido} icon={TrendingDown} tone="positive" />
        <StatCard
          label="Saldo devedor"
          value={totalDevido}
          icon={Wallet}
          tone={totalDevido > 0 ? "warning" : "positive"}
          hint={totalDevido > 0 ? "A descontar nas próximas folhas" : "Ninguém devendo"}
        />
        <StatCard
          label="Colaboradores devendo"
          value={dividas.filter((d) => d.remainingCents > 0).length}
          icon={Users}
          money={false}
        />
      </div>

      {dividas.some((d) => d.remainingCents > 0) && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Saldo devedor por colaborador</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2 text-right">Adiantado</th>
                  <th className="pb-2 text-right">Já abatido</th>
                  <th className="pb-2 text-right">Ainda deve</th>
                  <th className="pb-2 text-right">Vales abertos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dividas
                  .filter((d) => d.remainingCents > 0)
                  .map((d) => (
                    <tr key={d.staffId}>
                      <td className="py-2.5 font-medium">{d.staffName}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(d.totalCents)}</td>
                      <td className="py-2.5 text-right tabular-nums text-success">
                        {formatCurrency(d.deductedCents)}
                      </td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {formatCurrency(d.remainingCents)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {d.openAdvances}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">
          Vales <span className="font-normal text-muted-foreground">({vales.length})</span>
        </h3>

        {vales.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nenhum vale registrado"
            description={
              equipe.length === 0
                ? "Cadastre a equipe antes de conceder o primeiro vale."
                : "Quando um colaborador pedir adiantamento, registre aqui para o desconto entrar na folha sozinho."
            }
            action={equipe.length > 0 ? novoVale : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {vales.map((vale) => {
              const historico = historicos.get(vale.id) ?? []
              return (
                <li key={vale.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{vale.staffName}</p>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            ADVANCE_STATUS_CLASSES[vale.derivedStatus] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {ADVANCE_STATUS_LABELS[vale.derivedStatus]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Pedido em {formatDate(vale.requestedOn)}
                        {vale.paidAt ? ` · pago em ${formatDate(vale.paidAt.toISOString().slice(0, 10))}` : ""}
                        {vale.paymentMethod ? ` por ${label(PAYMENT_METHOD_LABELS, vale.paymentMethod)}` : ""}
                        {vale.receiptRef ? ` · ${vale.receiptRef}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {vale.installments === 1 ? "Desconto único" : `${vale.installments}x de ${formatCurrency(vale.installmentCents)}`}
                        {" · a partir de "}
                        {monthTitle(vale.firstDeductionMonth)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {vale.derivedStatus === "pendente" && (
                        <>
                          <PayAdvanceButton id={vale.id} amountCents={vale.amountCents} />
                          <CancelAdvanceButton id={vale.id} staffName={vale.staffName} />
                        </>
                      )}
                      {vale.derivedStatus === "pago" && (
                        <CancelAdvanceButton id={vale.id} staffName={vale.staffName} />
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Valor do vale</dt>
                      <dd className="mt-0.5 font-bold tabular-nums">{formatCurrency(vale.amountCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Já abatido</dt>
                      <dd className="mt-0.5 font-bold tabular-nums text-success">
                        {formatCurrency(vale.deductedCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Saldo devedor</dt>
                      <dd
                        className={cn(
                          "mt-0.5 font-bold tabular-nums",
                          vale.remainingCents > 0 ? "text-foreground" : "text-success",
                        )}
                      >
                        {formatCurrency(vale.remainingCents)}
                      </dd>
                    </div>
                  </dl>

                  {historico.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Parcelas descontadas</p>
                      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                        {historico.map((parcela) => (
                          <li key={parcela.id} className="tabular-nums">
                            <span className="text-muted-foreground">{monthTitle(parcela.competenceMonth)}</span>{" "}
                            <span className="font-semibold">{formatCurrency(parcela.amountCents)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {vale.notes && <p className="mt-3 text-xs text-muted-foreground">{vale.notes}</p>}
                  {vale.cancelReason && (
                    <p className="mt-3 text-xs text-destructive">Cancelado: {vale.cancelReason}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
