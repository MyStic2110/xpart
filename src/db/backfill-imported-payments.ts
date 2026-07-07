import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, jobCards, invoices, payments } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, jobCards, invoices, payments } });

// Imported job cards carry the real "Last bill amount" from the Excel — money
// the customer actually paid. This backfills a PAID invoice + payment for each,
// dated at the real visit date, so lifetime spend and historical revenue are
// accurate instead of showing zero.
async function main() {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org not found");

  const imported = await db
    .select()
    .from(jobCards)
    .leftJoin(invoices, eq(invoices.jobCardId, jobCards.id))
    .where(and(eq(jobCards.orgId, org.id), eq(jobCards.source, "imported"), isNull(invoices.id)));

  let count = 0;
  let totalPaise = 0;

  for (const row of imported) {
    const jc = row.job_cards;
    if (jc.total <= 0) continue; // no bill amount → nothing was paid
    const paidAt = new Date(`${jc.jobDate}T12:00:00Z`);

    await db.transaction(async (tx) => {
      const [inv] = await tx
        .insert(invoices)
        .values({
          orgId: org.id,
          branchId: jc.branchId,
          jobCardId: jc.id,
          clientId: jc.clientId,
          vehicleId: jc.vehicleId,
          subtotal: jc.subtotal,
          discount: jc.discount,
          total: jc.total,
          status: "paid",
          createdAt: paidAt,
          finalizedAt: paidAt,
        })
        .returning();

      // Payment mode wasn't captured in the export; cash is the realistic
      // default for a walk-in wash business and is flagged as imported.
      await tx.insert(payments).values({
        invoiceId: inv.id,
        mode: "cash",
        amount: jc.total,
        txnRef: "imported",
        paidAt,
      });
    });

    count++;
    totalPaise += jc.total;
  }

  console.log(`Backfilled ${count} paid invoices, total historical revenue ₹${(totalPaise / 100).toLocaleString("en-IN")}`);
  await client.end();
}

main();
