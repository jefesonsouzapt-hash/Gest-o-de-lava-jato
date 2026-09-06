import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// Convenções desta base de dados:
//
// 1. **Dinheiro em centavos inteiros.** Nunca `numeric` nem `real`. Ver
//    lib/locale/money.ts.
// 2. **Multi-empresa.** Cada tabela de negócio traz `companyId`. Todas as
//    consultas filtram por ele — é a fronteira entre clientes do SaaS, e
//    esquecê-lo expõe dados de um lava jato a outro.
// 3. **Nada se apaga.** Registros com histórico ficam inativos (`active`,
//    `archivedAt`); apagar reescreveria faturamento já emitido.
// 4. Identificadores brasileiros (CPF, CNPJ, placa, telefone) são gravados
//    normalizados — só dígitos, sem máscara — para a busca comparar.

// --- Enumerações -------------------------------------------------------------

/** Situações pelas quais o veículo passa, do agendamento à entrega. */
export const workOrderStatus = pgEnum("work_order_status", [
  "aguardando_chegada", // agendado, ainda não chegou
  "em_fila", // chegou; recepção feita, esperando pista
  "em_lavagem", // na pista: externa / chassi
  "acabamento", // secagem e interior
  "detalhe", // polimento, bancos e outros serviços especiais
  "controle_qualidade",
  "pronto_entrega", // cliente avisado
  "entregue",
  "cancelada",
])

/** Como o veículo chegou. */
export const arrivalType = pgEnum("arrival_type", ["agendado", "walk_in"])

/** Porte do veículo: governa o preço do serviço. */
export const vehicleCategory = pgEnum("vehicle_category", [
  "moto",
  "hatch",
  "sedan",
  "suv",
  "caminhonete", // caminhonete, utilitário, van
])

/** Meios de pagamento em uso no Brasil. */
export const paymentMethod = pgEnum("payment_method", [
  "pix",
  "dinheiro",
  "debito",
  "credito",
  "transferencia",
  "boleto",
])

export const bayStatus = pgEnum("bay_status", ["livre", "ocupada", "manutencao"])

// --- Enumerações da equipe ---------------------------------------------------

export const jobTitle = pgEnum("job_title", [
  "lavador",
  "detailer",
  "polidor",
  "recepcionista",
  "gerente",
  "caixa",
])

export const contractType = pgEnum("contract_type", ["clt", "pj", "diarista", "comissionado"])

export const staffStatus = pgEnum("staff_status", ["ativo", "inativo", "ferias", "afastado"])

/** Como a comissão do colaborador é calculada. */
export const commissionKind = pgEnum("commission_kind", [
  "nenhuma",
  "percentual", // % sobre o valor do serviço
  "valor_fixo", // R$ fixos por lavagem executada
])

export const pixKeyKind = pgEnum("pix_key_kind", ["cpf", "cnpj", "email", "telefone", "aleatoria"])

export const bankAccountKind = pgEnum("bank_account_kind", ["corrente", "poupanca", "pagamento"])

/** Vale / adiantamento salarial, do pedido até a quitação. */
export const advanceStatus = pgEnum("advance_status", [
  "pendente", // concedido, ainda não entregue ao funcionário
  "pago", // dinheiro entregue, nada abatido ainda
  "parcialmente_abatido",
  "quitado",
  "cancelado",
])

/** Fechamento da folha do mês. */
export const payrollStatus = pgEnum("payroll_status", ["aberta", "fechada", "paga"])

export const customerSegment = pgEnum("customer_segment", ["ocasional", "regular", "vip", "frota"])

export const inspectionDamageKind = pgEnum("inspection_damage_kind", [
  "risco",
  "amassado",
  "vidro_trincado",
  "pintura",
  "roda",
  "outro",
])

export const loyaltyKind = pgEnum("loyalty_kind", ["carimbo", "resgate", "ajuste"])

export const stockMovementKind = pgEnum("stock_movement_kind", ["entrada", "consumo", "quebra", "ajuste"])

