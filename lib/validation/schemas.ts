import { z } from "zod"
import {
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  isValidPhone,
  isValidPixKey,
  isValidPlate,
  normalizePhone,
  normalizePlate,
  pixKeyKind,
} from "@/lib/locale/br"
import { parseCurrencyToCents } from "@/lib/locale/money"

// Fronteira de entrada do sistema. Tudo que chega de um formulário, de uma
// rota ou da barra de endereço passa por aqui antes de tocar no banco.
//
// Os schemas **normalizam** além de validar: o telefone sai em E.164, a placa
// sem hífen, o CPF só com dígitos. Assim a normalização acontece num lugar só,
// e não espalhada por cada server action.
//
// As mensagens são o que o usuário lê — em português do Brasil, dizendo o que
// fazer, não o que a biblioteca achou.

// --- Peças reutilizáveis -----------------------------------------------------

const textoObrigatorio = (campo: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${campo}.`)
    .max(max, `${campo.charAt(0).toUpperCase()}${campo.slice(1)} está muito longo.`)

/** Campo de texto livre que vira `null` quando vem vazio. */
const textoOpcional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .transform((v) => v || null)
    .nullable()
    .catch(null)

/** Só os dígitos, ou `null`. É como documento, CEP e telefone são gravados. */
const digitosOpcionais = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "") || null)
  .nullable()
  .catch(null)

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhone(v), "Telefone inválido. Use DDD + número, como (11) 98888-7777.")
  .transform((v) => (v === "" ? null : normalizePhone(v)))

export const cpfSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidCpf(v), "CPF inválido. Confira os 11 dígitos.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

export const cnpjSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido. Confira os 14 dígitos.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

/** CPF ou CNPJ: o cliente pode ser pessoa física ou frota de empresa. */
export const documentSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidDocument(v), "CPF ou CNPJ inválido.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

export const cepSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidCep(v), "CEP inválido. Use o formato 00000-000.")
  .transform((v) => (v === "" ? null : v.replace(/\D/g, "")))

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (v) =>
      v === "" ||
      [
        "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
        "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
      ].includes(v),
    "UF inválida.",
  )
  .transform((v) => v || null)

export const plateSchema = z
  .string()
  .trim()
  .min(1, "Informe a placa.")
  .refine(isValidPlate, "Placa inválida. Use ABC-1234 ou ABC1D23.")
  .transform(normalizePlate)

export const emailSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail inválido.")
  .transform((v) => (v === "" ? null : v.toLowerCase()))

/** Chave PIX de qualquer tipo, recusada quando não é reconhecível. */
export const pixKeySchema = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || isValidPixKey(v),
    "Chave PIX inválida. Use CPF, CNPJ, e-mail, telefone ou chave aleatória.",
  )
  .transform((v) => (v === "" ? null : v))

/** Valor em reais digitado pelo usuário; sai em centavos inteiros. */
export const moneySchema = z
  .string()
  .trim()
  .transform(parseCurrencyToCents)
  .refine((cents) => cents >= 0, "O valor não pode ser negativo.")

export const positiveMoneySchema = moneySchema.refine((c) => c > 0, "Informe um valor maior que zero.")

/**
 * Percentual digitado; sai em pontos-base (12,5 % → 1250).
 *
 * Converte sem cortar e só depois valida a faixa: cortar 150 % para 100 %
 * silenciosamente devolveria ao usuário uma comissão que ele não escolheu, e
 * ele só descobriria no fechamento da folha.
 */
export const percentSchema = z
  .string()
  .trim()
  .transform((v) => parseCurrencyToCents(v || "0"))
  .refine((bps) => bps >= 0 && bps <= 10_000, "O percentual deve ficar entre 0% e 100%.")

/** Data no formato ISO usado pelo banco. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), "Data inválida.")

export const optionalIsoDateSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
  .transform((v) => v || null)

/** Competência da folha: `AAAA-MM`. */
export const competenceMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida. Use o formato AAAA-MM.")

export const vehicleCategorySchema = z.enum(["moto", "hatch", "sedan", "suv", "caminhonete"])

export const paymentMethodSchema = z.enum([
  "pix",
  "dinheiro",
  "debito",
  "credito",
  "transferencia",
  "boleto",
])

/** Formas com que um vale é entregue ao funcionário. */
export const advancePaymentMethodSchema = z.enum(["pix", "dinheiro", "transferencia"])

export const workOrderStatusSchema = z.enum([
  "aguardando_chegada",
  "em_fila",
  "em_lavagem",
  "acabamento",
  "detalhe",
  "controle_qualidade",
  "pronto_entrega",
  "entregue",
  "cancelada",
])

// --- Autenticação ------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
})

export const passwordSchema = z
  // Doze caracteres sem regra de composição: uma frase longa resiste melhor que
  // "Abc123!" e é mais fácil de lembrar no balcão.
  .string()
  .min(12, "A senha precisa ter pelo menos 12 caracteres.")
  .max(200, "A senha está muito longa.")

export const roleKeySchema = z.enum(["admin", "gerente", "recepcionista", "detailer", "lavador"])

export const createUserSchema = z.object({
  name: textoObrigatorio("o nome", 120),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: passwordSchema,
  roleKey: roleKeySchema,
  phone: phoneSchema,
})

// --- Empresa e identidade visual ---------------------------------------------

export const companySchema = z.object({
  name: textoObrigatorio("o nome do lava jato", 120),
  legalName: textoOpcional(160),
  cnpj: cnpjSchema,
  municipalRegistration: textoOpcional(40),
  phone: phoneSchema,
  whatsapp: phoneSchema,
  email: emailSchema,
  cep: cepSchema,
  street: textoOpcional(160),
  streetNumber: textoOpcional(20),
  complement: textoOpcional(80),
  district: textoOpcional(80),
  city: textoOpcional(80),
  uf: ufSchema,
  /** Alíquota de ISS do município: por lei fica entre 2% e 5%. */
  issBps: percentSchema.refine(
    (bps) => bps >= 200 && bps <= 500,
    "O ISS municipal fica entre 2% e 5%.",
  ),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use o formato #1a2b3c.")
    .transform((v) => v.toLowerCase()),
  logoUrl: textoOpcional(500),
})

// --- Clientes e veículos -----------------------------------------------------

export const customerSchema = z.object({
  name: textoObrigatorio("o nome do cliente", 120),
  phone: phoneSchema,
  email: emailSchema,
  document: documentSchema,
  cep: cepSchema,
  street: textoOpcional(160),
  streetNumber: textoOpcional(20),
  district: textoOpcional(80),
  city: textoOpcional(80),
  uf: ufSchema,
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
  category: vehicleCategorySchema.default("hatch"),
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
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "A duração mínima é de 5 minutos.")
    .max(1440, "A duração máxima é de 24 horas."),
  commissionBps: percentSchema,
  countsForLoyalty: z.coerce.boolean().default(true),
})

// --- Equipe ------------------------------------------------------------------

export const jobTitleSchema = z.enum([
  "lavador",
  "detailer",
  "polidor",
  "recepcionista",
  "gerente",
  "caixa",
])

export const contractTypeSchema = z.enum(["clt", "pj", "diarista", "comissionado"])
export const staffStatusSchema = z.enum(["ativo", "inativo", "ferias", "afastado"])
export const commissionKindSchema = z.enum(["nenhuma", "percentual", "valor_fixo"])

export const staffSchema = z
  .object({
    // Pessoais
    name: textoObrigatorio("o nome completo", 120),
    cpf: cpfSchema,
    rg: digitosOpcionais,
    birthDate: optionalIsoDateSchema,
    phone: phoneSchema,
    email: emailSchema,
    cep: cepSchema,
    street: textoOpcional(160),
    streetNumber: textoOpcional(20),
    complement: textoOpcional(80),
    district: textoOpcional(80),
    city: textoOpcional(80),
    uf: ufSchema,

    // Pagamento
    pixKey: pixKeySchema,
    bankName: textoOpcional(80),
    bankBranch: textoOpcional(20),
    bankAccount: textoOpcional(30),
    bankAccountType: z.enum(["corrente", "poupanca", "pagamento"]).nullable().catch(null),

    // Profissionais
    jobTitle: jobTitleSchema.default("lavador"),
    contractType: contractTypeSchema.default("clt"),
    status: staffStatusSchema.default("ativo"),
    hiredAt: optionalIsoDateSchema,

    // Financeiras
    baseSalaryCents: moneySchema,
    commissionKind: commissionKindSchema.default("nenhuma"),
    commissionBps: percentSchema,
    commissionFixedCents: moneySchema,

    notes: textoOpcional(),
  })
  .superRefine((dados, ctx) => {
    // Escolher "percentual" e deixar o campo em branco cria um colaborador que
    // parece comissionado e nunca recebe nada. Melhor recusar no cadastro.
    if (dados.commissionKind === "percentual" && dados.commissionBps <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["commissionBps"],
        message: "Informe o percentual da comissão.",
      })
    }
    if (dados.commissionKind === "valor_fixo" && dados.commissionFixedCents <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["commissionFixedCents"],
        message: "Informe o valor fixo por serviço.",
      })
    }
  })

export const staffCommissionRuleSchema = z
  .object({
    staffId: z.coerce.number().int().positive("Escolha o colaborador."),
    serviceCategoryId: z.coerce.number().int().positive().nullable().catch(null),
    kind: commissionKindSchema.default("percentual"),
    bps: percentSchema,
    fixedCents: moneySchema,
  })
  .superRefine((dados, ctx) => {
    if (dados.kind === "percentual" && dados.bps <= 0) {
      ctx.addIssue({ code: "custom", path: ["bps"], message: "Informe o percentual." })
    }
    if (dados.kind === "valor_fixo" && dados.fixedCents <= 0) {
      ctx.addIssue({ code: "custom", path: ["fixedCents"], message: "Informe o valor fixo." })
    }
  })

// --- Vales / adiantamentos ---------------------------------------------------

export const advanceSchema = z.object({
  staffId: z.coerce.number().int().positive("Escolha o colaborador."),
  amountCents: positiveMoneySchema,
  requestedOn: isoDateSchema,
  paymentMethod: advancePaymentMethodSchema,
  receiptRef: textoOpcional(80),
  installments: z.coerce
    .number()
    .int()
    .min(1, "O vale é descontado em pelo menos uma folha.")
    .max(24, "No máximo 24 parcelas."),
  firstDeductionMonth: competenceMonthSchema,
  notes: textoOpcional(),
})

/** Registro da entrega do dinheiro ao funcionário. */
export const advancePayoutSchema = z.object({
  id: z.coerce.number().int().positive(),
  paymentMethod: advancePaymentMethodSchema,
  receiptRef: textoOpcional(80),
})

// --- Folha -------------------------------------------------------------------

export const payrollAdjustmentSchema = z.object({
  staffId: z.coerce.number().int().positive(),
  bonusCents: moneySchema,
  otherEarningsCents: moneySchema,
  otherDeductionCents: moneySchema,
  notes: textoOpcional(),
})

// --- Operação ----------------------------------------------------------------

export const workOrderItemSchema = z.object({
  serviceId: z.coerce.number().int().positive().nullable().catch(null),
  description: textoObrigatorio("a descrição do serviço", 160),
  quantity: z.coerce.number().int().min(1, "A quantidade mínima é 1.").max(99, "A quantidade máxima é 99."),
  unitPriceCents: moneySchema,
})

export const paymentSchema = z.object({
  method: paymentMethodSchema,
  amountCents: positiveMoneySchema,
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
// O tipo vem do schema, nunca o contrário: assim não há como a validação e o
// tipo divergirem.

export type LoginInput = z.infer<typeof loginSchema>
export type CompanyInput = z.infer<typeof companySchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type ServiceInput = z.infer<typeof serviceSchema>
export type StaffInput = z.infer<typeof staffSchema>
export type AdvanceInput = z.infer<typeof advanceSchema>
export type PaymentInput = z.infer<typeof paymentSchema>

// --- Auxiliar para as server actions ----------------------------------------

export type FieldErrors = Record<string, string>

/**
 * Valida um `FormData` e devolve os erros prontos para a interface — a primeira
 * mensagem por campo, que é o que cabe embaixo de um `input`.
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
    // A primeira mensagem de cada campo ganha: três erros no mesmo input só
    // confundem.
    if (!(campo in errors)) errors[campo] = problema.message
  }
  return { ok: false, errors }
}

/** Descobre o tipo da chave PIX para gravar junto com ela. */
export function resolvePixKind(key: string | null) {
  return key ? pixKeyKind(key) : null
}
