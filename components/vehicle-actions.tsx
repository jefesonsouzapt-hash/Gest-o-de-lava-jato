"use client"

import { Trash2 } from "lucide-react"
import { ConfirmButton } from "@/components/confirm-button"
import { deleteVehicle } from "@/lib/actions/clientes"

export function DeleteVehicleButton({ id, plate }: { id: number; plate: string }) {
  return (
    <ConfirmButton
      variant="ghost"
      size="sm"
      icon={<Trash2 />}
      label={<span className="sr-only">Apagar veículo {plate}</span>}
      title={`Apagar o veículo ${plate}?`}
      description="Só é possível apagar um veículo que nunca entrou em ordem de serviço. Depois disso, o histórico depende dele."
      confirmLabel="Apagar"
      successMessage="Veículo apagado."
      action={deleteVehicle}
      fields={{ id }}
    />
  )
}
