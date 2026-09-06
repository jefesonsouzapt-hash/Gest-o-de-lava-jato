import type React from "react"
import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <p className="font-semibold text-balance">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
