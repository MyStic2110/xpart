import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // enquiry | jobcard | payment | feedback | stock
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
