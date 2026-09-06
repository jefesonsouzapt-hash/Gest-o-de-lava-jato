"use client"

import type React from "react"
import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createStaff, updateStaff, type ActionState } from "@/lib/actions/equipe"
import { bpsToPercentInput, centsToInput } from "@/lib/locale/money"
import { formatCep, formatCpf, formatPhone } from "@/lib/locale/br"
import { CONTRACT_TYPE_LABELS, JOB_TITLE_LABELS, STAFF_STATUS_LABELS, UFS } from "@/lib/domain"

export type StaffFormValues = {
  id: number
  name: string
  cpf: string | null
  rg: string | null
  birthDate: string | null
  phone: string | null
  email: string | null
  cep: string | null
  street: string | null
  streetNumber: string | null
  complement: string | null
  district: string | null
  city: string | null
  uf: string | null
  pixKey: string | null
  bankName: string | null
  bankBranch: string | null
  bankAccount: string | null
  bankAccountType: string | null
  jobTitle: string
  contractType: string
  status: string
  hiredAt: string | null
  baseSalaryCents: number
  commissionKind: string
  commissionBps: number
  commissionFixedCents: number
  notes: string | null
}

function Salvar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {editando ? "Salvar" : "Cadastrar"}
    </Button>
  )
}

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  )
}

