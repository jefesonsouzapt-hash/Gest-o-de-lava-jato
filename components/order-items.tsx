"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Campo, Enviar, ErroGeral } from "@/components/form-bits"
import { addOrderItem, removeOrderItem, setOrderDiscount } from "@/lib/actions/ordens"
import type { ActionState } from "@/lib/actions/form"
import { centsToInput, formatCurrency } from "@/lib/locale/money"
import { priceForVehicle, type VehicleCategory } from "@/lib/pricing/calc"

export type CatalogoItem = {
  id: number
  name: string
  basePriceCents: number
  prices: { category: string; priceCents: number }[]
}

/** Acrescenta um serviço do catálogo, ou um item avulso digitado no balcão. */
export function AddItemForm({
  orderId,
  category,
  servicos,
}: {
  orderId: number
  category: string
  servicos: CatalogoItem[]
}) {
  const [estado, formAction] = useActionState<ActionState, FormData>(addOrderItem, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  const [servicoId, setServicoId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [preco, setPreco] = useState("")
  const [chave, setChave] = useState(0)

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Serviço acrescentado.")
      setServicoId("")
      setDescricao("")
      setPreco("")
      setChave((k) => k + 1)
    }
  }, [estado])

  // Escolher o serviço preenche descrição e preço já no porte do carro; os
  // dois campos continuam editáveis, porque o balcão negocia.
  function escolher(id: string) {
    setServicoId(id)
    const servico = servicos.find((s) => String(s.id) === id)
    if (!servico) return
    const tabela = servico.prices.find((p) => p.category === category)
    setDescricao(servico.name)
    setPreco(
      centsToInput(
        priceForVehicle({
          basePriceCents: servico.basePriceCents,
          category: category as VehicleCategory,
          tablePriceCents: tabela?.priceCents ?? null,
        }),
      ),
    )
  }

  return (
    <form key={chave} action={formAction} className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4">
      <input type="hidden" name="workOrderId" value={orderId} />
      <input type="hidden" name="serviceId" value={servicoId} />

      <div className="grid gap-3 sm:grid-cols-12">
        <Campo id="oi-service" label="Do catálogo" className="sm:col-span-4">
          <NativeSelect id="oi-service" value={servicoId} onChange={(e) => escolher(e.target.value)}>
            <option value="">Item avulso</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Campo>

        <Campo id="oi-desc" label="Descrição" erro={erros.description} className="sm:col-span-4">
          <Input
            id="oi-desc"
            name="description"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="h-9"
            required
          />
        </Campo>

        <Campo id="oi-qty" label="Qtd." erro={erros.quantity} className="sm:col-span-1">
          <Input id="oi-qty" name="quantity" inputMode="numeric" defaultValue="1" className="h-9" required />
        </Campo>

        <Campo id="oi-price" label="Valor unitário" erro={erros.unitPriceCents} className="sm:col-span-2">
          <Input
            id="oi-price"
            name="unitPriceCents"
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="0,00"
            className="h-9"
            required
          />
        </Campo>

        <div className="flex items-end sm:col-span-1">
          <Enviar size="default">
            <Plus />
            <span className="sr-only">Acrescentar</span>
          </Enviar>
        </div>
      </div>

      <ErroGeral msg={erros._} />
    </form>
  )
}

export function RemoveItemButton({ orderId, itemId }: { orderId: number; itemId: number }) {
  const [pendente, iniciar] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pendente}
      aria-label="Remover item"
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData()
          dados.set("workOrderId", String(orderId))
          dados.set("itemId", String(itemId))
          const r = await removeOrderItem(dados)
          if (r.ok) toast.success("Item removido.")
          else toast.error(r.error ?? "Não foi possível remover.")
        })
      }
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  )
}

/** Desconto da ordem. O servidor recusa desconto maior que o subtotal. */
export function DiscountForm({ orderId, discountCents }: { orderId: number; discountCents: number }) {
  const [pendente, iniciar] = useTransition()
  const [valor, setValor] = useState(centsToInput(discountCents))

  return (
    <form
      className="flex items-end gap-2"
      action={(dados) => {
        dados.set("workOrderId", String(orderId))
        dados.set("discountCents", valor)
        iniciar(async () => {
          const r = await setOrderDiscount(dados)
          if (r.ok) toast.success("Desconto aplicado.")
          else toast.error(r.error ?? "Não foi possível aplicar o desconto.")
        })
      }}
    >
      <Campo id="oi-disc" label="Desconto">
        <Input
          id="oi-disc"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className="h-9 w-32"
        />
      </Campo>
      <Button type="submit" size="default" variant="outline" disabled={pendente}>
        {pendente && <Loader2 className="animate-spin" />}
        Aplicar
      </Button>
    </form>
  )
}

/** Só para o resumo lateral: mostra o total sem repetir a conta na página. */
export function OrderTotals({
  subtotalCents,
  discountCents,
  totalCents,
  issCents,
  paidCents,
  dueCents,
}: {
  subtotalCents: number
  discountCents: number
  totalCents: number
  issCents: number
  paidCents: number
  dueCents: number
}) {
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular-nums">{formatCurrency(subtotalCents)}</dd>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Desconto</dt>
          <dd className="tabular-nums text-destructive">− {formatCurrency(discountCents)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatCurrency(totalCents)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Recebido</dt>
        <dd className="tabular-nums text-success">{formatCurrency(paidCents)}</dd>
      </div>
      {dueCents > 0 && (
        <div className="flex justify-between gap-4 font-semibold">
          <dt>Falta receber</dt>
          <dd className="tabular-nums text-destructive">{formatCurrency(dueCents)}</dd>
        </div>
      )}
      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1.5 text-xs text-muted-foreground">
        <dt>ISS embutido</dt>
        <dd className="tabular-nums">{formatCurrency(issCents)}</dd>
      </div>
    </dl>
  )
}
