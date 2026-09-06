// Catálogo de permissões e perfis de acesso.
//
// As chaves vivem aqui, em TypeScript, e são semeadas no banco: o código é a
// fonte para o compilador, o banco é a fonte para a auditoria e para perfis
// personalizados por empresa.
//
// Uma permissão faltando nunca é erro silencioso — `can()` devolve `false`
// para chave desconhecida, e `requirePermission()` no servidor recusa.

export const PERMISSIONS = {
  // Operação do dia a dia
  "recepcao.gerir": "Receber veículos, abrir ordens e gerir a fila de espera",
  "ordem.ver": "Ver ordens de serviço",
  "ordem.editar": "Alterar serviços, observações e responsável de uma ordem",
  "ordem.avancar": "Mudar o status de uma ordem no quadro operacional",
  "ordem.cancelar": "Cancelar uma ordem de serviço",
  "vistoria.registrar": "Registrar a vistoria de entrada e as fotos",

  // Comercial
  "cliente.ver": "Ver clientes e o histórico deles",
  "cliente.editar": "Cadastrar e alterar clientes e veículos",
  "fidelidade.gerir": "Carimbar, resgatar e ajustar cartões de fidelidade",

  // Catálogo e recursos
  "servico.ver": "Ver o catálogo de serviços e preços",
  "servico.gerir": "Cadastrar e alterar serviços, pacotes e preços",
  "pista.gerir": "Gerir pistas e boxes",
  "estoque.ver": "Ver o estoque de produtos",
  "estoque.gerir": "Registrar entradas, consumos e perdas de estoque",

  // Dinheiro do caixa
  "pagamento.receber": "Registrar recebimentos",
  "pagamento.estornar": "Estornar um recebimento já registrado",
  "relatorio.ver": "Ver relatórios de faturamento e desempenho",
  "relatorio.financeiro": "Ver margem, custos e resultado do negócio",

  // Equipe e folha
  "equipe.ver": "Ver a equipe e a produtividade",
  "equipe.gerir": "Cadastrar e alterar colaboradores e regras de comissão",
  "comissao.ver": "Ver as comissões apuradas da equipe",
  "vale.gerir": "Conceder vales e adiantamentos e registrar o pagamento deles",
  "folha.ver": "Ver a folha de pagamento",
  "folha.fechar": "Fechar a folha do mês e marcar como paga",

  // Administração
  "usuario.gerir": "Criar contas, atribuir perfis e desativar acessos",
  "empresa.gerir": "Alterar dados da empresa, identidade visual e regras de fidelidade",
  "auditoria.ver": "Consultar o registro de auditoria",
} as const

export type Permission = keyof typeof PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

/** Perfis criados junto com cada empresa nova. */
export const ROLE_KEYS = ["admin", "gerente", "recepcionista", "detailer", "lavador"] as const
export type RoleKey = (typeof ROLE_KEYS)[number]

export const ROLE_NAMES: Record<RoleKey, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  recepcionista: "Recepcionista",
  detailer: "Detailer",
  lavador: "Lavador",
}

const RECEPCIONISTA: Permission[] = [
  "recepcao.gerir",
  "ordem.ver",
  "ordem.editar",
  "ordem.avancar",
  "ordem.cancelar",
  "vistoria.registrar",
  "cliente.ver",
  "cliente.editar",
  "fidelidade.gerir",
  "servico.ver",
  "estoque.ver",
  "pagamento.receber",
]

// Quem está na pista trabalha na ordem e vê o serviço, mas não mexe em dinheiro
// nem em dados de cliente: telefone e CPF não fazem falta para lavar carro.
const LAVADOR: Permission[] = [
  "ordem.ver",
  "ordem.avancar",
  "vistoria.registrar",
  "servico.ver",
  "estoque.ver",
]

const DETAILER: Permission[] = [...LAVADOR, "estoque.gerir"]

const GERENTE: Permission[] = [
  ...RECEPCIONISTA,
  "pagamento.estornar",
  "relatorio.ver",
  "relatorio.financeiro",
  "servico.gerir",
  "pista.gerir",
  "estoque.gerir",
  "equipe.ver",
  "equipe.gerir",
  "comissao.ver",
  "vale.gerir",
  "folha.ver",
  // Fechar a folha é do dono: é o ato que transforma a apuração em obrigação
  // de pagamento, e não se desfaz sem deixar rastro.
]

/**
 * Permissões de cada perfil de sistema.
 *
 * `admin` recebe tudo por construção: uma permissão nova nasce concedida ao
 * administrador e negada a todos os outros, que é o lado seguro do engano.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  admin: ALL_PERMISSIONS,
  gerente: dedupe(GERENTE),
  recepcionista: dedupe(RECEPCIONISTA),
  detailer: dedupe(DETAILER),
  lavador: dedupe(LAVADOR),
}

/** O usuário autenticado, como o resto do código o enxerga. */
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

/** Verdadeiro só se tiver **todas** as permissões pedidas. */
export function canAll(actor: Actor | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => can(actor, p))
}

/** Verdadeiro se tiver **pelo menos uma** — para telas com vários caminhos. */
export function canAny(actor: Actor | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(actor, p))
}

/** Permissões de um perfil de sistema; perfil desconhecido não recebe nada. */
export function permissionsForRole(roleKey: string): readonly Permission[] {
  return ROLE_PERMISSIONS[roleKey as RoleKey] ?? []
}

function dedupe(list: Permission[]): Permission[] {
  return [...new Set(list)]
}
