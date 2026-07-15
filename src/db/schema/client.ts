import { pgTable, uuid, text, date, timestamp, integer, pgEnum, unique, index } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { vehicleMakes, vehicleModels } from "./catalog";

export const genderEnum = pgEnum("gender", ["male", "female", "other", "unknown"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["petrol", "diesel", "cng", "electric", "hybrid"]);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address"),
    gender: genderEnum("gender").notNull().default("unknown"),
    dateOfBirth: date("date_of_birth"),
    anniversary: date("anniversary"),
    sourceOfClient: text("source_of_client"), // walkin | referral | whatsapp | google | instagram etc.
    // customer = regular retail client; third_party = vendor (e.g. a mechanic) who
    // brings vehicles in daily on credit — no loyalty points/wallet, dues tracked per invoice.
    clientType: text("client_type").notNull().default("customer"), // customer | third_party
    referralCode: text("referral_code").notNull(),
    referredByClientId: uuid("referred_by_client_id"),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.phone),
    unique().on(t.orgId, t.referralCode),
    index("clients_org_idx").on(t.orgId),
    index("clients_phone_idx").on(t.phone)
  ]
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    plateNumber: text("plate_number").notNull(),
    makeId: uuid("make_id").references(() => vehicleMakes.id),
    modelId: uuid("model_id").references(() => vehicleModels.id),
    segment: text("segment"),
    year: integer("year"),
    color: text("color"),
    fuelType: fuelTypeEnum("fuel_type"),
    odometerReading: integer("odometer_reading"),
    nextServiceDate: date("next_service_date"),
    vehicleType: text("vehicle_type").notNull().default("two_wheeler"), // two_wheeler | car
    images: text("images").array(),
    insuranceExpiryDate: date("insurance_expiry_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.orgId, t.plateNumber),
    index("vehicles_org_idx").on(t.orgId),
    index("vehicles_plate_idx").on(t.plateNumber)
  ]
);

// Wallet: one per client, org-scoped (usable across branches of the same org)
export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0), // paise, avoid floats for money
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("wallets_org_idx").on(t.orgId)
]);

export const walletTxnTypeEnum = pgEnum("wallet_txn_type", ["credit", "debit"]);
export const walletTxnSourceEnum = pgEnum("wallet_txn_source", [
  "topup",
  "cashback",
  "referral_bonus",
  "refund",
  "invoice_payment",
  "points_redemption",
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  type: walletTxnTypeEnum("type").notNull(),
  source: walletTxnSourceEnum("source").notNull(),
  amount: integer("amount").notNull(),
  refId: uuid("ref_id"),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Loyalty points ledger — separate from the rupee wallet ledger above. `points`
// is the signed change (+earn / −redeem), `balanceAfter` the running points
// total. Keeps an auditable trail of every loyalty movement.
export const pointsTxnTypeEnum = pgEnum("points_txn_type", ["earn", "redeem", "adjust"]);

export const pointsTransactions = pgTable("points_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: pointsTxnTypeEnum("type").notNull(),
  points: integer("points").notNull(), // signed: positive = earned, negative = redeemed
  balanceAfter: integer("balance_after").notNull(),
  refId: uuid("ref_id"), // invoice id for earn/redeem
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
