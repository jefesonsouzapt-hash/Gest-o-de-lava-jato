import { z } from "zod"
import {
  isValidNif,
  isValidPhone,
  isValidPlate,
  isValidPostalCode,
  normalizePhone,
  normalizePlate,
} from "@/lib/locale/pt"
import { parseCurrencyToCents } from "@/lib/locale/money"

// Fronteira de entrada da aplicação. Tudo o que chega de um formulário, de uma
// rota ou da barra de endereço passa por aqui antes de tocar na base de dados.
//
// Os schemas **normalizam** além de validar: o telemóvel sai em E.164 e a
// matrícula sai sem hífenes, que é como ficam guardados. Assim a normalização
// acontece num sítio só, e não espalhada por cada server action.
//
// As mensagens são as que o utilizador lê — em português de Portugal, a dizer
// o que fazer, não o que a biblioteca achou.

// --- Peças reutilizáveis -----------------------------------------------------

const textoObrigatorio = (campo: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `Indique ${campo}.`)
    .max(max, `${campo.charAt(0).toUpperCase()}${campo.slice(1)} é demasiado longo.`)

/** Campo de texto livre que fica `null` quando vem vazio. */
const textoOpcional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, "Texto demasiado longo.")
    .transform((v) => v || null)
    .nullable()
    .catch(null)

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhone(v), "Número inválido. Use nove dígitos, como 912 345 678.")
  .transform((v) => (v === "" ? null : normalizePhone(v)))

export const nifSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidNif(v), "NIF inválido. Confirme os nove dígitos.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

export const postalCodeSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPostalCode(v), "Código postal inválido. Use o formato 0000-000.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

export const plateSchema = z
  .string()
  .trim()
  .min(1, "Indique a matrícula.")
  .refine(isValidPlate, "Matrícula inválida. Use AA-00-AA, 00-AA-00, 00-00-AA ou AA-00-00.")
  .transform(normalizePlate)

export const emailSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Endereço de email inválido.")
  .transform((v) => (v === "" ? null : v.toLowerCase()))

/** Valor em euros escrito pelo utilizador; sai em cêntimos inteiros. */
export const moneySchema = z
  .string()
  .trim()
  .transform(parseCurrencyToCents)
  .refine((cents) => cents >= 0, "O valor não pode ser negativo.")

/** Data no formato ISO usado pela base de dados. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), "Data inválida.")

export const vehicleCategorySchema = z.enum([
  "ligeiro_pequeno",
  "ligeiro_medio",
  "suv",
  "comercial",
  "moto",
])

export const paymentMethodSchema = z.enum(["mbway", "multibanco", "transferencia", "dinheiro", "cartao"])

export const workOrderStatusSchema = z.enum([
  "aguarda_chegada",
  "em_fila",
  "em_lavagem",
  "acabamento",
  "detalhe",
  "controlo_qualidade",
  "pronta_recolha",
  "entregue",
  "cancelada",
])

export const vatRateSchema = z.coerce
  .number()
  .refine((v) => [0, 6, 13, 23].includes(v), "Taxa de IVA inválida.")

/** Percentagem convertida em pontos de base: 12,5 % → 1250. */
export const commissionSchema = z
  .string()
  .trim()
  .transform((v) => Math.round(parseCurrencyToCents(v || "0")))
  .refine((bps) => bps >= 0 && bps <= 10000, "A comissão tem de estar entre 0 % e 100 %.")

// --- Autenticação ------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Indique o email.").email("Endereço de email inválido."),
  password: z.string().min(1, "Indique a palavra-passe."),
})

export const passwordSchema = z
  .string()
  // Doze caracteres sem regras de composição: uma frase-passe longa resiste
  // melhor do que "Abc123!" e é mais fácil de decorar no balcão.
  .min(12, "A palavra-passe tem de ter pelo menos 12 caracteres.")
  .max(200, "A palavra-passe é demasiado longa.")

export const createUserSchema = z.object({
  name: textoObrigatorio("o nome", 120),
  email: z.string().trim().min(1, "Indique o email.").email("Endereço de email inválido."),
  password: passwordSchema,
  roleKey: z.enum(["admin", "gerente", "rececionista", "detailer", "lavador"]),
  phone: phoneSchema,
})

