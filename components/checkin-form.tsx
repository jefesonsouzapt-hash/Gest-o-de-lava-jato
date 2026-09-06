"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Car } from "lucide-react"
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
import { openWorkOrder } from "@/lib/actions/ordens"
import type { ActionState } from "@/lib/actions/form"
import { formatCurrency } from "@/lib/locale/money"
import { formatDuration } from "@/lib/locale/datetime"
import { durationForVehicle, priceForVehicle, type VehicleCategory } from "@/lib/pricing/calc"
import { VEHICLE_CATEGORY_LABELS } from "@/lib/domain"

export type CheckinVehicle = {
  id: number
  plate: string
  model: string | null
  brand: string | null
  category: string
  customerName: string
}

export type CheckinService = {
  id: number
  name: string
  basePriceCents: number
  durationMinutes: number
  categoryName: string | null
  prices: { category: string; priceCents: number }[]
}

/**
 * Chegada do carro: escolhe o veículo, marca os serviços e abre a ordem.
 *
 * O total aparece **antes** de abrir, já com o preço do porte daquele carro:
 * é o número que o recepcionista diz para o cliente, e ele não pode mudar
 * depois que a ordem existe.
 */
export function CheckinForm({
  veiculos,
  servicos,
  pistas,
  equipe,
}: {
  veiculos: CheckinVehicle[]
  servicos: CheckinService[]
  pistas: { id: number; name: string; status: string }[]
  equipe: { id: number; name: string }[]
}) {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(openWorkOrder, null)

  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Ordem de serviço aberta.")
      setAberto(false)
      setMarcados([])
    }
  }, [estado])

  const [veiculoId, setVeiculoId] = useState<string>("")
  const [marcados, setMarcados] = useState<number[]>([])

  const veiculo = veiculos.find((v) => String(v.id) === veiculoId)
  const porte = (veiculo?.category ?? "hatch") as VehicleCategory

  const resumo = useMemo(() => {
    const escolhidos = servicos.filter((s) => marcados.includes(s.id))
    const total = escolhidos.reduce((soma, s) => {
      const tabela = s.prices.find((p) => p.category === porte)
      return soma + priceForVehicle({ basePriceCents: s.basePriceCents, category: porte, tablePriceCents: tabela?.priceCents ?? null })
    }, 0)
    const minutos = escolhidos.reduce(
      (soma, s) => soma + durationForVehicle({ baseMinutes: s.durationMinutes, category: porte }),
      0,
    )
    return { total, minutos, quantos: escolhidos.length }
  }, [marcados, servicos, porte])

  function alternar(id: number) {
    setMarcados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button size="lg">
            <Car />
            Registrar chegada
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chegada do veículo</DialogTitle>
          <DialogDescription>
            Sem pista escolhida, a ordem entra na fila de espera.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <Campo id="ck-vehicle" label="Veículo" erro={erros.vehicleId}>
            <NativeSelect
              id="ck-vehicle"
              name="vehicleId"
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              required
            >
              <option value="" disabled>
                Busque pela placa
              </option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {[v.brand, v.model].filter(Boolean).join(" ") || "sem modelo"} · {v.customerName}
                </option>
              ))}
            </NativeSelect>
          </Campo>

          {veiculo && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Porte: <strong className="text-foreground">{VEHICLE_CATEGORY_LABELS[veiculo.category]}</strong> — é
              o que define o preço de cada serviço abaixo.
            </p>
          )}

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Serviços</legend>

            {servicos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum serviço ativo no catálogo. Cadastre em Serviços.
              </p>
            ) : (
              <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
                {servicos.map((s) => {
                  const tabela = s.prices.find((p) => p.category === porte)
                  const preco = priceForVehicle({
                    basePriceCents: s.basePriceCents,
                    category: porte,
                    tablePriceCents: tabela?.priceCents ?? null,
                  })
                  return (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            name="serviceIds"
                            value={s.id}
                            checked={marcados.includes(s.id)}
                            onChange={() => alternar(s.id)}
                            className="size-4 shrink-0 rounded border-input"
                          />
                          <span className="truncate text-sm">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatCurrency(preco)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>

          {resumo.quantos > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {resumo.quantos} {resumo.quantos === 1 ? "serviço" : "serviços"} ·{" "}
                {formatDuration(resumo.minutos)} estimados
              </span>
              <span className="text-lg font-bold tabular-nums">{formatCurrency(resumo.total)}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="ck-bay" label="Pista" hint="(opcional)" erro={erros.bayId}>
              <NativeSelect id="ck-bay" name="bayId" defaultValue="">
                <option value="">Deixar na fila</option>
                {pistas.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.status === "manutencao"}>
                    {p.name}
                    {p.status === "manutencao" ? " (manutenção)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <Campo id="ck-staff" label="Responsável" hint="(opcional)" erro={erros.assignedStaffId}>
              <NativeSelect id="ck-staff" name="assignedStaffId" defaultValue="">
                <option value="">Definir depois</option>
                {equipe.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Campo>

            <Campo id="ck-arrival" label="Chegada" erro={erros.arrival}>
              <NativeSelect id="ck-arrival" name="arrival" defaultValue="walk_in">
                <option value="walk_in">Sem agendamento</option>
                <option value="agendado">Agendado</option>
              </NativeSelect>
            </Campo>
          </div>

          <Campo id="ck-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <textarea
              id="ck-notes"
              name="notes"
              rows={2}
              placeholder="Cliente espera no local, tem pressa…"
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Abrir ordem</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