// --- Empresa -----------------------------------------------------------------

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    /** Nome fantasia, o que aparece na interface e no comprovante. */
    name: text("name").notNull(),
    /** Razão social, quando difere do nome fantasia. */
    legalName: text("legal_name"),
    /** CNPJ (ou CPF do MEI), só dígitos. */
    cnpj: text("cnpj"),
    /** Inscrição municipal, para a nota de serviço. */
    municipalRegistration: text("municipal_registration"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    cep: text("cep"),
    street: text("street"),
    streetNumber: text("street_number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    /** Sigla do estado: SP, RJ, MG… */
    uf: text("uf"),
    /** Alíquota de ISS do município, em pontos-base (500 = 5,00 %). */
    issBps: integer("iss_bps").notNull().default(500),
    logoUrl: text("logo_url"),
    /** Cor de marca em hexadecimal, usada nos tokens do tema. */
    brandColor: text("brand_color").notNull().default("#2f6fd0"),
    /** Nº de lavagens que dá direito a prémio. 0 desliga a fidelização. */
    loyaltyThreshold: integer("loyalty_threshold").notNull().default(10),
    /** Desconto do prémio, em percentagem. 100 = lavagem grátis. */
    loyaltyRewardPercent: integer("loyalty_reward_percent").notNull().default(100),
    /** Dias sem visita a partir dos quais o cliente entra nos lembretes. */
    reminderAfterDays: integer("reminder_after_days").notNull().default(30),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("companies_cnpj_key").on(t.cnpj)],
)

// --- Utilizadores, papéis e permissões (RBAC) --------------------------------

/**
 * Catálogo de permissões. As chaves vivem em lib/auth/permissions.ts e são
 * semeadas aqui: a base de dados é a fonte para a auditoria, o código é a
 * fonte para o TypeScript.
 */
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
})

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    /** Chave estável: `admin`, `gerente`, `rececionista`, `lavador`, `detailer`. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Papéis de sistema não podem ser eliminados nem despromovidos. */
    system: boolean("system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roles_company_key").on(t.companyId, t.key)],
)

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id").notNull(),
    permissionKey: text("permission_key").notNull(),
  },
  (t) => [
    uniqueIndex("role_permissions_key").on(t.roleId, t.permissionKey),
    index("role_permissions_role_idx").on(t.roleId),
  ],
)

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    roleId: integer("role_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** Argon2id/scrypt. Nunca a palavra-passe em claro. */
    passwordHash: text("password_hash").notNull(),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // O email identifica a conta em toda a plataforma, não só na empresa: sem
  // isto o mesmo email podia ter duas contas e o início de sessão ficava ambíguo.
  (t) => [uniqueIndex("users_email_key").on(t.email), index("users_company_idx").on(t.companyId)],
)

export const sessions = pgTable(
  "sessions",
  {
    /** Hash do token; o token em claro só existe na cookie do navegador. */
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
)

// --- Equipe ------------------------------------------------------------------

/**
 * Colaborador que trabalha no lava jato. Separado de `users`: nem todo lavador
 * tem conta no sistema, e nem toda conta executa serviço. Quem tem os dois
 * lados é ligado por `userId`.
 */
export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    /** Vínculo com a conta de acesso, quando o colaborador também usa o sistema. */
    userId: integer("user_id"),

    // --- Dados pessoais ---
    name: text("name").notNull(),
    /** CPF, só dígitos. */
    cpf: text("cpf"),
    rg: text("rg"),
    birthDate: date("birth_date"),
    /** E.164: `+55DDNNNNNNNNN`. */
    phone: text("phone"),
    email: text("email"),
    cep: text("cep"),
    street: text("street"),
    streetNumber: text("street_number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    uf: text("uf"),

    // --- Pagamento ---
    /** Chave PIX para o depósito do salário. */
    pixKey: text("pix_key"),
    pixKind: pixKeyKind("pix_kind"),
    bankName: text("bank_name"),
    bankBranch: text("bank_branch"),
    bankAccount: text("bank_account"),
    bankAccountType: bankAccountKind("bank_account_type"),

    // --- Dados profissionais ---
    jobTitle: jobTitle("job_title").notNull().default("lavador"),
    contractType: contractType("contract_type").notNull().default("clt"),
    status: staffStatus("status").notNull().default("ativo"),
    hiredAt: date("hired_at"),
    terminatedAt: date("terminated_at"),

    // --- Regras financeiras ---
    /** Salário base mensal em centavos. Zero para quem só ganha comissão. */
    baseSalaryCents: integer("base_salary_cents").notNull().default(0),
    commissionKind: commissionKind("commission_kind").notNull().default("nenhuma"),
    /** Comissão percentual padrão, em pontos-base (1250 = 12,50 %). */
    commissionBps: integer("commission_bps").notNull().default(0),
    /** Valor fixo por serviço executado, em centavos. */
    commissionFixedCents: integer("commission_fixed_cents").notNull().default(0),

    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_company_idx").on(t.companyId),
    // O CPF identifica a pessoa dentro da empresa: bloqueia o cadastro em
    // duplicidade, que faria a folha pagar duas vezes ao mesmo colaborador.
    uniqueIndex("staff_company_cpf_key").on(t.companyId, t.cpf),
  ],
)

