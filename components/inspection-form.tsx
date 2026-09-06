"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { ClipboardCheck } from "lucide-react"
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
import { saveInspection } from "@/lib/actions/ordens"
import type { ActionState } from "@/lib/actions/form"
import { INSPECTION_DAMAGE_LABELS, VEHICLE_AREAS } from "@/lib/domain"

/**
 * Vistoria de entrada.
 *
 * Registra o estado do carro quando chegou. É o documento que separa "já
 * estava assim" de "vocês riscaram" — por isso é uma por ordem e não se
 * edita depois.
 */
export function InspectionForm({ orderId }: { orderId: number }) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveInspection, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Vistoria registrada.")
      setAberto(false)
    }
  }, [estado])

  const [avarias, setAvarias] = useState<Record<string, string>>({})

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg">
            <ClipboardCheck />
            Fazer vistoria
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vistoria de entrada</DialogTitle>
          <DialogDescription>
            O estado do carro na chegada. Marcar uma avaria aqui é o que protege o lava jato de uma
            reclamação depois.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="workOrderId" value={orderId} />
          {Object.entries(avarias)
            .filter(([, tipo]) => tipo !== "")
            .map(([area, tipo]) => (
              <input key={area} type="hidden" name="damage" value={`${area}:${tipo}`} />
            ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="in-km" label="Quilometragem" hint="(opcional)" erro={erros.odometerKm}>
              <Input id="in-km" name="odometerKm" inputMode="numeric" className="h-9" />
            </Campo>

            <Campo id="in-fuel" label="Combustível (%)" hint="(opcional)" erro={erros.fuelLevelPercent}>
              <Input id="in-fuel" name="fuelLevelPercent" inputMode="numeric" placeholder="50" className="h-9" />
            </Campo>
          </div>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Avarias já existentes</legend>
            <p className="mb-3 text-xs text-muted-foreground">Deixe em branco o que estiver sem avaria.</p>

            <div className="grid gap-2 sm:grid-cols-2">
              {VEHICLE_AREAS.map((area) => (
                <label key={area.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{area.label}</span>
                  <NativeSelect
                    aria-label={`Avaria em ${area.label}`}
                    value={avarias[area.key] ?? ""}
                    onChange={(e) => setAvarias((a) => ({ ...a, [area.key]: e.target.value }))}
                    className="h-8 w-36 shrink-0 text-xs"
                  >
                    <option value="">—</option>
                    {Object.entries(INSPECTION_DAMAGE_LABELS).map(([chave, rotulo]) => (
                      <option key={chave} value={chave}>
                        {rotulo}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
            </div>
          </fieldset>

          <Campo id="in-items" label="Objetos deixados no carro" hint="(opcional)" erro={erros.personalItems}>
            <Input id="in-items" name="personalItems" placeholder="Cadeirinha, documentos, óculos…" className="h-9" />
          </Campo>

          <Campo id="in-signed" label="Conferido com" hint="(opcional)" erro={erros.signedByName}>
            <Input id="in-signed" name="signedByName" placeholder="Nome de quem entregou o carro" className="h-9" />
          </Campo>

          <Campo id="in-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <textarea
              id="in-notes"
              name="notes"
              rows={2}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Registrar vistoria</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
