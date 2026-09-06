"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Campo, Enviar, ErroGeral } from "@/components/form-bits"
import { updateCompany } from "@/lib/actions/empresa"
import type { ActionState } from "@/lib/actions/form"
import { formatCep, formatCnpj, formatPhone } from "@/lib/locale/br"
import { bpsToPercentInput } from "@/lib/locale/money"
import { UFS } from "@/lib/domain"

export type CompanyFormValues = {
  name: string
  legalName: string | null
  cnpj: string | null
  municipalRegistration: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cep: string | null
  street: string | null
  streetNumber: string | null
  complement: string | null
  district: string | null
  city: string | null
  uf: string | null
  issBps: number
  brandColor: string
  logoUrl: string | null
}

export function CompanyForm({ empresa }: { empresa: CompanyFormValues }) {
  const [estado, formAction] = useActionState<ActionState, FormData>(updateCompany, null)
  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) toast.success("Configurações salvas.")
  }, [estado])

  const [cor, setCor] = useState(empresa.brandColor)
  const [logo, setLogo] = useState(empresa.logoUrl ?? "")

  const v = (campo: keyof CompanyFormValues, formatador?: (s: string) => string) => {
    const doEstado = valores[campo]
    if (doEstado != null) return doEstado
    const bruto = empresa[campo]
    if (bruto == null) return ""
    return formatador ? formatador(String(bruto)) : String(bruto)
  }

  return (
    <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-8">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Dados da empresa</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="co-name" label="Nome do lava jato" erro={erros.name} className="sm:col-span-2">
            <Input id="co-name" name="name" defaultValue={v("name")} className="h-9" required />
          </Campo>

          <Campo id="co-legal" label="Razão social" hint="(opcional)" erro={erros.legalName}>
            <Input id="co-legal" name="legalName" defaultValue={v("legalName")} className="h-9" />
          </Campo>

          <Campo id="co-cnpj" label="CNPJ" erro={erros.cnpj}>
            <Input
              id="co-cnpj"
              name="cnpj"
              defaultValue={v("cnpj", formatCnpj)}
              placeholder="00.000.000/0000-00"
              className="h-9"
            />
          </Campo>

          <Campo id="co-im" label="Inscrição municipal" hint="(opcional)" erro={erros.municipalRegistration}>
            <Input id="co-im" name="municipalRegistration" defaultValue={v("municipalRegistration")} className="h-9" />
          </Campo>

          <Campo
            id="co-iss"
            label="ISS do município"
            hint="entre 2% e 5%"
            erro={erros.issBps}
          >
            <Input
              id="co-iss"
              name="issBps"
              inputMode="decimal"
              defaultValue={valores.issBps ?? bpsToPercentInput(empresa.issBps)}
              placeholder="5"
              className="h-9"
              required
            />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Contato</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo id="co-phone" label="Telefone" erro={erros.phone}>
            <Input id="co-phone" name="phone" defaultValue={v("phone", formatPhone)} className="h-9" />
          </Campo>
          <Campo id="co-wpp" label="WhatsApp" erro={erros.whatsapp}>
            <Input id="co-wpp" name="whatsapp" defaultValue={v("whatsapp", formatPhone)} className="h-9" />
          </Campo>
          <Campo id="co-email" label="E-mail" erro={erros.email}>
            <Input id="co-email" name="email" type="email" defaultValue={v("email")} className="h-9" />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Endereço</h3>
        <div className="grid gap-4 sm:grid-cols-6">
          <Campo id="co-cep" label="CEP" erro={erros.cep} className="sm:col-span-2">
            <Input id="co-cep" name="cep" defaultValue={v("cep", formatCep)} placeholder="00000-000" className="h-9" />
          </Campo>
          <Campo id="co-street" label="Rua" erro={erros.street} className="sm:col-span-3">
            <Input id="co-street" name="street" defaultValue={v("street")} className="h-9" />
          </Campo>
          <Campo id="co-num" label="Número" erro={erros.streetNumber}>
            <Input id="co-num" name="streetNumber" defaultValue={v("streetNumber")} className="h-9" />
          </Campo>
          <Campo id="co-comp" label="Complemento" erro={erros.complement} className="sm:col-span-2">
            <Input id="co-comp" name="complement" defaultValue={v("complement")} className="h-9" />
          </Campo>
          <Campo id="co-dist" label="Bairro" erro={erros.district} className="sm:col-span-2">
            <Input id="co-dist" name="district" defaultValue={v("district")} className="h-9" />
          </Campo>
          <Campo id="co-city" label="Cidade" erro={erros.city}>
            <Input id="co-city" name="city" defaultValue={v("city")} className="h-9" />
          </Campo>
          <Campo id="co-uf" label="UF" erro={erros.uf}>
            <NativeSelect id="co-uf" name="uf" defaultValue={v("uf")}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </NativeSelect>
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Identidade visual</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          A marca aparece na barra lateral, na tela de entrada e no comprovante do cliente.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="co-color" label="Cor da marca" erro={erros.brandColor}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Escolher cor da marca"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
              />
              <Input
                id="co-color"
                name="brandColor"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="#1a2b3c"
                className="h-9 font-mono"
                required
              />
            </div>
          </Campo>

          <Campo id="co-logo" label="Endereço do logo" hint="(opcional)" erro={erros.logoUrl}>
            <Input
              id="co-logo"
              name="logoUrl"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://…/logo.png"
              className="h-9"
            />
          </Campo>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-5 rounded-lg bg-muted px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: cor }}
            >
              {(valores.name ?? empresa.name).slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{valores.name ?? empresa.name}</p>
              <p className="text-xs text-muted-foreground">Como aparece na barra lateral</p>
            </div>
          </div>

          {/* Sem `next/image`: o logo é um endereço que o dono digita, e a
              lista de domínios permitidos não pode ser adivinhada aqui. */}
          {logo.trim() !== "" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Logo do lava jato"
              className="max-h-12 w-auto rounded bg-white/60 object-contain p-1"
            />
          )}
        </div>
      </section>

      <ErroGeral msg={erros._} />

      <div className="flex justify-end">
        <Enviar>Salvar configurações</Enviar>
      </div>
    </form>
  )
}
