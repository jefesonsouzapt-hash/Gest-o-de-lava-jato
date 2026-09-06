"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { BadgeCheck, Loader2, Lock, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  closePayrollPeriod,
  markPayrollPaid,
  reopenPayrollPeriod,
  type ActionState,
} from "@/lib/actions/folha"
import { formatCurrency } from "@/lib/locale/money"
import { monthTitle } from "@/lib/locale/datetime"

function Fechar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Lock />}
      Fechar folha
    </Button>
  )
}

/** Fecha a competência, congelando um holerite por colaborador. */
export function ClosePayrollButton({
  competenceMonth,
  totalCents,
  colaboradores,
}: {
  competenceMonth: string
  totalCents: number
  colaboradores: number
}) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(closePayrollPeriod, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Folha fechada. Os valores estão congelados.")
      setAberto(false)
    }
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="lg">
            <Lock />
            Fechar folha
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar a folha de {monthTitle(competenceMonth)}</DialogTitle>
          <DialogDescription>
            {colaboradores} colaborador(es), {formatCurrency(totalCents)} de líquido. Os valores ficam
            congelados e as parcelas de vale são descontadas do saldo devedor.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="competenceMonth" value={competenceMonth} />

          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            Enquanto não for marcada como paga, a folha ainda pode ser reaberta — e reabrir devolve as
            parcelas ao saldo devedor de cada vale.
          </p>

          {erros._ && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {erros._}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Fechar />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Marca como paga — depois disso a folha não reabre mais. */
export function MarkPaidButton({ competenceMonth }: { competenceMonth: string }) {
  const [pendente, startTransition] = useTransition()

  return (
    <Button
      size="lg"
      disabled={pendente}
      onClick={() =>
        startTransition(async () => {
          const fd = new FormData()
          fd.set("competenceMonth", competenceMonth)
          const r = await markPayrollPaid(fd)
          if (r.ok) toast.success("Folha marcada como paga.")
          else toast.error(r.error ?? "Não foi possível concluir.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
      Marcar como paga
    </Button>
  )
}

export function ReopenPayrollButton({ competenceMonth }: { competenceMonth: string }) {
  const [pendente, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={pendente}
      onClick={() =>
        startTransition(async () => {
          const fd = new FormData()
          fd.set("competenceMonth", competenceMonth)
          const r = await reopenPayrollPeriod(fd)
          if (r.ok) toast.success("Folha reaberta. As parcelas voltaram ao saldo devedor.")
          else toast.error(r.error ?? "Não foi possível reabrir.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Reabrir
    </Button>
  )
}
