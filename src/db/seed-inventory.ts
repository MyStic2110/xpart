import { readFileSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, branches, products, inventoryLots, inventoryItems } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, branches, products, inventoryLots, inventoryItems } });

interface Row {
  lotNo: string | null;
  name: string;
  volume: string | null;
  qty: number;
  unit: string;
  salePrice: number;
  expiry: string | null;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync("src/db/xpart-inventory.json", "utf8"));
  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org not found");
  const branch = await db.query.branches.findFirst({ where: eq(branches.orgId, org.id) });

  const existing = await db.query.inventoryLots.findFirst({ where: eq(inventoryLots.orgId, org.id) });
  if (existing) {
    console.log("Inventory already seeded, skipping.");
    await client.end();
    return;
  }

  const allProducts = await db.select().from(products).where(eq(products.orgId, org.id));
  const productByName = new Map(allProducts.map((p) => [p.name.toLowerCase(), p.id]));

  // group rows by lot no
  const byLot = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.lotNo ?? "unknown";
    if (!byLot.has(key)) byLot.set(key, []);
    byLot.get(key)!.push(r);
  }

  let lots = 0;
  let items = 0;
  for (const [lotNo, lotRows] of byLot) {
    const [lot] = await db
      .insert(inventoryLots)
      .values({ orgId: org.id, branchId: branch?.id ?? null, lotNo, sourceType: "unknown" })
      .returning();
    lots++;
    for (const r of lotRows) {
      await db.insert(inventoryItems).values({
        orgId: org.id,
        lotId: lot.id,
        productId: productByName.get(r.name.toLowerCase()) ?? null,
        productName: r.volume ? `${r.name} (${r.volume})` : r.name,
        quantity: r.qty.toString(),
        unit: r.unit || null,
        salePrice: r.salePrice,
        expiryDate: r.expiry,
      });
      items++;
    }
  }

  console.log(`Seeded ${lots} lots, ${items} inventory items.`);
  await client.end();
}

main();
