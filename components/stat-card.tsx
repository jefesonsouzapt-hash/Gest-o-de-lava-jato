import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/locale/money"

/**
 * Um número em destaque. `money` decide entre euros e contagem — a mesma caixa
 * serve para faturação e para "8 viaturas".
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  money = true,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: "positive" | "negative" | "warning" | "neutral"
  hint?: string
  money?: boolean
}) {
  const tons = {
    positive: "bg-success/10 text-success",
    negative: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground dark:text-warning",
    neutral: "bg-primary/10 text-primary",
  }[tone]

  const corValor =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : value < 0
          ? "text-destructive"
          : "text-foreground"

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tons)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn("mt-3 text-2xl font-bold tracking-tight tabular-nums", corValor)}>
        {money ? formatCurrency(value) : value.toLocaleString("pt-PT")}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
