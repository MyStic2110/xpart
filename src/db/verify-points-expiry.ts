import { db } from "./client";
import { wallets, pointsTransactions, clients } from "./schema";
import { getAndUpdateUsablePoints } from "../modules/invoices/service";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== STARTING POINTS EXPIRY VERIFICATION ===");

  // 1. Get first client
  const client = await db.query.clients.findFirst();
  if (!client) {
    console.error("No client found in the database to run verification!");
    process.exit(1);
  }
  console.log(`Testing with client: ${client.name} (ID: ${client.id})`);

  // 2. Find or create their wallet
  let wallet = await db.query.wallets.findFirst({ where: eq(wallets.clientId, client.id) });
  if (!wallet) {
    [wallet] = await db.insert(wallets).values({ clientId: client.id, orgId: client.orgId }).returning();
  }
  console.log(`Testing with wallet: ${wallet.id}`);

  // 3. Clear previous points history to prevent overlap
  await db.delete(pointsTransactions).where(eq(pointsTransactions.walletId, wallet.id));
  await db.update(wallets).set({ points: 0 }).where(eq(wallets.id, wallet.id));
  console.log("Cleaned up old transactions and reset wallet balance to 0.");

  // 4. Set up scenario:
  // - Earn 100 points: 200 days ago (should expire)
  // - Earn 150 points: 50 days ago (active)
  const date200DaysAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
  const date50DaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);

  console.log("\n--- Scenario 1: Inserting earn transactions ---");
  console.log("Inserting Earn 100 pts dated 200 days ago...");
  await db.insert(pointsTransactions).values({
    walletId: wallet.id,
    orgId: client.orgId,
    type: "earn",
    points: 100,
    balanceAfter: 100,
    note: "Earned 200 days ago",
    createdAt: date200DaysAgo,
  });

  console.log("Inserting Earn 150 pts dated 50 days ago...");
  await db.insert(pointsTransactions).values({
    walletId: wallet.id,
    orgId: client.orgId,
    type: "earn",
    points: 150,
    balanceAfter: 250,
    note: "Earned 50 days ago",
    createdAt: date50DaysAgo,
  });

  // Set wallet points to 250 initially to mimic them being added in the past
  await db.update(wallets).set({ points: 250 }).where(eq(wallets.id, wallet.id));

  // 5. Run the expiry sync logic
  console.log("\nRunning getAndUpdateUsablePoints...");
  const usable1 = await db.transaction(async (tx) => {
    return await getAndUpdateUsablePoints(tx, wallet!.id, client.orgId);
  });

  console.log(`Computed usable points: ${usable1}`);
  console.log("Expected: 150 (since the 100 pts earned 200 days ago should be expired).");

  // Fetch from DB to check if auto-adjustment worked
  const updatedWallet1 = await db.query.wallets.findFirst({ where: eq(wallets.id, wallet.id) });
  console.log(`Wallet points in DB after sync: ${updatedWallet1?.points}`);

  const txns = await db.query.pointsTransactions.findMany({ where: eq(pointsTransactions.walletId, wallet.id) });
  console.log("Transactions logged in DB:");
  txns.forEach((t) => {
    console.log(` - ${t.type.toUpperCase()}: ${t.points} pts (Note: "${t.note}")`);
  });

  // Verify Scenario 1
  if (usable1 === 150 && updatedWallet1?.points === 150 && txns.some((t) => t.type === "adjust" && t.points === -100)) {
    console.log("\n🟢 SCENARIO 1 SUCCESSFUL!");
  } else {
    console.error("\n🔴 SCENARIO 1 FAILED!");
    process.exit(1);
  }

  // 6. Scenario 2: FIFO check
  // Client redeems 50 points. This consumes 50 points from the oldest earn.
  console.log("\n--- Scenario 2: Redemeed 50 points ---");
  await db.insert(pointsTransactions).values({
    walletId: wallet.id,
    orgId: client.orgId,
    type: "redeem",
    points: -50,
    balanceAfter: 100,
    note: "Redeemed 50 points",
  });
  await db.update(wallets).set({ points: 100 }).where(eq(wallets.id, wallet.id));

  // Now, insert an expired earn of 80 points (190 days ago) and run sync
  console.log("Inserting Earn 80 pts dated 190 days ago...");
  await db.insert(pointsTransactions).values({
    walletId: wallet.id,
    orgId: client.orgId,
    type: "earn",
    points: 80,
    balanceAfter: 180,
    note: "Earned 190 days ago",
    createdAt: new Date(Date.now() - 190 * 24 * 60 * 60 * 1000),
  });
  await db.update(wallets).set({ points: 180 }).where(eq(wallets.id, wallet.id));

  console.log("Running getAndUpdateUsablePoints...");
  const usable2 = await db.transaction(async (tx) => {
    return await getAndUpdateUsablePoints(tx, wallet!.id, client.orgId);
  });

  console.log(`Computed usable points: ${usable2}`);
  console.log("Expected: 150 (the 80 pts are expired, 50 points are consumed from them by redeems, leaving 30 pts to expire. 150 pts remain active).");

  const updatedWallet2 = await db.query.wallets.findFirst({ where: eq(wallets.id, wallet.id) });
  console.log(`Wallet points in DB after sync: ${updatedWallet2?.points}`);

  const txns2 = await db.query.pointsTransactions.findMany({ where: eq(pointsTransactions.walletId, wallet.id) });
  console.log("Transactions logged in DB:");
  txns2.forEach((t) => {
    console.log(` - ${t.type.toUpperCase()}: ${t.points} pts (Note: "${t.note}")`);
  });

  if (usable2 === 150 && updatedWallet2?.points === 150 && txns2.some((t) => t.type === "adjust" && t.points === -30)) {
    console.log("\n🟢 SCENARIO 2 SUCCESSFUL!");
  } else {
    console.error("\n🔴 SCENARIO 2 FAILED!");
    process.exit(1);
  }

  // Clean up
  await db.delete(pointsTransactions).where(eq(pointsTransactions.walletId, wallet.id));
  await db.update(wallets).set({ points: 0 }).where(eq(wallets.id, wallet.id));
  console.log("\nVerification finished. Temporary test data cleaned up.");
}

main().catch(console.error);
