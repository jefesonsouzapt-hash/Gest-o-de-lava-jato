import type React from "react"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { companies, roles, users } from "@/lib/db/schema"
import { requireActorPage } from "@/lib/auth/guard"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActorPage()

  const [conta] = await db
    .select({
      name: users.name,
      email: users.email,
      roleName: roles.name,
      companyName: companies.name,
      brandColor: companies.brandColor,
      logoUrl: companies.logoUrl,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, actor.userId))
    .limit(1)

  // A marca da empresa entra como variável CSS na raiz da área logada: cada
  // lava jato vê a cor dele sem recompilar o tema.
  return (
    <div style={{ "--brand": conta?.brandColor ?? undefined } as React.CSSProperties}>
    <AppShell
      user={{
        name: conta?.name ?? "",
        email: conta?.email ?? "",
        roleName: conta?.roleName ?? "",
        companyName: conta?.companyName ?? "",
        brandColor: conta?.brandColor ?? null,
        logoUrl: conta?.logoUrl ?? null,
        permissions: actor.permissions,
      }}
    >
      {children}
    </AppShell>
    </div>
  )
}
