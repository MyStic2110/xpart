import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { clients, vehicles } from "./client";
import { jobCards } from "./jobcard";
import { offers } from "./offers";

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "paid", "partial", "cancelled"]);
export const paymentModeEnum = pgEnum("payment_mode", ["cash", "upi", "card", "wallet", "points"]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  jobCardId: uuid("job_card_id").notNull().references(() => jobCards.id).unique(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  appliedOfferId: uuid("applied_offer_id").references(() => offers.id),
  invoiceNo: text("invoice_no"), // sequential display invoice code, e.g. "0240/INV/26-27"
  subtotal: integer("subtotal").notNull(), // paise
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
}, (t) => [
  index("invoices_org_idx").on(t.orgId),
  index("invoices_branch_idx").on(t.branchId),
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  mode: paymentModeEnum("mode").notNull(),
  amount: integer("amount").notNull(),
  txnRef: text("txn_ref"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("payments_invoice_idx").on(t.invoiceId),
  index("payments_paid_at_idx").on(t.paidAt),
]);
