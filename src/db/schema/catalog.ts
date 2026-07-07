import { pgTable, uuid, text, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultPrice: integer("default_price").notNull(), // paise
    recurrenceDays: integer("recurrence_days"), // e.g. 30 for a wash, null = not a recurring service
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.name)]
);

// orgId NULL = global/system catalog shared by every org (seeded once).
// orgId set = a custom make/model an org added for itself on top of the shared catalog.
export const vehicleMakes = pgTable("vehicle_makes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vehicleModels = pgTable("vehicle_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  makeId: uuid("make_id").notNull().references(() => vehicleMakes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  segment: text("segment").notNull(), // Small | Medium | Large | XL / Premium | Super Bikes | Small Bike | All
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
