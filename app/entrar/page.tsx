import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { WelcomeShowcase } from "@/components/welcome-showcase"
import { getActor } from "@/lib/auth/session"
import { hasAnyUser } from "@/lib/auth/seed"

// Porta de entrada. Sistema zerado: cadastra a empresa e o administrador.
// Já configurado: login. Contas novas são criadas pelo administrador, nunca
// por cadastro livre.
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
