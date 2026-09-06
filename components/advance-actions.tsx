"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Ban, BadgeCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cancelAdvance, payAdvance, type ActionState } from "@/lib/actions/vales"
import { formatCurrency } from "@/lib/locale/money"

function Confirmar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  )
}

/** Registra a entrega do dinheiro. É aqui que o vale vira dívida. */
export function PayAdvanceButton({ id, amountCents }: { id: number; amountCents: number }) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(payAdvance, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Pagamento registrado. O valor entrou no saldo devedor.")
      setAberto(false)
    }
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="sm">
            <BadgeCheck />
            Registrar pagamento
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento do vale</DialogTitle>
          <DialogDescription>
            Confirme como os {formatCurrency(amountCents)} foram entregues ao colaborador. A partir daqui o
            valor passa a ser descontado nas próximas folhas.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`pay-method-${id}`}>Forma de pagamento</Label>
            <NativeSelect id={`pay-method-${id}`} name="paymentMethod" defaultValue="pix">
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`pay-ref-${id}`}>
              Comprovante <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id={`pay-ref-${id}`} name="receiptRef" placeholder="ID da transação" className="h-9" />
          </div>

          {erros._ && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {erros._}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Confirmar>Confirmar entrega</Confirmar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Cancela um vale — só enquanto nenhuma parcela foi descontada. */
export function CancelAdvanceButton({ id, staffName }: { id: number; staffName: string }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, startTransition] = useTransition()
  const [motivo, setMotivo] = useState("")

  function cancelar() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("id", String(id))
      formData.set("reason", motivo)
      const r = await cancelAdvance(formData)
      if (r.ok) {
        toast.success("Vale cancelado.")
        setAberto(false)
      } else {
        toast.error(r.error ?? "Não foi possível cancelar.")
      }
    })
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Ban />
            Cancelar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar vale</DialogTitle>
          <DialogDescription>
            O vale de {staffName} deixa de existir para a folha. Um vale que já teve parcela descontada não
            pode ser cancelado — isso reescreveria um holerite já entregue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`cancel-reason-${id}`}>
            Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id={`cancel-reason-${id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: lançado por engano"
            className="h-9"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="lg" onClick={() => setAberto(false)}>
            Voltar
          </Button>
          <Button variant="destructive" size="lg" onClick={cancelar} disabled={pendente}>
            {pendente && <Loader2 className="animate-spin" />}
            Cancelar vale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
