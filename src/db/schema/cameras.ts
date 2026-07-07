import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";

// CCTV / IP cameras installed at a branch (inside bays, outside entrance...).
// Config-first like connectors: we store the provider + stream URL + creds;
// `password` is never returned in full by the API. AI (MediaPipe person/vehicle
// detection) runs in the browser against browser-playable streams.
export const branchCameras = pgTable("branch_cameras", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Entrance", "Wash bay 1"...
  placement: text("placement").notNull().default("inside"), // inside | outside
  provider: text("provider").notNull(), // key in CAMERA_PROVIDERS registry
  streamUrl: text("stream_url").notNull(), // rtsp:// | http(s) MJPEG/HLS
  username: text("username"),
  password: text("password"),
  aiEnabled: boolean("ai_enabled").notNull().default(false), // MediaPipe layer on/off
  notes: text("notes"),
  status: text("status").notNull().default("active"), // active | disabled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
