import { db } from "./client";
import { wallets } from "./schema";
import { getAndUpdateUsablePoints } from "../modules/invoices/service";

async function main() {
  console.log("=== STARTING LOYALTY POINTS EXPIRY BACKFILL ===");

  const allWallets = await db.query.wallets.findMany();
  console.log(`Found ${allWallets.length} wallets to process.`);

  let updatedCount = 0;

  for (const wallet of allWallets) {
    try {
      await db.transaction(async (tx) => {
        const originalPoints = wallet.points;
        const usablePoints = await getAndUpdateUsablePoints(tx, wallet.id, wallet.orgId);
        if (originalPoints !== usablePoints) {
          console.log(`Wallet ${wallet.id} (Client: ${wallet.clientId}) updated: ${originalPoints} -> ${usablePoints}`);
          updatedCount++;
        }
      });
    } catch (err) {
      console.error(`Failed to process wallet ${wallet.id}:`, err);
    }
  }

  console.log(`=== BACKFILL COMPLETED. Processed ${allWallets.length} wallets, updated ${updatedCount} wallets. ===`);
}

main().catch(console.error);
