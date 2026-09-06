"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Resultado = { ok: boolean; error?: string }

/**
 * Botão que confirma antes de agir e mostra o motivo quando o servidor recusa.
 *
 * Toda ação destrutiva do sistema passa por aqui: sem a confirmação, um clique
 * errado cancela a ordem de serviço de um cliente que está no balcão.
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  successMessage,
  action,
  fields,
  reasonLabel,
  variant = "outline",
  size = "sm",
  icon,
}: {
  label: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  successMessage: string
  action: (formData: FormData) => Promise<Resultado>
  fields: Record<string, string | number>
  /** Quando presente, pede um motivo por escrito antes de confirmar. */
  reasonLabel?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  icon?: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [pendente, iniciar] = useTransition()

  function confirmar() {
    iniciar(async () => {
      const dados = new FormData()
      for (const [chave, valor] of Object.entries(fields)) dados.set(chave, String(valor))
      if (reasonLabel) dados.set("reason", motivo)

      const resultado = await action(dados)
      if (resultado.ok) {
        toast.success(successMessage)
        setAberto(false)
        setMotivo("")
      } else {
        toast.error(resultado.error ?? "Não foi possível concluir.")
      }
    })
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setAberto(true)}>
        {icon}
        {label}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {reasonLabel && (
            <div className="flex flex-col gap-2">
              <label htmlFor="cb-reason" className="text-sm font-medium">
                {reasonLabel}
              </label>
              <textarea
                id="cb-reason"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="lg" onClick={() => setAberto(false)} disabled={pendente}>
              Voltar
            </Button>
            <Button size="lg" onClick={confirmar} disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
