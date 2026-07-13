import { pgTable, uuid, text, date, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { clients, vehicles } from "./client";
import { users } from "./identity";
import { services } from "./catalog";
import { offers } from "./offers";
import { products } from "./products";
import { inventoryItems } from "./inventory";

export const jobCardStatusEnum = pgEnum("job_card_status", [
  "draft",
  "in_progress",
  "completed",
  "billed",
  "cancelled",
]);

export const jobCards = pgTable("job_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  appliedOfferId: uuid("applied_offer_id").references(() => offers.id),
  jobDate: date("job_date").notNull(),
  serviceAdvisorId: uuid("service_advisor_id").references(() => users.id),
  images: text("images").array(),
  subtotal: integer("subtotal").notNull().default(0), // paise
  discount: integer("discount").notNull().default(0), // paise
  taxPercent: integer("tax_percent").notNull().default(0), // 0 or 18
  total: integer("total").notNull().default(0), // paise
  status: jobCardStatusEnum("status").notNull().default("draft"),
  source: text("source").notNull().default("walkin"), // walkin | whatsapp | appointment | anpr
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("job_cards_org_idx").on(t.orgId),
  index("job_cards_branch_idx").on(t.branchId),
  index("job_cards_date_idx").on(t.jobDate),
]);

// many-to-many: a job card can have multiple mechanics (seen in real data)
export const jobCardMechanics = pgTable("job_card_mechanics", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobCardId: uuid("job_card_id").notNull().references(() => jobCards.id, { onDelete: "cascade" }),
  mechanicId: uuid("mechanic_id").notNull().references(() => users.id),
});

export const jobCardServices = pgTable("job_card_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobCardId: uuid("job_card_id").notNull().references(() => jobCards.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  qty: integer("qty").notNull().default(1),
  price: integer("price").notNull(), // paise, snapshot unit price at time of service
});

export const jobCardProducts = pgTable("job_card_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobCardId: uuid("job_card_id").notNull().references(() => jobCards.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  qty: integer("qty").notNull().default(1),
  price: integer("price").notNull(), // sale price snapshot (paise)
});

