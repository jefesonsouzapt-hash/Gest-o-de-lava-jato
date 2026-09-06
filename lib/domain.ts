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
/**
 * Quanto cada porte custa em relação ao hatch, **em porcentagem inteira**.
 *
 * Inteiro, e não 1.35: em ponto flutuante `6000 * 1.35` dá 8100.000000000001,
 * e o arredondamento para cima transforma R$ 81,00 em R$ 82,00. O cliente
 * paga um real a mais por um erro de binário.
 */
export const VEHICLE_CATEGORY_FACTORS_PCT: Record<string, number> = {
  moto: 60,
  hatch: 100,
  sedan: 115,
  suv: 135,
  caminhonete: 160,
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

export const CUSTOMER_SEGMENT_LABELS: Record<string, string> = {
  ocasional: "Ocasional",
  regular: "Regular",
  vip: "VIP",
  frota: "Frota",
}

export const CUSTOMER_SEGMENT_CLASSES: Record<string, string> = {
  ocasional: "bg-muted text-muted-foreground",
  regular: "bg-primary/10 text-primary",
  vip: "bg-warning/15 text-warning-foreground dark:text-warning",
  frota: "bg-success/10 text-success",
}

export const INSPECTION_DAMAGE_LABELS: Record<string, string> = {
  risco: "Risco",
  amassado: "Amassado",
  vidro_trincado: "Vidro trincado",
  pintura: "Pintura",
  roda: "Roda",
  outro: "Outro",
}

/** Zonas do carro na silhueta da vistoria. */
export const VEHICLE_AREAS: { key: string; label: string }[] = [
  { key: "frente", label: "Frente" },
  { key: "capo", label: "Capô" },
  { key: "teto", label: "Teto" },
  { key: "traseira", label: "Traseira" },
  { key: "porta_diant_esq", label: "Porta dianteira esq." },
  { key: "porta_tras_esq", label: "Porta traseira esq." },
  { key: "porta_diant_dir", label: "Porta dianteira dir." },
  { key: "porta_tras_dir", label: "Porta traseira dir." },
  { key: "parabrisa", label: "Para-brisa" },
  { key: "rodas", label: "Rodas" },
  { key: "interior", label: "Interior" },
  { key: "bancos", label: "Bancos" },
]

export const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  entrada: "Entrada",
  consumo: "Consumo",
  quebra: "Quebra",
  ajuste: "Ajuste",
}

/**
 * Colunas do quadro de ordens, na ordem em que o carro anda pelo lava jato.
 *
 * `entregue` e `cancelada` ficam de fora: o quadro é do que está acontecendo
 * agora, não do arquivo.
 */
export const BOARD_COLUMNS = [
  "aguardando_chegada",
  "em_fila",
  "em_lavagem",
  "acabamento",
  "detalhe",
  "controle_qualidade",
  "pronto_entrega",
] as const

export const WORK_ORDER_STATUS_CLASSES: Record<string, string> = {
  aguardando_chegada: "bg-muted text-muted-foreground",
  em_fila: "bg-muted text-muted-foreground",
  em_lavagem: "bg-primary/10 text-primary",
  acabamento: "bg-primary/10 text-primary",
  detalhe: "bg-primary/10 text-primary",
  controle_qualidade: "bg-warning/15 text-warning-foreground dark:text-warning",
  pronto_entrega: "bg-success/10 text-success",
  entregue: "bg-success/10 text-success",
  cancelada: "bg-destructive/10 text-destructive",
}

/** Unidade de estoque guardada em milésimos: 1500 = 1,5 L. */
export function formatQuantity(milli: number, unit: string): string {
  const valor = milli / 1000
  const casas = Number.isInteger(valor) ? 0 : valor * 10 % 1 === 0 ? 1 : 3
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${unit}`
}
