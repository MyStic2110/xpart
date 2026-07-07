import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, inventoryLots, inventoryItems, vehicles, clients, jobCards, invoices, expenses, expenseCategories, branches, users } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

const createVendorSchema = z.object({
  name: z.string().min(1),
  contactNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

const updateVendorSchema = createVendorSchema.partial();

export async function vendorRoutes(app: FastifyInstance) {
  // CRUD: List all vendors
  app.get("/vendors", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.orgId, auth.orgId))
      .orderBy(vendors.name);
    return reply.send(rows);
  });

  // CRUD: Create vendor
  app.post("/vendors", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createVendorSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const [row] = await db
      .insert(vendors)
      .values({
        orgId: auth.orgId,
        name: d.name,
        contactNumber: d.contactNumber,
        email: d.email || null,
        address: d.address || null,
      })
      .returning();
    return reply.code(201).send(row);
  });

  // CRUD: Update vendor
  app.patch("/vendors/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateVendorSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.contactNumber !== undefined) updates.contactNumber = d.contactNumber;
    if (d.email !== undefined) updates.email = d.email || null;
    if (d.address !== undefined) updates.address = d.address || null;

    if (Object.keys(updates).length === 0) return reply.code(400).send({ error: "no fields to update" });

    const [row] = await db
      .update(vendors)
      .set(updates)
      .where(and(eq(vendors.id, id), eq(vendors.orgId, auth.orgId)))
      .returning();

    if (!row) return reply.code(404).send({ error: "vendor not found" });
    return reply.send(row);
  });

  // CRUD: Delete vendor
  app.delete("/vendors/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };

    const [deleted] = await db
      .delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.orgId, auth.orgId)))
      .returning();

    if (!deleted) return reply.code(404).send({ error: "vendor not found" });
    return reply.send({ success: true });
  });

  // GET: Vendor Credit Ledger
  app.get("/vendors/:id/ledger", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const q = req.query as Record<string, string | undefined>;
    
    const search = q.search || "";
    const period = q.period || "all";
    const page = Number(q.page || 1);
    const limit = Number(q.limit || 10);

    let dateFilter = sql``;
    const now = new Date();
    if (period === "day") {
      const todayStr = now.toISOString().slice(0, 10);
      dateFilter = sql`and i.created_at::date = ${todayStr}::date`;
    } else if (period === "week") {
      dateFilter = sql`and date_trunc('week', i.created_at) = date_trunc('week', current_date)`;
    } else if (period === "month") {
      dateFilter = sql`and date_trunc('month', i.created_at) = date_trunc('month', current_date)`;
    }

    let searchFilter = sql``;
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      searchFilter = sql`and (
        v.plate_number ilike ${term}
        or c.name ilike ${term}
        or i.product_name ilike ${term}
      )`;
    }

    // Fetch all inventory items under credit lots for this vendor matching filters
    const query = sql`
      select i.id, i.product_name as "productName", i.quantity::float8 as quantity, i.unit,
             i.purchase_price as "purchasePrice", i.sale_price as "salePrice",
             i.vendor_amount_paid as "vendorAmountPaid", i.vendor_paid_status as "vendorPaidStatus",
             i.vehicle_id as "vehicleId", v.plate_number as "plateNumber",
             c.name as "clientName", c.phone as "clientPhone",
             i.job_card_id as "jobCardId", inv.status as "customerInvoiceStatus", inv.invoice_no as "customerInvoiceNo",
             l.lot_no as "lotNo", l.invoice_no as "supplierInvoiceNo",
             l.branch_id as "branchId"
      from inventory_items i
      join inventory_lots l on l.id = i.lot_id
      left join vehicles v on v.id = i.vehicle_id
      left join clients c on c.id = v.client_id
      left join job_cards j on j.id = i.job_card_id
      left join invoices inv on inv.job_card_id = j.id
      where i.org_id = ${auth.orgId}
        and l.vendor_id = ${id}
        and i.vendor_paid_status != 'n_a'
        and i.vehicle_id is not null
        ${dateFilter}
        ${searchFilter}
      order by i.created_at desc
    `;

    const rows = (await db.execute(query)) as unknown as any[];

    // Group rows by vehicle plate number
    const groups: Record<string, {
      vehicleId: string;
      plateNumber: string;
      clientName: string;
      clientPhone: string;
      customerInvoiceStatus: string;
      customerInvoiceNo: string;
      totalPurchaseDue: number; // paise
      totalSaleAmount: number; // paise
      totalPaidToVendor: number; // paise
      margin: number; // paise
      items: any[];
    }> = {};

    for (const r of rows) {
      const plate = r.plateNumber || "Unknown";
      if (!groups[plate]) {
        groups[plate] = {
          vehicleId: r.vehicleId,
          plateNumber: plate,
          clientName: r.clientName || "Unknown Client",
          clientPhone: r.clientPhone || "",
          customerInvoiceStatus: r.customerInvoiceStatus || "draft",
          customerInvoiceNo: r.customerInvoiceNo || "Draft",
          totalPurchaseDue: 0,
          totalSaleAmount: 0,
          totalPaidToVendor: 0,
          margin: 0,
          items: [],
        };
      }

      const qty = r.quantity || 0;
      const purchasePrice = r.purchasePrice || 0;
      const salePrice = r.salePrice || 0;
      const vendorAmountPaid = r.vendorAmountPaid || 0;

      const itemCost = purchasePrice * qty;
      const itemSale = salePrice * qty;
      const itemMargin = itemSale - itemCost;

      groups[plate].totalPurchaseDue += itemCost;
      groups[plate].totalSaleAmount += itemSale;
      groups[plate].totalPaidToVendor += vendorAmountPaid;
      groups[plate].margin += itemMargin;
      groups[plate].items.push(r);
    }

    const allGroups = Object.values(groups);

    // Calculate totals over all filtered groups
    const totals = {
      creditOwed: allGroups.reduce((sum, g) => sum + g.totalPurchaseDue, 0),
      settled: allGroups.reduce((sum, g) => sum + g.totalPaidToVendor, 0),
      outstanding: allGroups.reduce((sum, g) => sum + (g.totalPurchaseDue - g.totalPaidToVendor), 0),
      margin: allGroups.reduce((sum, g) => sum + g.margin, 0),
      readyToSettle: allGroups.reduce((sum, g) => {
        if (g.customerInvoiceStatus === "paid") {
          return sum + (g.totalPurchaseDue - g.totalPaidToVendor);
        }
        return sum;
      }, 0),
    };

    const totalGroups = allGroups.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedGroups = allGroups.slice(startIndex, endIndex);

    return reply.send({
      data: paginatedGroups,
      total: totalGroups,
      page,
      limit,
      totals,
    });
  });

  // POST: Settle Vendor for a vehicle (Full / Partial payment)
  app.post("/vendors/:id/pay-vehicle", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = z.object({
      vehicleId: z.string().uuid(),
      amount: z.coerce.number().positive(),
      paymentMode: z.string().min(1).default("UPI"),
    }).safeParse(req.body);

    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { vehicleId, amount, paymentMode } = parsed.data;
    let paymentPaise = Math.round(amount * 100);

    // Fetch all unpaid credit items for this vehicle and vendor
    const itemsToPay = await db
      .select({
        itemId: inventoryItems.id,
        purchasePrice: inventoryItems.purchasePrice,
        quantity: inventoryItems.quantity,
        vendorAmountPaid: inventoryItems.vendorAmountPaid,
        lotId: inventoryItems.lotId,
        branchId: inventoryLots.branchId,
      })
      .from(inventoryItems)
      .innerJoin(inventoryLots, eq(inventoryLots.id, inventoryItems.lotId))
      .where(
        and(
          eq(inventoryItems.orgId, auth.orgId),
          eq(inventoryItems.vehicleId, vehicleId),
          eq(inventoryLots.vendorId, id),
          eq(inventoryLots.isCredit, true),
          eq(inventoryItems.vendorPaidStatus, "unpaid")
        )
      );

    if (itemsToPay.length === 0) {
      return reply.code(400).send({ error: "no unpaid items found for this vehicle and vendor" });
    }

    await db.transaction(async (tx) => {
      let totalAppliedPaise = 0;

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

        totalAppliedPaise += applied;
        const newPaid = item.vendorAmountPaid + applied;

        await tx
          .update(inventoryItems)
          .set({
            vendorAmountPaid: newPaid,
            vendorPaidStatus: nextStatus,
          })
          .where(eq(inventoryItems.id, item.itemId));

        // Track how much we paid to the lot
        const lot = await tx.query.inventoryLots.findFirst({
          where: eq(inventoryLots.id, item.lotId),
        });

        if (lot) {
          const newLotPaid = Math.min(lot.amountPaid + applied, lot.totalAmount);
          await tx
            .update(inventoryLots)
            .set({
              amountPaid: newLotPaid,
              isCredit: newLotPaid < lot.totalAmount,
            })
            .where(eq(inventoryLots.id, item.lotId));
        }
      }

      // If any amount was actually applied, record as an Expense
      if (totalAppliedPaise > 0) {
        // 1. Ensure "Parts" Category exists for this Org
        let category = await tx.query.expenseCategories.findFirst({
          where: and(
            eq(expenseCategories.orgId, auth.orgId),
            eq(expenseCategories.name, "Parts")
          ),
        });
        
        if (!category) {
          const [newCat] = await tx
            .insert(expenseCategories)
            .values({
              orgId: auth.orgId,
              name: "Parts",
              description: "Auto-created category for vendor parts payment settlements",
            })
            .returning();
          category = newCat;
        }

        // 2. Resolve branchId (fallback to org's first branch)
        let finalBranchId = itemsToPay[0]?.branchId;
        if (!finalBranchId) {
          const firstBranch = await tx.query.branches.findFirst({
            where: eq(branches.orgId, auth.orgId),
          });
          finalBranchId = firstBranch?.id || null;
        }

        // 3. Resolve recipient (vendor name)
        const vendorRow = await tx.query.vendors.findFirst({
          where: eq(vendors.id, id),
        });
        const recipientName = vendorRow ? vendorRow.name : "Vendor";

        // 4. Resolve paidBy (staff user's name)
        const userRow = await tx.query.users.findFirst({
          where: eq(users.id, auth.userId),
        });
        const paidByName = userRow ? userRow.name : "Admin";

        // 5. Resolve vehicle plate number for note context
        const vehicleRow = await tx.query.vehicles.findFirst({
          where: eq(vehicles.id, vehicleId),
        });
        const plateStr = vehicleRow ? vehicleRow.plateNumber : "Unknown Vehicle";

        // 6. Local Date string YYYY-MM-DD
        const nowLocal = new Date();
        const year = nowLocal.getFullYear();
        const month = String(nowLocal.getMonth() + 1).padStart(2, "0");
        const day = String(nowLocal.getDate()).padStart(2, "0");
        const localDateStr = `${year}-${month}-${day}`;

        // 7. Insert the Expense Record
        await tx.insert(expenses).values({
          orgId: auth.orgId,
          branchId: finalBranchId,
          categoryId: category ? category.id : null,
          expenseDate: localDateStr,
          amount: totalAppliedPaise,
          paymentMode,
          recipient: recipientName,
          paidBy: paidByName,
          notes: `Vendor payment for parts on vehicle: ${plateStr}`,
        });
      }
    });

    return reply.send({ success: true, remainingBalanceRupees: paymentPaise / 100 });
  });
}
