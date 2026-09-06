import Link from "next/link"
import { Suspense } from "react"
import { Users } from "lucide-react"
import { requirePermissionPage } from "@/lib/auth/guard"
import { can } from "@/lib/auth/permissions"
import { listCustomers } from "@/lib/queries/clientes"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { SearchBox } from "@/components/search-box"
import { PhoneLink } from "@/components/phone-link"
import { CustomerDialog } from "@/components/customer-dialog"
import { formatCurrency } from "@/lib/locale/money"
import { formatDocument } from "@/lib/locale/br"
import { formatDate, toISODate } from "@/lib/locale/datetime"
import { CUSTOMER_SEGMENT_CLASSES, CUSTOMER_SEGMENT_LABELS, label } from "@/lib/domain"
import { cn } from "@/lib/utils"

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePermissionPage("cliente.ver")
  const podeEditar = can(actor, "cliente.editar")

  const { q } = await searchParams
  const clientes = await listCustomers(actor.companyId, { busca: q })

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem já passou pelo lava jato, com o histórico de cada um."
        action={podeEditar ? <CustomerDialog /> : undefined}
      />

      <div className="mb-4">
        <Suspense fallback={null}>
          <SearchBox placeholder="Buscar por nome, telefone ou CPF" />
        </Suspense>
      </div>

      {clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            q
              ? `Nada corresponde a "${q}". Confira a escrita ou cadastre o cliente.`
              : "Cadastre o primeiro cliente para começar a registrar veículos e ordens de serviço."
          }
          action={podeEditar ? <CustomerDialog /> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3 text-right">Veículos</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Já gastou</th>
                <th className="px-4 py-3">Última visita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                          CUSTOMER_SEGMENT_CLASSES[c.segment] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {label(CUSTOMER_SEGMENT_LABELS, c.segment)}
                      </span>
                      {c.document && (
                        <span className="text-xs text-muted-foreground">{formatDocument(c.document)}</span>
                      )}
                      {c.loyaltyStamps > 0 && (
                        <span className="text-xs text-muted-foreground">{c.loyaltyStamps} carimbos</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PhoneLink phone={c.phone} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.vehicleCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatCurrency(c.spentCents)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.lastVisitAt ? formatDate(toISODate(c.lastVisitAt)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
