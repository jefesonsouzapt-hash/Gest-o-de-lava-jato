import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Num arquivo "use server", **toda função exportada vira um endpoint HTTP**
// que qualquer navegador pode chamar, com os argumentos que quiser. Já
// escorregamos nisso duas vezes: uma prévia de folha que recebia o id da
// empresa por parâmetro, e um recalculador de vale exportado sem portão.
//
// Este teste lê o código-fonte porque o defeito não aparece em execução: a
// função funciona perfeitamente — para qualquer um.

const DIR = join(process.cwd(), "lib", "actions")

/** Portas de entrada que existem justamente para quem ainda não tem sessão. */
const PUBLICAS = new Set(["login", "logout", "setupFirstCompany"])

type Exportada = { arquivo: string; nome: string; assinatura: string; corpo: string }

function exportadasDeActions(): Exportada[] {
  const encontradas: Exportada[] = []

  for (const arquivo of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
    const fonte = readFileSync(join(DIR, arquivo), "utf8")
    if (!/^\s*["']use server["']/.test(fonte)) continue

    const regex = /export\s+async\s+function\s+(\w+)\s*\(([\s\S]*?)\)\s*:/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(fonte)) !== null) {
      // O corpo vai até a próxima função exportada (ou o fim do arquivo).
      const inicio = m.index
      regex.lastIndex = m.index + m[0].length
      const proxima = fonte.slice(regex.lastIndex).search(/\nexport\s+async\s+function\s/)
      const fim = proxima === -1 ? fonte.length : regex.lastIndex + proxima
      encontradas.push({
        arquivo,
        nome: m[1],
        assinatura: m[2],
        corpo: fonte.slice(inicio, fim),
      })
    }
  }

  return encontradas
}

/** Tudo que um arquivo "use server" exporta, função ou não. */
function exportsCruos(): { arquivo: string; texto: string }[] {
  const achados: { arquivo: string; texto: string }[] = []

  for (const arquivo of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
    const fonte = readFileSync(join(DIR, arquivo), "utf8")
    if (!/^\s*["']use server["']/.test(fonte)) continue

    for (const linha of fonte.split("\n")) {
      if (/^export\s/.test(linha)) achados.push({ arquivo, texto: linha.trim() })
    }
  }

  return achados
}

describe("um arquivo \"use server\" só exporta função async", () => {
  // O Next recusa qualquer outro export nesses arquivos e o **build inteiro**
  // falha — mas o typecheck passa, então o erro só aparece no fim do caminho.
  // Já perdi um build com um `export const` de configuração aqui.
  it.each(exportsCruos().map((e) => [`${e.arquivo}: ${e.texto.slice(0, 70)}`, e] as const))(
    "%s",
    (_id, e) => {
      const ehFuncaoAsync = /^export\s+async\s+function\s/.test(e.texto)
      const ehTipo = /^export\s+type\s/.test(e.texto)
      expect(ehFuncaoAsync || ehTipo).toBe(true)
    },
  )
})

describe("server actions são endpoints públicos", () => {
  const acoes = exportadasDeActions()

  it("encontra as actions do projeto", () => {
    // Se o scanner parar de achar nada, os testes abaixo passariam vazios.
    expect(acoes.length).toBeGreaterThan(10)
  })

  it.each(acoes.filter((a) => !PUBLICAS.has(a.nome)).map((a) => [`${a.arquivo}:${a.nome}`, a] as const))(
    "%s começa por um portão",
    (_id, acao) => {
      // `requireActor` também é portão: recusa quem não tem sessão. É o certo
      // para uma ação sobre a própria conta, onde não há permissão a exigir
      // além de estar autenticado.
      expect(/await (requirePermission|tryPermission|requireActor)\(/.test(acao.corpo)).toBe(true)
    },
  )

  it.each(acoes.map((a) => [`${a.arquivo}:${a.nome}`, a] as const))(
    "%s não recebe companyId de fora",
    (_id, acao) => {
      // A empresa vem sempre do usuário autenticado. Recebê-la por parâmetro
      // deixa qualquer um ler e escrever no lava jato do vizinho.
      expect(/\bcompanyId\b/.test(acao.assinatura)).toBe(false)
    },
  )
})
