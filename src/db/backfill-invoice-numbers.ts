import { db } from "./client";
import { invoices } from "./schema";
import { eq } from "drizzle-orm";

function getFinancialYearSuffix(date: Date): string {
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  if (month >= 3) {
    return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }
}

async function main() {
  console.log("=== STARTING INVOICE NUMBERS BACKFILL ===");

  // Get all invoices ordered by creation date (oldest first)
  const invoiceList = await db.query.invoices.findMany({
    orderBy: invoices.createdAt,
  });
  console.log(`Found ${invoiceList.length} invoices to process.`);

  // Group invoices by orgId to ensure org-scoped sequential numbering
  const orgCounterMap: Record<string, number> = {};

  let updatedCount = 0;

  for (const inv of invoiceList) {
    try {
      const orgId = inv.orgId;
      const count = (orgCounterMap[orgId] || 0) + 1;
      orgCounterMap[orgId] = count;

      const serial = count.toString().padStart(4, "0");
      const suffix = getFinancialYearSuffix(inv.createdAt);
      const invoiceNo = `${serial}/INV/${suffix}`;

      await db
        .update(invoices)
        .set({ invoiceNo })
        .where(eq(invoices.id, inv.id));

      console.log(`Invoice ${inv.id} (Created: ${inv.createdAt.toLocaleDateString()}) -> Assigned: ${invoiceNo}`);
      updatedCount++;
    } catch (err) {
      console.error(`Failed to update invoice ${inv.id}:`, err);
    }
  }

  console.log(`=== BACKFILL COMPLETED. Processed ${invoiceList.length} invoices, updated ${updatedCount} invoice display numbers. ===`);
}

main().catch(console.error);
