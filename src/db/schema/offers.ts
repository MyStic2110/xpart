import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  discountType: text("discount_type").notNull(), // flat | percentage
  value: integer("value").notNull(), // paise or percentage value
  maxDiscount: integer("max_discount").notNull().default(0), // paise, cap
  minBillingAmount: integer("min_billing_amount").notNull().default(0), // paise
  targetType: text("target_type").notNull().default("all"), // all | churn_risk | new_client | loyal_client
  isActive: boolean("is_active").notNull().default(true),
  restrictedDays: text("restricted_days").array(), // e.g. ["1", "2"] for Mon, Tue
  startTime: text("start_time"), // e.g. "09:00"
  endTime: text("end_time"), // e.g. "13:00"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

