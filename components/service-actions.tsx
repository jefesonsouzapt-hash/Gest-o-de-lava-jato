"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setServiceActive } from "@/lib/actions/catalogo"
import { setProductActive } from "@/lib/actions/estoque"

function Alternar({
  id,
  active,
  action,
  rotuloAtivo,
  rotuloInativo,
}: {
  id: number
  active: boolean
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  rotuloAtivo: string
  rotuloInativo: string
}) {
  const [pendente, iniciar] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData()
          dados.set("id", String(id))
          dados.set("active", active ? "0" : "1")
          const r = await action(dados)
          if (r.ok) toast.success(active ? rotuloInativo : rotuloAtivo)
          else toast.error(r.error ?? "Não foi possível alterar.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Power />}
      {active ? "Desativar" : "Ativar"}
    </Button>
  )
}

export function ServiceActiveButton({ id, active }: { id: number; active: boolean }) {
  return (
    <Alternar
      id={id}
      active={active}
      action={setServiceActive}
      rotuloAtivo="Serviço reativado."
      rotuloInativo="Serviço desativado. As ordens antigas continuam intactas."
    />
  )
}

export function ProductActiveButton({ id, active }: { id: number; active: boolean }) {
  return (
    <Alternar
      id={id}
      active={active}
      action={setProductActive}
      rotuloAtivo="Produto reativado."
      rotuloInativo="Produto desativado."
    />
  )
}
