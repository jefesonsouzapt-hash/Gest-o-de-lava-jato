"use client"

import { Power, PowerOff } from "lucide-react"
import { RowActionItem } from "@/components/row-actions"
import { setServiceActive } from "@/lib/actions/catalogo"
import { setProductActive } from "@/lib/actions/estoque"

/** Item de menu que ativa ou desativa, com o texto certo para cada estado. */
function AlternarItem({
  id,
  active,
  action,
  aoAtivar,
  aoDesativar,
}: {
  id: number
  active: boolean
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  aoAtivar: string
  aoDesativar: string
}) {
  return (
    <RowActionItem
      icon={active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
      action={action}
      fields={{ id, active: active ? "0" : "1" }}
      successMessage={active ? aoDesativar : aoAtivar}
      destructive={active}
    >
      {active ? "Desativar" : "Ativar"}
    </RowActionItem>
  )
}

export function ServiceActiveItem({ id, active }: { id: number; active: boolean }) {
  return (
    <AlternarItem
      id={id}
      active={active}
      action={setServiceActive}
      aoAtivar="Serviço reativado."
      aoDesativar="Serviço desativado. As ordens antigas continuam intactas."
    />
  )
}

export function ProductActiveItem({ id, active }: { id: number; active: boolean }) {
  return (
    <AlternarItem
      id={id}
      active={active}
      action={setProductActive}
      aoAtivar="Produto reativado."
      aoDesativar="Produto desativado."
    />
  )
}
