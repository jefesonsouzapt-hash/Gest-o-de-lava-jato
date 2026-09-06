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
// 1. **Dinheiro em cêntimos inteiros.** Nunca `numeric` nem `real`. Ver
//    lib/locale/money.ts.
// 2. **Multi-empresa.** Cada tabela de negócio traz `companyId`. Todas as
//    consultas filtram por ele — é a fronteira entre clientes do SaaS, e
//    esquecê-lo expõe dados de um lava jato a outro.
// 3. **Nada se apaga.** Registos com histórico ficam inativos (`active`,
//    `archivedAt`); apagar reescreveria faturação já emitida.
// 4. Identificadores portugueses (NIF, matrícula, telemóvel) são guardados
//    normalizados — sem espaços nem hífenes — para a pesquisa comparar.

// --- Enumerações -------------------------------------------------------------

/** Estados por que passa uma viatura, da marcação à entrega. */
export const workOrderStatus = pgEnum("work_order_status", [
  "aguarda_chegada", // agendada, ainda não chegou
  "em_fila", // chegou; receção feita, à espera de pista
  "em_lavagem", // em pista: exterior / chassi
  "acabamento", // secagem e interior
  "detalhe", // polimento, estofos e outros serviços especiais
  "controlo_qualidade",
  "pronta_recolha", // cliente avisado
  "entregue",
  "cancelada",
])

/** Como a viatura chegou. */
export const arrivalType = pgEnum("arrival_type", ["agendado", "walk_in"])

/** Tipologia da viatura: governa o preço do serviço. */
export const vehicleCategory = pgEnum("vehicle_category", [
  "ligeiro_pequeno",
  "ligeiro_medio",
  "suv", // SUV / monovolume
  "comercial", // todo-o-terreno / carrinha comercial
  "moto",
])

/** Meios de pagamento em uso em Portugal. */
export const paymentMethod = pgEnum("payment_method", [
  "mbway",
  "multibanco",
  "transferencia",
  "dinheiro",
  "cartao",
])

export const bayStatus = pgEnum("bay_status", ["livre", "ocupada", "manutencao"])

export const customerSegment = pgEnum("customer_segment", ["ocasional", "regular", "vip", "frota"])

export const inspectionDamageKind = pgEnum("inspection_damage_kind", [
  "risco",
  "amolgadela",
  "vidro_partido",
  "pintura",
  "jante",
  "outro",
])

export const loyaltyKind = pgEnum("loyalty_kind", ["carimbo", "resgate", "ajuste"])

export const stockMovementKind = pgEnum("stock_movement_kind", ["entrada", "consumo", "quebra", "ajuste"])

// --- Empresa -----------------------------------------------------------------

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** NIF da empresa, só dígitos. */
    nif: text("nif"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    postalCode: text("postal_code"),
    locality: text("locality"),
    municipality: text("municipality"),
    district: text("district"),
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
  (t) => [uniqueIndex("companies_nif_key").on(t.nif)],
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

// --- Equipa ------------------------------------------------------------------

/**
 * Colaborador que executa serviço. Separado de `users`: nem todo o lavador
 * tem conta na aplicação, e nem toda a conta executa lavagens.
 */
export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    /** Ligação opcional à conta, quando o colaborador também usa o sistema. */
    userId: integer("user_id"),
    name: text("name").notNull(),
    /** `lavador` | `detailer` | `rececionista` | `gerente`. */
    jobTitle: text("job_title").notNull().default("lavador"),
    phone: text("phone"),
    /** Comissão padrão em pontos de base (1250 = 12,50 %). */
    commissionBps: integer("commission_bps").notNull().default(0),
    active: boolean("active").notNull().default(true),
    hiredAt: date("hired_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_company_idx").on(t.companyId)],
)

// --- Clientes e viaturas -----------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    /** E.164: `+3519XXXXXXXX`. */
    phone: text("phone"),
    email: text("email"),
    /** NIF, só dígitos. Necessário para faturação com contribuinte. */
    nif: text("nif"),
    address: text("address"),
    postalCode: text("postal_code"),
    locality: text("locality"),
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
    /** Matrícula sem hífenes e em maiúsculas: `AA00AA`. */
    plate: text("plate").notNull(),
    brand: text("brand"),
    model: text("model"),
    color: text("color"),
    category: vehicleCategory("category").notNull().default("ligeiro_medio"),
    year: integer("year"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Única dentro da empresa, não da plataforma: dois lava jatos diferentes
  // atendem legitimamente a mesma viatura.
  (t) => [
    uniqueIndex("vehicles_company_plate_key").on(t.companyId, t.plate),
    index("vehicles_customer_idx").on(t.customerId),
  ],
)

// --- Inspeção de entrada -----------------------------------------------------

/**
 * Estado da viatura no momento em que entra. É o que protege o lava jato de
 * uma reclamação por um risco que já lá estava.
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
    /** Preço-base com IVA incluído, em cêntimos, para a tipologia média. */
    basePriceCents: integer("base_price_cents").notNull().default(0),
    /** Taxa de IVA em percentagem: 23, 13 ou 6. */
    vatRate: integer("vat_rate").notNull().default(23),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    /** Comissão em pontos de base. Vence a comissão padrão do colaborador. */
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
    /** Parcela de IVA contida no total. */
    vatCents: integer("vat_cents").notNull().default(0),

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
    /** Preço unitário com IVA incluído, em cêntimos. */
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    vatRate: integer("vat_rate").notNull().default(23),
    commissionBps: integer("commission_bps").notNull().default(0),
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
