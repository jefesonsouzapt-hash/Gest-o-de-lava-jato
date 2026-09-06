// Erros do PostgreSQL, reconhecidos sem depender do texto da mensagem.
//
// O Drizzle embrulha o erro do driver, então o `code` original costuma estar
// em `cause` — às vezes dois níveis abaixo. Comparar `error.code` direto falha
// em silêncio e o usuário recebe uma mensagem errada.

/** Código SQLSTATE do erro, procurado pela cadeia de `cause`. */
export function codigoPostgres(erro: unknown): string | null {
  let atual = erro
  for (let i = 0; i < 5; i++) {
    if (typeof atual !== "object" || atual === null) return null
    const codigo = (atual as { code?: unknown }).code
    if (typeof codigo === "string") return codigo
    atual = (atual as { cause?: unknown }).cause
  }
  return null
}

/** 23505 — violação de índice único. */
export function isUniqueViolation(erro: unknown): boolean {
  return codigoPostgres(erro) === "23505"
}
