"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Pencil, Plus } from "lucide-react"
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
import { saveService } from "@/lib/actions/catalogo"
import type { ActionState } from "@/lib/actions/form"
import { bpsToPercentInput, centsToInput, formatCurrency, parseCurrencyToCents } from "@/lib/locale/money"
import { priceForVehicle, type VehicleCategory } from "@/lib/pricing/calc"
import { VEHICLE_CATEGORY_LABELS } from "@/lib/domain"

const CATEGORIAS = ["moto", "hatch", "sedan", "suv", "caminhonete"] as const

export type ServiceFormValues = {
  id: number
  name: string
  description: string | null
  categoryId: number | null
  isPackage: boolean
  basePriceCents: number
  durationMinutes: number
  commissionBps: number
  countsForLoyalty: boolean
  prices: { category: string; priceCents: number }[]
}

export function ServiceDialog({
  servico,
  categorias,
}: {
  servico?: ServiceFormValues
  categorias: { id: number; name: string }[]
}) {
  const editando = servico != null
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveService, null)

  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Serviço atualizado." : "Serviço cadastrado.")
      setAberto(false)
    }
  }, [estado, editando])

  // O preço-base muda a estimativa por porte na hora, para o dono ver quanto
  // vai cobrar de cada carro antes de salvar.
  const [precoBase, setPrecoBase] = useState(
    valores.basePriceCents ?? (servico ? centsToInput(servico.basePriceCents) : ""),
  )

  const tabela = new Map((servico?.prices ?? []).map((p) => [p.category, p.priceCents]))
  const baseCents = parseCurrencyToCents(precoBase)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          editando ? (
            <Button variant="outline" size="sm">
              <Pencil />
              Editar
            </Button>
          ) : (
            <Button size="lg">
              <Plus />
              Novo serviço
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            O preço-base é o do hatch. Os outros portes são estimados a partir dele — e você pode fixar
            qualquer um na tabela abaixo.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-5">
          {editando && <input type="hidden" name="id" value={servico.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="sv-name" label="Nome" erro={erros.name} className="sm:col-span-2">
              <Input
                id="sv-name"
                name="name"
                defaultValue={valores.name ?? servico?.name ?? ""}
                className="h-9"
                required
                autoFocus
              />
            </Campo>

            <Campo id="sv-cat" label="Categoria" hint="(opcional)" erro={erros.categoryId}>
              <NativeSelect
                id="sv-cat"
                name="categoryId"
                defaultValue={valores.categoryId ?? servico?.categoryId ?? ""}
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <Campo id="sv-price" label="Preço-base (hatch)" erro={erros.basePriceCents}>
              <Input
                id="sv-price"
                name="basePriceCents"
                inputMode="decimal"
                value={precoBase}
                onChange={(e) => setPrecoBase(e.target.value)}
                placeholder="0,00"
                className="h-9"
                required
              />
            </Campo>

            <Campo id="sv-dur" label="Duração (minutos)" erro={erros.durationMinutes}>
              <Input
                id="sv-dur"
                name="durationMinutes"
                inputMode="numeric"
                defaultValue={valores.durationMinutes ?? String(servico?.durationMinutes ?? 30)}
                className="h-9"
                required
              />
            </Campo>

            <Campo
              id="sv-comm"
              label="Comissão do serviço"
              hint="em %"
              erro={erros.commissionBps}
            >
              <Input
                id="sv-comm"
                name="commissionBps"
                inputMode="decimal"
                defaultValue={valores.commissionBps ?? bpsToPercentInput(servico?.commissionBps ?? 0)}
                placeholder="0"
                className="h-9"
              />
            </Campo>
          </div>

          <Campo id="sv-desc" label="Descrição" hint="(opcional)" erro={erros.description}>
            <textarea
              id="sv-desc"
              name="description"
              rows={2}
              defaultValue={valores.description ?? servico?.description ?? ""}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Preço por porte</legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Deixe em branco para usar a estimativa. O valor digitado sempre manda.
            </p>

            <div className="grid gap-3 sm:grid-cols-5">
              {CATEGORIAS.map((cat) => {
                const estimado = priceForVehicle({
                  basePriceCents: baseCents,
                  category: cat as VehicleCategory,
                })
                const fixado = tabela.get(cat)
                return (
                  <div key={cat} className="flex flex-col gap-1.5">
                    <label htmlFor={`sv-price-${cat}`} className="text-xs font-medium">
                      {VEHICLE_CATEGORY_LABELS[cat]}
                    </label>
                    <Input
                      id={`sv-price-${cat}`}
                      name={`price_${cat}`}
                      inputMode="decimal"
                      defaultValue={valores[`price_${cat}`] ?? (fixado != null ? centsToInput(fixado) : "")}
                      placeholder={centsToInput(estimado)}
                      className="h-9 text-sm"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      estimado {formatCurrency(estimado)}
                    </span>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="countsForLoyalty"
                value="true"
                defaultChecked={
                  valores.countsForLoyalty === "true" || (!estado && (servico?.countsForLoyalty ?? true))
                }
                className="size-4 rounded border-input"
              />
              Conta carimbo no cartão de fidelidade
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isPackage"
                value="true"
                defaultChecked={valores.isPackage === "true" || (!estado && (servico?.isPackage ?? false))}
                className="size-4 rounded border-input"
              />
              É um pacote
            </label>
          </div>

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
