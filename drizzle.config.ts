import { readFileSync } from "node:fs"

// Sem importar defineConfig do drizzle-kit: ele não é dependência do projeto
// (roda sob demanda via `pnpm dlx`), e um import daqui quebraria essa execução.
// O drizzle-kit aceita um objeto simples como export padrão — defineConfig só
// acrescenta tipagem.

// O Next carrega .env.local sozinho; o drizzle-kit não. Lê o arquivo na mão
// para que `pnpm db:push` use a mesma DATABASE_URL do app.
function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return

  for (const file of [".env.local", ".env"]) {
    let content: string
    try {
      content = readFileSync(file, "utf8")
    } catch {
      continue
    }

    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key]) continue
      // Remove aspas envolventes, se houver.
      process.env[key] = rawValue.trim().replace(/^["'](.*)["']$/, "$1")
    }

    if (process.env.DATABASE_URL) return
  }
}

loadEnvLocal()

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local e preencha a conexão.")
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
}
