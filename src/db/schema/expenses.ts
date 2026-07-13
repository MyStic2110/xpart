import { pgTable, uuid, text, integer, date, timestamp, unique, index } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";

// Expense "Type" — org-wide shared list (Rent, Salary, Utilities…), like products.
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.orgId, t.name)]
);

// A single spend, stamped to the branch it belongs to.
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => expenseCategories.id, { onDelete: "set null" }),
  expenseDate: date("expense_date").notNull(),
  amount: integer("amount").notNull(), // paise
  // Free text (e.g. "Cash", "Online payment", "UPI") — source apps vary, so not an enum.
  paymentMode: text("payment_mode").notNull().default("Cash"),
  recipient: text("recipient"), // who was paid (vendor / landlord / person)
  paidBy: text("paid_by"), // free text — who made the payment (e.g. "Admin", staff name)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("expenses_org_idx").on(t.orgId),
  index("expenses_branch_idx").on(t.branchId),
  index("expenses_date_idx").on(t.expenseDate),
]);
