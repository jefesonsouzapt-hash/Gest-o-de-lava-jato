import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { WelcomeShowcase } from "@/components/welcome-showcase"
import { getActor } from "@/lib/auth/session"
import { hasAnyUser } from "@/lib/auth/seed"

// Porta de entrada. Sistema por estrear: cria a empresa e o administrador.
// Já configurado: início de sessão. Novas contas entram por convite do
// administrador, nunca por registo livre.
export default async function EntrarPage() {
  if (await getActor()) redirect("/painel")

  const configurado = await hasAnyUser()

  return (
    <main className="flex min-h-svh flex-col lg:flex-row">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <AuthForm mode={configurado ? "entrar" : "arranque"} />
      </div>
      <WelcomeShowcase />
    </main>
  )
}
