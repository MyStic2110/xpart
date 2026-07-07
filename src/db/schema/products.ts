import { pgTable, uuid, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mrp: integer("mrp").notNull().default(0), // paise
    volume: text("volume"), // "1 L", "1 Pcs", "1 Pkt"
    barcode: text("barcode"),
    category: text("category"),
    subCategory: text("sub_category"),
    sku: text("sku"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.name)]
);
