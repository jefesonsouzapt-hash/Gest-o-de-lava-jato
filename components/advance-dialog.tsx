"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { HandCoins, Loader2 } from "lucide-react"
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
import { createAdvance, type ActionState } from "@/lib/actions/vales"
import { formatCurrency, parseCurrencyToCents } from "@/lib/locale/money"
import { splitInstallments } from "@/lib/payroll/calc"
import { monthTitle } from "@/lib/locale/datetime"

function Conceder() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Conceder vale
    </Button>
  )
}

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  )
}

/** Próximas competências, para escolher em qual folha o desconto começa. */
function proximasCompetencias(hoje: string, quantas = 6): string[] {
  const [ano, mes] = hoje.split("-").map(Number)
  return Array.from({ length: quantas }, (_, i) => {
    const d = new Date(ano, mes - 1 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
}

export function AdvanceDialog({
  colaboradores,
  hoje,
  competenciaAtual,
}: {
  colaboradores: { id: number; name: string }[]
  hoje: string
  competenciaAtual: string
}) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(createAdvance, null)

  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Vale concedido. Registre o pagamento quando o dinheiro sair.")
      setAberto(false)
    }
  }, [estado])

  // Prévia das parcelas: o mesmo cálculo do fechamento, para o colaborador ver
  // o que vai ser descontado antes de assinar.
  const [valor, setValor] = useState(valores.amountCents ?? "")
  const [parcelas, setParcelas] = useState(Number(valores.installments ?? 1))

  const previa = useMemo(() => {
    const centavos = parseCurrencyToCents(valor)
    if (centavos <= 0) return []
    return splitInstallments(centavos, parcelas)
  }, [valor, parcelas])

  const competencias = proximasCompetencias(competenciaAtual)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="lg">
            <HandCoins />
            Novo vale
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo vale / adiantamento</DialogTitle>
          <DialogDescription>
            O vale só vira dívida do colaborador quando o pagamento é registrado.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="va-staff">Colaborador</Label>
            <NativeSelect id="va-staff" name="staffId" defaultValue={valores.staffId ?? ""} required>
              <option value="" disabled>
                Escolha o colaborador
              </option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <Erro msg={erros.staffId} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-amount">Valor</Label>
              <Input
                id="va-amount"
                name="amountCents"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-9"
                required
              />
              <Erro msg={erros.amountCents} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="va-date">Data do pedido</Label>
              <Input
                id="va-date"
                name="requestedOn"
                type="date"
                defaultValue={valores.requestedOn ?? hoje}
                className="h-9"
                required
              />
              <Erro msg={erros.requestedOn} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="va-method">Forma de entrega</Label>
              <NativeSelect id="va-method" name="paymentMethod" defaultValue={valores.paymentMethod ?? "pix"}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
              </NativeSelect>
              <Erro msg={erros.paymentMethod} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="va-installments">Parcelas</Label>
              <NativeSelect
                id="va-installments"
                name="installments"
                value={String(parcelas)}
                onChange={(e) => setParcelas(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Desconto único" : `${n}x`}
                  </option>
                ))}
              </NativeSelect>
              <Erro msg={erros.installments} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="va-first">Descontar a partir de</Label>
              <NativeSelect
                id="va-first"
                name="firstDeductionMonth"
                defaultValue={valores.firstDeductionMonth ?? competencias[1] ?? competenciaAtual}
              >
                {competencias.map((c) => (
                  <option key={c} value={c}>
                    {monthTitle(c)}
                  </option>
                ))}
              </NativeSelect>
              <Erro msg={erros.firstDeductionMonth} />
            </div>
          </div>

          {previa.length > 0 && (
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Como vai ser descontado
                {previa.length > 1 && " — o centavo de resto cai na última parcela"}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                {previa.map((centavos, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{i + 1}ª</span>{" "}
                    <span className="font-semibold">{formatCurrency(centavos)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="va-receipt">
              Comprovante <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="va-receipt"
              name="receiptRef"
              placeholder="ID da transação, número do recibo"
              defaultValue={valores.receiptRef ?? ""}
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="va-notes">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <textarea
              id="va-notes"
              name="notes"
              rows={2}
              defaultValue={valores.notes ?? ""}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
            <Conceder />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