// --- Clientes e viaturas -----------------------------------------------------

export const customerSchema = z.object({
  name: textoObrigatorio("o nome do cliente", 120),
  phone: phoneSchema,
  email: emailSchema,
  nif: nifSchema,
  address: textoOpcional(200),
  postalCode: postalCodeSchema,
  locality: textoOpcional(120),
  segment: z.enum(["ocasional", "regular", "vip", "frota"]).default("ocasional"),
  marketingOptIn: z.coerce.boolean().default(false),
  notes: textoOpcional(),
})

export const vehicleSchema = z.object({
  customerId: z.coerce.number().int().positive("Escolha o cliente."),
  plate: plateSchema,
  brand: textoOpcional(60),
  model: textoOpcional(60),
  color: textoOpcional(40),
  category: vehicleCategorySchema.default("ligeiro_medio"),
  year: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number.parseInt(v, 10)))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 1900 && v <= new Date().getFullYear() + 1),
      "Ano inválido.",
    ),
  notes: textoOpcional(),
})

// --- Catálogo ----------------------------------------------------------------

export const serviceSchema = z.object({
  name: textoObrigatorio("o nome do serviço", 120),
  description: textoOpcional(),
  categoryId: z.coerce.number().int().positive().nullable().catch(null),
  isPackage: z.coerce.boolean().default(false),
  basePriceCents: moneySchema,
  vatRate: vatRateSchema.default(23),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "A duração mínima é de 5 minutos.")
    .max(1440, "A duração máxima é de 24 horas."),
  commissionBps: commissionSchema,
  countsForLoyalty: z.coerce.boolean().default(true),
})

export const servicePriceSchema = z.object({
  category: vehicleCategorySchema,
  priceCents: moneySchema,
  durationMinutes: z.coerce.number().int().min(5).max(1440).nullable().catch(null),
})

// --- Operação ----------------------------------------------------------------

export const workOrderItemSchema = z.object({
  serviceId: z.coerce.number().int().positive().nullable().catch(null),
  description: textoObrigatorio("a descrição do serviço", 160),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "A quantidade mínima é 1.")
    .max(99, "A quantidade máxima é 99."),
  unitPriceCents: moneySchema,
  vatRate: vatRateSchema.default(23),
})

export const paymentSchema = z.object({
  method: paymentMethodSchema,
  amountCents: moneySchema.refine((c) => c > 0, "O valor recebido tem de ser maior que zero."),
  reference: textoOpcional(80),
})

export const inspectionSchema = z.object({
  odometerKm: z.coerce.number().int().min(0).max(2_000_000).nullable().catch(null),
  fuelLevelPercent: z.coerce.number().int().min(0).max(100).nullable().catch(null),
  personalItems: textoOpcional(),
  notes: textoOpcional(),
  signedByName: textoOpcional(120),
})

// --- Tipos derivados ---------------------------------------------------------
// O tipo vem do schema, nunca o contrário: assim não há forma de a validação e
// o tipo divergirem.

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type ServiceInput = z.infer<typeof serviceSchema>
export type WorkOrderItemInput = z.infer<typeof workOrderItemSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type InspectionInput = z.infer<typeof inspectionSchema>

// --- Auxiliar para as server actions ----------------------------------------

export type FieldErrors = Record<string, string>

/**
 * Valida um `FormData` e devolve os erros já prontos para a interface — a
 * primeira mensagem por campo, que é o que cabe debaixo de um `input`.
 */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; errors: FieldErrors } {
  const bruto: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {}
  for (const chave of new Set(formData.keys())) {
    const valores = formData.getAll(chave)
    bruto[chave] = valores.length > 1 ? valores : valores[0]
  }

  const resultado = schema.safeParse(bruto)
  if (resultado.success) return { ok: true, data: resultado.data }

  const errors: FieldErrors = {}
  for (const problema of resultado.error.issues) {
    const campo = problema.path.join(".") || "_"
    // A primeira mensagem de cada campo ganha: mostrar três erros no mesmo
    // input só confunde.
    if (!(campo in errors)) errors[campo] = problema.message
  }
  return { ok: false, errors }
}
