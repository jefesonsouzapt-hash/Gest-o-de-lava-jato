import { cn } from "@/lib/utils"

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        {/* Carro sob a gota de água. */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2.5c1.9 2.3 3 4 3 5.3a3 3 0 0 1-6 0c0-1.3 1.1-3 3-5.3Z" />
          <path d="M4 18.5h16" />
          <path d="M4 18.5v-3l1.8-3.2a2 2 0 0 1 1.75-1.03h8.9a2 2 0 0 1 1.75 1.03L20 15.5v3" />
          <path d="M7.5 15.5h.01" />
          <path d="M16.5 15.5h.01" />
        </svg>
      </span>
      {/* O texto herda a cor de quem o renderiza: o mesmo logótipo serve na
          barra lateral escura e na tela de entrada, sobre fundo claro. */}
      {showText && (
        <span className="flex flex-col leading-none text-current">
          <span className="text-[15px] font-extrabold tracking-tight">Lava Jato</span>
          <span className="mt-0.5 text-[11px] font-medium opacity-60">Gestão</span>
        </span>
      )}
    </div>
  )
}
