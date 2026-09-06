import { eq } from "drizzle-orm"
import { requirePermissionPage } from "@/lib/auth/guard"
import { db } from "@/lib/db"
import { companies } from "@/lib/db/schema"
import { PageHeader } from "@/components/page-header"
import { CompanyForm } from "@/components/company-form"

export default async function ConfiguracoesPage() {
  const actor = await requirePermissionPage("empresa.gerir")

  const [empresa] = await db.select().from(companies).where(eq(companies.id, actor.companyId)).limit(1)
  if (!empresa) return null

  return (
    <>
      <PageHeader
        title="Configurações da empresa"
        description="Dados fiscais, contato e identidade visual do lava jato."
      />
      <CompanyForm empresa={empresa} />
    </>
  )
}
