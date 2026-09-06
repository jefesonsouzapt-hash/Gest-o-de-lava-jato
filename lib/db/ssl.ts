// Decide se a conexão com o Postgres usa TLS.
//
// O driver `pg` **não liga TLS sozinho**, e todo Postgres gerenciado
// (Supabase, Neon, Railway) recusa conexão sem ele. Sem isto o sistema
// funciona no Postgres da máquina do desenvolvedor e falha em produção — que
// é o pior lugar para descobrir.

export type SslConfig = false | { rejectUnauthorized: boolean }

/** Hosts que rodam na própria máquina e não têm certificado. */
function ehLocal(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  )
}

/**
 * Configuração de TLS a partir da URL de conexão.
 *
 * A ordem é: o que o `sslmode` da URL disser, depois o palpite pelo host.
 *
 * - `sslmode=disable` → sem TLS, mesmo remoto. É a saída para quem tem um
 *   Postgres na rede interna sem certificado.
 * - `sslmode=verify-full` ou `verify-ca` → TLS com o certificado conferido.
 * - Host local → sem TLS.
 * - Qualquer outro host → **TLS sem conferir o certificado**.
 *
 * O último caso merece explicação. Os provedores gerenciados apresentam
 * certificados de uma cadeia própria que não está no pacote de raízes do
 * Node; conferir exigiria embarcar o certificado de cada provedor no
 * repositório e trocá-lo a cada rotação. A conexão continua **cifrada** — o
 * que se abre mão é da garantia de estar falando com o servidor certo, e não
 * com alguém no meio do caminho.
 *
 * Quem quiser essa garantia usa `sslmode=verify-full` na URL e fornece a
 * raiz por `NODE_EXTRA_CA_CERTS`.
 */
export function sslFromUrl(databaseUrl: string): SslConfig {
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    // URL ilegível: o `pg` vai reclamar com uma mensagem melhor que a nossa.
    return false
  }

  const modo = url.searchParams.get("sslmode")

  if (modo === "disable") return false
  if (modo === "verify-full" || modo === "verify-ca") return { rejectUnauthorized: true }
  if (modo === "require" || modo === "prefer" || modo === "allow") return { rejectUnauthorized: false }

  return ehLocal(url.hostname) ? false : { rejectUnauthorized: false }
}
