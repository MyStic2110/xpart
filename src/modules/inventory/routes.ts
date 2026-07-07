import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  inventoryLots,
  inventoryItems,
  inventoryConsumptions,
  jobCards,
  jobCardProducts,
  jobCardServices,
  invoices,
  vehicles,
  branches
} from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createNotification } from "@/modules/notifications/routes";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

export async function inventoryRoutes(app: FastifyInstance) {
  // Items with their lot's source/invoice/credit context. filter: available | expired | all
  app.get("/inventory/items", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { filter, branchId } = req.query as { filter?: string; branchId?: string };

    let cond = sql`i.org_id = ${auth.orgId}`;
    if (branchId && branchId !== "all") cond = sql`${cond} and l.branch_id = ${branchId}`;
    if (filter === "available") {
      cond = sql`${cond} and i.quantity > 0 and (i.expiry_date is null or i.expiry_date >= current_date)`;
    } else if (filter === "expired") {
      cond = sql`${cond} and i.expiry_date is not null and i.expiry_date < current_date`;
    }

    const rows = await db.execute(sql`
      select i.id, i.product_name as "productName", i.quantity::float8 as quantity, i.unit,
             i.sale_price as "salePrice", i.expiry_date as "expiryDate",
             l.lot_no as "lotNo", l.source_type as "sourceType", l.source_name as "sourceName",
             l.invoice_no as "invoiceNo", l.is_credit as "isCredit",
             (i.expiry_date is not null and i.expiry_date < current_date) as "expired"
      from inventory_items i
      join inventory_lots l on l.id = i.lot_id
      where ${cond}
      order by i.expiry_date asc nulls last
    `);
    return reply.send(rows);
  });

  app.get("/inventory/summary", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId } = req.query as { branchId?: string };
    const b = branchId && branchId !== "all" ? branchId : null;
    const itemBranch = b ? sql`and i.lot_id in (select id from inventory_lots where branch_id = ${b})` : sql``;
    const lotBranch = b ? sql`and l.branch_id = ${b}` : sql``;
    const result = await db.execute(sql`
      select
        (select count(*) from inventory_items i where i.org_id = ${auth.orgId} and i.quantity > 0
            and (i.expiry_date is null or i.expiry_date >= current_date) ${itemBranch}) as available_items,
        (select coalesce(sum(i.quantity * i.sale_price),0) from inventory_items i where i.org_id = ${auth.orgId} and i.quantity > 0
            and (i.expiry_date is null or i.expiry_date >= current_date) ${itemBranch}) as available_value,
        (select count(*) from inventory_items i where i.org_id = ${auth.orgId}
            and i.expiry_date is not null and i.expiry_date < current_date and i.quantity > 0 ${itemBranch}) as expired_items,
        (select coalesce(sum(l.total_amount - l.amount_paid),0) from inventory_lots l
            where l.org_id = ${auth.orgId} and l.is_credit = true ${lotBranch}) as credit_outstanding
    `);
    const r = (result as unknown as Record<string, string | number>[])[0];
    const n = (k: string) => Number(r[k] ?? 0);
    return reply.send({
      availableItems: n("available_items"),
      availableValue: n("available_value"),
      expiredItems: n("expired_items"),
      creditOutstanding: n("credit_outstanding"),
    });
  });

  // Record a purchase: a lot (source/invoice/credit) + its stocked items.
  const purchaseSchema = z.object({
    lotNo: z.string().min(1),
    sourceType: z.enum(["vendor", "client", "mechanic", "unknown"]).default("vendor"),
    sourceName: z.string().optional().or(z.literal("")),
    vendorId: z.string().uuid().optional().nullable(),
    invoiceNo: z.string().optional().or(z.literal("")),
    purchaseDate: z.string().optional().or(z.literal("")),
    isCredit: z.boolean().default(false),
    totalAmount: z.coerce.number().nonnegative().default(0),
    amountPaid: z.coerce.number().nonnegative().default(0),
    items: z
      .array(
        z.object({
          productName: z.string().min(1),
          productId: z.string().uuid().optional().nullable(),
          quantity: z.coerce.number().nonnegative(),
          unit: z.string().optional().or(z.literal("")),
          purchasePrice: z.coerce.number().nonnegative().default(0),
          salePrice: z.coerce.number().nonnegative(),
          vehicleId: z.string().uuid().optional().nullable(),
          expiryDate: z.string().optional().or(z.literal("")),
        })
      )
      .min(1),
  });

  app.post("/inventory/lots", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [lot] = await tx
        .insert(inventoryLots)
        .values({
          orgId: auth.orgId,
          lotNo: d.lotNo,
          sourceType: d.sourceType,
          sourceName: d.sourceName || null,
          vendorId: d.vendorId || null,
          invoiceNo: d.invoiceNo || null,
          purchaseDate: d.purchaseDate || null,
          isCredit: d.isCredit,
          totalAmount: Math.round(d.totalAmount * 100),
          amountPaid: Math.round(d.amountPaid * 100),
        })
        .returning();

      // Find first branch as fallback for auto-created job cards
      const firstBranch = await tx.query.branches.findFirst({ where: eq(branches.orgId, auth.orgId) });
      const branchIdToUse = lot.branchId || firstBranch?.id;

      // Helper function to recalculate job card totals
      async function recalculateJobCard(tx: any, jobCardId: string) {
        const servicesSum = await tx
          .select({ sum: sql<number>`coalesce(sum(qty * price), 0)::int` })
          .from(jobCardServices)
          .where(eq(jobCardServices.jobCardId, jobCardId));

        const productsSum = await tx
          .select({ sum: sql<number>`coalesce(sum(qty * price), 0)::int` })
          .from(jobCardProducts)
          .where(eq(jobCardProducts.jobCardId, jobCardId));

        const subtotal = (servicesSum[0]?.sum ?? 0) + (productsSum[0]?.sum ?? 0);
        const jc = await tx.query.jobCards.findFirst({ where: eq(jobCards.id, jobCardId) });
        if (jc) {
          const discounted = Math.max(subtotal - jc.discount, 0);
          const total = Math.round(discounted * (1 + jc.taxPercent / 100));
          await tx
            .update(jobCards)
            .set({ subtotal, total })
            .where(eq(jobCards.id, jobCardId));

          const inv = await tx.query.invoices.findFirst({ where: eq(invoices.jobCardId, jobCardId) });
          if (inv) {
            await tx
              .update(invoices)
              .set({ subtotal, total })
              .where(eq(invoices.id, inv.id));
          }
        }
      }

      for (const it of d.items) {
        // Insert inventory item
        const [createdItem] = await tx
          .insert(inventoryItems)
          .values({
            orgId: auth.orgId,
            lotId: lot.id,
            productId: it.productId || null,
            productName: it.productName,
            quantity: it.quantity.toString(),
            unit: it.unit || null,
            purchasePrice: Math.round(it.purchasePrice * 100),
            salePrice: Math.round(it.salePrice * 100),
            vehicleId: it.vehicleId || null,
            vendorPaidStatus: d.isCredit ? "unpaid" : "n_a",
            expiryDate: it.expiryDate || null,
          })
          .returning();

        // If it is linked to a vehicle, handle job card appending / creation
        if (it.vehicleId && branchIdToUse) {
          // Find an active job card for this vehicle
          let activeJobCard = await tx.query.jobCards.findFirst({
            where: and(
              eq(jobCards.orgId, auth.orgId),
              eq(jobCards.vehicleId, it.vehicleId),
              sql`${jobCards.status} in ('draft', 'in_progress')`
            ),
          });

          if (!activeJobCard) {
            // Find client of vehicle
            const vehicle = await tx.query.vehicles.findFirst({
              where: eq(vehicles.id, it.vehicleId),
            });
            if (vehicle) {
              [activeJobCard] = await tx
                .insert(jobCards)
                .values({
                  orgId: auth.orgId,
                  branchId: branchIdToUse,
                  clientId: vehicle.clientId,
                  vehicleId: it.vehicleId,
                  jobDate: new Date().toISOString().slice(0, 10),
                  status: "draft",
                  subtotal: 0,
                  total: 0,
                })
                .returning();
            }
          }

          if (activeJobCard) {
            // Add product line item to job card
            await tx.insert(jobCardProducts).values({
              jobCardId: activeJobCard.id,
              productId: it.productId || null,
              inventoryItemId: createdItem.id,
              productName: it.productName,
              qty: Math.max(1, Math.round(it.quantity)),
              price: Math.round(it.salePrice * 100),
            });

            // Update inventory item with linked jobCardId
            await tx
              .update(inventoryItems)
              .set({ jobCardId: activeJobCard.id })
              .where(eq(inventoryItems.id, createdItem.id));

            // Recalculate job card subtotal and total
            await recalculateJobCard(tx, activeJobCard.id);
          }
        }
      }
      return lot;
    });

    return reply.code(201).send(result);
  });

  // Record a credit payment against a lot.
  app.post("/inventory/lots/:id/pay", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = z.object({ amount: z.coerce.number().positive() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const lot = await db.query.inventoryLots.findFirst({ where: and(eq(inventoryLots.id, id), eq(inventoryLots.orgId, auth.orgId)) });
    if (!lot) return reply.code(404).send({ error: "lot not found" });

    const newPaid = Math.min(lot.amountPaid + Math.round(parsed.data.amount * 100), lot.totalAmount);
    let paymentPaise = newPaid - lot.amountPaid;

    await db.transaction(async (tx) => {
      // Update lot payment details
      await tx
        .update(inventoryLots)
        .set({ amountPaid: newPaid, isCredit: newPaid < lot.totalAmount })
        .where(eq(inventoryLots.id, id));

      if (paymentPaise > 0) {
        // Find all unpaid items for this lot
        const itemsToPay = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.lotId, id),
              eq(inventoryItems.vendorPaidStatus, "unpaid")
            )
          );

        for (const item of itemsToPay) {
          if (paymentPaise <= 0) break;

          const qty = Number(item.quantity);
          const totalCost = item.purchasePrice * qty;
          const outstanding = totalCost - item.vendorAmountPaid;

          if (outstanding <= 0) continue;

          let applied = 0;
          let nextStatus = "unpaid";

          if (paymentPaise >= outstanding) {
            applied = outstanding;
            paymentPaise -= outstanding;
            nextStatus = "paid";
          } else {
            applied = paymentPaise;
            paymentPaise = 0;
            nextStatus = "unpaid";
          }

          await tx
            .update(inventoryItems)
            .set({
              vendorAmountPaid: item.vendorAmountPaid + applied,
              vendorPaidStatus: nextStatus,
            })
            .where(eq(inventoryItems.id, item.id));
        }
      }
    });

    const updated = await db.query.inventoryLots.findFirst({ where: eq(inventoryLots.id, id) });
    return reply.send(updated);
  });

  // Consume stock of a specific inventory item
  app.post("/inventory/items/:id/consume", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = z.object({ quantity: z.coerce.number().positive(), notes: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const item = await db.query.inventoryItems.findFirst({ where: and(eq(inventoryItems.id, id), eq(inventoryItems.orgId, auth.orgId)) });
    if (!item) return reply.code(404).send({ error: "item not found" });

    const currentQty = Number(item.quantity);
    if (parsed.data.quantity > currentQty) {
      return reply.code(400).send({ error: `cannot consume more than available stock (${currentQty} remaining)` });
    }

    const newQty = (currentQty - parsed.data.quantity).toString();
    const [updated] = await db
      .update(inventoryItems)
      .set({ quantity: newQty })
      .where(eq(inventoryItems.id, id))
      .returning();

    await db.insert(inventoryConsumptions).values({
      orgId: auth.orgId,
      itemId: id,
      productName: item.productName,
      quantity: parsed.data.quantity.toString(),
      consumedBy: auth.userId,
      notes: parsed.data.notes || null,
    });

    // Trigger low stock warning notification
    if (Number(newQty) <= 2) {
      const lot = await db.query.inventoryLots.findFirst({ where: eq(inventoryLots.id, item.lotId) });
      await createNotification(auth.orgId, {
        title: "Low Stock Warning",
        message: `Product "${item.productName}" (Lot #${lot?.lotNo || id.slice(0, 4)}) is running low. Remaining: ${newQty} ${item.unit || "units"}.`,
        type: "stock",
      });
    }

    return reply.send({ success: true, item: updated });
  });

  app.get("/inventory/consumptions", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(inventoryConsumptions)
      .where(eq(inventoryConsumptions.orgId, auth.orgId))
      .orderBy(desc(inventoryConsumptions.createdAt))
      .limit(100);
    return reply.send(rows);
  });
}
