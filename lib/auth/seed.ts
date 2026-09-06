import { eq, notInArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { permissions, rolePermissions, roles, serviceCategories, services, users, washBays } from "@/lib/db/schema"
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type RoleKey,
} from "@/lib/auth/permissions"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Sincroniza o catálogo de permissões do banco com o do código.
 *
 * O código manda: uma permissão nova aparece aqui, uma removida some. A
 * remoção apaga junto as concessões — uma permissão que não existe mais não
 * pode continuar gravada num perfil e voltar a abrir portas se o nome for
 * reaproveitado.
 */
export async function syncPermissionCatalog(tx: Tx = db as unknown as Tx): Promise<void> {
  await tx
    .insert(permissions)
    .values(ALL_PERMISSIONS.map((key) => ({ key, description: PERMISSIONS[key] })))
    .onConflictDoUpdate({
      target: permissions.key,
      set: { description: sql`excluded.description` },
    })

  // `notInArray` e não um `sql` na mão com ALL(): o drizzle expande um array
  // de JavaScript em parâmetros soltos ($1, $2, …), e o Postgres recusa isso
  // do lado direito de ALL() com "requires array on right side".
  const obsoletas = await tx
    .select({ key: permissions.key })
    .from(permissions)
    .where(notInArray(permissions.key, ALL_PERMISSIONS))

  for (const { key } of obsoletas) {
    await tx.delete(rolePermissions).where(eq(rolePermissions.permissionKey, key))
    await tx.delete(permissions).where(eq(permissions.key, key))
  }
}

/** Cria os cinco perfis de sistema de uma empresa com as permissões deles. */
export async function seedRoles(tx: Tx, companyId: number): Promise<Record<RoleKey, number>> {
  const criados = {} as Record<RoleKey, number>

  for (const key of ROLE_KEYS) {
    const [papel] = await tx
      .insert(roles)
      .values({ companyId, key, name: ROLE_NAMES[key], system: true })
      .onConflictDoUpdate({
        target: [roles.companyId, roles.key],
        set: { name: ROLE_NAMES[key] },
      })
      .returning({ id: roles.id })

    criados[key] = papel.id

    // Reescreve as concessões a partir do código: um perfil de sistema não
    // acumula permissões antigas quando a matriz muda.
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, papel.id))
    await tx.insert(rolePermissions).values(
      ROLE_PERMISSIONS[key].map((permissionKey) => ({ roleId: papel.id, permissionKey })),
    )
  }

  return criados
}

// Cardápio inicial com preços de referência do mercado brasileiro, para o
// sistema não abrir vazio. Valores em centavos, para o porte médio (hatch);
// tudo editável depois em Serviços.
const CATALOGO_INICIAL: {
  categoria: string
  nome: string
  descricao: string
  precoCents: number
  minutos: number
  comissaoBps: number
  pacote?: boolean
  fidelidade?: boolean
}[] = [
  {
    categoria: "Lavagem",
    nome: "Lavagem Simples",
    descricao: "Externa, rodas e secagem.",
    precoCents: 3_500,
    minutos: 25,
    comissaoBps: 3000,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem Completa",
    descricao: "Externa, interna, aspiração e cera rápida.",
    precoCents: 6_000,
    minutos: 50,
    comissaoBps: 3000,
    pacote: true,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem a Seco",
    descricao: "Sem água corrente, com produto específico.",
    precoCents: 5_000,
    minutos: 40,
    comissaoBps: 3000,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem de Motor",
    descricao: "Limpeza do compartimento do motor.",
    precoCents: 4_500,
    minutos: 30,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Estética",
    nome: "Enceramento",
    descricao: "Aplicação de cera de proteção.",
    precoCents: 9_000,
    minutos: 60,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Estética",
    nome: "Cristalização de Vidros",
    descricao: "Repelente de água aplicado nos vidros.",
    precoCents: 12_000,
    minutos: 45,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Polimento",
    nome: "Polimento Comercial",
    descricao: "Correção leve de riscos e brilho na pintura.",
    precoCents: 35_000,
    minutos: 180,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Polimento",
    nome: "Vitrificação Cerâmica",
    descricao: "Proteção cerâmica de longa duração.",
    precoCents: 120_000,
    minutos: 480,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Higienização",
    nome: "Higienização Interna",
    descricao: "Bancos, carpete, teto e forros.",
    precoCents: 25_000,
    minutos: 180,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Higienização",
    nome: "Higienização do Ar-condicionado",
    descricao: "Limpeza do sistema e troca do filtro de cabine.",
    precoCents: 12_000,
    minutos: 40,
    comissaoBps: 3500,
    fidelidade: false,
  },
]

/** Catálogo, pistas e categorias iniciais de uma empresa nova. */
export async function seedCatalog(tx: Tx, companyId: number): Promise<void> {
  const nomesCategorias = [...new Set(CATALOGO_INICIAL.map((s) => s.categoria))]

  const categorias = new Map<string, number>()
  for (const [indice, nome] of nomesCategorias.entries()) {
    const [linha] = await tx
      .insert(serviceCategories)
      .values({ companyId, name: nome, position: indice })
      .onConflictDoUpdate({
        target: [serviceCategories.companyId, serviceCategories.name],
        set: { position: indice },
      })
      .returning({ id: serviceCategories.id })
    categorias.set(nome, linha.id)
  }

  await tx
    .insert(services)
    .values(
      CATALOGO_INICIAL.map((s) => ({
        companyId,
        categoryId: categorias.get(s.categoria) ?? null,
        name: s.nome,
        description: s.descricao,
        isPackage: s.pacote ?? false,
        basePriceCents: s.precoCents,
        durationMinutes: s.minutos,
        commissionBps: s.comissaoBps,
        countsForLoyalty: s.fidelidade ?? true,
      })),
    )
    .onConflictDoNothing()

  await tx
    .insert(washBays)
    .values([
      { companyId, name: "Pista 1", position: 0 },
      { companyId, name: "Pista 2", position: 1 },
    ])
    .onConflictDoNothing()
}

/** Existe alguma conta? É o que decide entre primeiro acesso e login. */
export async function hasAnyUser(): Promise<boolean> {
  const [linha] = await db.select({ id: users.id }).from(users).limit(1)
  return Boolean(linha)
}
