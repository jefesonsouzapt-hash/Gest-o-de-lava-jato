"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2, LogIn, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/logo"
import { login, setupFirstCompany, type FormState } from "@/lib/actions/auth"

/** Botão que sabe sozinho quando o formulário está a ser submetido. */
function SubmitButton({ children, icon: Icon }: { children: React.ReactNode; icon: typeof LogIn }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="mt-1 h-11 w-full text-base" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Icon />}
      {children}
    </Button>
  )
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  )
}

export function AuthForm({ mode }: { mode: "entrar" | "arranque" }) {
  const acao = mode === "entrar" ? login : setupFirstCompany
  const [estado, formAction] = useActionState<FormState, FormData>(acao, null)
  const erros = estado && !estado.ok ? estado.errors : {}
  // O React 19 limpa um formulário não controlado quando a ação termina. Sem
  // devolver os valores, um dígito errado no NIF apagava tudo o que já tinha
  // sido escrito.
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-6" />
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          {mode === "entrar" ? "Iniciar sessão" : "Configurar o lava jato"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          {mode === "entrar"
            ? "Entre com o email e a palavra-passe da sua conta."
            : "É a primeira vez que abre o sistema. Crie a empresa e a sua conta de administrador."}
        </p>
      </div>

      <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-4">
        {mode === "arranque" && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="companyName">Nome do lava jato</Label>
              <Input
                id="companyName"
                name="companyName"
                defaultValue={valores.companyName ?? ""}
                placeholder="Ex.: Detail Center Porto"
                className="h-11"
                maxLength={120}
                required
                autoFocus
                aria-invalid={Boolean(erros.companyName)}
              />
              <ErrorText message={erros.companyName} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="companyNif">
                NIF da empresa <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="companyNif"
                name="companyNif"
                defaultValue={valores.companyNif ?? ""}
                inputMode="numeric"
                placeholder="500 000 000"
                className="h-11"
                aria-invalid={Boolean(erros.companyNif)}
              />
              <ErrorText message={erros.companyNif} />
            </div>

            <hr className="my-1 border-border" />
          </>
        )}

        {mode === "arranque" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">O seu nome</Label>
            <Input
              id="name"
              name="name"
              defaultValue={valores.name ?? ""}
              autoComplete="name"
              placeholder="Nome e apelido"
              className="h-11"
              maxLength={120}
              required
              aria-invalid={Boolean(erros.name)}
            />
            <ErrorText message={erros.name} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            defaultValue={valores.email ?? ""}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.pt"
            className="h-11"
            required
            autoFocus={mode === "entrar"}
            aria-invalid={Boolean(erros.email)}
          />
          <ErrorText message={erros.email} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Palavra-passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            className="h-11"
            required
            aria-invalid={Boolean(erros.password)}
          />
          <ErrorText message={erros.password} />
          {mode === "arranque" && !erros.password && (
            <p className="text-xs text-muted-foreground">
              Pelo menos 12 caracteres. Uma frase que só você saiba resiste melhor do que um código curto.
            </p>
          )}
        </div>

        {/* Erro que não pertence a nenhum campo: credenciais inválidas. */}
        {erros._ && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {erros._}
          </p>
        )}

        <SubmitButton icon={mode === "entrar" ? LogIn : Sparkles}>
          {mode === "entrar" ? "Entrar" : "Criar empresa e entrar"}
        </SubmitButton>
      </form>
    </div>
  )
}
