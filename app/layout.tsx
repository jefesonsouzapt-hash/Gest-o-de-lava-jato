import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })

export const metadata: Metadata = {
  title: "Gestão de Lava Jato",
  description:
    "CRM e gestão para lava jato e estética automotiva: recepção, pistas, ordens de serviço, estoque, comissões e folha de pagamento.",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#151d2b" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