export function StaffDialog({
  colaborador,
  trigger,
}: {
  colaborador?: StaffFormValues
  trigger?: React.ReactNode
}) {
  const editando = Boolean(colaborador)
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(
    editando ? updateStaff : createStaff,
    null,
  )

  const erros = estado && !estado.ok ? estado.errors : {}
  const valores = estado && !estado.ok ? (estado.values ?? {}) : {}

  // Só fecha quando a action confirma; fechar no clique esconderia o erro.
  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Colaborador atualizado." : "Colaborador cadastrado.")
      setAberto(false)
    }
  }, [estado, editando])

  // O tipo de comissão decide quais campos fazem sentido preencher.
  const [tipoComissao, setTipoComissao] = useState(colaborador?.commissionKind ?? "nenhuma")

  const v = (campo: keyof StaffFormValues, formatado?: string) =>
    valores[campo as string] ?? formatado ?? (colaborador?.[campo] as string | null) ?? ""

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button size="lg">
              <Plus />
              Novo colaborador
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
          <DialogDescription>
            A chave PIX é o que o sistema usa para o pagamento do salário e dos vales.
          </DialogDescription>
        </DialogHeader>

        <form key={JSON.stringify(valores)} action={formAction} className="flex flex-col gap-5">
          {editando && <input type="hidden" name="id" value={colaborador!.id} />}

          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Dados pessoais</h3>

            <div className="flex flex-col gap-2">
              <Label htmlFor="st-name">Nome completo</Label>
              <Input id="st-name" name="name" defaultValue={v("name")} className="h-9" maxLength={120} required />
              <Erro msg={erros.name} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-cpf">CPF</Label>
                <Input
                  id="st-cpf"
                  name="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  defaultValue={v("cpf", formatCpf(colaborador?.cpf))}
                  className="h-9"
                />
                <Erro msg={erros.cpf} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-rg">RG</Label>
                <Input id="st-rg" name="rg" defaultValue={v("rg")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-birth">Nascimento</Label>
                <Input id="st-birth" name="birthDate" type="date" defaultValue={v("birthDate")} className="h-9" />
                <Erro msg={erros.birthDate} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-phone">Celular</Label>
                <Input
                  id="st-phone"
                  name="phone"
                  type="tel"
                  placeholder="(11) 98888-7777"
                  defaultValue={v("phone", formatPhone(colaborador?.phone))}
                  className="h-9"
                />
                <Erro msg={erros.phone} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-email">E-mail</Label>
                <Input id="st-email" name="email" type="email" defaultValue={v("email")} className="h-9" />
                <Erro msg={erros.email} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-cep">CEP</Label>
                <Input
                  id="st-cep"
                  name="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  defaultValue={v("cep", formatCep(colaborador?.cep))}
                  className="h-9"
                />
                <Erro msg={erros.cep} />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="st-street">Rua</Label>
                <Input id="st-street" name="street" defaultValue={v("street")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-number">Número</Label>
                <Input id="st-number" name="streetNumber" defaultValue={v("streetNumber")} className="h-9" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-complement">Complemento</Label>
                <Input id="st-complement" name="complement" defaultValue={v("complement")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-district">Bairro</Label>
                <Input id="st-district" name="district" defaultValue={v("district")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-city">Cidade</Label>
                <Input id="st-city" name="city" defaultValue={v("city")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-uf">UF</Label>
                <NativeSelect id="st-uf" name="uf" defaultValue={v("uf")}>
                  <option value="">—</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </NativeSelect>
                <Erro msg={erros.uf} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-muted-foreground">Pagamento</h3>

            <div className="flex flex-col gap-2">
              <Label htmlFor="st-pix">Chave PIX</Label>
              <Input
                id="st-pix"
                name="pixKey"
                placeholder="CPF, e-mail, celular ou chave aleatória"
                defaultValue={v("pixKey")}
                className="h-9"
              />
              <Erro msg={erros.pixKey} />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-bank">Banco</Label>
                <Input id="st-bank" name="bankName" defaultValue={v("bankName")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-branch">Agência</Label>
                <Input id="st-branch" name="bankBranch" defaultValue={v("bankBranch")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-account">Conta</Label>
                <Input id="st-account" name="bankAccount" defaultValue={v("bankAccount")} className="h-9" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-account-type">Tipo</Label>
                <NativeSelect id="st-account-type" name="bankAccountType" defaultValue={v("bankAccountType")}>
                  <option value="">—</option>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="pagamento">Pagamento</option>
                </NativeSelect>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-muted-foreground">Dados profissionais</h3>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-job">Cargo</Label>
                <NativeSelect id="st-job" name="jobTitle" defaultValue={v("jobTitle") || "lavador"}>
                  {Object.entries(JOB_TITLE_LABELS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-contract">Contrato</Label>
                <NativeSelect id="st-contract" name="contractType" defaultValue={v("contractType") || "clt"}>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-status">Situação</Label>
                <NativeSelect id="st-status" name="status" defaultValue={v("status") || "ativo"}>
                  {Object.entries(STAFF_STATUS_LABELS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-hired">Admissão</Label>
                <Input id="st-hired" name="hiredAt" type="date" defaultValue={v("hiredAt")} className="h-9" />
                <Erro msg={erros.hiredAt} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-muted-foreground">Salário e comissão</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-salary">Salário base</Label>
                <Input
                  id="st-salary"
                  name="baseSalaryCents"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={
                    valores.baseSalaryCents ?? (colaborador ? centsToInput(colaborador.baseSalaryCents) : "")
                  }
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Deixe zerado para quem só ganha comissão.</p>
                <Erro msg={erros.baseSalaryCents} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="st-commission-kind">Tipo de comissão</Label>
                <NativeSelect
                  id="st-commission-kind"
                  name="commissionKind"
                  value={tipoComissao}
                  onChange={(e) => setTipoComissao(e.target.value)}
                >
                  <option value="nenhuma">Sem comissão</option>
                  <option value="percentual">Percentual por serviço</option>
                  <option value="valor_fixo">Valor fixo por lavagem</option>
                </NativeSelect>
              </div>
            </div>

            {/* Os campos ficam presentes mas desabilitados: escondê-los faria a
                mensagem de erro apontar para um campo que não está na tela. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-bps">Percentual (%)</Label>
                <Input
                  id="st-bps"
                  name="commissionBps"
                  inputMode="decimal"
                  placeholder="12,5"
                  defaultValue={
                    valores.commissionBps ?? (colaborador ? bpsToPercentInput(colaborador.commissionBps) : "0")
                  }
                  className="h-9"
                  disabled={tipoComissao !== "percentual"}
                />
                <Erro msg={erros.commissionBps} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="st-fixed">Valor fixo por serviço</Label>
                <Input
                  id="st-fixed"
                  name="commissionFixedCents"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={
                    valores.commissionFixedCents ??
                    (colaborador ? centsToInput(colaborador.commissionFixedCents) : "0")
                  }
                  className="h-9"
                  disabled={tipoComissao !== "valor_fixo"}
                />
                <Erro msg={erros.commissionFixedCents} />
              </div>
            </div>

            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Comissão diferente por categoria de serviço (5% na lavagem, 15% na vitrificação) é cadastrada
              na ficha do colaborador e vence esta regra geral.
            </p>
          </section>

          <div className="flex flex-col gap-2">
            <Label htmlFor="st-notes">Observações</Label>
            <textarea
              id="st-notes"
              name="notes"
              rows={2}
              defaultValue={v("notes")}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {erros._ && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {erros._}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Salvar editando={editando} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
