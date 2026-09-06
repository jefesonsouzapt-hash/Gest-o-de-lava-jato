"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setStaffActive } from "@/lib/actions/equipe"

/**
 * Ativa ou desativa um colaborador. Nunca há exclusão: comissão apurada e vale
 * descontado continuam ligados a ele.
 */
export function StaffActiveButton({
  id,
  name,
  active,
  variant = "icon",
}: {
  id: number
  name: string
  active: boolean
  variant?: "icon" | "text"
}) {
  const [pendente, startTransition] = useTransition()

  const rotulo = active ? "Desativar" : "Reativar"
  const Icone = active ? UserMinus : UserPlus

  function clicar() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("id", String(id))
      formData.set("active", String(!active))

      const r = await setStaffActive(formData)
      if (r.ok) toast.success(active ? `${name} saiu da equipe ativa.` : `${name} voltou para a equipe.`)
      else toast.error(r.error ?? "Não foi possível concluir.")
    })
  }

  if (variant === "text") {
    return (
      <Button variant="outline" size="sm" onClick={clicar} disabled={pendente}>
        {pendente ? <Loader2 className="animate-spin" /> : <Icone />}
        {rotulo}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      onClick={clicar}
      disabled={pendente}
      aria-label={`${rotulo} ${name}`}
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Icone />}
    </Button>
  )
}
