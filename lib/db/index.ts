import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"
import { sslFromUrl } from "./ssl"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env.local e preencha a conexão.")
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // O `pg` não liga TLS sozinho e todo Postgres gerenciado o exige.
  ssl: sslFromUrl(process.env.DATABASE_URL),
  // Cada função serverless tem a própria piscina. Poucas conexões por
  // instância, fechadas cedo: senão um sábado de movimento esgota o limite do
  // banco e o balcão começa a recusar cliente.
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
})

export const db = drizzle(pool, { schema })
