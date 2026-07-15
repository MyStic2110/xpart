import { eq, and, desc, sql, or, ilike } from "drizzle-orm";
import { db } from "@/db/client";
import { jobCards, invoices, payments, clients, vehicles, wallets, walletTransactions, pointsTransactions, jobCardServices, jobCardProducts, services, offers, organizations, branches } from "@/db/schema";
import { createNotification } from "@/modules/notifications/routes";

export class InvoiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

// Completing a job card is the trigger point for billing: it snapshots the
// job card's totals into a draft invoice so frontdesk never re-types line
// items — same "auto-draft from job card" principle as the rest of the app.
function getFinancialYearSuffix(date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  if (month >= 3) {
    return `${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
  }
}

export async function completeJobCardAndGenerateInvoice(orgId: string, jobCardId: string) {
  const jobCard = await db.query.jobCards.findFirst({ where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, orgId)) });
  if (!jobCard) throw new InvoiceError("job card not found", 404);
  if (jobCard.status === "cancelled") throw new InvoiceError("cannot complete a cancelled job card", 409);

  const existingInvoice = await db.query.invoices.findFirst({ where: eq(invoices.jobCardId, jobCardId) });
  if (existingInvoice) {
    return { jobCard, invoice: existingInvoice, alreadyExisted: true };
  }

  return await db.transaction(async (tx) => {
    const [updatedJobCard] = await tx
      .update(jobCards)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(jobCards.id, jobCardId))
      .returning();

    const invoiceCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.orgId, orgId));
    const nextNum = (invoiceCount[0]?.count ?? 0) + 1;
    const serial = nextNum.toString().padStart(4, "0");
    const invoiceNo = `${serial}/INV/${getFinancialYearSuffix()}`;

    const [invoice] = await tx
      .insert(invoices)
      .values({
        orgId,
        branchId: jobCard.branchId,
        jobCardId: jobCard.id,
        clientId: jobCard.clientId,
        vehicleId: jobCard.vehicleId,
        appliedOfferId: jobCard.appliedOfferId,
        invoiceNo,
        subtotal: jobCard.subtotal,
        discount: jobCard.discount,
        total: jobCard.total,
        status: "draft",
      })
      .returning();

    return { jobCard: updatedJobCard, invoice, alreadyExisted: false };
  });
}

export async function listInvoices(orgId: string, branchId?: string | null) {
  const conds = [eq(invoices.orgId, orgId)];
  if (branchId) conds.push(eq(invoices.branchId, branchId));
  return db
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      total: invoices.total,
      status: invoices.status,
      createdAt: invoices.createdAt,
      finalizedAt: invoices.finalizedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      plateNumber: vehicles.plateNumber,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(vehicles, eq(vehicles.id, invoices.vehicleId))
    .where(and(...conds))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoiceDetail(orgId: string, invoiceId: string) {
  return await db.transaction(async (tx) => {
    const invoice = await tx.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)) });
    if (!invoice) throw new InvoiceError("invoice not found", 404);

    const client = await tx.query.clients.findFirst({ where: eq(clients.id, invoice.clientId) });
    const vehicle = await tx.query.vehicles.findFirst({ where: eq(vehicles.id, invoice.vehicleId) });
    const paymentRows = await tx.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.paidAt));
    const wallet = client ? await tx.query.wallets.findFirst({ where: eq(wallets.clientId, client.id) }) : null;

    const servicesList = await tx
      .select({ id: jobCardServices.id, serviceName: services.name, qty: jobCardServices.qty, price: jobCardServices.price })
      .from(jobCardServices)
      .innerJoin(services, eq(services.id, jobCardServices.serviceId))
      .where(eq(jobCardServices.jobCardId, invoice.jobCardId));

    const productsList = await tx
      .select({ id: jobCardProducts.id, serviceName: jobCardProducts.productName, qty: jobCardProducts.qty, price: jobCardProducts.price })
      .from(jobCardProducts)
      .where(eq(jobCardProducts.jobCardId, invoice.jobCardId));

    const lineItems = [
      ...servicesList.map((s) => ({ ...s, type: "service" as const })),
      ...productsList.map((p) => ({ ...p, type: "product" as const })),
    ];

    const paidSoFar = paymentRows.reduce((sum, p) => sum + p.amount, 0);

    let appliedOffer = null;
    if (invoice.appliedOfferId) {
      appliedOffer = await tx.query.offers.findFirst({ where: eq(offers.id, invoice.appliedOfferId) });
    }

    // Third-party vendors (mechanics running a credit tab) are not loyalty
    // members — no wallet draws, no points, plain cash/UPI/card settlement.
    const isThirdParty = client?.clientType === "third_party";
    const loyalty = await getLoyaltyConfig(orgId, invoice.branchId);

    let pointsBalance = 0;
    if (wallet && !isThirdParty) {
      pointsBalance = await getAndUpdateUsablePoints(tx, wallet.id, orgId);
    }

    return {
      invoice: {
        ...invoice,
        appliedOfferCode: appliedOffer?.code ?? null,
        appliedOfferTitle: appliedOffer?.title ?? null,
      },
      client,
      vehicle,
      lineItems,
      payments: paymentRows,
      paidSoFar,
      balanceDue: invoice.total - paidSoFar,
      walletBalance: isThirdParty ? 0 : wallet?.balance ?? 0,
      pointsBalance,
      loyaltyEnabled: loyalty.enabled && !isThirdParty,
      redeemPaisePerPoint: loyalty.redeemPaisePerPoint,
    };
  });
}

export class PaymentError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

// A handle that is either the root db or an open transaction — both expose the
// same query builder, so write helpers can run inside or outside a transaction.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Loyalty config resolved per branch, with the org-wide master switch applied.
// Returns enabled=false whenever the org has wallet/loyalty turned off OR the
// branch has opted out, so callers never need to know about both flags. Config
// is reference data, so it's read off the root db (no need to join the txn).
async function getLoyaltyConfig(orgId: string, branchId: string) {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
  const branch = await db.query.branches.findFirst({ where: eq(branches.id, branchId) });
  const enabled = !!org?.walletEnabled && !!branch?.loyaltyPointsEnabled;
  return {
    enabled,
    pointsPerThousand: branch?.pointsPerThousand ?? 0,
    redeemPaisePerPoint: branch?.redeemPaisePerPoint ?? 0,
  };
}

// Calculates current usable non-expired points using FIFO and syncs the wallet points balance.
export async function getAndUpdateUsablePoints(tx: Tx, walletId: string, orgId: string): Promise<number> {
  const txns = await tx
    .select()
    .from(pointsTransactions)
    .where(eq(pointsTransactions.walletId, walletId))
    .orderBy(pointsTransactions.createdAt); // oldest first

  const earns = txns.filter((t) => t.type === "earn" && t.points > 0);
  const redeems = txns.filter((t) => t.type === "redeem" || (t.type === "adjust" && t.points < 0));

  let totalRedeemed = Math.abs(redeems.reduce((sum, r) => sum + r.points, 0));
  const now = new Date();
  const expiryDuration = 180 * 24 * 60 * 60 * 1000; // 180 days in ms

  let usableBalance = 0;
  let expiredPointsToAdjust = 0;

  for (const earn of earns) {
    let remainingInEarn = earn.points;
    if (totalRedeemed > 0) {
      if (totalRedeemed >= remainingInEarn) {
        totalRedeemed -= remainingInEarn;
        remainingInEarn = 0;
      } else {
        remainingInEarn -= totalRedeemed;
        totalRedeemed = 0;
      }
    }

    if (remainingInEarn > 0) {
      const expiresAt = new Date(earn.createdAt.getTime() + expiryDuration);
      if (expiresAt > now) {
        usableBalance += remainingInEarn;
      } else {
        expiredPointsToAdjust += remainingInEarn;
      }
    }
  }

  const wallet = await tx.query.wallets.findFirst({ where: eq(wallets.id, walletId) });
  if (wallet && wallet.points !== usableBalance) {
    const difference = usableBalance - wallet.points;
    if (difference !== 0) {
      await tx.update(wallets).set({ points: usableBalance }).where(eq(wallets.id, walletId));
      await tx.insert(pointsTransactions).values({
        walletId,
        orgId,
        type: "adjust",
        points: difference,
        balanceAfter: usableBalance,
        note: `Automatic adjustment: ${Math.abs(difference)} points expired (180 days limit)`,
      });
    }
  }

  return usableBalance;
}

// Credits 500 referral points to both the referrer and referee wallets.
async function creditReferralBonus(
  tx: Tx,
  orgId: string,
  referrerClientId: string,
  refereeClientId: string,
  refereeInvoiceId: string
) {
  // 1. Credit Referrer
  let referrerWallet = await tx.query.wallets.findFirst({ where: eq(wallets.clientId, referrerClientId) });
  if (!referrerWallet) {
    [referrerWallet] = await tx.insert(wallets).values({ clientId: referrerClientId, orgId }).returning();
  }
  const referrerNewPoints = referrerWallet.points + 500;
  await tx.update(wallets).set({ points: referrerNewPoints }).where(eq(wallets.id, referrerWallet.id));
  await tx.insert(pointsTransactions).values({
    walletId: referrerWallet.id,
    orgId,
    type: "earn",
    points: 500,
    balanceAfter: referrerNewPoints,
    refId: refereeInvoiceId,
    note: `Referral bonus for inviting client`,
  });

  // 2. Credit Referee (the friend)
  let refereeWallet = await tx.query.wallets.findFirst({ where: eq(wallets.clientId, refereeClientId) });
  if (!refereeWallet) {
    [refereeWallet] = await tx.insert(wallets).values({ clientId: refereeClientId, orgId }).returning();
  }
  const refereeNewPoints = refereeWallet.points + 500;
  await tx.update(wallets).set({ points: refereeNewPoints }).where(eq(wallets.id, refereeWallet.id));
  await tx.insert(pointsTransactions).values({
    walletId: refereeWallet.id,
    orgId,
    type: "earn",
    points: 500,
    balanceAfter: refereeNewPoints,
    refId: refereeInvoiceId,
    note: `Welcome bonus for using referral code`,
  });
}

// Credits loyalty points for real money collected (cash/upi/card only — wallet
// and points payments must not earn, to avoid earning on already-redeemed value).
// Runs inside the payment transaction so points and the payment commit together.
async function earnPoints(
  tx: Tx,
  opts: { orgId: string; branchId: string; clientId: string; amountPaise: number; refId: string }
) {
  const cfg = await getLoyaltyConfig(opts.orgId, opts.branchId);
  if (!cfg.enabled || cfg.pointsPerThousand <= 0) return 0;

  // points = floor(rupees / 1000 * pointsPerThousand); amountPaise/100 = rupees.
  const earned = Math.floor((opts.amountPaise * cfg.pointsPerThousand) / 100000);
  if (earned <= 0) return 0;

  let wallet = await tx.query.wallets.findFirst({ where: eq(wallets.clientId, opts.clientId) });
  if (!wallet) {
    [wallet] = await tx.insert(wallets).values({ clientId: opts.clientId, orgId: opts.orgId }).returning();
  }

  const newPoints = wallet.points + earned;
  await tx.update(wallets).set({ points: newPoints }).where(eq(wallets.id, wallet.id));
  await tx.insert(pointsTransactions).values({
    walletId: wallet.id,
    orgId: opts.orgId,
    type: "earn",
    points: earned,
    balanceAfter: newPoints,
    refId: opts.refId,
    note: `Earned on ₹${(opts.amountPaise / 100).toFixed(2)} collected`,
  });
  return earned;
}

interface RecordPaymentInput {
  mode: "cash" | "upi" | "card" | "wallet";
  amount: number; // paise
  txnRef?: string;
}

export async function recordPayment(orgId: string, invoiceId: string, input: RecordPaymentInput) {
  const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)) });
  if (!invoice) throw new PaymentError("invoice not found", 404);
  if (invoice.status === "cancelled") throw new PaymentError("cannot pay a cancelled invoice", 409);
  if (invoice.status === "paid") throw new PaymentError("invoice is already fully paid", 409);
  if (input.amount <= 0) throw new PaymentError("payment amount must be positive");

  const existingPayments = await db.select().from(payments).where(eq(payments.invoiceId, invoiceId));
  const alreadyPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = invoice.total - alreadyPaid;
  if (input.amount > remaining) throw new PaymentError(`payment exceeds balance due (${remaining} paise remaining)`);

  const payer = await db.query.clients.findFirst({ where: eq(clients.id, invoice.clientId) });
  const isThirdParty = payer?.clientType === "third_party";
  if (isThirdParty && input.mode === "wallet") {
    throw new PaymentError("third-party vendors settle in cash/UPI/card — no wallet");
  }

  return await db.transaction(async (tx) => {
    if (input.mode === "wallet") {
      const wallet = await tx.query.wallets.findFirst({ where: eq(wallets.clientId, invoice.clientId) });
      if (!wallet) throw new PaymentError("client has no wallet");
      if (wallet.balance < input.amount) throw new PaymentError("insufficient wallet balance");

      const newBalance = wallet.balance - input.amount;
      await tx.update(wallets).set({ balance: newBalance }).where(eq(wallets.id, wallet.id));
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        type: "debit",
        source: "invoice_payment",
        amount: input.amount,
        refId: invoiceId,
        balanceAfter: newBalance,
      });
    }

    const [payment] = await tx
      .insert(payments)
      .values({ invoiceId, mode: input.mode, amount: input.amount, txnRef: input.txnRef || null })
      .returning();

    // Earn loyalty points only on real money collected, never on wallet draws.
    // Third-party vendors are not loyalty members and never earn.
    let earnedPoints = 0;
    if (!isThirdParty && (input.mode === "cash" || input.mode === "upi" || input.mode === "card")) {
      earnedPoints = await earnPoints(tx, {
        orgId,
        branchId: invoice.branchId,
        clientId: invoice.clientId,
        amountPaise: input.amount,
        refId: invoiceId,
      });
    }

    const totalPaid = alreadyPaid + input.amount;
    const newStatus = totalPaid >= invoice.total ? "paid" : "partial";

    const [updatedInvoice] = await tx
      .update(invoices)
      .set({ status: newStatus, finalizedAt: newStatus === "paid" ? new Date() : invoice.finalizedAt })
      .where(eq(invoices.id, invoiceId))
      .returning();

    // Mark the job card billed once the invoice is fully settled.
    if (newStatus === "paid") {
      await tx.update(jobCards).set({ status: "billed" }).where(eq(jobCards.id, invoice.jobCardId));
      
      // If the client has a referrer and this is their first paid invoice, credit the referral bonus.
      if (payer && payer.referredByClientId) {
        const paidInvoicesCount = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(invoices)
          .where(
            and(
              eq(invoices.clientId, invoice.clientId),
              eq(invoices.status, "paid"),
              sql`${invoices.id} != ${invoiceId}`
            )
          );
        
        const otherPaidCount = paidInvoicesCount[0]?.count ?? 0;
        if (otherPaidCount === 0) {
          await creditReferralBonus(tx, orgId, payer.referredByClientId, invoice.clientId, invoiceId);
          console.log(`[referral] Credited referral points to referrer (${payer.referredByClientId}) and referee (${invoice.clientId}) for invoice ${invoiceId}`);
        }
      }
    }

    await createNotification(orgId, {
      title: newStatus === "paid" ? "Invoice Paid" : "Partial Payment Received",
      message: `Received ₹${(input.amount / 100).toFixed(2)} via ${input.mode.toUpperCase()}${earnedPoints > 0 ? ` · +${earnedPoints} points` : ""}.`,
      type: "payment",
    });

    return { invoice: updatedInvoice, payment, earnedPoints };
  });
}

// Redeem loyalty points against an invoice's outstanding balance. Points are
// converted to money at the branch's configurable rate and settled as a
// `points`-mode payment, reusing the same paid/partial → job-card-billed flow
// as cash. Invoice totals stay immutable; the redemption shows in payment history.
export async function redeemPoints(orgId: string, invoiceId: string, points: number) {
  if (!Number.isInteger(points) || points <= 0) throw new PaymentError("points to redeem must be a positive whole number");

  const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.orgId, orgId)) });
  if (!invoice) throw new PaymentError("invoice not found", 404);
  if (invoice.status === "cancelled") throw new PaymentError("cannot redeem against a cancelled invoice", 409);
  if (invoice.status === "paid") throw new PaymentError("invoice is already fully paid", 409);

  const payer = await db.query.clients.findFirst({ where: eq(clients.id, invoice.clientId) });
  if (payer?.clientType === "third_party") {
    throw new PaymentError("third-party vendors do not have loyalty points", 409);
  }

  return await db.transaction(async (tx) => {
    const cfg = await getLoyaltyConfig(orgId, invoice.branchId);
    if (!cfg.enabled) throw new PaymentError("loyalty points are not enabled for this branch", 409);
    if (cfg.redeemPaisePerPoint <= 0) throw new PaymentError("point redemption value is not configured");

    const wallet = await tx.query.wallets.findFirst({ where: eq(wallets.clientId, invoice.clientId) });
    if (!wallet) throw new PaymentError("client has no wallet");
    
    // Sync points balance first
    const pointsBalance = await getAndUpdateUsablePoints(tx, wallet.id, orgId);
    if (pointsBalance <= 0) throw new PaymentError("client has no points to redeem");
    if (points > pointsBalance) throw new PaymentError(`client only has ${pointsBalance} points`);

    const existingPayments = await tx.select().from(payments).where(eq(payments.invoiceId, invoiceId));
    const alreadyPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = invoice.total - alreadyPaid;
    if (remaining <= 0) throw new PaymentError("nothing left to pay on this invoice");

    const value = points * cfg.redeemPaisePerPoint; // paise
    if (value > remaining) {
      const maxPoints = Math.floor(remaining / cfg.redeemPaisePerPoint);
      throw new PaymentError(`redemption exceeds balance due — redeem at most ${maxPoints} points`);
    }

    const newPoints = wallet.points - points;
    await tx.update(wallets).set({ points: newPoints }).where(eq(wallets.id, wallet.id));
    await tx.insert(pointsTransactions).values({
      walletId: wallet.id,
      orgId,
      type: "redeem",
      points: -points,
      balanceAfter: newPoints,
      refId: invoiceId,
      note: `Redeemed for ₹${(value / 100).toFixed(2)} on invoice`,
    });

    const [payment] = await tx
      .insert(payments)
      .values({ invoiceId, mode: "points", amount: value, txnRef: `${points} pts` })
      .returning();

    const totalPaid = alreadyPaid + value;
    const newStatus = totalPaid >= invoice.total ? "paid" : "partial";
    const [updatedInvoice] = await tx
      .update(invoices)
      .set({ status: newStatus, finalizedAt: newStatus === "paid" ? new Date() : invoice.finalizedAt })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (newStatus === "paid") {
      await tx.update(jobCards).set({ status: "billed" }).where(eq(jobCards.id, invoice.jobCardId));
    }

    await createNotification(orgId, {
      title: "Points Redeemed",
      message: `Redeemed ${points} points (₹${(value / 100).toFixed(2)}) against an invoice.`,
      type: "payment",
    });

    return { invoice: updatedInvoice, payment, redeemedPoints: points, redeemedValue: value, pointsRemaining: newPoints };
  });
}
