import { db } from "./client";
import { wallets, pointsTransactions, payments, invoices, branches } from "./schema";
import { getAndUpdateUsablePoints } from "../modules/invoices/service";
import { eq, and, inArray } from "drizzle-orm";

async function main() {
  console.log("=== STARTING HISTORICAL PAYMENTS LOYALTY BACKFILL ===");

  // 1. Fetch all payments that are of mode cash, upi, or card
  const paymentList = await db.query.payments.findMany({
    where: inArray(payments.mode, ["cash", "upi", "card"]),
    orderBy: payments.paidAt, // oldest first
  });
  console.log(`Found ${paymentList.length} cash/UPI/card payments to process.`);

  let pointsEarnedCount = 0;
  let txnsInsertedCount = 0;

  for (const payment of paymentList) {
    try {
      // Find the associated invoice
      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, payment.invoiceId),
      });
      if (!invoice) {
        console.warn(`No invoice found for payment ID: ${payment.id}`);
        continue;
      }

      // Find the branch config
      const branch = await db.query.branches.findFirst({
        where: eq(branches.id, invoice.branchId),
      });
      if (!branch) {
        console.warn(`No branch found for branch ID: ${invoice.branchId}`);
        continue;
      }

      const pointsPerThousand = branch.pointsPerThousand ?? 50;

      // Calculate earned points: floor(rupees / 1000 * pointsPerThousand)
      const earned = Math.floor((payment.amount * pointsPerThousand) / 100000);
      if (earned <= 0) continue;

      // Find or create wallet for client
      let wallet = await db.query.wallets.findFirst({
        where: eq(wallets.clientId, invoice.clientId),
      });
      if (!wallet) {
        [wallet] = await db
          .insert(wallets)
          .values({
            clientId: invoice.clientId,
            orgId: invoice.orgId,
            points: 0,
            balance: 0,
          })
          .returning();
      }

      // Check if we already have an earn transaction for this payment
      const existingTxn = await db.query.pointsTransactions.findFirst({
        where: and(
          eq(pointsTransactions.walletId, wallet.id),
          eq(pointsTransactions.refId, invoice.id),
          eq(pointsTransactions.type, "earn")
        ),
      });

      if (existingTxn) {
        continue;
      }

      // Insert earn transaction backdated to payment.paidAt
      await db.insert(pointsTransactions).values({
        walletId: wallet.id,
        orgId: invoice.orgId,
        type: "earn",
        points: earned,
        balanceAfter: wallet.points + earned,
        refId: invoice.id,
        note: `Earned on ₹${(payment.amount / 100).toFixed(2)} collected (Backfill)`,
        createdAt: payment.paidAt,
      });

      // Update wallet temporary balance
      await db
        .update(wallets)
        .set({ points: wallet.points + earned })
        .where(eq(wallets.id, wallet.id));

      pointsEarnedCount += earned;
      txnsInsertedCount++;
    } catch (err) {
      console.error(`Failed to process payment ID ${payment.id}:`, err);
    }
  }

  console.log(`Inserted ${txnsInsertedCount} earn transactions, totaling ${pointsEarnedCount} points.`);

  // 2. Now run the dynamic FIFO sync for all client wallets to enforce the 180-day expiry policy!
  console.log("\nEnforcing 180-day FIFO expiry on all wallets...");
  const allWallets = await db.query.wallets.findMany();
  let updatedWalletsCount = 0;

  for (const wallet of allWallets) {
    try {
      await db.transaction(async (tx) => {
        const originalPoints = wallet.points;
        const usablePoints = await getAndUpdateUsablePoints(tx, wallet.id, wallet.orgId);
        if (originalPoints !== usablePoints) {
          updatedWalletsCount++;
        }
      });
    } catch (err) {
      console.error(`Failed to sync wallet ${wallet.id}:`, err);
    }
  }

  console.log(`=== BACKFILL COMPLETED. Processed ${allWallets.length} wallets, updated ${updatedWalletsCount} points balances. ===`);
}

main().catch(console.error);
