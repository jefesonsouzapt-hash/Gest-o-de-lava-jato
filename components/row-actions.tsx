"use client"

import type React from "react"
import { useTransition } from "react"
import { toast } from "sonner"
import { Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Menu de ações de uma linha de tabela.
 *
 * Dez linhas com "Editar" e "Desativar" lado a lado viram vinte botões
 * competindo pela atenção com o dado, que é o que a pessoa veio ler. O menu
 * deixa a ação a um clique de distância sem ocupar a tela o tempo todo.
 */
export function RowActions({
  label = "Ações",
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Item do menu que dispara uma server action e mostra o resultado. */
export function RowActionItem({
  icon,
  children,
  action,
  fields,
  successMessage,
  destructive,
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  fields: Record<string, string | number>
  successMessage: string
  destructive?: boolean
}) {
  const [pendente, iniciar] = useTransition()

  return (
    <DropdownMenuItem
      disabled={pendente}
      className={cn(destructive && "text-destructive focus:text-destructive")}
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData()
          for (const [chave, valor] of Object.entries(fields)) dados.set(chave, String(valor))
          const r = await action(dados)
          if (r.ok) toast.success(successMessage)
          else toast.error(r.error ?? "Não foi possível concluir.")
        })
      }
    >
      {pendente ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </DropdownMenuItem>
  )
}
