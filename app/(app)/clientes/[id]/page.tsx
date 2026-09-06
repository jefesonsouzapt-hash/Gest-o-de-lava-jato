import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Car, Gift, Receipt } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { customerHistory, getCustomer, listVehicles } from "@/lib/queries/clientes"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { CustomerDialog } from "@/components/customer-dialog"
import { VehicleDialog } from "@/components/vehicle-dialog"
import { PhoneLink } from "@/components/phone-link"
import { DeleteVehicleButton } from "@/components/vehicle-actions"
import { LOYALTY_TARGET } from "@/lib/loyalty"
import { formatCurrency } from "@/lib/locale/money"
import { formatCep, formatDocument } from "@/lib/locale/br"
import { formatDate } from "@/lib/locale/datetime"
import {
  CUSTOMER_SEGMENT_LABELS,
  VEHICLE_CATEGORY_LABELS,
  WORK_ORDER_STATUS_CLASSES,
  WORK_ORDER_STATUS_LABELS,
  label,
} from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage("cliente.ver")
  const podeEditar = can(actor, "cliente.editar")

  const { id } = await params
  const clienteId = Number.parseInt(id, 10)
  if (!Number.isFinite(clienteId)) notFound()

  const cliente = await getCustomer(actor.companyId, clienteId)
  if (!cliente) notFound()

  const [veiculos, historico] = await Promise.all([
    listVehicles(actor.companyId, { customerId: clienteId }),
    customerHistory(actor.companyId, clienteId),
  ])

  const entregues = historico.filter((o) => o.status === "entregue")
  const gasto = entregues.reduce((s, o) => s + o.totalCents, 0)
  const faltamCarimbos = Math.max(LOYALTY_TARGET - cliente.loyaltyStamps, 0)

  const endereco = [
    cliente.street && `${cliente.street}${cliente.streetNumber ? `, ${cliente.streetNumber}` : ""}`,
    cliente.district,
    cliente.city && cliente.uf ? `${cliente.city}/${cliente.uf}` : cliente.city,
    cliente.cep && formatCep(cliente.cep),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Todos os clientes
      </Link>

      <PageHeader
        title={cliente.name}
        description={
          [label(CUSTOMER_SEGMENT_LABELS, cliente.segment), cliente.document && formatDocument(cliente.document)]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        action={
          podeEditar ? (
            <div className="flex flex-wrap gap-2">
              <VehicleDialog clientes={[]} customerId={cliente.id} />
              <CustomerDialog cliente={cliente} />
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total gasto" value={gasto} icon={Receipt} tone="positive" />
        <StatCard label="Visitas" value={entregues.length} icon={Car} money={false} />
        <StatCard
          label="Carimbos"
          value={cliente.loyaltyStamps}
          icon={Gift}
          money={false}
          tone={faltamCarimbos === 0 ? "positive" : "neutral"}
          hint={faltamCarimbos === 0 ? "Prêmio disponível" : `Faltam ${faltamCarimbos} para o prêmio`}
        />
        <StatCard label="Veículos" value={veiculos.length} icon={Car} money={false} />
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Contato</h3>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Celular</dt>
              <dd>
                <PhoneLink phone={cliente.phone} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="truncate">{cliente.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Promoções</dt>
              <dd>{cliente.marketingOptIn ? "Aceita receber" : "Não aceita"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Endereço</h3>
          <p className="text-sm text-muted-foreground">{endereco || "Não informado."}</p>
          {cliente.notes && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-semibold">Observações</h3>
              <p className="text-sm text-muted-foreground">{cliente.notes}</p>
            </>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">
          Veículos <span className="font-normal text-muted-foreground">({veiculos.length})</span>
        </h3>

        {veiculos.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Nenhum veículo"
            description="Cadastre o carro do cliente para abrir ordens de serviço."
            action={podeEditar ? <VehicleDialog clientes={[]} customerId={cliente.id} /> : undefined}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {veiculos.map((v) => (
              <li key={v.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold">{v.plate}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[v.brand, v.model, v.color, v.year].filter(Boolean).join(" · ") || "Sem detalhes"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {label(VEHICLE_CATEGORY_LABELS, v.category)}
                    </p>
                  </div>
                  {podeEditar && (
                    <div className="flex shrink-0 items-center gap-1">
                      <VehicleDialog veiculo={v} customerId={cliente.id} />
                      <DeleteVehicleButton id={v.id} plate={v.plate} />
                    </div>
                  )}
                </div>
                {v.notes && <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{v.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">Histórico</h3>
        {historico.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma ordem ainda"
            description="As ordens de serviço deste cliente aparecem aqui."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Ordem</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historico.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/ordens/${o.id}`} className="font-medium hover:underline">
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.businessDate)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.plate}</td>
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
