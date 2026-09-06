"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Campo, Enviar, ErroGeral } from "@/components/form-bits"
import { createCustomer, updateCustomer } from "@/lib/actions/clientes"
import type { ActionState } from "@/lib/actions/form"
import { formatCep, formatDocument, formatPhone } from "@/lib/locale/br"
import { CUSTOMER_SEGMENT_LABELS, UFS } from "@/lib/domain"

export type CustomerFormValues = {
  id: number
  name: string
  phone: string | null
  email: string | null
  document: string | null
  cep: string | null
  street: string | null
  streetNumber: string | null
  district: string | null
  city: string | null
  uf: string | null
  segment: string
  marketingOptIn: boolean
  notes: string | null
}

export function CustomerDialog({ cliente }: { cliente?: CustomerFormValues }) {
  const editando = cliente != null
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(
    editando ? updateCustomer : createCustomer,
    null,
  )

  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Cliente atualizado." : "Cliente cadastrado.")
      setAberto(false)
    }
  }, [estado, editando])

  const v = (campo: keyof CustomerFormValues, formatador?: (s: string) => string) => {
    const doEstado = valores[campo]
    if (doEstado != null) return doEstado
    const bruto = cliente?.[campo]
    if (bruto == null) return ""
    return formatador ? formatador(String(bruto)) : String(bruto)
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          editando ? (
            <Button variant="outline" size="sm">
              <Pencil />
              Editar
            </Button>
          ) : (
            <Button size="lg">
              <Plus />
              Novo cliente
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            O telefone é por onde o cliente é avisado de que o carro ficou pronto.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-5">
          {editando && <input type="hidden" name="id" value={cliente.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="cl-name" label="Nome" erro={erros.name} className="sm:col-span-2">
              <Input id="cl-name" name="name" defaultValue={v("name")} className="h-9" required autoFocus />
            </Campo>

            <Campo id="cl-phone" label="Celular" erro={erros.phone}>
              <Input
                id="cl-phone"
                name="phone"
                defaultValue={v("phone", formatPhone)}
                placeholder="(11) 98888-7777"
                className="h-9"
              />
            </Campo>

            <Campo id="cl-email" label="E-mail" hint="(opcional)" erro={erros.email}>
              <Input id="cl-email" name="email" type="email" defaultValue={v("email")} className="h-9" />
            </Campo>

            <Campo id="cl-doc" label="CPF ou CNPJ" hint="(opcional)" erro={erros.document}>
              <Input id="cl-doc" name="document" defaultValue={v("document", formatDocument)} className="h-9" />
            </Campo>

            <Campo id="cl-segment" label="Perfil" erro={erros.segment}>
              <NativeSelect id="cl-segment" name="segment" defaultValue={v("segment") || "ocasional"}>
                {Object.entries(CUSTOMER_SEGMENT_LABELS).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>
                    {rotulo}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-6">
            <Campo id="cl-cep" label="CEP" erro={erros.cep} className="sm:col-span-2">
              <Input id="cl-cep" name="cep" defaultValue={v("cep", formatCep)} placeholder="00000-000" className="h-9" />
            </Campo>
            <Campo id="cl-street" label="Rua" erro={erros.street} className="sm:col-span-3">
              <Input id="cl-street" name="street" defaultValue={v("street")} className="h-9" />
            </Campo>
            <Campo id="cl-num" label="Número" erro={erros.streetNumber}>
              <Input id="cl-num" name="streetNumber" defaultValue={v("streetNumber")} className="h-9" />
            </Campo>
            <Campo id="cl-dist" label="Bairro" erro={erros.district} className="sm:col-span-3">
              <Input id="cl-dist" name="district" defaultValue={v("district")} className="h-9" />
            </Campo>
            <Campo id="cl-city" label="Cidade" erro={erros.city} className="sm:col-span-2">
              <Input id="cl-city" name="city" defaultValue={v("city")} className="h-9" />
            </Campo>
            <Campo id="cl-uf" label="UF" erro={erros.uf}>
              <NativeSelect id="cl-uf" name="uf" defaultValue={v("uf")}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </NativeSelect>
            </Campo>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="marketingOptIn"
              value="true"
              defaultChecked={valores.marketingOptIn === "true" || (!estado && (cliente?.marketingOptIn ?? false))}
              className="size-4 rounded border-input"
            />
            Aceita receber promoções por WhatsApp
          </label>

          <Campo id="cl-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <textarea
              id="cl-notes"
              name="notes"
              rows={2}
              defaultValue={v("notes")}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          <ErroGeral msg={erros._} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>{editando ? "Salvar" : "Cadastrar"}</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
