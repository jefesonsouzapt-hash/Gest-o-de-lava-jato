"use client"

import type React from "react"
import { useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Boxes,
  CalendarClock,
  Car,
  CircleUser,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  SprayCan,
  Users,
  UserRound,
  Wallet,
  X,
} from "lucide-react"
import { logout } from "@/lib/actions/auth"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Permission } from "@/lib/auth/permissions"

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission }

// A permissão de cada item. Esconder o menu é só cortesia — a página no
// servidor verifica de novo, porque o endereço pode ser digitado na mão.
const NAV: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/recepcao", label: "Recepção e fila", icon: CalendarClock, permission: "recepcao.gerir" },
  { href: "/ordens", label: "Ordens de serviço", icon: ClipboardList, permission: "ordem.ver" },
  { href: "/clientes", label: "Clientes", icon: Users, permission: "cliente.ver" },
  { href: "/veiculos", label: "Veículos", icon: Car, permission: "cliente.ver" },
  { href: "/servicos", label: "Serviços", icon: SprayCan, permission: "servico.ver" },
  { href: "/estoque", label: "Estoque", icon: Boxes, permission: "estoque.ver" },
  { href: "/equipe", label: "Equipe", icon: UserRound, permission: "equipe.ver" },
  { href: "/vales", label: "Vales e adiantamentos", icon: HandCoins, permission: "vale.gerir" },
  { href: "/folha", label: "Folha de pagamento", icon: ReceiptText, permission: "folha.ver" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "relatorio.ver" },
  { href: "/caixa", label: "Caixa", icon: Wallet, permission: "relatorio.financeiro" },
  { href: "/minha-conta", label: "Minha conta", icon: CircleUser },
  { href: "/configuracoes", label: "Configurações", icon: Settings, permission: "empresa.gerir" },
]

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: {
    name: string
    email: string
    roleName: string
    companyName: string
    /** Identidade visual da empresa, definida em Configurações. */
    brandColor?: string | null
    logoUrl?: string | null
    permissions: readonly string[]
  }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const itens = NAV.filter((item) => !item.permission || user.permissions.includes(item.permission))
  const atual = itens.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
  const titulo = atual?.label ?? "Gestão de Lava Jato"

  const iniciais = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex min-h-svh bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegação principal"
      >
        <div className="flex items-center justify-between">
          {/* O logo da empresa substitui a marca do sistema quando existe: a
              barra lateral é do lava jato, não nossa. `next/image` não serve —
              o endereço é digitado pelo dono e não dá para listar os domínios
              permitidos de antemão. */}
          {user.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.logoUrl}
              alt={user.companyName}
              className="max-h-9 w-auto max-w-[10rem] object-contain"
            />
          ) : (
            <Logo />
          )}
          <button
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="mt-7 flex flex-1 flex-col gap-1 overflow-y-auto">
          {itens.map((item) => {
            const Icon = item.icon
            const ativo = atual?.href === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-2.5 py-2 text-xs text-sidebar-foreground/60">
          <span
            className="size-1.5 shrink-0 rounded-full bg-sidebar-primary"
            style={user.brandColor ? { backgroundColor: user.brandColor } : undefined}
          />
          <span className="truncate">{user.companyName}</span>
        </div>
      </aside>

      {aberto && (
        <button
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setAberto(false)}
          aria-label="Fechar navegação"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setAberto(true)}
            aria-label="Abrir navegação"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="text-base font-semibold tracking-tight">{titulo}</h1>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {iniciais}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* O rótulo é um `Menu.GroupLabel` do Base UI e quebra fora de
                    um `Menu.Group` — e o erro derruba a página inteira. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="truncate font-semibold">{user.name}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                    <span className="mt-1 text-xs font-normal text-primary">{user.roleName}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {/* Navegação por `router.push` e não por `render={<Link/>}`:
                    o Base UI quebra ao compor o item de menu com o Link do
                    Next e leva a página inteira junto. */}
                <DropdownMenuItem onClick={() => router.push("/minha-conta")}>
                  <CircleUser className="size-4" />
                  Minha conta
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => startTransition(async () => void (await logout()))}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
