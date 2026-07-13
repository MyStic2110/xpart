import { pgTable, uuid, text, integer, numeric, date, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { products } from "./products";
import { vehicles } from "./client";
import { jobCards } from "./jobcard";

export const inventorySourceEnum = pgEnum("inventory_source", ["vendor", "client", "mechanic", "unknown"]);

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactNumber: text("contact_number").notNull(),
  email: text("email"),
  address: text("address"),
  gstNumber: text("gst_number"),
  yearsInBusiness: integer("years_in_business"),
  rating: numeric("rating").default("4.5"),
  genuineCertification: boolean("genuine_certification").default(true),
  returnPolicy: text("return_policy"),
  specialization: text("specialization"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  googleMapsUrl: text("google_maps_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A purchase batch — who it was bought from, the supplier invoice, and whether
// it was bought on credit (amount still owed).
export const inventoryLots = pgTable("inventory_lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
  lotNo: text("lot_no").notNull(),
  sourceType: inventorySourceEnum("source_type").notNull().default("unknown"),
  sourceName: text("source_name"), // vendor / client / mechanic name
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }), // Link to structured vendor
  invoiceNo: text("invoice_no"), // supplier purchase invoice reference
  purchaseDate: date("purchase_date"),
  isCredit: boolean("is_credit").notNull().default(false),
  totalAmount: integer("total_amount").notNull().default(0), // paise
  amountPaid: integer("amount_paid").notNull().default(0), // paise; outstanding = total - paid
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Stock of a specific product within a lot, with its own expiry.
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  lotId: uuid("lot_id").notNull().references(() => inventoryLots.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  productName: text("product_name").notNull(), // snapshot, in case product master changes
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unit: text("unit"), // L | Pcs | Pkt
  purchasePrice: integer("purchase_price").notNull().default(0), // Cost price (paise)
  salePrice: integer("sale_price").notNull().default(0), // Selling price to client (paise)
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }), // Associated vehicle
  jobCardId: uuid("job_card_id").references(() => jobCards.id, { onDelete: "set null" }), // Linked job card
  vendorAmountPaid: integer("vendor_amount_paid").notNull().default(0), // Amount paid to vendor for this item (paise)
  vendorPaidStatus: text("vendor_paid_status").notNull().default("n_a"), // 'unpaid' | 'paid' | 'n_a' (not credit)
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryConsumptions = pgTable("inventory_consumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  consumedBy: uuid("consumed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

