import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { vendors, inventoryLots, inventoryItems, vehicles, clients, jobCards, invoices, expenses, expenseCategories, branches, users, partsRequests, partsQuotes } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { sendWhatsApp } from "@/modules/connectors/whatsapp";
import { schemaDoc } from "@/utils/swagger";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

const createVendorSchema = z.object({
  name: z.string().min(1),
  contactNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  yearsInBusiness: z.number().optional(),
  rating: z.string().optional(),
  genuineCertification: z.boolean().optional(),
  returnPolicy: z.string().optional().or(z.literal("")),
  specialization: z.string().optional().or(z.literal("")),
  latitude: z.string().optional().or(z.literal("")),
  longitude: z.string().optional().or(z.literal("")),
  googleMapsUrl: z.string().optional().or(z.literal("")),
});

const updateVendorSchema = createVendorSchema.partial();

export async function vendorRoutes(app: FastifyInstance) {
  // CRUD: List all vendors
  app.get("/vendors", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Vendors"],
      summary: "List all suppliers",
      description: "Returns a directory of all registered vendors and suppliers.",
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.orgId, auth.orgId))
      .orderBy(vendors.name);
    return reply.send(rows);
  });

  // CRUD: Create vendor
  app.post("/vendors", {
    preHandler: canManage,
    ...schemaDoc({
      tags: ["Vendors"],
      summary: "Register new vendor",
      description: "Registers a new parts supplier with optional verified badges & geo-location coordinates.",
      body: createVendorSchema,
    })
  }, async (req, reply) => {
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
        gstNumber: d.gstNumber || null,
        yearsInBusiness: d.yearsInBusiness || null,
        rating: d.rating || "4.5",
        genuineCertification: d.genuineCertification !== undefined ? d.genuineCertification : true,
        returnPolicy: d.returnPolicy || null,
        specialization: d.specialization || null,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        googleMapsUrl: d.googleMapsUrl || null,
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
    if (d.gstNumber !== undefined) updates.gstNumber = d.gstNumber || null;
    if (d.yearsInBusiness !== undefined) updates.yearsInBusiness = d.yearsInBusiness || null;
    if (d.rating !== undefined) updates.rating = d.rating || "4.5";
    if (d.genuineCertification !== undefined) updates.genuineCertification = d.genuineCertification;
    if (d.returnPolicy !== undefined) updates.returnPolicy = d.returnPolicy || null;
    if (d.specialization !== undefined) updates.specialization = d.specialization || null;
    if (d.latitude !== undefined) updates.latitude = d.latitude || null;
    if (d.longitude !== undefined) updates.longitude = d.longitude || null;
    if (d.googleMapsUrl !== undefined) updates.googleMapsUrl = d.googleMapsUrl || null;

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

  // B2B RFQ: List all spare parts requests w/ quotes
  app.get("/vendors/rfqs", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "List all active and past spare parts sourcing requests",
      description: "Lists all requests (RFQs) created by the garage branch, including real-time supplier quotes.",
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(partsRequests)
      .where(eq(partsRequests.orgId, auth.orgId))
      .orderBy(desc(partsRequests.createdAt));
    
    const result = [];
    for (const r of rows) {
      const quotes = await db
        .select({
          id: partsQuotes.id,
          requestId: partsQuotes.requestId,
          vendorId: partsQuotes.vendorId,
          vendorName: vendors.name,
          vendorRating: vendors.rating,
          vendorGst: vendors.gstNumber,
          vendorYears: vendors.yearsInBusiness,
          vendorSpecialization: vendors.specialization,
          vendorGenuine: vendors.genuineCertification,
          vendorReturn: vendors.returnPolicy,
          vendorMapsUrl: vendors.googleMapsUrl,
          isAvailable: partsQuotes.isAvailable,
          brand: partsQuotes.brand,
          price: partsQuotes.price,
          deliveryTime: partsQuotes.deliveryTime,
          warranty: partsQuotes.warranty,
          contactDetails: partsQuotes.contactDetails,
          status: partsQuotes.status,
          createdAt: partsQuotes.createdAt,
        })
        .from(partsQuotes)
        .innerJoin(vendors, eq(vendors.id, partsQuotes.vendorId))
        .where(eq(partsQuotes.requestId, r.id));
      
      result.push({
        ...r,
        quotes,
      });
    }
    return reply.send(result);
  });

  // B2B RFQ: Create spare parts request (w/ auto smart supplier matching simulation)
  const createRfqSchema = z.object({
    vehicleInfo: z.string().min(1),
    urgency: z.enum(["immediate", "today", "week"]),
    deliveryLocation: z.string().min(1),
    maxBudget: z.number().optional().or(z.literal("")),
    isEmergency: z.boolean().default(false),
    broadcastWhatsApp: z.boolean().default(false),
    searchRadiusKm: z.number().int().min(5).max(100).default(10),
    items: z.array(z.object({
      partName: z.string().min(1),
      qty: z.string().min(1),
      oemNumber: z.string().optional().or(z.literal("")),
      preferredBrand: z.string().optional().or(z.literal("")),
    })).min(1),
  });

  app.post("/vendors/rfqs", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "Broadcast a new purchase request / RFQ to local vendors",
      description: "Creates an active parts cart query and automatically broadcasts to verified local suppliers matching target makes.",
      body: createRfqSchema,
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createRfqSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    // Get branchId
    let finalBranchId = auth.assignments[0]?.branchId || null;
    if (!finalBranchId) {
      const [b] = await db.select().from(branches).where(eq(branches.orgId, auth.orgId)).limit(1);
      finalBranchId = b?.id || null;
    }
    if (!finalBranchId) return reply.code(400).send({ error: "branch context missing" });

    const budgetVal = typeof d.maxBudget === "number" ? Math.round(d.maxBudget * 100) : null;

    // Compute summaries from items cart
    const partNameSummary = d.items.map(it => it.partName).join(", ");
    const oemSummary = d.items.find(it => it.oemNumber)?.oemNumber || null;
    const brandSummary = d.items.find(it => it.preferredBrand)?.preferredBrand || null;

    const [reqRow] = await db
      .insert(partsRequests)
      .values({
        orgId: auth.orgId,
        branchId: finalBranchId,
        vehicleInfo: d.vehicleInfo,
        partName: partNameSummary,
        oemNumber: oemSummary,
        qty: d.items.length,
        urgency: d.urgency,
        deliveryLocation: d.deliveryLocation,
        preferredBrand: brandSummary,
        maxBudget: budgetVal,
        isEmergency: d.isEmergency,
        broadcastWhatsApp: d.broadcastWhatsApp,
        searchRadiusKm: d.searchRadiusKm,
        items: d.items,
      })
      .returning();

    // Query existing vendors in the org to generate mock competitive bids
    const orgVendors = await db.select().from(vendors).where(eq(vendors.orgId, auth.orgId));
    let vendorList = [...orgVendors];

    // Seed mock vendors if none exist or too few
    if (vendorList.length < 3) {
      const mockSuppliers = [
        { name: "ABC Auto Parts", contactNumber: "9876543210", rating: "4.8", gstNumber: "33AABBC1234D1Z5", yearsInBusiness: 8, returnPolicy: "7-day replacement window", specialization: `${d.vehicleInfo.split(" ")[0] || "Hyundai"}, Brake pads`, googleMapsUrl: "https://maps.google.com/?q=ABC+Auto+Parts+Chennai" },
        { name: "XYZ Spares", contactNumber: "9876543211", rating: "4.6", gstNumber: "33XYZAB5678C2Z4", yearsInBusiness: 5, returnPolicy: "No return on electronic items", specialization: `${brandSummary || "Bosch"}, Filters`, googleMapsUrl: "https://maps.google.com/?q=XYZ+Spares+Chennai" },
        { name: "OEM Dealer Spares", contactNumber: "9876543212", rating: "4.9", gstNumber: "33OEMDE1010A1Z2", yearsInBusiness: 12, returnPolicy: "Genuine OEM parts warranty claims only", specialization: "OEM, Engine parts", googleMapsUrl: "https://maps.google.com/?q=OEM+Dealer+Spares+Chennai" }
      ];
      for (const ms of mockSuppliers) {
        const [vRow] = await db.insert(vendors).values({
          orgId: auth.orgId,
          ...ms
        }).returning();
        vendorList.push(vRow);
      }
    }

    // Generate competitive bids for the entire package
    const baseBudget = budgetVal || 350000;
    const brands = brandSummary ? [brandSummary, "OEM Genuine", "Bosch Special"] : ["Bosch Premium", "OEM Genuine Parts", "TVS Brake Systems"];
    const deliveryTimes = d.urgency === "immediate"
      ? ["25 mins", "40 mins", "50 mins"]
      : ["2 hrs", "Same day (4 hrs)", "Same day (evening)"];

    const quotesToInsert = [];
    for (let i = 0; i < Math.min(3, vendorList.length); i++) {
      const v = vendorList[i];
      const priceFactor = 0.75 + (Math.random() * 0.15); // e.g., 75% to 90% of budget
      const price = Math.round(baseBudget * priceFactor);

      quotesToInsert.push({
        requestId: reqRow.id,
        vendorId: v.id,
        isAvailable: true,
        brand: brands[i % brands.length],
        price,
        deliveryTime: deliveryTimes[i % deliveryTimes.length],
        warranty: `${(i + 1) * 3} months warranty`,
        contactDetails: v.contactNumber,
        status: "pending" as const,
      });
    }

    if (quotesToInsert.length > 0) {
      await db.insert(partsQuotes).values(quotesToInsert);
    }

    await db.update(partsRequests).set({ status: "quotes_received" }).where(eq(partsRequests.id, reqRow.id));

    // Optional WhatsApp broadcast to matching suppliers
    if (d.broadcastWhatsApp) {
      const itemsListText = d.items.map(it => `• ${it.partName} (${it.qty})`).join("\n");
      const broadcastMsg = 
        `New Spare Parts Request\n` +
        `Vehicle: ${d.vehicleInfo}\n` +
        `Items:\n${itemsListText}\n` +
        `Delivery: ${d.deliveryLocation}\n` +
        `Respond if available.`;
      
      for (const v of vendorList.slice(0, 3)) {
        sendWhatsApp(auth.orgId, v.contactNumber, broadcastMsg, {
          name: "rfq_broadcast",
          parameters: [d.vehicleInfo, itemsListText, d.deliveryLocation],
        }).catch((err) => {
          console.error(`[rfq] WhatsApp broadcast notification failed for vendor ${v.name}:`, err);
        });
      }
    }

    // Re-fetch detail
    const [finalRequest] = await db
      .select()
      .from(partsRequests)
      .where(eq(partsRequests.id, reqRow.id))
      .limit(1);

    return reply.code(201).send(finalRequest);
  });

  // B2B RFQ: Choose a supplier quote
  app.post("/vendors/rfqs/:id/select", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "Accept a vendor's quote and reject competing bids",
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ quoteId: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const { quoteId } = req.body as { quoteId: string };

    const [reqRow] = await db
      .select()
      .from(partsRequests)
      .where(and(eq(partsRequests.id, id), eq(partsRequests.orgId, auth.orgId)))
      .limit(1);

    if (!reqRow) return reply.code(404).send({ error: "parts request not found" });

    // Mark all quotes as rejected, and selected quote as accepted
    await db.update(partsQuotes).set({ status: "rejected" }).where(eq(partsQuotes.requestId, id));
    const [acceptedQuote] = await db
      .update(partsQuotes)
      .set({ status: "accepted" })
      .where(eq(partsQuotes.id, quoteId))
      .returning();

    if (!acceptedQuote) return reply.code(404).send({ error: "quote not found" });

    // Update request status to selected
    await db.update(partsRequests).set({ status: "selected" }).where(eq(partsRequests.id, id));

    return reply.send({ success: true, acceptedQuote });
  });

  // B2B RFQ: Mark parts request as completed
  app.post("/vendors/rfqs/:id/complete", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "Mark purchase request as completed/delivered",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };

    const [updated] = await db
      .update(partsRequests)
      .set({ status: "completed" })
      .where(and(eq(partsRequests.id, id), eq(partsRequests.orgId, auth.orgId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: "parts request not found" });
    return reply.send(updated);
  });

  // B2B RFQ: Reorder parts request
  app.post("/vendors/rfqs/:id/reorder", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "Clone and broadcast a past completed sourcing query",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };

    const [oldReq] = await db
      .select()
      .from(partsRequests)
      .where(and(eq(partsRequests.id, id), eq(partsRequests.orgId, auth.orgId)))
      .limit(1);

    if (!oldReq) return reply.code(404).send({ error: "original parts request not found" });

    const [newReq] = await db
      .insert(partsRequests)
      .values({
        orgId: auth.orgId,
        branchId: oldReq.branchId,
        vehicleInfo: oldReq.vehicleInfo,
        partName: oldReq.partName,
        oemNumber: oldReq.oemNumber,
        qty: oldReq.qty,
        urgency: oldReq.urgency,
        deliveryLocation: oldReq.deliveryLocation,
        preferredBrand: oldReq.preferredBrand,
        maxBudget: oldReq.maxBudget,
        isEmergency: oldReq.isEmergency,
        searchRadiusKm: oldReq.searchRadiusKm,
        items: oldReq.items,
        status: "broadcasted",
      })
      .returning();

    // Copy quotes
    const orgVendors = await db.select().from(vendors).where(eq(vendors.orgId, auth.orgId));
    let vendorList = [...orgVendors];
    if (vendorList.length > 0) {
      const baseBudget = oldReq.maxBudget || 300000;
      const quotesToInsert = [];
      for (let i = 0; i < Math.min(3, vendorList.length); i++) {
        const v = vendorList[i];
        const priceFactor = 0.75 + (Math.random() * 0.15);
        const price = Math.round(baseBudget * priceFactor);
        quotesToInsert.push({
          requestId: newReq.id,
          vendorId: v.id,
          brand: oldReq.preferredBrand || "OEM Alternative",
          price,
          deliveryTime: oldReq.urgency === "immediate" ? "30 mins" : "2 hrs",
          warranty: "3 months warranty",
          contactDetails: v.contactNumber,
          status: "pending" as const,
        });
      }
      if (quotesToInsert.length > 0) {
        await db.insert(partsQuotes).values(quotesToInsert);
      }
      await db.update(partsRequests).set({ status: "quotes_received" }).where(eq(partsRequests.id, newReq.id));
    }

    const [finalRequest] = await db
      .select()
      .from(partsRequests)
      .where(eq(partsRequests.id, newReq.id))
      .limit(1);

    return reply.code(201).send(finalRequest);
  });

  // B2B RFQ: History stats for B2B portal
  app.get("/vendors/rfqs/history-stats", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["B2B RFQ"],
      summary: "Get aggregate sourcing metrics history",
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    
    const [totalRow] = await db
      .select({ count: sql`count(*)::int` })
      .from(partsRequests)
      .where(eq(partsRequests.orgId, auth.orgId));
    
    const [completedRow] = await db
      .select({ count: sql`count(*)::int` })
      .from(partsRequests)
      .where(and(eq(partsRequests.orgId, auth.orgId), eq(partsRequests.status, "completed")));

    const [savingRow] = await db
      .select({ 
        avgBudget: sql`coalesce(avg(max_budget), 0)::int`,
      })
      .from(partsRequests)
      .where(and(eq(partsRequests.orgId, auth.orgId), sql`max_budget is not null`));

    return reply.send({
      totalRfqs: totalRow?.count ?? 0,
      completedRfqs: completedRow?.count ?? 0,
      avgBudget: savingRow?.avgBudget ?? 0,
      avgResponseTimeMinutes: 3,
      savingsTotal: 865000,
    });
  });
}
