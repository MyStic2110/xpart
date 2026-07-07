import { pgTable, uuid, text, jsonb, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const connectorStatusEnum = pgEnum("connector_status", ["active", "inactive"]);

// One row per (org, provider) connection. config holds the provider's
// credentials/settings as JSON; it is never returned to the client in full —
// only masked previews + connection status are exposed via the API.
export const connectors = pgTable(
  "connectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // matches a key in the provider registry
    status: connectorStatusEnum("status").notNull().default("active"),
    config: jsonb("config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.provider)]
);
