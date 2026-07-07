import { pgTable, uuid, text, timestamp, pgEnum, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const orgStatusEnum = pgEnum("org_status", ["trial", "active", "suspended", "cancelled"]);
export const branchStatusEnum = pgEnum("branch_status", ["active", "inactive"]);

// Per-day working hours for the System Settings screen. Times are 24h "HH:MM".
export interface WorkingDay {
  day: string; // "monday" … "sunday"
  open: string; // "09:00"
  close: string; // "19:00"
  closed: boolean; // true = shut that day
}

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("starter"),
  status: orgStatusEnum("status").notNull().default("trial"),
  walletEnabled: boolean("wallet_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Branch name
  salonName: text("salon_name").notNull(), // Salon / outlet display name (can differ per branch)
  city: text("city").notNull(),
  address: text("address"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  gstNumber: text("gst_number"), // can be shared across branches or unique per branch
  workingHours: text("working_hours"), // human summary, e.g. "Mon-Sat 9:00-20:00, Sun closed"
  status: branchStatusEnum("status").notNull().default("active"),
  // Business profile / System Settings
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  youtubeUrl: text("youtube_url"),
  googleMapsUrl: text("google_maps_url"), // "Google Direction" map link
  loginBgUrl: text("login_bg_url"), // login page background image
  openingTime: text("opening_time"), // overall business hours, 24h "HH:MM"
  closingTime: text("closing_time"),
  workingDays: jsonb("working_days").$type<WorkingDay[]>(), // per-day schedule
  extraHoursEnabled: boolean("extra_hours_enabled").notNull().default(false),
  dayEndReportTime: text("day_end_report_time"), // e.g. "20:00"
  loyaltyPointsEnabled: boolean("loyalty_points_enabled").notNull().default(true),
  pointsPerThousand: integer("points_per_thousand").notNull().default(50), // points earned per ₹1000 collected
  redeemPaisePerPoint: integer("redeem_paise_per_point").notNull().default(100), // value of 1 point on redemption (100 paise = ₹1)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
