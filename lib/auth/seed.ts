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
 * Sincroniza o catálogo de permissões da base de dados com o do código.
 *
 * O código manda: uma permissão nova aparece aqui, uma removida desaparece.
 * A remoção apaga também as concessões — uma permissão que já não existe não
 * pode continuar gravada num papel e a abrir portas se o nome for reutilizado.
 */
export async function syncPermissionCatalog(tx: Tx = db as unknown as Tx): Promise<void> {
  await tx
    .insert(permissions)
    .values(ALL_PERMISSIONS.map((key) => ({ key, description: PERMISSIONS[key] })))
    .onConflictDoUpdate({
      target: permissions.key,
      set: { description: sql`excluded.description` },
    })

  // `notInArray` e não um `sql` à mão com ALL(): o drizzle expande um array de
  // JavaScript em parâmetros soltos ($1, $2, …), e o Postgres recusa isso do
  // lado direito de ALL() com "requires array on right side".
  const obsoletas = await tx
    .select({ key: permissions.key })
    .from(permissions)
    .where(notInArray(permissions.key, ALL_PERMISSIONS))

  for (const { key } of obsoletas) {
    await tx.delete(rolePermissions).where(eq(rolePermissions.permissionKey, key))
    await tx.delete(permissions).where(eq(permissions.key, key))
  }
}

/** Cria os cinco papéis de sistema de uma empresa com as suas permissões. */
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

    // Reescreve as concessões a partir do código: um papel de sistema não
    // acumula permissões antigas quando a matriz muda.
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, papel.id))
    await tx.insert(rolePermissions).values(
      ROLE_PERMISSIONS[key].map((permissionKey) => ({ roleId: papel.id, permissionKey })),
    )
  }

  return criados
}

// Cardápio inicial com preços de referência do mercado português, para a
// aplicação não abrir vazia. Preços em cêntimos, com IVA incluído, para a
// tipologia média; tudo editável depois em Serviços.
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
    nome: "Lavagem Express",
    descricao: "Exterior e jantes, com secagem.",
    precoCents: 1200,
    minutos: 15,
    comissaoBps: 3000,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem Completa",
    descricao: "Exterior, interior, aspiração e cera express.",
    precoCents: 2500,
    minutos: 45,
    comissaoBps: 3000,
    pacote: true,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem a Seco",
    descricao: "Sem água corrente, com produto específico.",
    precoCents: 2000,
    minutos: 40,
    comissaoBps: 3000,
  },
  {
    categoria: "Lavagem",
    nome: "Lavagem de Motor",
    descricao: "Limpeza do compartimento do motor.",
    precoCents: 2500,
    minutos: 30,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Estética",
    nome: "Enceramento",
    descricao: "Aplicação de cera de proteção.",
    precoCents: 4500,
    minutos: 60,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Estética",
    nome: "Cristalização de Vidros",
    descricao: "Repelente de água aplicado nos vidros.",
    precoCents: 3500,
    minutos: 45,
    comissaoBps: 3500,
    fidelidade: false,
  },
  {
    categoria: "Polimento",
    nome: "Polimento Comercial",
    descricao: "Correção leve de riscos e brilho na pintura.",
    precoCents: 12000,
    minutos: 180,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Polimento",
    nome: "Vitrificação Cerâmica",
    descricao: "Proteção cerâmica de longa duração.",
    precoCents: 45000,
    minutos: 480,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Higienização",
    nome: "Detalhe Interior",
    descricao: "Estofos, carpete, tejadilho e forros.",
    precoCents: 9000,
    minutos: 180,
    comissaoBps: 4000,
    fidelidade: false,
  },
  {
    categoria: "Higienização",
    nome: "Higienização do Ar Condicionado",
    descricao: "Limpeza do sistema e substituição do filtro de habitáculo.",
    precoCents: 3500,
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
        vatRate: 23,
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

/** Há alguma conta criada? É o que decide entre arranque e início de sessão. */
export async function hasAnyUser(): Promise<boolean> {
  const [linha] = await db.select({ id: users.id }).from(users).limit(1)
  return Boolean(linha)
}
