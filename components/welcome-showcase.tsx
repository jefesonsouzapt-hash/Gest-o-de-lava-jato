import { ClipboardList, Droplets, ShieldCheck } from "lucide-react"

const destaques = [
  {
    icon: Droplets,
    title: "O pátio num ecrã",
    description: "Fila, pista, acabamento e entrega — sem caderno e sem grupo de WhatsApp.",
  },
  {
    icon: ShieldCheck,
    title: "Inspeção de entrada",
    description: "Danos e fotografias registados antes de tocar na viatura. Fim das discussões à saída.",
  },
  {
    icon: ClipboardList,
    title: "Caixa que fecha sozinho",
    description: "Fichas pagas viram faturação; consumíveis e comissões saem no mesmo relatório.",
  },
]

export function WelcomeShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-sidebar px-10 py-14 text-sidebar-foreground lg:flex lg:w-[46%] lg:flex-col lg:justify-between xl:w-[42%]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <p className="text-sm font-medium text-sidebar-primary">Gestão de Lava Jato</p>
        <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight text-balance">
          Da viatura na fila ao dinheiro em caixa.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-sidebar-foreground/70 text-pretty">
          Receção, pistas, fichas de trabalho, consumíveis e faturação no mesmo sítio — pensado para quem
          atende ao balcão.
        </p>
      </div>

      <ul className="relative mt-12 flex flex-col gap-6">
        {destaques.map((item) => (
          <li key={item.title} className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-primary">
              <item.icon className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-sidebar-foreground/70">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="relative text-xs text-sidebar-foreground/50">
        Feito para o dia a dia de um centro de detalhe automóvel.
      </p>
    </aside>
  )
}
