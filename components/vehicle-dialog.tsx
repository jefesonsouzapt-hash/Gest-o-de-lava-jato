"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Car, Pencil } from "lucide-react"
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
import { saveVehicle } from "@/lib/actions/clientes"
import type { ActionState } from "@/lib/actions/form"
import { formatPlate } from "@/lib/locale/br"
import { VEHICLE_CATEGORY_LABELS } from "@/lib/domain"

export type VehicleFormValues = {
  id: number
  customerId: number
  plate: string
  brand: string | null
  model: string | null
  color: string | null
  category: string
  year: number | null
  notes: string | null
}

export function VehicleDialog({
  veiculo,
  clientes,
  customerId,
}: {
  veiculo?: VehicleFormValues
  /** Quando ausente, o dono já está decidido e o campo não aparece. */
  clientes?: { id: number; name: string }[]
  customerId?: number
}) {
  const editando = veiculo != null
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveVehicle, null)

  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Veículo atualizado." : "Veículo cadastrado.")
      setAberto(false)
    }
  }, [estado, editando])

  const v = (campo: keyof VehicleFormValues, formatador?: (s: string) => string) => {
    const doEstado = valores[campo]
    if (doEstado != null) return doEstado
    const bruto = veiculo?.[campo]
    if (bruto == null) return ""
    return formatador ? formatador(String(bruto)) : String(bruto)
  }

  const donoFixo = customerId ?? veiculo?.customerId

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          editando ? (
            <Button variant="ghost" size="sm">
              <Pencil />
              Editar
            </Button>
          ) : (
            <Button size="lg">
              <Car />
              Novo veículo
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          <DialogDescription>
            O porte define o preço: a mesma lavagem custa mais numa caminhonete do que num hatch.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-5">
          {editando && <input type="hidden" name="id" value={veiculo.id} />}

          {clientes && !customerId ? (
            <Campo id="ve-customer" label="Dono" erro={erros.customerId}>
              <NativeSelect
                id="ve-customer"
                name="customerId"
                defaultValue={v("customerId") || ""}
                required
              >
                <option value="" disabled>
                  Escolha o cliente
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
          ) : (
            <input type="hidden" name="customerId" value={donoFixo ?? ""} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ve-plate" label="Placa" erro={erros.plate}>
              <Input
                id="ve-plate"
                name="plate"
                defaultValue={v("plate", formatPlate)}
                placeholder="ABC1D23"
                className="h-9 font-mono uppercase"
                required
                autoFocus
              />
            </Campo>

            <Campo id="ve-cat" label="Porte" erro={erros.category}>
              <NativeSelect id="ve-cat" name="category" defaultValue={v("category") || "hatch"}>
                {Object.entries(VEHICLE_CATEGORY_LABELS).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>
                    {rotulo}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <Campo id="ve-brand" label="Marca" hint="(opcional)" erro={erros.brand}>
              <Input id="ve-brand" name="brand" defaultValue={v("brand")} className="h-9" />
            </Campo>

            <Campo id="ve-model" label="Modelo" hint="(opcional)" erro={erros.model}>
              <Input id="ve-model" name="model" defaultValue={v("model")} className="h-9" />
            </Campo>

            <Campo id="ve-color" label="Cor" hint="(opcional)" erro={erros.color}>
              <Input id="ve-color" name="color" defaultValue={v("color")} className="h-9" />
            </Campo>

            <Campo id="ve-year" label="Ano" hint="(opcional)" erro={erros.year}>
              <Input id="ve-year" name="year" inputMode="numeric" defaultValue={v("year")} className="h-9" />
            </Campo>
          </div>

          <Campo id="ve-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <textarea
              id="ve-notes"
              name="notes"
              rows={2}
              defaultValue={v("notes")}
              placeholder="Farol quebrado, alarme sensível…"
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>{editando ? "Salvar" : "Cadastrar"}</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
