import { readFileSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, products } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, products } });

interface Row {
  name: string;
  mrp: number;
  volume: string | null;
  barcode: string | null;
  category: string | null;
  subCategory: string | null;
  sku: string | null;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync("src/db/xpart-products.json", "utf8"));
  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org 'Xpart Automotive' not found");

  let created = 0;
  for (const r of rows) {
    const existing = await db.query.products.findFirst({ where: and(eq(products.orgId, org.id), eq(products.name, r.name)) });
    if (existing) continue;
    await db.insert(products).values({
      orgId: org.id,
      name: r.name,
      mrp: r.mrp,
      volume: r.volume,
      barcode: r.barcode,
      category: r.category,
      subCategory: r.subCategory,
      sku: r.sku,
    });
    created++;
  }
  console.log(`Seeded ${created} products.`);
  await client.end();
}

main();
