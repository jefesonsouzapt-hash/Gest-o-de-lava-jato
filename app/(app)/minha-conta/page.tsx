import { eq } from "drizzle-orm"
import { KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { requireActorPage } from "@/lib/auth/guard"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { PageHeader } from "@/components/page-header"
import { ProfileForm, PasswordForm } from "@/components/account-forms"
import { PERMISSIONS, ROLE_NAMES, type RoleKey } from "@/lib/auth/permissions"

export default async function MinhaContaPage() {
  const actor = await requireActorPage()

  const [conta] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1)
  if (!conta) return null

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso e o que você pode fazer no sistema." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserRound className="size-4" />
            Perfil
          </h3>
          <ProfileForm name={conta.name} email={conta.email} />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4" />
            Senha
          </h3>
          <PasswordForm />
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4" />
          Suas permissões
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Papel:{" "}
          <strong className="text-foreground">
            {ROLE_NAMES[actor.roleKey as RoleKey] ?? actor.roleKey}
          </strong>{" "}
          · {actor.permissions.length} permissões
        </p>

        <ul className="flex flex-wrap gap-2">
          {[...actor.permissions].sort().map((chave) => (
            <li key={chave} className="rounded-full bg-muted px-3 py-1 text-xs">
              {PERMISSIONS[chave as keyof typeof PERMISSIONS] ?? chave}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
