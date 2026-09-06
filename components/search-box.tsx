"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

/**
 * Busca que escreve na barra de endereço.
 *
 * O termo vive na URL, e não num estado do componente: assim a busca sobrevive
 * ao recarregar, dá para mandar o link para o colega e o botão "voltar"
 * funciona como o usuário espera.
 */
export function SearchBox({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [termo, setTermo] = useState(searchParams.get(param) ?? "")

  useEffect(() => {
    // Espera o usuário parar de digitar: uma consulta por tecla derruba o banco
    // à toa e faz a lista piscar.
    const t = setTimeout(() => {
      const atual = searchParams.get(param) ?? ""
      if (termo === atual) return

      const params = new URLSearchParams(searchParams.toString())
      if (termo.trim()) params.set(param, termo.trim())
      else params.delete(param)

      router.replace(`?${params.toString()}`, { scroll: false })
    }, 350)

    return () => clearTimeout(t)
  }, [termo, param, router, searchParams])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-9"
      />
    </div>
  )
}
