"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Banknote, Gift, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Campo, Enviar, ErroGeral } from "@/components/form-bits"
import { ConfirmButton } from "@/components/confirm-button"
import { redeemLoyalty, registerPayment, voidPayment } from "@/lib/actions/caixa"
import type { ActionState } from "@/lib/actions/form"
import { centsToInput, formatCurrency, parseCurrencyToCents } from "@/lib/locale/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/domain"

export function PaymentDialog({ orderId, dueCents }: { orderId: number; dueCents: number }) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(registerPayment, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Pagamento registrado.")
      setAberto(false)
    }
  }, [estado])

  // Começa com o valor cheio: o caso normal é pagar tudo de uma vez, e é onde
  // um erro de digitação custa mais caro.
  const [valor, setValor] = useState(centsToInput(dueCents))
  const digitado = parseCurrencyToCents(valor)
  const restante = dueCents - digitado

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="lg">
            <Banknote />
            Receber {formatCurrency(dueCents)}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receber pagamento</DialogTitle>
          <DialogDescription>
            Ao quitar a ordem, a comissão do responsável é creditada e o cartão de fidelidade é carimbado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="workOrderId" value={orderId} />

          <Campo id="pg-method" label="Forma de pagamento" erro={erros.method}>
            <NativeSelect id="pg-method" name="method" defaultValue="pix" required>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([chave, rotulo]) => (
                <option key={chave} value={chave}>
                  {rotulo}
                </option>
              ))}
            </NativeSelect>
          </Campo>

          <Campo id="pg-amount" label="Valor" erro={erros.amountCents}>
            <Input
              id="pg-amount"
              name="amountCents"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-9"
              required
              autoFocus
            />
          </Campo>

          {digitado > 0 && restante > 0 && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
              Pagamento parcial: ainda faltarão{" "}
              <strong className="text-foreground">{formatCurrency(restante)}</strong>. A comissão só é creditada
              quando a ordem for quitada.
            </p>
          )}

          <Campo id="pg-ref" label="Comprovante" hint="(opcional)" erro={erros.reference}>
            <Input
              id="pg-ref"
              name="reference"
              placeholder="ID da transação, últimos dígitos do cartão"
              className="h-9"
            />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Confirmar recebimento</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function VoidPaymentButton({ paymentId, amountCents }: { paymentId: number; amountCents: number }) {
  return (
    <ConfirmButton
      icon={<RotateCcw />}
      label="Estornar"
      title={`Estornar ${formatCurrency(amountCents)}?`}
      description="A linha continua no caixa do dia, marcada como estornada — é o que faz o fechamento bater. A comissão creditada por este pagamento também é estornada."
      confirmLabel="Estornar"
      successMessage="Pagamento estornado."
      reasonLabel="Motivo do estorno"
      action={voidPayment}
      fields={{ paymentId }}
    />
  )
}

export function RedeemLoyaltyButton({ orderId, stamps, target }: { orderId: number; stamps: number; target: number }) {
  return (
    <ConfirmButton
      icon={<Gift />}
      label="Usar prêmio de fidelidade"
      title="Aplicar o prêmio de fidelidade?"
      description={`O cliente tem ${stamps} carimbos. O prêmio desconta o serviço mais barato desta ordem e zera ${target} carimbos do cartão. Precisa ser aplicado antes do pagamento.`}
      confirmLabel="Aplicar prêmio"
      successMessage="Prêmio aplicado."
      action={redeemLoyalty}
      fields={{ workOrderId: orderId }}
    />
  )
}
