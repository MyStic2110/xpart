import { pgTable, uuid, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { organizations } from "./org";

export const garages = pgTable("garages", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }), // nullable for public directory listings
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  phone: text("phone"),
  website: text("website"),
  osmId: text("osm_id"),
  googlePlaceId: text("google_place_id"),
  verified: boolean("verified").notNull().default(false),
  claimed: boolean("claimed").notNull().default(false),
  rating: real("rating"),
  reviewCount: integer("review_count").notNull().default(0),
  serviceRadiusKm: real("service_radius_km").notNull().default(5),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const garageServices = pgTable("garage_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  garageId: uuid("garage_id").notNull().references(() => garages.id, { onDelete: "cascade" }),
  serviceName: text("service_name").notNull(),
  category: text("category"), // engine_repair, bike_service, alignment, battery, ac_repair, ev_repair, insurance, tyre_shop, car_wash, etc.
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const garageWorkingHours = pgTable("garage_working_hours", {
  garageId: uuid("garage_id").primaryKey().references(() => garages.id, { onDelete: "cascade" }),
  mondayOpen: text("monday_open"),
  mondayClose: text("monday_close"),
  tuesdayOpen: text("tuesday_open"),
  tuesdayClose: text("tuesday_close"),
  wednesdayOpen: text("wednesday_open"),
  wednesdayClose: text("wednesday_close"),
  thursdayOpen: text("thursday_open"),
  thursdayClose: text("thursday_close"),
  fridayOpen: text("friday_open"),
  fridayClose: text("friday_close"),
  saturdayOpen: text("saturday_open"),
  saturdayClose: text("saturday_close"),
  sundayOpen: text("sunday_open"),
  sundayClose: text("sunday_close"),
});

export const garagePhotos = pgTable("garage_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  garageId: uuid("garage_id").notNull().references(() => garages.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  source: text("source").notNull().default("user"), // user, osm, system
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const garageCoverage = pgTable("garage_coverage", {
  garageId: uuid("garage_id").primaryKey().references(() => garages.id, { onDelete: "cascade" }),
  coverageRadius: real("coverage_radius").notNull().default(5),
  pickupAvailable: boolean("pickup_available").notNull().default(false),
  roadsideAssistance: boolean("roadside_assistance").notNull().default(false),
  homeService: boolean("home_service").notNull().default(false),
  fleetService: boolean("fleet_service").notNull().default(false),
});

export const garageClaims = pgTable("garage_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  garageId: uuid("garage_id").notNull().references(() => garages.id, { onDelete: "cascade" }),
  claimedByUserId: text("claimed_by_user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  verificationOtp: text("verification_otp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
