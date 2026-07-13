import { pgTable, uuid, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { vendors } from "./inventory";

export interface RfqItem {
  partName: string;
  qty: string;
  oemNumber?: string;
  preferredBrand?: string;
}

export const partsRequests = pgTable("parts_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  vehicleInfo: text("vehicle_info").notNull(),
  partName: text("part_name").notNull(),
  oemNumber: text("oem_number"),
  qty: integer("qty").notNull().default(1),
  urgency: text("urgency").notNull(), // immediate | today | week
  deliveryLocation: text("delivery_location").notNull(),
  preferredBrand: text("preferred_brand"),
  maxBudget: integer("max_budget"), // in paise
  status: text("status").notNull().default("broadcasted"), // broadcasted | quotes_received | selected | completed | cancelled
  isEmergency: boolean("is_emergency").notNull().default(false),
  broadcastWhatsApp: boolean("broadcast_whatsapp").notNull().default(false),
  searchRadiusKm: integer("search_radius_km").notNull().default(10),
  items: jsonb("items").$type<RfqItem[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const partsQuotes = pgTable("parts_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").notNull().references(() => partsRequests.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  isAvailable: boolean("is_available").notNull().default(true),
  brand: text("brand").notNull(),
  price: integer("price").notNull(), // in paise
  deliveryTime: text("delivery_time").notNull(), // e.g., "45 mins", "2 hrs"
  warranty: text("warranty"),
  contactDetails: text("contact_details"),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
