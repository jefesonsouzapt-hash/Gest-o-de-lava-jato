import { MessageCircle } from "lucide-react"
import { formatPhone, whatsappLink } from "@/lib/locale/br"

/**
 * Telefone que vira conversa no WhatsApp.
 *
 * É por aqui que o balcão avisa que o carro ficou pronto, então o número
 * precisa ser clicável em toda tela onde aparece — e não ser um link quebrado
 * quando o cliente não tem celular cadastrado.
 */
export function PhoneLink({ phone, message }: { phone: string | null | undefined; message?: string }) {
  const link = whatsappLink(phone, message)
  if (!link) return <span className="text-muted-foreground">—</span>

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-primary hover:underline"
    >
      <MessageCircle className="size-3.5 shrink-0" />
      {formatPhone(phone ?? "")}
    </a>
  )
}