/**
 * Comissão diferente por categoria de serviço — 5 % na lavagem completa,
 * 15 % na vitrificação. Vence a comissão do serviço e a padrão do colaborador.
 */
export const staffCommissionRules = pgTable(
  "staff_commission_rules",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    staffId: integer("staff_id").notNull(),
    /** Nulo = regra para qualquer categoria; preenchido = só para aquela. */
    serviceCategoryId: integer("service_category_id"),
    kind: commissionKind("kind").notNull().default("percentual"),
    bps: integer("bps").notNull().default(0),
    fixedCents: integer("fixed_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_commission_rules_key").on(t.staffId, t.serviceCategoryId)],
)

// --- Clientes e viaturas -----------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    /** E.164: `+55DDNNNNNNNNN`. */
    phone: text("phone"),
    email: text("email"),
    /** CPF ou CNPJ, só dígitos. Necessário para nota com o documento. */
    document: text("document"),
    cep: text("cep"),
    street: text("street"),
    streetNumber: text("street_number"),
    district: text("district"),
    city: text("city"),
    uf: text("uf"),
    segment: customerSegment("segment").notNull().default("ocasional"),
    /** Carimbos acumulados no cartão de fidelidade. */
    loyaltyStamps: integer("loyalty_stamps").notNull().default(0),
    /** Preenchido na entrega de cada ordem; alimenta os lembretes de retorno. */
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customers_company_name_idx").on(t.companyId, t.name),
    index("customers_company_phone_idx").on(t.companyId, t.phone),
  ],
)

export const vehicles = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    customerId: integer("customer_id").notNull(),
    /** Placa sem hífen e em maiúsculas: `ABC1D23`. */
    plate: text("plate").notNull(),
    brand: text("brand"),
    model: text("model"),
    color: text("color"),
    category: vehicleCategory("category").notNull().default("hatch"),
    year: integer("year"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Única dentro da empresa, não da plataforma: dois lava jatos diferentes
  // atendem legitimamente o mesmo veículo.
  (t) => [
    uniqueIndex("vehicles_company_plate_key").on(t.companyId, t.plate),
    index("vehicles_customer_idx").on(t.customerId),
  ],
)

// --- Inspeção de entrada -----------------------------------------------------

/**
 * Estado do veículo no momento em que entra. É o que protege o lava jato de
 * uma reclamação por um risco que já estava lá.
 */
export const vehicleInspections = pgTable(
  "vehicle_inspections",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    workOrderId: integer("work_order_id").notNull(),
    vehicleId: integer("vehicle_id").notNull(),
    /** Quilómetros no conta-quilómetros, quando registados. */
    odometerKm: integer("odometer_km"),
    fuelLevelPercent: integer("fuel_level_percent"),
    /** Objetos pessoais deixados no interior. */
    personalItems: text("personal_items"),
    notes: text("notes"),
    /** Assinatura do cliente em data URL, ou confirmação verbal registada. */
    signatureDataUrl: text("signature_data_url"),
    signedByName: text("signed_by_name"),
    inspectedByStaffId: integer("inspected_by_staff_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vehicle_inspections_order_key").on(t.workOrderId)],
)

export const inspectionDamages = pgTable(
  "inspection_damages",
  {
    id: serial("id").primaryKey(),
    inspectionId: integer("inspection_id").notNull(),
    kind: inspectionDamageKind("kind").notNull(),
    /** Zona da viatura: `frente`, `porta_esq`, `capot`, … */
    area: text("area").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inspection_damages_inspection_idx").on(t.inspectionId)],
)

export const inspectionPhotos = pgTable(
  "inspection_photos",
  {
    id: serial("id").primaryKey(),
    inspectionId: integer("inspection_id").notNull(),
    url: text("url").notNull(),
    caption: text("caption"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inspection_photos_inspection_idx").on(t.inspectionId)],
)

// --- Pistas / boxes ----------------------------------------------------------

export const washBays = pgTable(
  "wash_bays",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    status: bayStatus("status").notNull().default("livre"),
    /** Ordem de apresentação no monitor de pistas. */
    position: integer("position").notNull().default(0),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wash_bays_company_name_key").on(t.companyId, t.name)],
)

// --- Catálogo de serviços ----------------------------------------------------

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("service_categories_company_name_key").on(t.companyId, t.name)],
)

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    categoryId: integer("category_id"),
    name: text("name").notNull(),
    description: text("description"),
    /** Um pacote agrupa vários serviços num preço só (Lavagem Completa). */
    isPackage: boolean("is_package").notNull().default(false),
    /** Preço em centavos, para o porte médio (hatch). */
    basePriceCents: integer("base_price_cents").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    /**
     * Comissão do serviço em pontos-base. Vence a comissão padrão do
     * colaborador, e perde para uma regra por categoria do próprio colaborador.
     */
    commissionBps: integer("commission_bps").notNull().default(0),
    /** Uma lavagem conta carimbo no cartão de fidelidade; um polimento não. */
    countsForLoyalty: boolean("counts_for_loyalty").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("services_company_name_key").on(t.companyId, t.name)],
)

