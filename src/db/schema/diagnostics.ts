import { pgTable, uuid, text, date, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { clients, vehicles } from "./client";
import { users } from "./identity";

// ---------------------------------------------------------------------------
// Advanced Diagnostics — PDF-report intelligence per vehicle.
//
// A garage uploads any diagnostic PDF (OBD scanner export, dealer health
// report, emission test…) against a vehicle. The pipeline extracts DTC fault
// codes + vehicle info + sensor readings, correlates codes to a root cause,
// scores vehicle health per system, and keeps a per-vehicle history so
// recurring faults surface. No live OBD connection needed.
// ---------------------------------------------------------------------------

export const diagnosticReports = pgTable("diagnostic_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),

  fileUrl: text("file_url").notNull(), // /uploads/<uuid>.pdf
  fileName: text("file_name").notNull(),
  // Full document text (text layer or OCR markdown) saved as a plain .txt next
  // to the PDF — one LLM-friendly artefact instead of parse blobs in the DB.
  textFileUrl: text("text_file_url"),
  reportType: text("report_type").notNull().default("obd_scan"),
  // processed = parsed OK · needs_ai = scanned/no text layer and no AI connector · failed = unreadable
  status: text("status").notNull().default("processed"),
  engine: text("engine"), // parser | ai | parser+ai — which extraction path produced the data

  // Extracted document facts
  reportDate: date("report_date"),
  odometerKm: integer("odometer_km"),
  vin: text("vin"),
  plateNumber: text("plate_number"), // as printed on the report (matching key)
  workshopName: text("workshop_name"),
  technicianName: text("technician_name"),
  // Everything else the extractor found: vehicle {make,model,fuel…}, sensors[],
  // freezeFrames[], remarks[], partsReplaced[] — schema-less on purpose, the
  // document zoo (Autel/Launch/Bosch/dealer formats) is too varied for columns.
  extracted: jsonb("extracted"),

  // Full JSON returned by the AutoDiag India LLM prompt (OpenRouter) — the
  // AI layer of the report UI. Null when no LLM connector is configured.
  aiAnalysis: jsonb("ai_analysis"),

  // Analysis output
  healthScore: integer("health_score"), // 0–100
  systemScores: jsonb("system_scores"), // { engine: 84, abs_brakes: 100, … }
  rootCauses: jsonb("root_causes"), // [{ title, confidence, explains[], repairSequence[] }]
  recommendations: jsonb("recommendations"), // [{ action, priority, estCostMin/Max paise, laborHours, parts[] }]
  summary: text("summary"), // one-paragraph human-readable verdict

  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per DTC found in a report — flat so history/aggregation queries
// (top codes org-wide, recurring per vehicle) stay simple SQL.
export const diagnosticFaults = pgTable("diagnostic_faults", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  reportId: uuid("report_id").notNull().references(() => diagnosticReports.id, { onDelete: "cascade" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }), // denormalised for timeline queries

  code: text("code").notNull(), // P0420, C0035…
  description: text("description").notNull(),
  system: text("system").notNull().default("unknown"), // engine | transmission | abs_brakes | airbag | network | electrical | emissions | cooling | fuel | body
  ecu: text("ecu"), // module name as printed on the report
  status: text("status").notNull().default("unknown"), // active | pending | history | permanent | unknown
  severity: text("severity").notNull().default("medium"), // critical | high | medium | low | info
  isRecurring: boolean("is_recurring").notNull().default(false), // seen in an earlier report of the same vehicle

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
