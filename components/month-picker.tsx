"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { monthTitle } from "@/lib/locale/datetime"

/** Desloca uma competência `AAAA-MM` em N meses. */
function shiftMonth(ym: string, delta: number): string {
  const [ano, mes] = ym.split("-").map(Number)
  const d = new Date(ano, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function ir(ym: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("mes", ym)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
      <Button variant="ghost" size="icon-sm" onClick={() => ir(shiftMonth(value, -1))} aria-label="Mês anterior">
        <ChevronLeft />
      </Button>
      <span className="min-w-[9.5rem] text-center text-sm font-semibold">{monthTitle(value)}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => ir(shiftMonth(value, 1))} aria-label="Próximo mês">
        <ChevronRight />
      </Button>
    </div>
  )
}
