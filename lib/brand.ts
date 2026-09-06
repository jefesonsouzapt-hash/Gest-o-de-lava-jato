// Identidade visual: a cor que o dono escolheu vira o tema da aplicação.
//
// Funções puras sobre a cor em hexadecimal. A parte que importa é o contraste:
// uma marca amarela com texto branco em cima é ilegível, e é exatamente o que
// acontece se o texto do botão for fixo.

export type BrandTheme = {
  /** A cor da marca, normalizada em `#rrggbb`. */
  primary: string
  /** Preto ou branco, o que tiver contraste sobre a marca. */
  onPrimary: string
  /** Versão translúcida, para fundos suaves de selo e ícone. */
  soft: string
}

const PADRAO = "#0b6bcb"

/** `#abc` → `#aabbcc`; qualquer coisa inválida vira a cor padrão. */
export function normalizeHex(input: string | null | undefined): string {
  const bruto = String(input ?? "").trim().toLowerCase()

  if (/^#[0-9a-f]{6}$/.test(bruto)) return bruto
  if (/^#[0-9a-f]{3}$/.test(bruto)) {
    const [, r, g, b] = bruto
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return PADRAO
}

function canaisRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex)
  return [
    Number.parseInt(h.slice(1, 3), 16),
    Number.parseInt(h.slice(3, 5), 16),
    Number.parseInt(h.slice(5, 7), 16),
  ]
}

/**
 * Luminância relativa da cor (WCAG 2.1, 0 = preto, 1 = branco).
 *
 * Não é a média dos canais: o olho enxerga o verde muito mais que o azul, e
 * usar a média faria um azul-marinho parecer claro.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = canaisRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste entre duas cores, de 1:1 a 21:1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const claro = Math.max(la, lb)
  const escuro = Math.min(la, lb)
  return (claro + 0.05) / (escuro + 0.05)
}

/**
 * Texto legível sobre a cor da marca.
 *
 * Escolhe entre preto e branco pelo contraste real, não por um limiar de
 * luminância chutado: numa marca amarela o branco reprova em qualquer norma,
 * e é o caso que quebra a heurística ingênua.
 */
export function readableOn(hex: string): string {
  const branco = "#ffffff"
  const preto = "#101828"
  return contrastRatio(hex, branco) >= contrastRatio(hex, preto) ? branco : preto
}

/** O tema derivado da cor da marca, pronto para virar variáveis CSS. */
export function brandTheme(hex: string | null | undefined): BrandTheme {
  const primary = normalizeHex(hex)
  const [r, g, b] = canaisRgb(primary)
  return {
    primary,
    onPrimary: readableOn(primary),
    soft: `rgb(${r} ${g} ${b} / 0.12)`,
  }
}

/**
 * As variáveis CSS que a marca sobrescreve.
 *
 * Só estas: o resto do tema (fundo, texto, bordas) continua vindo do
 * `globals.css`, senão uma cor mal escolhida deixaria a aplicação ilegível.
 */
export function brandCssVars(hex: string | null | undefined): Record<string, string> {
  const tema = brandTheme(hex)
  return {
    "--primary": tema.primary,
    "--primary-foreground": tema.onPrimary,
    "--ring": tema.primary,
    "--sidebar-primary": tema.primary,
    "--sidebar-primary-foreground": tema.onPrimary,
    "--chart-1": tema.primary,
    "--brand-soft": tema.soft,
  }
}