/**
 * Preço por tipologia de viatura. Só existe linha onde o preço difere do
 * `basePriceCents`; a ausência de linha significa "usa o preço-base".
 */
export const servicePrices = pgTable(
  "service_prices",
  {
    id: serial("id").primaryKey(),
    serviceId: integer("service_id").notNull(),
    category: vehicleCategory("category").notNull(),
    priceCents: integer("price_cents").notNull(),
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [uniqueIndex("service_prices_service_category_key").on(t.serviceId, t.category)],
)

/** Serviços que compõem um pacote. */
export const packageItems = pgTable(
  "package_items",
  {
    packageId: integer("package_id").notNull(),
    serviceId: integer("service_id").notNull(),
  },
  (t) => [uniqueIndex("package_items_key").on(t.packageId, t.serviceId)],
)

// --- Agenda e fila de espera -------------------------------------------------

/**
 * Marcações e chegadas. Uma marcação nasce aqui e dá origem a uma ficha de
 * trabalho quando a viatura chega; um walk-in cria as duas ao mesmo tempo.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    customerId: integer("customer_id"),
    vehicleId: integer("vehicle_id"),
    arrival: arrivalType("arrival").notNull().default("agendado"),
    /** Instante marcado; num walk-in é a hora de chegada. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull().default(30),
    bayId: integer("bay_id"),
    workOrderId: integer("work_order_id"),
    /** Posição na fila de espera; nulo quando já entrou em pista. */
    queuePosition: integer("queue_position"),
    notes: text("notes"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointments_company_scheduled_idx").on(t.companyId, t.scheduledFor)],
)

// --- Ficha de trabalho -------------------------------------------------------

export const workOrders = pgTable(
  "work_orders",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    /** Número sequencial por empresa, mostrado ao cliente: OS 2026/0142. */
    reference: text("reference").notNull(),
    customerId: integer("customer_id").notNull(),
    vehicleId: integer("vehicle_id").notNull(),
    bayId: integer("bay_id"),
    assignedStaffId: integer("assigned_staff_id"),
    createdByUserId: integer("created_by_user_id"),
    status: workOrderStatus("status").notNull().default("em_fila"),
    arrival: arrivalType("arrival").notNull().default("walk_in"),
    /** Data de competência: é por ela que a faturação e os relatórios agrupam. */
    businessDate: date("business_date").notNull(),

    // Totais gravados, não somados na leitura: o preço do item é uma fotografia
    // do momento da venda, e um mês fechado não pode mudar por causa de um
    // reajuste de tabela feito hoje. Tudo em cêntimos, com IVA incluído.
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    /** ISS embutido no total, gravado com a alíquota vigente na venda. */
    issCents: integer("iss_cents").notNull().default(0),

    /** Prémio de fidelidade aplicado nesta ficha, se houve. */
    loyaltyRewardApplied: boolean("loyalty_reward_applied").notNull().default(false),

    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    customerNotifiedAt: timestamp("customer_notified_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("work_orders_company_reference_key").on(t.companyId, t.reference),
    index("work_orders_company_date_idx").on(t.companyId, t.businessDate),
    index("work_orders_company_status_idx").on(t.companyId, t.status),
    index("work_orders_customer_idx").on(t.customerId),
  ],
)

export const workOrderItems = pgTable(
  "work_order_items",
  {
    id: serial("id").primaryKey(),
    workOrderId: integer("work_order_id").notNull(),
    /** Nulo num item avulso descrito à mão no balcão. */
    serviceId: integer("service_id"),
    /** Cópia do nome no momento da venda. */
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    /** Preço unitário em centavos. */
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    /** Cópia da regra de comissão vigente na venda. */
    commissionBps: integer("commission_bps").notNull().default(0),
    commissionFixedCents: integer("commission_fixed_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_order_items_order_idx").on(t.workOrderId)],
)

// --- Consumíveis -------------------------------------------------------------

export const inventoryProducts = pgTable(
  "inventory_products",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    /** `champo`, `cera`, `limpa_jantes`, `microfibra`, `filtro`, … */
    kind: text("kind").notNull().default("quimico"),
    /** Unidade de medida: `L`, `ml`, `kg`, `un`. */
    unit: text("unit").notNull().default("un"),
    /** Quantidade em stock, na unidade acima e em milésimos para aceitar 0,5 L. */
    stockMilli: integer("stock_milli").notNull().default(0),
    /** Abaixo deste valor a aplicação avisa. */
    minStockMilli: integer("min_stock_milli").notNull().default(0),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    supplier: text("supplier"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inventory_products_company_name_key").on(t.companyId, t.name)],
)

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    productId: integer("product_id").notNull(),
    kind: stockMovementKind("kind").notNull(),
    /** Positivo em entradas, negativo em consumos. Em milésimos da unidade. */
    quantityMilli: integer("quantity_milli").notNull(),
    workOrderId: integer("work_order_id"),
    userId: integer("user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
)

/** Consumo estimado de um produto por serviço, para descontar stock. */
export const serviceConsumables = pgTable(
  "service_consumables",
  {
    serviceId: integer("service_id").notNull(),
    productId: integer("product_id").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
  },
  (t) => [uniqueIndex("service_consumables_key").on(t.serviceId, t.productId)],
)

// --- Pagamentos --------------------------------------------------------------

/**
 * Um recebimento. Uma ficha pode ter mais de um (metade em MB WAY, metade em
 * dinheiro), por isso o pagamento não é uma coluna da ficha.
 */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    workOrderId: integer("work_order_id").notNull(),
    method: paymentMethod("method").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** Referência Multibanco, ID de transação MB WAY, últimos dígitos do cartão. */
    reference: text("reference"),
    receivedByUserId: integer("received_by_user_id"),
    /** Preenchido quando o recebimento é anulado; a linha nunca se apaga. */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_order_idx").on(t.workOrderId),
    index("payments_company_created_idx").on(t.companyId, t.createdAt),
  ],
)

