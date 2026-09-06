"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Campo, Enviar, ErroGeral } from "@/components/form-bits"
import { changePassword, updateProfile } from "@/lib/actions/conta"
import type { ActionState } from "@/lib/actions/form"

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [estado, formAction] = useActionState<ActionState, FormData>(updateProfile, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) toast.success("Perfil atualizado.")
  }, [estado])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Campo id="ac-name" label="Nome" erro={erros.name}>
        <Input id="ac-name" name="name" defaultValue={name} className="h-9" required />
      </Campo>

      <Campo id="ac-email" label="E-mail" hint="não muda por aqui">
        <Input id="ac-email" value={email} disabled className="h-9" />
      </Campo>

      <ErroGeral msg={erros._} />

      <div className="flex justify-end">
        <Enviar>Salvar</Enviar>
      </div>
    </form>
  )
}

export function PasswordForm() {
  const [estado, formAction] = useActionState<ActionState, FormData>(changePassword, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) toast.success("Senha alterada. As outras sessões foram encerradas.")
  }, [estado])

  return (
    // A chave zera os campos depois de trocar: senha digitada não fica na tela.
    <form key={estado?.ok ? "limpo" : "atual"} action={formAction} className="flex flex-col gap-4">
      <Campo id="ac-current" label="Senha atual" erro={erros.currentPassword}>
        <Input
          id="ac-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="h-9"
          required
        />
      </Campo>

      <Campo id="ac-new" label="Nova senha" hint="mínimo de 12 caracteres" erro={erros.password}>
        <Input id="ac-new" name="password" type="password" autoComplete="new-password" className="h-9" required />
      </Campo>

      <Campo id="ac-confirm" label="Repita a nova senha" erro={erros.confirmPassword}>
        <Input
          id="ac-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="h-9"
          required
        />
      </Campo>

      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Trocar a senha encerra as sessões nos outros aparelhos. Esta continua aberta.
      </p>

      <ErroGeral msg={erros._} />

      <div className="flex justify-end">
        <Enviar>Trocar senha</Enviar>
      </div>
    </form>
  )
}
