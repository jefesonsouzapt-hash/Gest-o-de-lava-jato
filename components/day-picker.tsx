"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"

/** Escolha de dia que vive na URL, como a busca. */
export function DayPicker({ value, param = "dia" }: { value: string; param?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <Input
      type="date"
      value={value}
      aria-label="Escolher data"
      className="h-9 w-auto"
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString())
        if (e.target.value) params.set(param, e.target.value)
        else params.delete(param)
        router.replace(`?${params.toString()}`, { scroll: false })
      }}
    />
  )
}

/** Intervalo de datas para os relatórios. */
export function RangePicker({ desde, ate }: { desde: string; ate: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function trocar(campo: "desde" | "ate", valor: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) params.set(campo, valor)
    else params.delete(campo)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={desde}
        aria-label="Data inicial"
        max={ate}
        className="h-9 w-auto"
        onChange={(e) => trocar("desde", e.target.value)}
      />
      <span className="text-sm text-muted-foreground">até</span>
      <Input
        type="date"
        value={ate}
        aria-label="Data final"
        min={desde}
        className="h-9 w-auto"
        onChange={(e) => trocar("ate", e.target.value)}
      />
    </div>
  )
}