// --- Fidelização -------------------------------------------------------------

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    customerId: integer("customer_id").notNull(),
    workOrderId: integer("work_order_id"),
    kind: loyaltyKind("kind").notNull(),
    /** Positivo ao carimbar, negativo ao resgatar. */
    stamps: integer("stamps").notNull(),
    /** Saldo do cartão depois desta linha, para auditar sem recalcular tudo. */
    balanceAfter: integer("balance_after").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loyalty_transactions_customer_idx").on(t.customerId)],
)

// --- Auditoria ---------------------------------------------------------------

/**
 * Quem mudou o quê. Escrito por toda a ação que altera dinheiro, estado de
 * ficha, stock ou permissões.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    userId: integer("user_id"),
    /** `work_order.status_changed`, `payment.voided`, `user.role_changed`, … */
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    /** Estado antes e depois, em JSON, só com os campos que mudaram. */
    before: text("before"),
    after: text("after"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_company_created_idx").on(t.companyId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
  ],
)

// --- Comissões ---------------------------------------------------------------

/**
 * Comissão creditada ao colaborador. Nasce quando a ordem de serviço é
 * concluída **e quitada** — comissão sobre serviço não pago é dívida do
 * cliente, não ganho do lavador.
 *
 * Cada linha guarda a regra que valeu na hora (`bps` ou `fixedCents`), e não
 * uma referência à regra atual: reajustar a comissão hoje não pode reescrever
 * o que já foi apurado num mês fechado.
 */
export const commissionEntries = pgTable(
  "commission_entries",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    staffId: integer("staff_id").notNull(),
    workOrderId: integer("work_order_id").notNull(),
    workOrderItemId: integer("work_order_item_id"),
    /** Descrição do serviço, copiada para o extrato do colaborador. */
    description: text("description").notNull(),
    /** Valor do serviço sobre o qual a comissão incidiu, em centavos. */
    baseCents: integer("base_cents").notNull().default(0),
    kind: commissionKind("kind").notNull().default("percentual"),
    bps: integer("bps").notNull().default(0),
    fixedCents: integer("fixed_cents").notNull().default(0),
    /** O que o colaborador ganhou nesta linha, em centavos. */
    amountCents: integer("amount_cents").notNull().default(0),
    /** Mês de competência `AAAA-MM`: define em qual folha a comissão entra. */
    competenceMonth: text("competence_month").notNull(),
    /** Preenchido quando o pagamento da OS é estornado; a linha nunca some. */
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reverseReason: text("reverse_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("commission_entries_staff_month_idx").on(t.staffId, t.competenceMonth),
    index("commission_entries_order_idx").on(t.workOrderId),
    // Um item de OS gera no máximo uma comissão: sem isto, reprocessar a
    // quitação creditaria o lavador duas vezes pelo mesmo serviço.
    uniqueIndex("commission_entries_item_key").on(t.workOrderItemId),
  ],
)

