import Link from "next/link"
import { Suspense } from "react"
import { Car } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { listCustomers, listVehicles } from "@/lib/queries/clientes"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { SearchBox } from "@/components/search-box"
import { VehicleDialog } from "@/components/vehicle-dialog"
import { PhoneLink } from "@/components/phone-link"
import { VEHICLE_CATEGORY_LABELS, label } from "@/lib/domain"

export default async function VeiculosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePermissionPage("cliente.ver")
  const podeEditar = can(actor, "cliente.editar")

  const { q } = await searchParams
  const [veiculos, clientes] = await Promise.all([
    listVehicles(actor.companyId, { busca: q }),
    podeEditar ? listCustomers(actor.companyId) : Promise.resolve([]),
  ])

  const novo = podeEditar ? <VehicleDialog clientes={clientes.map((c) => ({ id: c.id, name: c.name }))} /> : undefined

  return (
    <>
      <PageHeader
        title="Veículos"
        description="Todos os carros atendidos, com o dono de cada um."
        action={clientes.length > 0 ? novo : undefined}
      />

      <div className="mb-4">
        <Suspense fallback={null}>
          <SearchBox placeholder="Buscar por placa, modelo ou dono" />
        </Suspense>
      </div>

      {veiculos.length === 0 ? (
        <EmptyState
          icon={Car}
          title={q ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
          description={
            q
              ? `Nada corresponde a "${q}". A busca por placa ignora o hífen.`
              : clientes.length === 0
                ? "Cadastre um cliente antes de registrar o primeiro veículo."
                : "Cadastre o primeiro veículo para abrir ordens de serviço."
          }
          action={clientes.length > 0 ? novo : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Porte</th>
                <th className="px-4 py-3">Dono</th>
                <th className="px-4 py-3">Contato</th>
                {podeEditar && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {veiculos.map((v) => (
                <tr key={v.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono font-semibold">{v.plate}</td>
                  <td className="px-4 py-3">
                    {[v.brand, v.model, v.color, v.year].filter(Boolean).join(" · ") || (
                      <span className="text-muted-foreground">Sem detalhes</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {label(VEHICLE_CATEGORY_LABELS, v.category)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${v.customerId}`} className="hover:underline">
                      {v.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PhoneLink phone={v.customerPhone} />
                  </td>
                  {podeEditar && (
                    <td className="px-4 py-3 text-right">
                      <VehicleDialog veiculo={v} clientes={clientes.map((c) => ({ id: c.id, name: c.name }))} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
