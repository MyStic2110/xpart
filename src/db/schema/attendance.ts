import { pgTable, uuid, text, date, integer, numeric, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { users } from "./identity";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "half_day",
  "absent",
  "leave",
  "lop", // loss of pay
]);

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    checkIn: text("check_in"), // "09:05 AM"
    checkOut: text("check_out"), // "08:10 PM"
    hoursWorked: numeric("hours_worked", { precision: 4, scale: 1 }).notNull().default("0"),
    notes: text("notes"),
    markedBy: uuid("marked_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.date)]
);

export const payoutStatusEnum = pgEnum("payout_status", ["draft", "paid"]);

// One finalized snapshot per user per month. Computed values are stored at
// finalize-time so historical payslips don't shift if commission % changes later.
export const salaryPayouts = pgTable(
  "salary_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "YYYY-MM"
    baseSalary: integer("base_salary").notNull(), // paise
    presentDays: integer("present_days").notNull(),
    lopDays: integer("lop_days").notNull(),
    leaveDays: integer("leave_days").notNull(),
    lopDeduction: integer("lop_deduction").notNull(), // paise
    revenueGenerated: integer("revenue_generated").notNull(), // paise, attributed via job cards
    serviceCommissionEarned: integer("service_commission_earned").notNull().default(0), // paise
    productCommissionEarned: integer("product_commission_earned").notNull().default(0), // paise
    bonus: integer("bonus").notNull().default(0), // paise
    otherDeductions: integer("other_deductions").notNull().default(0), // paise
    netPayout: integer("net_payout").notNull(), // paise
    status: payoutStatusEnum("status").notNull().default("draft"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.month)]
);