// --- Vales / adiantamentos ---------------------------------------------------

/**
 * Adiantamento salarial entregue ao colaborador, a ser descontado da folha.
 *
 * O valor é uma dívida do funcionário com a empresa até ser totalmente
 * abatido. O saldo devedor é sempre `amountCents` menos a soma dos
 * `advanceDeductions` — nunca um campo guardado à parte, que sairia do lugar
 * no primeiro estorno.
 */
export const employeeAdvances = pgTable(
  "employee_advances",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    staffId: integer("staff_id").notNull(),

    /** Valor total concedido, em centavos. */
    amountCents: integer("amount_cents").notNull(),
    requestedOn: date("requested_on").notNull(),
    /** Quando o dinheiro saiu para o funcionário. Nulo = ainda não entregue. */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: paymentMethod("payment_method"),
    /** Comprovante, ID da transação PIX, número do recibo. */
    receiptRef: text("receipt_ref"),

    /** Em quantas folhas será abatido. 1 = desconto único na próxima. */
    installments: integer("installments").notNull().default(1),
    /** Primeira folha que desconta, `AAAA-MM`. */
    firstDeductionMonth: text("first_deduction_month").notNull(),

    status: advanceStatus("status").notNull().default("pendente"),
    notes: text("notes"),
    createdByUserId: integer("created_by_user_id"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("employee_advances_staff_idx").on(t.staffId),
    index("employee_advances_company_status_idx").on(t.companyId, t.status),
  ],
)

/** Cada parcela de um vale efetivamente descontada numa folha. */
export const advanceDeductions = pgTable(
  "advance_deductions",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    advanceId: integer("advance_id").notNull(),
    staffId: integer("staff_id").notNull(),
    payrollEntryId: integer("payroll_entry_id"),
    competenceMonth: text("competence_month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("advance_deductions_advance_idx").on(t.advanceId),
    // Um vale desconta no máximo uma vez por folha; reabrir e refechar a folha
    // não pode cobrar a mesma parcela duas vezes.
    uniqueIndex("advance_deductions_advance_month_key").on(t.advanceId, t.competenceMonth),
  ],
)

// --- Folha de pagamento ------------------------------------------------------

export const payrollPeriods = pgTable(
  "payroll_periods",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    /** Competência `AAAA-MM`. */
    competenceMonth: text("competence_month").notNull(),
    status: payrollStatus("status").notNull().default("aberta"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: integer("closed_by_user_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payroll_periods_company_month_key").on(t.companyId, t.competenceMonth)],
)

/**
 * Uma linha por colaborador na folha do mês, com os valores **congelados** no
 * fechamento. Recalcular ao abrir a tela faria o holerite de março mudar
 * quando alguém corrigisse um preço em abril.
 */
export const payrollEntries = pgTable(
  "payroll_entries",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    payrollPeriodId: integer("payroll_period_id").notNull(),
    staffId: integer("staff_id").notNull(),

    // Proventos
    baseSalaryCents: integer("base_salary_cents").notNull().default(0),
    commissionCents: integer("commission_cents").notNull().default(0),
    bonusCents: integer("bonus_cents").notNull().default(0),
    otherEarningsCents: integer("other_earnings_cents").notNull().default(0),

    // Descontos
    advanceDeductionCents: integer("advance_deduction_cents").notNull().default(0),
    otherDeductionCents: integer("other_deduction_cents").notNull().default(0),

    /** Proventos menos descontos. Nunca negativo — ver lib/payroll/calc.ts. */
    netCents: integer("net_cents").notNull().default(0),

    /** Quantos serviços o colaborador executou no mês, para conferência. */
    servicesCount: integer("services_count").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payroll_entries_period_staff_key").on(t.payrollPeriodId, t.staffId),
    index("payroll_entries_staff_idx").on(t.staffId),
  ],
)
