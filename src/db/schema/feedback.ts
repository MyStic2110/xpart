import { pgTable, uuid, text, integer, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations, branches } from "./org";
import { clients } from "./client";
import { jobCards } from "./jobcard";

export const feedbackSourceEnum = pgEnum("feedback_source", ["in_app", "google", "whatsapp", "manual"]);

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  jobCardId: uuid("job_card_id").references(() => jobCards.id, { onDelete: "set null" }),
  source: feedbackSourceEnum("source").notNull().default("manual"),
  reviewerName: text("reviewer_name"),
  rating: integer("rating"), // 1-5
  comment: text("comment"),
  reply: text("reply"), // owner's response
  reviewDate: date("review_date"),
  externalId: text("external_id"), // dedup key for imported reviews (e.g. Google review id)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
