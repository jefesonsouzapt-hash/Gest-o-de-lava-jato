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
  it("não tem chaves repetidas em nenhum papel", () => {
    for (const papel of ROLE_KEYS) {
      const lista = ROLE_PERMISSIONS[papel]
      expect(new Set(lista).size).toBe(lista.length)
    }
  })

  it("só concede permissões que existem no catálogo", () => {
    // Uma chave escrita à mão com erro passaria despercebida e a verificação
    // devolveria false para sempre, sem ninguém dar por isso.
    for (const papel of ROLE_KEYS) {
      for (const permissao of ROLE_PERMISSIONS[papel]) {
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
    expect(can(lavador, "pagamento.anular")).toBe(false)
    expect(can(lavador, "cliente.ver")).toBe(false)
    expect(can(lavador, "relatorio.financeiro")).toBe(false)
    expect(can(lavador, "utilizador.gerir")).toBe(false)
  })

  it("o lavador trabalha a ficha e regista a inspeção", () => {
    const lavador = actor("lavador")
    expect(can(lavador, "ficha.ver")).toBe(true)
    expect(can(lavador, "ficha.avancar")).toBe(true)
    expect(can(lavador, "inspecao.registar")).toBe(true)
  })

  it("o rececionista recebe mas não anula um recebimento", () => {
    // Quem cobra não desfaz a própria cobrança: anular é do gerente.
    const rececionista = actor("rececionista")
    expect(can(rececionista, "pagamento.receber")).toBe(true)
    expect(can(rececionista, "pagamento.anular")).toBe(false)
  })

  it("o rececionista não gere o catálogo nem a equipa", () => {
    const rececionista = actor("rececionista")
    expect(can(rececionista, "servico.gerir")).toBe(false)
    expect(can(rececionista, "equipa.gerir")).toBe(false)
    expect(can(rececionista, "empresa.gerir")).toBe(false)
  })

  it("o gerente vê o resultado do negócio mas não gere acessos", () => {
    const gerente = actor("gerente")
    expect(can(gerente, "relatorio.financeiro")).toBe(true)
    expect(can(gerente, "pagamento.anular")).toBe(true)
    expect(can(gerente, "equipa.gerir")).toBe(true)
    // Criar contas e mudar papéis é do administrador.
    expect(can(gerente, "utilizador.gerir")).toBe(false)
    expect(can(gerente, "auditoria.ver")).toBe(false)
  })

  it("só o administrador consulta a auditoria e gere utilizadores", () => {
    for (const papel of ROLE_KEYS) {
      const esperado = papel === "admin"
      expect(can(actor(papel), "auditoria.ver")).toBe(esperado)
      expect(can(actor(papel), "utilizador.gerir")).toBe(esperado)
      expect(can(actor(papel), "empresa.gerir")).toBe(esperado)
    }
  })
})

describe("negação por omissão", () => {
  it("nega quando não há ator autenticado", () => {
    expect(can(null, "ficha.ver")).toBe(false)
    expect(can(undefined, "ficha.ver")).toBe(false)
    expect(canAny(null, ["ficha.ver", "cliente.ver"])).toBe(false)
  })

  it("nega uma chave que não existe no catálogo", () => {
    // Uma permissão apagada do catálogo mas ainda gravada na base de dados não
    // pode continuar a abrir portas.
    const inventada = "ficha.apagar_tudo" as Permission
    expect(can(actor("admin"), inventada)).toBe(false)
  })

  it("nega um papel desconhecido", () => {
    const intruso = actor("superadmin")
    expect(intruso.permissions).toHaveLength(0)
    expect(can(intruso, "ficha.ver")).toBe(false)
  })

  it("ignora permissões gravadas que não estão no papel", () => {
    // O ator traz a lista que veio da base de dados; `can` não volta a olhar
    // para o papel, para que um papel personalizado funcione na mesma.
    const personalizado: Actor = {
      userId: 2,
      companyId: 1,
      roleKey: "personalizado",
      permissions: ["ficha.ver"],
    }
    expect(can(personalizado, "ficha.ver")).toBe(true)
    expect(can(personalizado, "ficha.editar")).toBe(false)
  })
})

describe("combinações", () => {
  it("canAll exige todas", () => {
    const rececionista = actor("rececionista")
    expect(canAll(rececionista, ["ficha.ver", "cliente.ver"])).toBe(true)
    expect(canAll(rececionista, ["ficha.ver", "pagamento.anular"])).toBe(false)
  })

  it("canAny basta uma", () => {
    const lavador = actor("lavador")
    expect(canAny(lavador, ["cliente.ver", "ficha.ver"])).toBe(true)
    expect(canAny(lavador, ["cliente.ver", "pagamento.receber"])).toBe(false)
  })

  it("uma lista vazia é verdadeira em canAll e falsa em canAny", () => {
    const lavador = actor("lavador")
    expect(canAll(lavador, [])).toBe(true)
    expect(canAny(lavador, [])).toBe(false)
  })
})
