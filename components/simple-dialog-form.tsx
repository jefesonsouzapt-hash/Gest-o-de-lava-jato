"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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
import { saveBay, saveCategory } from "@/lib/actions/catalogo"
import type { ActionState } from "@/lib/actions/form"

/** Categoria de serviço: só um nome, mas é o que agrupa a comissão por tipo. */
export function CategoryDialog() {
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveCategory, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Categoria salva.")
      setAberto(false)
    }
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg">
            <Plus />
            Nova categoria
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>
            Categorias agrupam serviços — e é por elas que se define comissão diferente por tipo de serviço.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <Campo id="cat-name" label="Nome" erro={erros.name}>
            <Input id="cat-name" name="name" placeholder="Lavagem, Estética, Polimento…" className="h-9" required autoFocus />
          </Campo>
          <ErroGeral msg={erros._} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Salvar</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Pista/box de lavagem. */
export function BayDialog({ pista }: { pista?: { id: number; name: string; status: string; notes: string | null } }) {
  const editando = pista != null
  const [aberto, setAberto] = useState(false)
  const [estado, formAction] = useActionState<ActionState, FormData>(saveBay, null)
  const erros = estado && !estado.ok ? estado.errors : {}

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Pista atualizada." : "Pista cadastrada.")
      setAberto(false)
    }
  }, [estado, editando])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button variant={editando ? "ghost" : "outline"} size={editando ? "sm" : "lg"}>
            {!editando && <Plus />}
            {editando ? "Editar" : "Nova pista"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar pista" : "Nova pista"}</DialogTitle>
          <DialogDescription>Cada pista atende um carro por vez.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={pista.id} />}

          <Campo id="bay-name" label="Nome" erro={erros.name}>
            <Input
              id="bay-name"
              name="name"
              defaultValue={pista?.name ?? ""}
              placeholder="Pista 1"
              className="h-9"
              required
              autoFocus
            />
          </Campo>

          <Campo id="bay-status" label="Situação" erro={erros.status}>
            <NativeSelect id="bay-status" name="status" defaultValue={pista?.status ?? "livre"}>
              <option value="livre">Livre</option>
              <option value="ocupada">Ocupada</option>
              <option value="manutencao">Em manutenção</option>
            </NativeSelect>
          </Campo>

          <Campo id="bay-notes" label="Observações" hint="(opcional)" erro={erros.notes}>
            <Input id="bay-notes" name="notes" defaultValue={pista?.notes ?? ""} className="h-9" />
          </Campo>

          <ErroGeral msg={erros._} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Enviar>Salvar</Enviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
