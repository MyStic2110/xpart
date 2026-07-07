import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, offers } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, offers } });

const SEED_OFFERS = [
  {
    code: "FIRST100",
    title: "New Client Welcome",
    description: "Get ₹100 off on your first or second wash / detailing service.",
    discountType: "flat",
    value: 10000, // ₹100
    maxDiscount: 10000,
    minBillingAmount: 30000, // ₹300
    targetType: "new_client",
    isActive: true,
  },
  {
    code: "WINBACK150",
    title: "Win-Back Special",
    description: "Get ₹150 off on your next visit (Since your last visit was over 60 days ago).",
    discountType: "flat",
    value: 15000, // ₹150
    maxDiscount: 15000,
    minBillingAmount: 30000, // ₹300
    targetType: "churn_risk",
    isActive: true,
  },
  {
    code: "UPSELLDET",
    title: "Premium Detailing Upgrade",
    description: "Add a Teflon Polish & Wax to your wash today for only ₹999 (₹1,499 standard value).",
    discountType: "flat",
    value: 50000, // ₹500 off
    maxDiscount: 50000,
    minBillingAmount: 149900, // ₹1,499
    targetType: "detailing_upsell",
    isActive: true,
  },
  {
    code: "LOYAL50",
    title: "Loyal Customer Discount",
    description: "Enjoy ₹50 off as a thank you for your 5+ lifetime visits.",
    discountType: "flat",
    value: 5000, // ₹50
    maxDiscount: 5000,
    minBillingAmount: 20000, // ₹200
    targetType: "loyal_client",
    isActive: true,
  },
  {
    code: "BDAY200",
    title: "Birthday Celebration Reward",
    description: "Happy Birthday! Enjoy ₹200 off on any service today.",
    discountType: "flat",
    value: 20000, // ₹200
    maxDiscount: 20000,
    minBillingAmount: 50000, // ₹500
    targetType: "birthday_special",
    isActive: true,
  },
  {
    code: "ANNI200",
    title: "Anniversary Celebration Reward",
    description: "Happy Anniversary! Celebrate with a flat ₹200 off on any service today.",
    discountType: "flat",
    value: 20000, // ₹200
    maxDiscount: 20000,
    minBillingAmount: 50000, // ₹500
    targetType: "anniversary_special",
    isActive: true,
  },
  {
    code: "HAPPY100",
    title: "Happy Hour Car Wash",
    description: "Flat ₹100 off on car wash services (Mon-Sat, 9:00 AM - 10:00 PM).",
    discountType: "flat",
    value: 10000,
    maxDiscount: 10000,
    minBillingAmount: 30000,
    targetType: "all",
    isActive: true,
    restrictedDays: ["1", "2", "3", "4", "5", "6"],
    startTime: "09:00",
    endTime: "22:00",
  },
  {
    code: "OFFPEAK50",
    title: "Afternoon Off-Peak Polish",
    description: "Enjoy flat ₹50 off on polish/wax upgrades during weekday afternoons (Mon-Fri, 12:00 PM - 4:00 PM).",
    discountType: "flat",
    value: 5000,
    maxDiscount: 5000,
    minBillingAmount: 20000,
    targetType: "all",
    isActive: true,
    restrictedDays: ["1", "2", "3", "4", "5"],
    startTime: "12:00",
    endTime: "16:00",
  },
  {
    code: "MIDNIGHT200",
    title: "Midnight Car Glow Up",
    description: "Flat ₹200 off for late-night bookings (Daily, 11:00 PM - 4:00 AM).",
    discountType: "flat",
    value: 20000,
    maxDiscount: 20000,
    minBillingAmount: 100000,
    targetType: "all",
    isActive: true,
    restrictedDays: ["0", "1", "2", "3", "4", "5", "6"],
    startTime: "23:00",
    endTime: "04:00",
  },
];

async function main() {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org 'Xpart Automotive' not found");

  let created = 0;
  for (const r of SEED_OFFERS) {
    const existing = await db.query.offers.findFirst({ where: and(eq(offers.orgId, org.id), eq(offers.code, r.code)) });
    if (existing) continue;
    await db.insert(offers).values({
      orgId: org.id,
      code: r.code,
      title: r.title,
      description: r.description,
      discountType: r.discountType,
      value: r.value,
      maxDiscount: r.maxDiscount,
      minBillingAmount: r.minBillingAmount,
      targetType: r.targetType,
      isActive: r.isActive,
      restrictedDays: (r as any).restrictedDays || null,
      startTime: (r as any).startTime || null,
      endTime: (r as any).endTime || null,
    });
    created++;
  }
  console.log(`Seeded ${created} default offers.`);
  await client.end();
}

main();
