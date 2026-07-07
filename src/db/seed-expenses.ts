import { readFileSync } from "node:fs";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, branches, expenseCategories, expenses } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, branches, expenseCategories, expenses } });

interface Row {
  date: string; // YYYY-MM-DD
  type: string; // category name
  amount: number; // paise
  paymentMode: string;
  recipient: string;
  paidBy: string;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync("src/db/xpart-expenses.json", "utf8"));
  if (rows.length === 0) throw new Error("no rows in xpart-expenses.json");

  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org 'Xpart Automotive' not found");

  // No branch in the export → stamp everything to the org's primary (earliest) branch.
  const branch = await db.query.branches.findFirst({
    where: eq(branches.orgId, org.id),
    orderBy: asc(branches.createdAt),
  });
  if (!branch) throw new Error("no branch found for org");

  // Resolve category names → ids, creating any that are missing.
  const cats = await db.select().from(expenseCategories).where(eq(expenseCategories.orgId, org.id));
  const catId = new Map(cats.map((c) => [c.name, c.id]));
  for (const name of new Set(rows.map((r) => r.type))) {
    if (catId.has(name)) continue;
    const [c] = await db.insert(expenseCategories).values({ orgId: org.id, name }).returning();
    catId.set(name, c.id);
    console.log(`+ created missing category "${name}"`);
  }

  // Idempotent re-import: clear this branch's expenses in the file's date range, then insert.
  const from = rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0].date);
  const to = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const removed = await db
    .delete(expenses)
    .where(and(eq(expenses.orgId, org.id), eq(expenses.branchId, branch.id), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)))
    .returning();
  if (removed.length) console.log(`cleared ${removed.length} existing expenses in ${from}..${to}`);

  await db.insert(expenses).values(
    rows.map((r) => ({
      orgId: org.id,
      branchId: branch.id,
      categoryId: catId.get(r.type) ?? null,
      expenseDate: r.date,
      amount: r.amount,
      paymentMode: r.paymentMode,
      recipient: r.recipient || null,
      paidBy: r.paidBy || null,
    }))
  );

  const total = rows.reduce((s, r) => s + r.amount, 0);
  console.log(`Seeded ${rows.length} expenses (${from}..${to}) to branch "${branch.name}" — ₹${(total / 100).toLocaleString("en-IN")}.`);
  await client.end();
}

main();
