// Vocabulário do negócio: o que o banco guarda e como aparece na tela.
// Um lugar só, para o mesmo status não virar "Em lavagem" numa tela e
// "Lavando" na outra.

export const JOB_TITLE_LABELS: Record<string, string> = {
  lavador: "Lavador",
  detailer: "Detailer",
  polidor: "Polidor",
  recepcionista: "Recepcionista",
  gerente: "Gerente",
  caixa: "Caixa",
}

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  diarista: "Diarista",
  comissionado: "Comissionado / Freelance",
}

export const STAFF_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  ferias: "Em férias",
  afastado: "Afastado",
}

export const STAFF_STATUS_CLASSES: Record<string, string> = {
  ativo: "bg-success/12 text-success",
  inativo: "bg-muted text-muted-foreground",
  ferias: "bg-primary/12 text-primary",
  afastado: "bg-warning/15 text-warning-foreground dark:text-warning",
}

export const COMMISSION_KIND_LABELS: Record<string, string> = {
  nenhuma: "Sem comissão",
  percentual: "Percentual por serviço",
  valor_fixo: "Valor fixo por lavagem",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
}

export const ADVANCE_STATUS_CLASSES: Record<string, string> = {
  pendente: "bg-warning/15 text-warning-foreground dark:text-warning",
  pago: "bg-primary/12 text-primary",
  parcialmente_abatido: "bg-primary/12 text-primary",
  quitado: "bg-success/12 text-success",
  cancelado: "bg-destructive/10 text-destructive",
}

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  paga: "Paga",
}

export const PAYROLL_STATUS_CLASSES: Record<string, string> = {
  aberta: "bg-warning/15 text-warning-foreground dark:text-warning",
  fechada: "bg-primary/12 text-primary",
  paga: "bg-success/12 text-success",
}

export const VEHICLE_CATEGORY_LABELS: Record<string, string> = {
  moto: "Moto",
  hatch: "Hatch / compacto",
  sedan: "Sedã",
  suv: "SUV",
  caminhonete: "Caminhonete / utilitário",
}

/**
 * Multiplicador sugerido do preço por porte do veículo. É só sugestão: o
 * valor do item da ordem continua editável, porque quem está no balcão vê o
 * carro.
 */
export const VEHICLE_CATEGORY_FACTORS: Record<string, number> = {
  moto: 0.6,
  hatch: 1,
  sedan: 1.15,
  suv: 1.35,
  caminhonete: 1.6,
}

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  aguardando_chegada: "Aguardando chegada",
  em_fila: "Na fila",
  em_lavagem: "Em lavagem",
  acabamento: "Acabamento",
  detalhe: "Detalhe",
  controle_qualidade: "Controle de qualidade",
  pronto_entrega: "Pronto para entrega",
  entregue: "Entregue",
  cancelada: "Cancelada",
}

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const

/** Rótulo de um mapa, com a chave crua como último recurso. */
export function label(mapa: Record<string, string>, chave: string | null | undefined): string {
  if (!chave) return "—"
  return mapa[chave] ?? chave
}
