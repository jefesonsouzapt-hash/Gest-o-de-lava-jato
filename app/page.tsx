import { redirect } from "next/navigation"
import { getActor } from "@/lib/auth/session"

export default async function HomePage() {
  redirect((await getActor()) ? "/painel" : "/entrar")
}
