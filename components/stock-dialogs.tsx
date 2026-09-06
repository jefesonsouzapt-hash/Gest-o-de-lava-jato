"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeftRight, Pencil, Plus } from "lucide-react"
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
import { registerMovement, saveProduct } from "@/lib/actions/estoque"
import type { ActionState } from "@/lib/actions/form"
import { centsToInput } from "@/lib/locale/money"
import { STOCK_MOVEMENT_LABELS } from "@/lib/domain"

export type ProductFormValues = {
  id: number
  name: string
  kind: string
  unit: string
  minStockMilli: number
  unitCostCents: number
  supplier: string | null
}

/** Milésimos vira texto para o campo: 1500 → "1,5". */
function milliToInput(milli: number): string {
  return centsToInput(Math.round(milli / 10))
}

export function ProductDialog({ produto }: { produto?: ProductFormValues }) {
  const editando = produto != null
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveProduct, null)
  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Produto atualizado." : "Produto cadastrado.")
      setAberto(false)
    }
  }, [estado, editando])

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
              Novo produto
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            O saldo inicial entra como movimento de entrada — todo número no estoque tem uma linha que
            o explica.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={produto.id} />}

          <Campo id="pr-name" label="Nome" erro={erros.name}>
            <Input
              id="pr-name"
              name="name"
              defaultValue={valores.name ?? produto?.name ?? ""}
              placeholder="Shampoo automotivo"
              className="h-9"
              required
              autoFocus
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="pr-kind" label="Tipo" erro={erros.kind}>
              <Input
                id="pr-kind"
                name="kind"
                defaultValue={valores.kind ?? produto?.kind ?? "quimico"}
                placeholder="químico, pano, filtro…"
                className="h-9"
              />
            </Campo>

            <Campo id="pr-unit" label="Unidade" erro={erros.unit}>
              <NativeSelect id="pr-unit" name="unit" defaultValue={valores.unit ?? produto?.unit ?? "un"}>
                <option value="un">Unidade</option>
                <option value="L">Litro</option>
                <option value="ml">Mililitro</option>
                <option value="kg">Quilo</option>
              </NativeSelect>
            </Campo>

            <Campo id="pr-min" label="Estoque mínimo" erro={erros.minStockMilli}>
              <Input
                id="pr-min"
                name="minStockMilli"
                inputMode="decimal"
                defaultValue={valores.minStockMilli ?? (produto ? milliToInput(produto.minStockMilli) : "0")}
                className="h-9"
                required
              />
            </Campo>

            <Campo id="pr-cost" label="Custo unitário" erro={erros.unitCostCents}>
              <Input
                id="pr-cost"
                name="unitCostCents"
                inputMode="decimal"
                defaultValue={valores.unitCostCents ?? (produto ? centsToInput(produto.unitCostCents) : "0,00")}
                className="h-9"
                required
              />
            </Campo>

            {!editando && (
              <Campo id="pr-init" label="Saldo inicial" erro={erros.initialStock}>
                <Input id="pr-init" name="initialStock" inputMode="decimal" defaultValue="0" className="h-9" />
              </Campo>
            )}

            <Campo id="pr-sup" label="Fornecedor" hint="(opcional)" erro={erros.supplier}>
              <Input id="pr-sup" name="supplier" defaultValue={valores.supplier ?? produto?.supplier ?? ""} className="h-9" />
            </Campo>
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

export function MovementDialog({ produtos }: { produtos: { id: number; name: string; unit: string }[] }) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(registerMovement, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  const [tipo, setTipo] = useState("entrada")

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Movimento registrado.")
      setAberto(false)
    }
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg">
            <ArrowLeftRight />
            Lançar movimento
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimento de estoque</DialogTitle>
          <DialogDescription>
            Entrada soma; consumo e quebra subtraem. O ajuste é a contagem física corrigindo o sistema.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <Campo id="mv-product" label="Produto" erro={erros.productId}>
            <NativeSelect id="mv-product" name="productId" defaultValue="" required>
              <option value="" disabled>
                Escolha o produto
              </option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </NativeSelect>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="mv-kind" label="Tipo" erro={erros.kind}>
              <NativeSelect id="mv-kind" name="kind" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {Object.entries(STOCK_MOVEMENT_LABELS).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>
                    {rotulo}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <Campo id="mv-qty" label="Quantidade" erro={erros.quantityMilli}>
              <Input id="mv-qty" name="quantityMilli" inputMode="decimal" placeholder="0" className="h-9" required autoFocus />
            </Campo>
          </div>

          {tipo === "ajuste" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="negative" value="1" className="size-4 rounded border-input" />
              Diminuir o saldo (a contagem deu menos que o sistema)
            </label>
          )}

          <Campo id="mv-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <Input id="mv-notes" name="notes" placeholder="Nota fiscal, contagem do mês…" className="h-9" />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Lançar</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
