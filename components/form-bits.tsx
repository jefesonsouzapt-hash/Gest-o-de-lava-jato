"use client"

import type React from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** Mensagem de erro de um campo. `role="alert"` para o leitor de tela anunciar. */
export function Erro({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  )
}

/** Erro que não é de nenhum campo — permissão negada, conflito, falha do banco. */
export function ErroGeral({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {msg}
    </p>
  )
}

/** Rótulo + campo + erro, que é o desenho de todo formulário daqui. */
export function Campo({
  id,
  label,
  hint,
  erro,
  children,
  className,
}: {
  id: string
  label: string
  hint?: string
  erro?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      <Erro msg={erro} />
    </div>
  )
}

/**
 * Botão de envio que se desabilita sozinho enquanto a ação corre.
 *
 * Sem isso, dois cliques rápidos abrem duas ordens de serviço — e o cliente
 * recebe dois números para o mesmo carro.
 */
export function Enviar({
  children,
  variant,
  size = "lg",
}: {
  children: React.ReactNode
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  )
}
