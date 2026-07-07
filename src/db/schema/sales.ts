import { pgTable, uuid, text, date, timestamp, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { clients, vehicles } from "./client";
import { services } from "./catalog";
import { users } from "./identity";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  serviceId: uuid("service_id").references(() => services.id),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"), // "10:30 AM"
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesActionStatusEnum = pgEnum("sales_action_status", [
  "pending", // due, not yet actioned
  "contacted", // called or messaged, awaiting outcome
  "appointment_booked",
  "rescheduled", // client asked to be followed up later
  "declined",
  "closed", // visit happened / action no longer needed
  "expired", // window passed without action
]);

// One row per (client, service) recurrence cycle. Generated automatically
// when a service with recurrenceDays is overdue for a client; the sales
// team works the queue and every outcome is logged here, not just the
// current status — this is the "detailed entry" / audit trail the owner asked for.
export const salesActions = pgTable(
  "sales_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    lastServiceDate: date("last_service_date").notNull(),
    dueDate: date("due_date").notNull(),
    potentialRevenue: integer("potential_revenue").notNull(), // paise, snapshot of service price
    status: salesActionStatusEnum("status").notNull().default("pending"),
    nextFollowUpDate: date("next_follow_up_date"),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    handledBy: uuid("handled_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // one open recurrence-tracking row per client+service+cycle
  (t) => [unique().on(t.clientId, t.serviceId, t.dueDate)]
);

export const salesActionLogs = pgTable("sales_action_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  salesActionId: uuid("sales_action_id").notNull().references(() => salesActions.id, { onDelete: "cascade" }),
  outcome: text("outcome").notNull(), // free text: "called - confirmed for Friday", "whatsapp sent", etc.
  byUserId: uuid("by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
