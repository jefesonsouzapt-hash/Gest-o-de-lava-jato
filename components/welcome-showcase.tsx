import { ClipboardList, Droplets, ShieldCheck } from "lucide-react"

const destaques = [
  {
    icon: Droplets,
    title: "O pátio numa tela só",
    description: "Fila, pista, acabamento e entrega — sem caderno e sem grupo de WhatsApp.",
  },
  {
    icon: ShieldCheck,
    title: "Vistoria de entrada",
    description: "Avarias e fotos registradas antes de encostar no carro. Fim da discussão na saída.",
  },
  {
    icon: ClipboardList,
    title: "Comissão e folha no automático",
    description: "Ordem paga credita a comissão do lavador; vale e adiantamento entram no fechamento.",
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
          Do carro na fila ao dinheiro no caixa.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-sidebar-foreground/70 text-pretty">
          Recepção, pistas, ordens de serviço, estoque, comissões e folha no mesmo lugar — feito para quem
          atende no balcão.
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
        Feito para o dia a dia de um lava jato de verdade.
      </p>
    </aside>
  )
}
