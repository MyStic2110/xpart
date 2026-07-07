import { pgTable, uuid, text, timestamp, date, integer, numeric, pgEnum, unique } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";

export const roleEnum = pgEnum("role", [
  "super_admin",
  "org_owner",
  "admin",
  "branch_manager",
  "frontdesk",
  "mechanic",
  "viewer",
]);

export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "expired", "revoked"]);
export const genderEnum2 = pgEnum("staff_gender", ["male", "female"]);
export const staffCategoryEnum = pgEnum("staff_category", ["mechanic", "staff"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Extended profile captured by the "Add staff" / "Add mechanic" forms.
// One row per staffAssignment-backed user; mechanic-only fields stay null for staff.
export const staffProfiles = pgTable("staff_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  category: staffCategoryEnum("category").notNull(),
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum2("gender").notNull(),
  workingHoursStart: text("working_hours_start").notNull(), // "09:00 AM"
  workingHoursEnd: text("working_hours_end").notNull(), // "11:55 PM"
  monthlySalary: integer("monthly_salary").notNull(), // paise
  dateOfJoining: date("date_of_joining").notNull(),
  emergencyContactNumber: text("emergency_contact_number"),
  emergencyContactPerson: text("emergency_contact_person"),
  address: text("address"),
  idProofUrl: text("id_proof_url"),
  photoUrl: text("photo_url"),
  // mechanic-only
  mechanicType: text("mechanic_type"),
  serviceCommissionPct: numeric("service_commission_pct", { precision: 5, scale: 2 }),
  productCommissionPct: numeric("product_commission_pct", { precision: 5, scale: 2 }),
  // staff-only
  userType: text("user_type"), // e.g. admin
  department: text("department"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// branchId is NULL => org-wide scope (e.g. org_owner)
export const staffAssignments = pgTable(
  "staff_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.orgId, t.branchId, t.role)]
);

export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  phone: text("phone").notNull(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  invitedBy: uuid("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
