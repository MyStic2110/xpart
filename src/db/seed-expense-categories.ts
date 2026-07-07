import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, expenseCategories } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, expenseCategories } });

// Standard workshop expense buckets. Idempotent — re-running only adds what's missing.
const CATEGORIES = [
  "Daily expenses",
  "Tools and equipment",
  "Staff expenses",
  "Parts",
  "Marketing",
  "Workshop expenses",
  "Job work",
  "Transport",
];

async function main() {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org 'Xpart Automotive' not found");

  let created = 0;
  for (const name of CATEGORIES) {
    const existing = await db.query.expenseCategories.findFirst({
      where: and(eq(expenseCategories.orgId, org.id), eq(expenseCategories.name, name)),
    });
    if (existing) continue;
    await db.insert(expenseCategories).values({ orgId: org.id, name });
    created++;
  }
  console.log(`Seeded ${created} expense categories (${CATEGORIES.length - created} already present).`);
  await client.end();
}

main();
