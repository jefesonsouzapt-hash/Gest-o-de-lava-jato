CREATE TYPE "public"."arrival_type" AS ENUM('agendado', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."bay_status" AS ENUM('livre', 'ocupada', 'manutencao');--> statement-breakpoint
CREATE TYPE "public"."customer_segment" AS ENUM('ocasional', 'regular', 'vip', 'frota');--> statement-breakpoint
CREATE TYPE "public"."inspection_damage_kind" AS ENUM('risco', 'amolgadela', 'vidro_partido', 'pintura', 'jante', 'outro');--> statement-breakpoint
CREATE TYPE "public"."loyalty_kind" AS ENUM('carimbo', 'resgate', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mbway', 'multibanco', 'transferencia', 'dinheiro', 'cartao');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_kind" AS ENUM('entrada', 'consumo', 'quebra', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."vehicle_category" AS ENUM('ligeiro_pequeno', 'ligeiro_medio', 'suv', 'comercial', 'moto');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('aguarda_chegada', 'em_fila', 'em_lavagem', 'acabamento', 'detalhe', 'controlo_qualidade', 'pronta_recolha', 'entregue', 'cancelada');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer,
	"vehicle_id" integer,
	"arrival" "arrival_type" DEFAULT 'agendado' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"estimated_minutes" integer DEFAULT 30 NOT NULL,
	"bay_id" integer,
	"work_order_id" integer,
	"queue_position" integer,
	"notes" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" text,
	"after" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nif" text,
	"phone" text,
	"email" text,
	"address" text,
	"postal_code" text,
	"locality" text,
	"municipality" text,
	"district" text,
	"logo_url" text,
	"brand_color" text DEFAULT '#2f6fd0' NOT NULL,
	"loyalty_threshold" integer DEFAULT 10 NOT NULL,
	"loyalty_reward_percent" integer DEFAULT 100 NOT NULL,
	"reminder_after_days" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"nif" text,
	"address" text,
	"postal_code" text,
	"locality" text,
	"segment" "customer_segment" DEFAULT 'ocasional' NOT NULL,
	"loyalty_stamps" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp with time zone,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_damages" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" integer NOT NULL,
	"kind" "inspection_damage_kind" NOT NULL,
	"area" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'quimico' NOT NULL,
	"unit" text DEFAULT 'un' NOT NULL,
	"stock_milli" integer DEFAULT 0 NOT NULL,
	"min_stock_milli" integer DEFAULT 0 NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"supplier" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"work_order_id" integer,
	"kind" "loyalty_kind" NOT NULL,
	"stamps" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_items" (
	"package_id" integer NOT NULL,
	"service_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"work_order_id" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" text,
	"received_by_user_id" integer,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_consumables" (
	"service_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_milli" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category_id" integer,
	"name" text NOT NULL,
	"description" text,
	"is_package" boolean DEFAULT false NOT NULL,
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 23 NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"commission_bps" integer DEFAULT 0 NOT NULL,
	"counts_for_loyalty" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"job_title" text DEFAULT 'lavador' NOT NULL,
	"phone" text,
	"commission_bps" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hired_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"kind" "stock_movement_kind" NOT NULL,
	"quantity_milli" integer NOT NULL,
	"work_order_id" integer,
	"user_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"work_order_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"odometer_km" integer,
	"fuel_level_percent" integer,
	"personal_items" text,
	"notes" text,
	"signature_data_url" text,
	"signed_by_name" text,
	"inspected_by_staff_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"plate" text NOT NULL,
	"brand" text,
	"model" text,
	"color" text,
	"category" "vehicle_category" DEFAULT 'ligeiro_medio' NOT NULL,
	"year" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wash_bays" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" "bay_status" DEFAULT 'livre' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_id" integer NOT NULL,
	"service_id" integer,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 23 NOT NULL,
	"commission_bps" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"reference" text NOT NULL,
	"customer_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"bay_id" integer,
	"assigned_staff_id" integer,
	"created_by_user_id" integer,
	"status" "work_order_status" DEFAULT 'em_fila' NOT NULL,
	"arrival" "arrival_type" DEFAULT 'walk_in' NOT NULL,
	"business_date" date NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"loyalty_reward_applied" boolean DEFAULT false NOT NULL,
	"arrived_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"customer_notified_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "appointments_company_scheduled_idx" ON "appointments" USING btree ("company_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "audit_logs_company_created_idx" ON "audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_nif_key" ON "companies" USING btree ("nif");--> statement-breakpoint
CREATE INDEX "customers_company_name_idx" ON "customers" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "customers_company_phone_idx" ON "customers" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "inspection_damages_inspection_idx" ON "inspection_damages" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_inspection_idx" ON "inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_products_company_name_key" ON "inventory_products" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_customer_idx" ON "loyalty_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "package_items_key" ON "package_items" USING btree ("package_id","service_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "payments_company_created_idx" ON "payments" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_key" ON "role_permissions" USING btree ("role_id","permission_key");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_key" ON "roles" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_company_name_key" ON "service_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_consumables_key" ON "service_consumables" USING btree ("service_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_prices_service_category_key" ON "service_prices" USING btree ("service_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "services_company_name_key" ON "services" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_company_idx" ON "staff" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_inspections_order_key" ON "vehicle_inspections" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_company_plate_key" ON "vehicles" USING btree ("company_id","plate");--> statement-breakpoint
CREATE INDEX "vehicles_customer_idx" ON "vehicles" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wash_bays_company_name_key" ON "wash_bays" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "work_order_items_order_idx" ON "work_order_items" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_company_reference_key" ON "work_orders" USING btree ("company_id","reference");--> statement-breakpoint
CREATE INDEX "work_orders_company_date_idx" ON "work_orders" USING btree ("company_id","business_date");--> statement-breakpoint
CREATE INDEX "work_orders_company_status_idx" ON "work_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "work_orders_customer_idx" ON "work_orders" USING btree ("customer_id");