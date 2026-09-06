// Catálogo de permissões e papéis.
//
// As chaves vivem aqui, em TypeScript, e são semeadas na base de dados: o
// código é a fonte para o compilador, a base de dados é a fonte para a
// auditoria e para papéis personalizados por empresa.
//
// Uma permissão em falta nunca é um erro silencioso — `can()` devolve `false`
// para chave desconhecida, e `requirePermission()` no servidor recusa.

export const PERMISSIONS = {
  // Operação diária
  "rececao.gerir": "Receber viaturas, abrir fichas e gerir a fila de espera",
  "ficha.ver": "Ver fichas de trabalho",
  "ficha.editar": "Alterar serviços, notas e responsável de uma ficha",
  "ficha.avancar": "Mudar o estado de uma ficha no quadro operacional",
  "ficha.cancelar": "Cancelar uma ficha de trabalho",
  "inspecao.registar": "Registar a inspeção de entrada e as fotografias",

  // Comercial
  "cliente.ver": "Ver clientes e o respetivo histórico",
  "cliente.editar": "Criar e alterar clientes e viaturas",
  "fidelizacao.gerir": "Carimbar, resgatar e ajustar cartões de fidelidade",

  // Catálogo e recursos
  "servico.ver": "Ver o catálogo de serviços e preços",
  "servico.gerir": "Criar e alterar serviços, pacotes e preços",
  "pista.gerir": "Gerir pistas e boxes",
  "stock.ver": "Ver o stock de consumíveis",
  "stock.gerir": "Registar entradas, consumos e quebras de stock",

  // Dinheiro
  "pagamento.receber": "Registar recebimentos",
  "pagamento.anular": "Anular um recebimento já registado",
  "relatorio.ver": "Ver relatórios de faturação e desempenho",
  "relatorio.financeiro": "Ver margem, custos e resultado do negócio",

  // Administração
  "equipa.ver": "Ver a equipa e a produtividade",
  "equipa.gerir": "Criar e alterar colaboradores e comissões",
  "utilizador.gerir": "Criar contas, atribuir papéis e desativar acessos",
  "empresa.gerir": "Alterar dados da empresa, marca e regras de fidelização",
  "auditoria.ver": "Consultar o registo de auditoria",
} as const

export type Permission = keyof typeof PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

/** Papéis criados com cada empresa nova. */
export const ROLE_KEYS = ["admin", "gerente", "rececionista", "detailer", "lavador"] as const
export type RoleKey = (typeof ROLE_KEYS)[number]

export const ROLE_NAMES: Record<RoleKey, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  rececionista: "Rececionista",
  detailer: "Detailer",
  lavador: "Lavador",
}

const RECECIONISTA: Permission[] = [
  "rececao.gerir",
  "ficha.ver",
  "ficha.editar",
  "ficha.avancar",
  "ficha.cancelar",
  "inspecao.registar",
  "cliente.ver",
  "cliente.editar",
  "fidelizacao.gerir",
  "servico.ver",
  "stock.ver",
  "pagamento.receber",
]

// Quem está na pista trabalha na ficha e vê o serviço, mas não mexe em dinheiro
// nem em dados de cliente: o telemóvel e o NIF não fazem falta para lavar.
const LAVADOR: Permission[] = ["ficha.ver", "ficha.avancar", "inspecao.registar", "servico.ver", "stock.ver"]

const DETAILER: Permission[] = [...LAVADOR, "stock.gerir"]

const GERENTE: Permission[] = [
  ...RECECIONISTA,
  "pagamento.anular",
  "relatorio.ver",
  "relatorio.financeiro",
  "servico.gerir",
  "pista.gerir",
  "stock.gerir",
  "equipa.ver",
  "equipa.gerir",
]

/**
 * Permissões de cada papel de sistema.
 *
 * `admin` recebe tudo por construção: uma permissão nova nasce concedida ao
 * administrador e negada a todos os outros, que é o lado seguro do engano.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  admin: ALL_PERMISSIONS,
  gerente: dedupe(GERENTE),
  rececionista: dedupe(RECECIONISTA),
  detailer: dedupe(DETAILER),
  lavador: dedupe(LAVADOR),
}

/** O ator autenticado, como o resto do código o vê. */
export type Actor = {
  userId: number
  companyId: number
  roleKey: string
  permissions: readonly string[]
}

/** Verificação pontual. Chave desconhecida é sempre negada. */
export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false
  return actor.permissions.includes(permission)
}

/** Verdadeiro só se o ator tiver **todas** as permissões pedidas. */
export function canAll(actor: Actor | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => can(actor, p))
}

/** Verdadeiro se tiver **pelo menos uma** — para ecrãs com vários caminhos. */
export function canAny(actor: Actor | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(actor, p))
}

/** Permissões de um papel de sistema; papel desconhecido não recebe nada. */
export function permissionsForRole(roleKey: string): readonly Permission[] {
  return ROLE_PERMISSIONS[roleKey as RoleKey] ?? []
}

function dedupe(list: Permission[]): Permission[] {
  return [...new Set(list)]
}
