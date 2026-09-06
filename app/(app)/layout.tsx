import type React from "react"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { companies, roles, users } from "@/lib/db/schema"
import { requireActorPage } from "@/lib/auth/guard"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActorPage()

  const [perfil] = await db
    .select({
      name: users.name,
      email: users.email,
      roleName: roles.name,
      companyName: companies.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, actor.userId))
    .limit(1)

  return (
    <AppShell
      user={{
        name: perfil?.name ?? "",
        email: perfil?.email ?? "",
        roleName: perfil?.roleName ?? "",
        companyName: perfil?.companyName ?? "",
        permissions: actor.permissions,
      }}
    >
      {children}
    </AppShell>
  )
}
