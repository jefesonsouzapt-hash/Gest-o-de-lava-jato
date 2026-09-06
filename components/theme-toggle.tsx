"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

type Tema = "claro" | "escuro" | "sistema"

const CHAVE = "lj-tema"

function aplicar(tema: Tema) {
  const escuro =
    tema === "escuro" ||
    (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", escuro)
}

/**
 * Alternador de tema.
 *
 * O padrão é seguir o sistema: num balcão de lava jato o celular do
 * recepcionista já está no escuro à noite, e a tela não deveria brigar com
 * isso. A escolha fica no aparelho, não na conta — o mesmo usuário pode
 * preferir claro no computador da recepção e escuro no celular.
 */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("sistema")

  useEffect(() => {
    const salvo = (localStorage.getItem(CHAVE) as Tema | null) ?? "sistema"
    setTema(salvo)
    aplicar(salvo)

    // Seguir o sistema quer dizer acompanhar quando ele muda, não só na carga.
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const aoMudar = () => {
      if ((localStorage.getItem(CHAVE) as Tema | null) === "sistema") aplicar("sistema")
    }
    mq.addEventListener("change", aoMudar)
    return () => mq.removeEventListener("change", aoMudar)
  }, [])

  function escolher(novo: Tema) {
    setTema(novo)
    localStorage.setItem(CHAVE, novo)
    aplicar(novo)
  }

  const opcoes: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
    { valor: "claro", rotulo: "Tema claro", Icone: Sun },
    { valor: "sistema", rotulo: "Seguir o sistema", Icone: Monitor },
    { valor: "escuro", rotulo: "Tema escuro", Icone: Moon },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {opcoes.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          aria-label={rotulo}
          title={rotulo}
          onClick={() => escolher(valor)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            tema === valor
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icone className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

/**
 * Script que roda antes da primeira pintura.
 *
 * Sem ele a tela nasce clara e pisca para escura assim que o React monta —
 * o "flash" branco que todo site de tema escuro mal-feito tem.
 */
export const SCRIPT_TEMA = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(CHAVE)})||"sistema";
var e=t==="escuro"||(t==="sistema"&&matchMedia("(prefers-color-scheme: dark)").matches);
if(e)document.documentElement.classList.add("dark");
}catch(_){}})()`
