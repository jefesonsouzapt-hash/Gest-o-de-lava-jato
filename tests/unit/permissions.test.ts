import { describe, expect, it } from "vitest"
import {
  ALL_PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  can,
  canAll,
  canAny,
  permissionsForRole,
  type Actor,
  type Permission,
} from "@/lib/auth/permissions"

function actor(roleKey: string): Actor {
  return { userId: 1, companyId: 1, roleKey, permissions: permissionsForRole(roleKey) }
}

describe("catálogo", () => {
  it("não tem chaves repetidas em nenhum perfil", () => {
    for (const perfil of ROLE_KEYS) {
      const lista = ROLE_PERMISSIONS[perfil]
      expect(new Set(lista).size).toBe(lista.length)
    }
  })

  it("só concede permissões que existem no catálogo", () => {
    // Uma chave escrita à mão com erro passaria despercebida e a verificação
    // devolveria false para sempre, sem ninguém dar por isso.
    for (const perfil of ROLE_KEYS) {
      for (const permissao of ROLE_PERMISSIONS[perfil]) {
        expect(ALL_PERMISSIONS).toContain(permissao)
      }
    }
  })
})

describe("administrador", () => {
  it("recebe todas as permissões do catálogo", () => {
    const admin = actor("admin")
    for (const permissao of ALL_PERMISSIONS) {
      expect(can(admin, permissao)).toBe(true)
    }
  })
})

describe("separação de funções", () => {
  it("o lavador não toca em dinheiro nem em dados de cliente", () => {
    const lavador = actor("lavador")
    expect(can(lavador, "pagamento.receber")).toBe(false)
    expect(can(lavador, "pagamento.estornar")).toBe(false)
    expect(can(lavador, "cliente.ver")).toBe(false)
    expect(can(lavador, "relatorio.financeiro")).toBe(false)
    expect(can(lavador, "usuario.gerir")).toBe(false)
    // Nem a própria folha: o lavador não vê o salário de ninguém, inclusive
    // o dos colegas.
    expect(can(lavador, "folha.ver")).toBe(false)
    expect(can(lavador, "comissao.ver")).toBe(false)
  })

  it("o lavador trabalha a ordem e registra a vistoria", () => {
    const lavador = actor("lavador")
    expect(can(lavador, "ordem.ver")).toBe(true)
    expect(can(lavador, "ordem.avancar")).toBe(true)
    expect(can(lavador, "vistoria.registrar")).toBe(true)
  })

  it("o recepcionista recebe mas não estorna um recebimento", () => {
    // Quem cobra não desfaz a própria cobrança: estornar é do gerente.
    const recepcionista = actor("recepcionista")
    expect(can(recepcionista, "pagamento.receber")).toBe(true)
    expect(can(recepcionista, "pagamento.estornar")).toBe(false)
  })

  it("o recepcionista não gere o catálogo nem a equipa", () => {
    const recepcionista = actor("recepcionista")
    expect(can(recepcionista, "servico.gerir")).toBe(false)
    expect(can(recepcionista, "equipe.gerir")).toBe(false)
    expect(can(recepcionista, "empresa.gerir")).toBe(false)
  })

  it("o gerente apura a folha mas não a fecha, nem gere acessos", () => {
    const gerente = actor("gerente")
    expect(can(gerente, "relatorio.financeiro")).toBe(true)
    expect(can(gerente, "pagamento.estornar")).toBe(true)
    expect(can(gerente, "equipe.gerir")).toBe(true)
    // Apurar é do gerente; fechar a folha é do dono — é o ato que vira
    // obrigação de pagamento.
    expect(can(gerente, "folha.ver")).toBe(true)
    expect(can(gerente, "vale.gerir")).toBe(true)
    expect(can(gerente, "folha.fechar")).toBe(false)
    // Criar contas e mudar perfis é do administrador.
    expect(can(gerente, "usuario.gerir")).toBe(false)
    expect(can(gerente, "auditoria.ver")).toBe(false)
  })

  it("só o administrador consulta a auditoria, gere contas e fecha a folha", () => {
    for (const perfil of ROLE_KEYS) {
      const esperado = perfil === "admin"
      expect(can(actor(perfil), "auditoria.ver")).toBe(esperado)
      expect(can(actor(perfil), "usuario.gerir")).toBe(esperado)
      expect(can(actor(perfil), "empresa.gerir")).toBe(esperado)
      expect(can(actor(perfil), "folha.fechar")).toBe(esperado)
    }
  })
})

describe("negação por omissão", () => {
  it("nega quando não há ator autenticado", () => {
    expect(can(null, "ordem.ver")).toBe(false)
    expect(can(undefined, "ordem.ver")).toBe(false)
    expect(canAny(null, ["ordem.ver", "cliente.ver"])).toBe(false)
  })

  it("nega uma chave que não existe no catálogo", () => {
    // Uma permissão apagada do catálogo mas ainda gravada na base de dados não
    // pode continuar a abrir portas.
    const inventada = "ordem.apagar_tudo" as Permission
    expect(can(actor("admin"), inventada)).toBe(false)
  })

  it("nega um perfil desconhecido", () => {
    const intruso = actor("superadmin")
    expect(intruso.permissions).toHaveLength(0)
    expect(can(intruso, "ordem.ver")).toBe(false)
  })

  it("ignora permissões gravadas que não estão no perfil", () => {
    // O ator traz a lista que veio da base de dados; `can` não volta a olhar
    // para o perfil, para que um perfil personalizado funcione na mesma.
    const personalizado: Actor = {
      userId: 2,
      companyId: 1,
      roleKey: "personalizado",
      permissions: ["ordem.ver"],
    }
    expect(can(personalizado, "ordem.ver")).toBe(true)
    expect(can(personalizado, "ordem.editar")).toBe(false)
  })
})

describe("combinações", () => {
  it("canAll exige todas", () => {
    const recepcionista = actor("recepcionista")
    expect(canAll(recepcionista, ["ordem.ver", "cliente.ver"])).toBe(true)
    expect(canAll(recepcionista, ["ordem.ver", "pagamento.estornar"])).toBe(false)
  })

  it("canAny basta uma", () => {
    const lavador = actor("lavador")
    expect(canAny(lavador, ["cliente.ver", "ordem.ver"])).toBe(true)
    expect(canAny(lavador, ["cliente.ver", "pagamento.receber"])).toBe(false)
  })

  it("uma lista vazia é verdadeira em canAll e falsa em canAny", () => {
    const lavador = actor("lavador")
    expect(canAll(lavador, [])).toBe(true)
    expect(canAny(lavador, [])).toBe(false)
  })
})
