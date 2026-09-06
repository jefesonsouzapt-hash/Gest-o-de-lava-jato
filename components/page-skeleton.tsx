import { Skeleton } from "@/components/ui/skeleton"

/**
 * Esqueleto da página enquanto os dados chegam.
 *
 * O que aparece aqui tem o **formato** do que vai chegar: um bloco cinza
 * genérico faz a tela pular quando o conteúdo entra, e o olho perde o lugar.
 */
export function PageSkeleton({
  cards = 4,
  rows = 6,
  table = true,
}: {
  cards?: number
  rows?: number
  table?: boolean
}) {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-7 w-28" />
            </div>
          ))}
        </div>
      )}

      {table && (
        <div className="mt-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
