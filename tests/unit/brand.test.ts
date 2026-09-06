import { describe, expect, it } from "vitest"
import {
  brandCssVars,
  brandTheme,
  contrastRatio,
  normalizeHex,
  readableOn,
  relativeLuminance,
} from "@/lib/brand"

describe("cor da marca", () => {
  it("aceita o formato curto", () => {
    expect(normalizeHex("#0af")).toBe("#00aaff")
  })

  it("normaliza maiúsculas e espaços", () => {
    expect(normalizeHex("  #0F766E  ")).toBe("#0f766e")
  })

  it("cor inválida vira a padrão, nunca quebra a tela", () => {
    // Um valor colado errado no cadastro não pode deixar a aplicação sem cor.
    for (const ruim of ["", "azul", "#12", "#12345", null, undefined, "rgb(1,2,3)"]) {
      expect(normalizeHex(ruim)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe("contraste do texto sobre a marca", () => {
  it("marca escura pede texto branco", () => {
    expect(readableOn("#0b6bcb")).toBe("#ffffff")
    expect(readableOn("#101828")).toBe("#ffffff")
  })

  it("marca clara pede texto escuro", () => {
    // O caso que quebra a heurística ingênua: amarelo é claríssimo, e branco
    // em cima dele reprova em qualquer norma de acessibilidade.
    expect(readableOn("#ffd400")).toBe("#101828")
    expect(readableOn("#7ee787")).toBe("#101828")
  })

  it("a escolha sempre atinge pelo menos 4,5:1", () => {
    // Mínimo da WCAG AA para texto normal.
    const marcas = ["#0b6bcb", "#0f766e", "#ffd400", "#e11d48", "#7ee787", "#111111", "#fafafa"]
    for (const marca of marcas) {
      expect(contrastRatio(marca, readableOn(marca))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("a luminância pesa o verde mais que o azul", () => {
    // Média simples diria que os três são iguais; o olho discorda.
    expect(relativeLuminance("#00ff00")).toBeGreaterThan(relativeLuminance("#ff0000"))
    expect(relativeLuminance("#ff0000")).toBeGreaterThan(relativeLuminance("#0000ff"))
  })

  it("preto e branco são os extremos", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5)
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5)
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
  })
})

describe("tema derivado da marca", () => {
  it("sobrescreve só o que é da marca", () => {
    const vars = brandCssVars("#0f766e")
    // Fundo, texto e bordas continuam do tema: uma cor mal escolhida não pode
    // deixar a aplicação ilegível.
    expect(Object.keys(vars)).not.toContain("--background")
    expect(Object.keys(vars)).not.toContain("--foreground")
    expect(vars["--primary"]).toBe("#0f766e")
    expect(vars["--primary-foreground"]).toBe("#ffffff")
  })

  it("o fundo suave é a própria marca translúcida", () => {
    expect(brandTheme("#0f766e").soft).toBe("rgb(15 118 110 / 0.12)")
  })
})
