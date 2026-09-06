import type { Metadata, Viewport } from "next"
import { Manrope } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" })

export const metadata: Metadata = {
  title: "Gestão de Lava Jato",
  description:
    "CRM e gestão operacional para lava jatos e centros de detalhe automóvel: receção, pistas, fichas de trabalho, consumíveis e faturação.",
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
    <html lang="pt-PT" className={`${manrope.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
