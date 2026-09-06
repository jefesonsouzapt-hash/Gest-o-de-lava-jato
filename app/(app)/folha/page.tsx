import Link from "next/link"
import { Banknote, HandCoins, ReceiptText, Users } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { MonthPicker } from "@/components/month-picker"
import { ClosePayrollButton, MarkPaidButton, ReopenPayrollButton } from "@/components/payroll-close"
import { previewPayroll } from "@/lib/actions/folha"
import { getPayrollPeriod, listPayrollEntries } from "@/lib/queries/equipe"
import { currentMonthKey, monthTitle } from "@/lib/locale/datetime"
import { formatCurrency } from "@/lib/locale/money"
import { JOB_TITLE_LABELS, PAYROLL_STATUS_CLASSES, PAYROLL_STATUS_LABELS, label } from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function FolhaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const actor = await requirePermissionPage("folha.ver")
  const podeFechar = can(actor, "folha.fechar")

  const { mes } = await searchParams
  const competencia = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonthKey()

  const periodo = await getPayrollPeriod(actor.companyId, competencia)
  const fechada = Boolean(periodo && periodo.status !== "aberta")

  // Fechada, mostra o que foi congelado. Aberta, a prévia — pelo mesmo cálculo,
  // para o que aparece na tela ser exatamente o que vai ser gravado.
  const linhas = fechada
    ? (await listPayrollEntries(actor.companyId, periodo!.id)).map((e) => ({
        staffId: e.staffId,
        staffName: e.staffName,
        jobTitle: e.jobTitle,
        baseSalaryCents: e.baseSalaryCents,
        commissionCents: e.commissionCents,
        servicesCount: e.servicesCount,
        advanceDeductionCents: e.advanceDeductionCents,
        netCents: e.netCents,
        postponedCents: 0,
      }))
    : await previewPayroll(competencia)

  const totalSalario = linhas.reduce((s, l) => s + l.baseSalaryCents, 0)
  const totalComissao = linhas.reduce((s, l) => s + l.commissionCents, 0)
  const totalVales = linhas.reduce((s, l) => s + l.advanceDeductionCents, 0)
  const totalLiquido = linhas.reduce((s, l) => s + l.netCents, 0)
  const totalAdiado = linhas.reduce((s, l) => s + l.postponedCents, 0)

  const status = periodo?.status ?? "aberta"

  return (
    <>
      <PageHeader
        title="Folha de pagamento"
        description={
          fechada
            ? "Valores congelados no fechamento desta competência."
            : "Prévia do mês. Nada é gravado até o fechamento."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker value={competencia} />
            {podeFechar && linhas.length > 0 && status === "aberta" && (
              <ClosePayrollButton
                competenceMonth={competencia}
                totalCents={totalLiquido}
                colaboradores={linhas.length}
              />
            )}
            {podeFechar && status === "fechada" && (
              <>
                <ReopenPayrollButton competenceMonth={competencia} />
                <MarkPaidButton competenceMonth={competencia} />
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            PAYROLL_STATUS_CLASSES[status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {monthTitle(competencia)} · {label(PAYROLL_STATUS_LABELS, status)}
        </span>
        {status === "paga" && (
          <span className="text-xs text-muted-foreground">
            Uma folha paga não pode ser reaberta — o dinheiro saiu e o holerite foi entregue.
          </span>
        )}
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum colaborador ativo"
          description="Cadastre a equipe para que a folha tenha o que calcular."
          action={
            <a className="text-sm font-medium text-primary hover:underline" href="/equipe">
              Ir para Equipe
            </a>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Salários" value={totalSalario} icon={Banknote} />
            <StatCard label="Comissões" value={totalComissao} icon={ReceiptText} tone="positive" />
            <StatCard
              label="Vales descontados"
              value={totalVales}
              icon={HandCoins}
              tone={totalVales > 0 ? "warning" : "neutral"}
              hint={
                totalAdiado > 0 ? `${formatCurrency(totalAdiado)} não coube e fica para a próxima` : undefined
              }
            />
            <StatCard label="Líquido a pagar" value={totalLiquido} icon={Users} tone="positive" />
          </div>

          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">
              {fechada ? "Holerites" : "Prévia por colaborador"}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                    <th className="pb-2">Colaborador</th>
                    <th className="pb-2 text-right">Serviços</th>
                    <th className="pb-2 text-right">Salário</th>
                    <th className="pb-2 text-right">Comissão</th>
                    <th className="pb-2 text-right">Vales</th>
                    <th className="pb-2 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.map((l) => (
                    <tr key={l.staffId}>
                      <td className="py-2.5">
                        <span className="font-medium">{l.staffName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {label(JOB_TITLE_LABELS, l.jobTitle)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {l.servicesCount}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{formatCurrency(l.baseSalaryCents)}</td>
                      <td className="py-2.5 text-right tabular-nums text-success">
                        {formatCurrency(l.commissionCents)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-destructive">
                        {l.advanceDeductionCents > 0 ? `− ${formatCurrency(l.advanceDeductionCents)}` : "—"}
                      </td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {formatCurrency(l.netCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td className="pt-3">Total</td>
                    <td className="pt-3" />
                    <td className="pt-3 text-right tabular-nums">{formatCurrency(totalSalario)}</td>
                    <td className="pt-3 text-right tabular-nums">{formatCurrency(totalComissao)}</td>
                    <td className="pt-3 text-right tabular-nums">− {formatCurrency(totalVales)}</td>
                    <td className="pt-3 text-right tabular-nums">{formatCurrency(totalLiquido)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalAdiado > 0 && (
              <p className="mt-4 rounded-lg bg-warning/10 px-4 py-3 text-xs text-muted-foreground">
                <strong className="text-foreground">{formatCurrency(totalAdiado)}</strong> em vales não coube
                no líquido deste mês e continua no saldo devedor. O líquido nunca fica negativo: quem tem mais
                vale do que salário não termina o mês devendo à empresa na folha.{" "}
                <Link href="/vales" className="font-medium text-primary hover:underline">
                  Ver saldo devedor
                </Link>
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}
