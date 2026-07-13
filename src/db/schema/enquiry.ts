import { pgTable, uuid, text, integer, date, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { users } from "./identity";
import { vehicleMakes, vehicleModels } from "./catalog";

export const leadStatusEnum = pgEnum("lead_status", ["pending", "contacted", "follow_up", "converted", "lost"]);
export const enquiryChannelEnum = pgEnum("enquiry_channel", ["sms", "whatsapp"]);

export const enquiries = pgTable("enquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),

  contactNumber: text("contact_number").notNull(),
  clientName: text("client_name").notNull(),
  email: text("email"),
  address: text("address"),

  enquiryFor: text("enquiry_for").notNull(), // service / product / package the lead is interested in
  enquiryType: text("enquiry_type").notNull(), // New, Service, Sales, Membership, etc.
  response: text("response"),
  dateToFollow: date("date_to_follow").notNull(),
  sourceOfEnquiry: text("source_of_enquiry").notNull(), // walk-in, phone, whatsapp, google, referral...
  leadRepresentativeId: uuid("lead_representative_id").references(() => users.id),
  leadStatus: leadStatusEnum("lead_status").notNull().default("pending"),
  channel: enquiryChannelEnum("channel").notNull().default("sms"),

  vehicleNumber: text("vehicle_number"),
  makeId: uuid("make_id").references(() => vehicleMakes.id),
  modelId: uuid("model_id").references(() => vehicleModels.id),
  segment: text("segment"),
  year: integer("year"),
  color: text("color"),
  fuelType: text("fuel_type"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("enquiries_org_idx").on(t.orgId),
  index("enquiries_branch_idx").on(t.branchId),
  index("enquiries_created_idx").on(t.createdAt),
]);
