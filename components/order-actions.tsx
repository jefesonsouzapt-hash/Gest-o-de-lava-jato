"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Loader2, Undo2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { ConfirmButton } from "@/components/confirm-button"
import { assignOrder, cancelOrder, setOrderStatus } from "@/lib/actions/ordens"
import { BOARD_COLUMNS, WORK_ORDER_STATUS_LABELS, label } from "@/lib/domain"

/** Empurra a ordem para a próxima coluna do quadro. */
export function AdvanceButton({
  orderId,
  status,
  full = false,
}: {
  orderId: number
  status: string
  full?: boolean
}) {
  const [pendente, iniciar] = useTransition()
  const indice = BOARD_COLUMNS.indexOf(status as (typeof BOARD_COLUMNS)[number])
  const proximo = indice >= 0 && indice < BOARD_COLUMNS.length - 1 ? BOARD_COLUMNS[indice + 1] : "entregue"

  return (
    <Button
      variant={full ? "default" : "ghost"}
      size="sm"
      disabled={pendente}
      className={full ? "w-full" : undefined}
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData()
          dados.set("workOrderId", String(orderId))
          dados.set("status", proximo)
          const r = await setOrderStatus(dados)
          if (r.ok) toast.success(`Movida para ${label(WORK_ORDER_STATUS_LABELS, proximo)}.`)
          else toast.error(r.error ?? "Não foi possível avançar.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <ChevronRight />}
      {label(WORK_ORDER_STATUS_LABELS, proximo)}
    </Button>
  )
}

/** Volta a ordem uma coluna — o carro voltou para refazer o acabamento. */
export function StatusSelect({ orderId, status }: { orderId: number; status: string }) {
  const [pendente, iniciar] = useTransition()

  return (
    <NativeSelect
      aria-label="Mudar situação da ordem"
      value={status}
      disabled={pendente}
      className="h-8 w-auto text-xs"
      onChange={(e) => {
        const novo = e.target.value
        iniciar(async () => {
          const dados = new FormData()
          dados.set("workOrderId", String(orderId))
          dados.set("status", novo)
          const r = await setOrderStatus(dados)
          if (r.ok) toast.success("Situação atualizada.")
          else toast.error(r.error ?? "Não foi possível mudar a situação.")
        })
      }}
    >
      {[...BOARD_COLUMNS, "entregue"].map((s) => (
        <option key={s} value={s}>
          {label(WORK_ORDER_STATUS_LABELS, s)}
        </option>
      ))}
    </NativeSelect>
  )
}

/** Manda a ordem para uma pista e define quem executa. */
export function AssignSelects({
  orderId,
  bayId,
  staffId,
  pistas,
  equipe,
}: {
  orderId: number
  bayId: number | null
  staffId: number | null
  pistas: { id: number; name: string; status: string }[]
  equipe: { id: number; name: string }[]
}) {
  const [pendente, iniciar] = useTransition()

  function salvar(novaPista: string, novoColab: string) {
    iniciar(async () => {
      const dados = new FormData()
      dados.set("workOrderId", String(orderId))
      if (novaPista) dados.set("bayId", novaPista)
      if (novoColab) dados.set("assignedStaffId", novoColab)
      const r = await assignOrder(dados)
      if (r.ok) toast.success("Atribuição atualizada.")
      else toast.error(r.error ?? "Não foi possível atribuir.")
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <NativeSelect
        aria-label="Pista"
        defaultValue={bayId ?? ""}
        disabled={pendente}
        className="h-9 w-auto"
        onChange={(e) => salvar(e.target.value, String(staffId ?? ""))}
      >
        <option value="">Sem pista</option>
        {pistas.map((p) => (
          <option key={p.id} value={p.id} disabled={p.status === "manutencao"}>
            {p.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Responsável"
        defaultValue={staffId ?? ""}
        disabled={pendente}
        className="h-9 w-auto"
        onChange={(e) => salvar(String(bayId ?? ""), e.target.value)}
      >
        <option value="">Sem responsável</option>
        {equipe.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}

export function CancelOrderButton({ orderId, reference }: { orderId: number; reference: string }) {
  const router = useRouter()
  return (
    <ConfirmButton
      icon={<XCircle />}
      label="Cancelar ordem"
      title={`Cancelar a ordem ${reference}?`}
      description="A ordem não é apagada — o número já foi dito ao cliente. Ela fica marcada como cancelada e sai do quadro. Pagamentos precisam ser estornados antes."
      confirmLabel="Cancelar ordem"
      successMessage="Ordem cancelada."
      reasonLabel="Motivo do cancelamento"
      action={async (formData) => {
        const r = await cancelOrder(formData)
        if (r.ok) router.refresh()
        return r
      }}
      fields={{ workOrderId: orderId }}
    />
  )
}

/** Devolve a ordem entregue para "pronto para entrega". */
export function ReopenOrderButton({ orderId }: { orderId: number }) {
  const [pendente, iniciar] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData()
          dados.set("workOrderId", String(orderId))
          dados.set("status", "pronto_entrega")
          const r = await setOrderStatus(dados)
          if (r.ok) toast.success("Ordem devolvida para entrega.")
          else toast.error(r.error ?? "Não foi possível reabrir.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Desfazer entrega
    </Button>
  )
}
