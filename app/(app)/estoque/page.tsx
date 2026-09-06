import { AlertTriangle, Boxes, PackageCheck, Wallet } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { listMovements, listProducts } from "@/lib/queries/estoque"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { MovementDialog, ProductDialog } from "@/components/stock-dialogs"
import { ProductActiveItem } from "@/components/service-actions"
import { RowActions } from "@/components/row-actions"
import { formatCurrency } from "@/lib/locale/money"
import { formatDateTime } from "@/lib/locale/datetime"
import { STOCK_MOVEMENT_LABELS, formatQuantity, label } from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function EstoquePage() {
  const actor = await requirePermissionPage("estoque.ver")
  const podeGerir = can(actor, "estoque.gerir")

  const [produtos, movimentos] = await Promise.all([
    listProducts(actor.companyId, { incluirInativos: true }),
    listMovements(actor.companyId, { limite: 60 }),
  ])

  const ativos = produtos.filter((p) => p.active)
  const abaixo = ativos.filter((p) => p.belowMin)
  const valorTotal = ativos.reduce((s, p) => s + p.valueCents, 0)

  const novoProduto = podeGerir ? <ProductDialog /> : undefined

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Produtos, saldo e o consumo que cada ordem de serviço baixa sozinha."
        action={
          podeGerir ? (
            <div className="flex flex-wrap gap-2">
              {ativos.length > 0 && (
                <MovementDialog produtos={ativos.map((p) => ({ id: p.id, name: p.name, unit: p.unit }))} />
              )}
              {novoProduto}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos ativos" value={ativos.length} icon={Boxes} money={false} />
        <StatCard
          label="No mínimo ou abaixo"
          value={abaixo.length}
          icon={AlertTriangle}
          money={false}
          tone={abaixo.length > 0 ? "warning" : "positive"}
          hint={abaixo.length > 0 ? "Hora de repor" : "Tudo em dia"}
        />
        <StatCard label="Valor em estoque" value={valorTotal} icon={Wallet} />
        <StatCard label="Movimentos recentes" value={movimentos.length} icon={PackageCheck} money={false} />
      </div>

      {abaixo.length > 0 && (
        <section className="mt-6 rounded-xl border border-warning/40 bg-warning/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-warning" />
            Precisa repor
          </h3>
          <ul className="flex flex-wrap gap-2">
            {abaixo.map((p) => (
              <li key={p.id} className="rounded-full bg-card px-3 py-1 text-sm">
                <span className="font-medium">{p.name}</span>{" "}
                <span className="text-muted-foreground tabular-nums">
                  {formatQuantity(p.stockMilli, p.unit)} de {formatQuantity(p.minStockMilli, p.unit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">
          Produtos <span className="font-normal text-muted-foreground">({produtos.length})</span>
        </h3>

        {produtos.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum produto cadastrado"
            description="Cadastre shampoo, cera, microfibra — o que o lava jato consome a cada carro."
            action={novoProduto}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Mínimo</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Fornecedor</th>
                  {podeGerir && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {produtos.map((p) => (
                  <tr key={p.id} className={cn("hover:bg-muted/40", !p.active && "opacity-55")}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {p.kind}
                        {!p.active && " · inativo"}
                      </p>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        // Saldo negativo significa consumo lançado sem entrada:
                        // é para o dono ver, não para esconder em zero.
                        p.stockMilli < 0 ? "text-destructive" : p.belowMin && "text-warning",
                      )}
                    >
                      {formatQuantity(p.stockMilli, p.unit)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {formatQuantity(p.minStockMilli, p.unit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.unitCostCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.valueCents)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.supplier ?? "—"}</td>
                    {podeGerir && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ProductDialog produto={p} />
                          <RowActions label={`Ações de ${p.name}`}>
                            <ProductActiveItem id={p.id} active={p.active} />
                          </RowActions>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold">Últimos movimentos</h3>

        {movimentos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum movimento registrado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Quantidade</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movimentos.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">{m.productName}</td>
                    <td className="px-4 py-3">{label(STOCK_MOVEMENT_LABELS, m.kind)}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        m.quantityMilli < 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {m.quantityMilli > 0 ? "+" : "−"} {formatQuantity(Math.abs(m.quantityMilli), m.unit)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.orderReference ? `Ordem ${m.orderReference}` : (m.notes ?? m.userName ?? "—")}
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
