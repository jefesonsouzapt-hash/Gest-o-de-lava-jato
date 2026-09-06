import { Pencil, Phone, UserRound } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StaffDialog } from "@/components/staff-dialog"
import { StaffActiveButton } from "@/components/staff-active-button"
import { Button } from "@/components/ui/button"
import { commissionTotals, listStaff } from "@/lib/queries/equipe"
import { currentMonthKey, formatDate, monthTitle } from "@/lib/locale/datetime"
import { formatBps, formatCurrency } from "@/lib/locale/money"
import { formatPhone, formatPixKey } from "@/lib/locale/br"
import {
  COMMISSION_KIND_LABELS,
  CONTRACT_TYPE_LABELS,
  JOB_TITLE_LABELS,
  STAFF_STATUS_CLASSES,
  STAFF_STATUS_LABELS,
  label,
} from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function EquipePage() {
  const actor = await requirePermissionPage("equipe.ver")
  const podeGerir = can(actor, "equipe.gerir")
  const podeVerComissao = can(actor, "comissao.ver")

  const mes = currentMonthKey()
  const [equipe, comissoes] = await Promise.all([
    listStaff(actor.companyId, true),
    podeVerComissao ? commissionTotals(actor.companyId, mes) : Promise.resolve(new Map()),
  ])

  const ativos = equipe.filter((c) => c.active)
  const inativos = equipe.filter((c) => !c.active)

  return (
    <>
      <PageHeader
        title="Equipe"
        description={
          podeVerComissao
            ? `Quem trabalha no lava jato e quanto cada um produziu em ${monthTitle(mes).toLowerCase()}.`
            : "Quem trabalha no lava jato."
        }
        action={podeGerir ? <StaffDialog /> : undefined}
      />

      {ativos.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Nenhum colaborador cadastrado"
          description="Cadastre a equipe para poder apontar quem executou cada serviço, apurar comissão e fechar a folha."
          action={podeGerir ? <StaffDialog /> : undefined}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {ativos.map((c) => {
            const comissao = comissoes.get(c.id)
            return (
              <li key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{c.name}</p>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                          STAFF_STATUS_CLASSES[c.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {label(STAFF_STATUS_LABELS, c.status)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {label(JOB_TITLE_LABELS, c.jobTitle)} · {label(CONTRACT_TYPE_LABELS, c.contractType)}
                      {c.hiredAt ? ` · desde ${formatDate(c.hiredAt)}` : ""}
                    </p>
                    {c.phone && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {formatPhone(c.phone)}
                      </p>
                    )}
                  </div>

                  {podeGerir && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <StaffDialog
                        colaborador={{
                          id: c.id,
                          name: c.name,
                          cpf: c.cpf,
                          rg: c.rg,
                          birthDate: c.birthDate,
                          phone: c.phone,
                          email: c.email,
                          cep: c.cep,
                          street: c.street,
                          streetNumber: c.streetNumber,
                          complement: c.complement,
                          district: c.district,
                          city: c.city,
                          uf: c.uf,
                          pixKey: c.pixKey,
                          bankName: c.bankName,
                          bankBranch: c.bankBranch,
                          bankAccount: c.bankAccount,
                          bankAccountType: c.bankAccountType,
                          jobTitle: c.jobTitle,
                          contractType: c.contractType,
                          status: c.status,
                          hiredAt: c.hiredAt,
                          baseSalaryCents: c.baseSalaryCents,
                          commissionKind: c.commissionKind,
                          commissionBps: c.commissionBps,
                          commissionFixedCents: c.commissionFixedCents,
                          notes: c.notes,
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            aria-label={`Editar ${c.name}`}
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      <StaffActiveButton id={c.id} name={c.name} active />
                    </div>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Salário base</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{formatCurrency(c.baseSalaryCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Comissão</dt>
                    <dd className="mt-0.5 text-sm font-semibold">
                      {c.commissionKind === "percentual"
                        ? formatBps(c.commissionBps)
                        : c.commissionKind === "valor_fixo"
                          ? `${formatCurrency(c.commissionFixedCents)} / serviço`
                          : label(COMMISSION_KIND_LABELS, c.commissionKind)}
                    </dd>
                  </div>
                  {podeVerComissao && (
                    <>
                      <div>
                        <dt className="text-xs text-muted-foreground">Serviços no mês</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">{comissao?.services ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Comissão no mês</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-primary">
                          {formatCurrency(comissao?.amountCents ?? 0)}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>

                {podeGerir && c.pixKey && (
                  <p className="mt-3 truncate text-xs text-muted-foreground">
                    PIX: <span className="font-medium text-foreground">{formatPixKey(c.pixKey)}</span>
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {inativos.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground">Inativos</h3>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Saem da lista de executores, mas continuam ligados às comissões e aos vales já registrados.
          </p>
          <ul className="flex flex-col gap-2">
            {inativos.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {c.name} · {label(JOB_TITLE_LABELS, c.jobTitle)}
                </span>
                {podeGerir && <StaffActiveButton id={c.id} name={c.name} active={false} variant="text" />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
