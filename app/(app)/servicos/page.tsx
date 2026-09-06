import { SprayCan, Warehouse } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { listBays, listServiceCategories, listServices } from "@/lib/queries/catalogo"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { ServiceDialog } from "@/components/service-dialog"
import { BayDialog, CategoryDialog } from "@/components/simple-dialog-form"
import { ServiceActiveButton } from "@/components/service-actions"
import { formatCurrency, formatBps } from "@/lib/locale/money"
import { formatDuration } from "@/lib/locale/datetime"
import { priceForVehicle, type VehicleCategory } from "@/lib/pricing/calc"
import { VEHICLE_CATEGORY_LABELS } from "@/lib/domain"
import { cn } from "@/lib/utils"

const CATEGORIAS = ["moto", "hatch", "sedan", "suv", "caminhonete"] as const

export default async function ServicosPage() {
  const actor = await requirePermissionPage("servico.ver")
  const podeGerir = can(actor, "servico.gerir")
  const podePista = can(actor, "pista.gerir")

  const [servicos, categorias, pistas] = await Promise.all([
    listServices(actor.companyId, { incluirInativos: true }),
    listServiceCategories(actor.companyId),
    listBays(actor.companyId, { incluirInativas: true }),
  ])

  const novoServico = podeGerir ? (
    <ServiceDialog categorias={categorias.map((c) => ({ id: c.id, name: c.name }))} />
  ) : undefined

  return (
    <>
      <PageHeader
        title="Serviços e preços"
        description="O catálogo do balcão. O preço de cada porte sai daqui quando a ordem é aberta."
        action={
          podeGerir ? (
            <div className="flex flex-wrap gap-2">
              <CategoryDialog />
              {novoServico}
            </div>
          ) : undefined
        }
      />

      {servicos.length === 0 ? (
        <EmptyState
          icon={SprayCan}
          title="Nenhum serviço cadastrado"
          description="Cadastre lavagem, enceramento, polimento — o que o lava jato vende."
          action={novoServico}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">Serviço</th>
                {CATEGORIAS.map((c) => (
                  <th key={c} className="px-3 py-3 text-right">
                    {VEHICLE_CATEGORY_LABELS[c]}
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Duração</th>
                <th className="px-3 py-3 text-right">Comissão</th>
                {podeGerir && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {servicos.map((s) => {
                const tabela = new Map(s.prices.map((p) => [p.category, p.priceCents]))
                return (
                  <tr key={s.id} className={cn("hover:bg-muted/40", !s.active && "opacity-55")}>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.isPackage && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            Pacote
                          </span>
                        )}
                        {!s.active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.categoryName ?? "Sem categoria"}
                        {!s.countsForLoyalty && " · não conta carimbo"}
                      </p>
                    </td>

                    {CATEGORIAS.map((cat) => {
                      const fixado = tabela.get(cat)
                      const valor = priceForVehicle({
                        basePriceCents: s.basePriceCents,
                        category: cat as VehicleCategory,
                        tablePriceCents: fixado ?? null,
                      })
                      return (
                        <td
                          key={cat}
                          className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            // Preço estimado fica mais claro que o preço que o
                            // dono fixou: dá para ver de relance o que ele
                            // decidiu e o que o sistema deduziu.
                            fixado == null && "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(valor)}
                        </td>
                      )
                    })}

                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                      {formatDuration(s.durationMinutes)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {s.commissionBps > 0 ? formatBps(s.commissionBps) : "—"}
                    </td>

                    {podeGerir && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ServiceDialog
                            servico={s}
                            categorias={categorias.map((c) => ({ id: c.id, name: c.name }))}
                          />
                          <ServiceActiveButton id={s.id} active={s.active} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              Pistas <span className="font-normal text-muted-foreground">({pistas.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground">Cada pista atende um carro por vez.</p>
          </div>
          {podePista && <BayDialog />}
        </div>

        {pistas.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nenhuma pista cadastrada"
            description="Sem pista, a ordem entra na fila de espera e só sai quando alguém a coloca em lavagem."
            action={podePista ? <BayDialog /> : undefined}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pistas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "manutencao" ? "Em manutenção" : p.status === "ocupada" ? "Ocupada" : "Livre"}
                  </p>
                </div>
                {podePista && <BayDialog pista={p} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
