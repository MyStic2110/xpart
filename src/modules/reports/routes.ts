import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte, lt, inArray, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  jobCards,
  invoices,
  payments,
  clients,
  vehicles,
  users,
  jobCardMechanics,
  staffProfiles,
  attendance,
  enquiries,
  vehicleMakes,
  vehicleModels,
  branches,
  wallets,
  walletTransactions,
  expenses,
  expenseCategories,
} from "@/db/schema";
import { requireAuth } from "@/middleware/auth";

export async function reportsRoutes(app: FastifyInstance) {
  // Helper to parse dates into Date objects or string ISOs
  function parseDateParams(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(`${startDate}T00:00:00Z`) : undefined;
    const end = endDate ? new Date(`${endDate}T23:59:59Z`) : undefined;
    return { start, end };
  }

  // 1. Daily Reports
  app.get("/reports/daily-reports", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    // Let's query job cards, invoices, payments, and discounts in the date range, then group them by date.
    // To make this simple and robust across DB dialects, we can query the entities and group them in memory.
    const jcConditions = [eq(jobCards.orgId, auth.orgId)];
    if (branchId && branchId !== "all") jcConditions.push(eq(jobCards.branchId, branchId));
    if (startDate) jcConditions.push(gte(jobCards.jobDate, startDate));
    if (endDate) jcConditions.push(lte(jobCards.jobDate, endDate));

    const jcRows = await db.select({
      jobDate: jobCards.jobDate,
      total: jobCards.total,
      discount: jobCards.discount,
    }).from(jobCards).where(and(...jcConditions));

    const invConditions = [eq(invoices.orgId, auth.orgId)];
    if (branchId && branchId !== "all") invConditions.push(eq(invoices.branchId, branchId));
    if (start) invConditions.push(gte(invoices.createdAt, start));
    if (end) invConditions.push(lte(invoices.createdAt, end));

    const invRows = await db.select({
      createdAt: invoices.createdAt,
      total: invoices.total,
    }).from(invoices).where(and(...invConditions));

    const payConditions = [eq(invoices.orgId, auth.orgId)];
    if (branchId && branchId !== "all") payConditions.push(eq(invoices.branchId, branchId));
    if (start) payConditions.push(gte(payments.paidAt, start));
    if (end) payConditions.push(lte(payments.paidAt, end));

    const payRows = await db.select({
      paidAt: payments.paidAt,
      amount: payments.amount,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(...payConditions));

    // Group by Date
    const dailyMap: Record<string, {
      date: string;
      jobCardsCount: number;
      invoicesCount: number;
      invoicedAmount: number;
      paymentsCollected: number;
      discountsGiven: number;
    }> = {};

    const getOrCreate = (dateStr: string) => {
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = {
          date: dateStr,
          jobCardsCount: 0,
          invoicesCount: 0,
          invoicedAmount: 0,
          paymentsCollected: 0,
          discountsGiven: 0,
        };
      }
      return dailyMap[dateStr];
    };

    jcRows.forEach((r) => {
      const day = r.jobDate;
      const entry = getOrCreate(day);
      entry.jobCardsCount += 1;
      entry.discountsGiven += r.discount;
    });

    invRows.forEach((r) => {
      const day = r.createdAt.toISOString().slice(0, 10);
      const entry = getOrCreate(day);
      entry.invoicesCount += 1;
      entry.invoicedAmount += r.total;
    });

    payRows.forEach((r) => {
      const day = r.paidAt.toISOString().slice(0, 10);
      const entry = getOrCreate(day);
      entry.paymentsCollected += r.amount;
    });

    const sortedDaily = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
    return reply.send(sortedDaily);
  });

  // 2. Day Summary
  app.get("/reports/day-summary", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    // Filter conditions
    const jcCond = [eq(jobCards.orgId, auth.orgId)];
    const invCond = [eq(invoices.orgId, auth.orgId)];
    const payCond = [eq(invoices.orgId, auth.orgId)];
    const enqCond = [eq(enquiries.orgId, auth.orgId)];

    if (branchId && branchId !== "all") {
      jcCond.push(eq(jobCards.branchId, branchId));
      invCond.push(eq(invoices.branchId, branchId));
      payCond.push(eq(invoices.branchId, branchId));
      enqCond.push(eq(enquiries.branchId, branchId));
    }
    if (startDate) {
      jcCond.push(gte(jobCards.jobDate, startDate));
      enqCond.push(gte(enquiries.dateToFollow, startDate)); // or enquiries.createdAt
    }
    if (endDate) {
      jcCond.push(lte(jobCards.jobDate, endDate));
      enqCond.push(lte(enquiries.dateToFollow, endDate));
    }
    if (start) {
      invCond.push(gte(invoices.createdAt, start));
      payCond.push(gte(payments.paidAt, start));
    }
    if (end) {
      invCond.push(lte(invoices.createdAt, end));
      payCond.push(lte(payments.paidAt, end));
    }

    const jcRows = await db.select({
      id: jobCards.id,
      date: jobCards.jobDate,
      status: jobCards.status,
      clientName: clients.name,
      total: jobCards.total,
    })
    .from(jobCards)
    .innerJoin(clients, eq(jobCards.clientId, clients.id))
    .where(and(...jcCond));

    const invRows = await db.select({
      id: invoices.id,
      date: invoices.createdAt,
      status: invoices.status,
      clientName: clients.name,
      total: invoices.total,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(...invCond));

    const payRows = await db.select({
      id: payments.id,
      date: payments.paidAt,
      mode: payments.mode,
      clientName: clients.name,
      amount: payments.amount,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(...payCond));

    const enqRows = await db.select({
      id: enquiries.id,
      date: enquiries.createdAt,
      clientName: enquiries.clientName,
      type: enquiries.enquiryType,
      status: enquiries.leadStatus,
    })
    .from(enquiries)
    .where(and(...enqCond));

    // Map all into one general transaction log
    const logs: {
      date: string;
      type: "Job Card" | "Invoice" | "Payment" | "Enquiry";
      referenceId: string;
      clientName: string;
      detail: string;
      value: number; // in paise
    }[] = [];

    jcRows.forEach((r) => {
      logs.push({
        date: r.date,
        type: "Job Card",
        referenceId: r.id.slice(0, 8),
        clientName: r.clientName,
        detail: `Status: ${r.status}`,
        value: r.total,
      });
    });

    invRows.forEach((r) => {
      logs.push({
        date: r.date.toISOString().slice(0, 10),
        type: "Invoice",
        referenceId: r.id.slice(0, 8),
        clientName: r.clientName,
        detail: `Status: ${r.status}`,
        value: r.total,
      });
    });

    payRows.forEach((r) => {
      logs.push({
        date: r.date.toISOString().slice(0, 10),
        type: "Payment",
        referenceId: r.id.slice(0, 8),
        clientName: r.clientName,
        detail: `Mode: ${r.mode}`,
        value: r.amount,
      });
    });

    enqRows.forEach((r) => {
      logs.push({
        date: r.date.toISOString().slice(0, 10),
        type: "Enquiry",
        referenceId: r.id.slice(0, 8),
        clientName: r.clientName,
        detail: `Type: ${r.type} (${r.status})`,
        value: 0,
      });
    });

    logs.sort((a, b) => b.date.localeCompare(a.date));
    return reply.send(logs);
  });

  // 3. Job Cards
  app.get("/reports/job-cards", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, userId, startDate, endDate } = req.query as {
      branchId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    };

    const conditions = [eq(jobCards.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(jobCards.branchId, branchId));
    if (userId && userId !== "all") conditions.push(eq(jobCards.serviceAdvisorId, userId));
    if (startDate) conditions.push(gte(jobCards.jobDate, startDate));
    if (endDate) conditions.push(lte(jobCards.jobDate, endDate));

    const rows = await db.select({
      id: jobCards.id,
      jobDate: jobCards.jobDate,
      status: jobCards.status,
      subtotal: jobCards.subtotal,
      discount: jobCards.discount,
      taxPercent: jobCards.taxPercent,
      total: jobCards.total,
      source: jobCards.source,
      createdAt: jobCards.createdAt,
      completedAt: jobCards.completedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      plateNumber: vehicles.plateNumber,
      advisorName: users.name,
    })
    .from(jobCards)
    .innerJoin(clients, eq(jobCards.clientId, clients.id))
    .innerJoin(vehicles, eq(jobCards.vehicleId, vehicles.id))
    .leftJoin(users, eq(jobCards.serviceAdvisorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(jobCards.createdAt));

    const jcIds = rows.map((r) => r.id);
    const mechanicsMapped: Record<string, string[]> = {};
    if (jcIds.length > 0) {
      const mechRows = await db.select({
        jobCardId: jobCardMechanics.jobCardId,
        mechanicName: users.name,
      })
      .from(jobCardMechanics)
      .innerJoin(users, eq(jobCardMechanics.mechanicId, users.id))
      .where(inArray(jobCardMechanics.jobCardId, jcIds));

      mechRows.forEach((m) => {
        if (!mechanicsMapped[m.jobCardId]) mechanicsMapped[m.jobCardId] = [];
        if (m.mechanicName) mechanicsMapped[m.jobCardId].push(m.mechanicName);
      });
    }

    const result = rows.map((r) => ({
      ...r,
      mechanics: (mechanicsMapped[r.id] || []).join(", "),
    }));

    return reply.send(result);
  });

  // 4. Billing Report
  app.get("/reports/billing", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    const conditions = [eq(invoices.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(invoices.branchId, branchId));
    if (start) conditions.push(gte(invoices.createdAt, start));
    if (end) conditions.push(lte(invoices.createdAt, end));

    const rows = await db.select({
      id: invoices.id,
      createdAt: invoices.createdAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      plateNumber: vehicles.plateNumber,
      subtotal: invoices.subtotal,
      discount: invoices.discount,
      total: invoices.total,
      status: invoices.status,
      finalizedAt: invoices.finalizedAt,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt));

    return reply.send(rows);
  });

  // 5. Enquiry Report
  app.get("/reports/enquiries", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, userId, startDate, endDate } = req.query as {
      branchId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    };

    const conditions = [eq(enquiries.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(enquiries.branchId, branchId));
    if (userId && userId !== "all") conditions.push(eq(enquiries.leadRepresentativeId, userId));
    if (startDate) conditions.push(gte(enquiries.createdAt, new Date(`${startDate}T00:00:00Z`)));
    if (endDate) conditions.push(lte(enquiries.createdAt, new Date(`${endDate}T23:59:59Z`)));

    const rows = await db.select({
      id: enquiries.id,
      createdAt: enquiries.createdAt,
      clientName: enquiries.clientName,
      contactNumber: enquiries.contactNumber,
      email: enquiries.email,
      address: enquiries.address,
      enquiryFor: enquiries.enquiryFor,
      enquiryType: enquiries.enquiryType,
      sourceOfEnquiry: enquiries.sourceOfEnquiry,
      leadStatus: enquiries.leadStatus,
      channel: enquiries.channel,
      vehicleNumber: enquiries.vehicleNumber,
      repName: users.name,
      followUpDate: enquiries.dateToFollow,
    })
    .from(enquiries)
    .leftJoin(users, eq(enquiries.leadRepresentativeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(enquiries.createdAt));

    return reply.send(rows);
  });

  // 6. Mechanic performance Report
  app.get("/reports/mechanics", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, userId, startDate, endDate } = req.query as {
      branchId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    // List all mechanics of this org
    const mechCond = [eq(staffProfiles.orgId, auth.orgId), eq(staffProfiles.category, "mechanic")];
    if (userId && userId !== "all") mechCond.push(eq(staffProfiles.userId, userId));

    const mechs = await db.select({
      userId: users.id,
      name: users.name,
      serviceCommissionPct: staffProfiles.serviceCommissionPct,
    })
    .from(users)
    .innerJoin(staffProfiles, eq(users.id, staffProfiles.userId))
    .where(and(...mechCond));

    if (mechs.length === 0) return reply.send([]);

    const result = [];
    for (const m of mechs) {
      // Find job cards completed/billed that this mechanic worked on
      const jcCond = [eq(jobCardMechanics.mechanicId, m.userId)];
      if (branchId && branchId !== "all") jcCond.push(eq(jobCards.branchId, branchId));
      if (startDate) jcCond.push(gte(jobCards.jobDate, startDate));
      if (endDate) jcCond.push(lte(jobCards.jobDate, endDate));

      const mechanicJobCards = await db.select({
        jobCardId: jobCards.id,
        total: jobCards.total,
      })
      .from(jobCardMechanics)
      .innerJoin(jobCards, eq(jobCardMechanics.jobCardId, jobCards.id))
      .where(and(...jcCond));

      const jcIds = mechanicJobCards.map((jc) => jc.jobCardId);

      let completedInvoicesCount = 0;
      let totalRevenue = 0;

      if (jcIds.length > 0) {
        // Query completed invoices
        const invConditions = [
          inArray(invoices.jobCardId, jcIds),
          inArray(invoices.status, ["paid", "partial"]),
        ];
        if (start) invConditions.push(gte(invoices.createdAt, start));
        if (end) invConditions.push(lte(invoices.createdAt, end));

        const invoicesList = await db.select({
          total: invoices.total,
        })
        .from(invoices)
        .where(and(...invConditions));

        completedInvoicesCount = invoicesList.length;
        totalRevenue = invoicesList.reduce((sum, inv) => sum + inv.total, 0);
      }

      const commissionPct = Number(m.serviceCommissionPct ?? 0);
      const estCommission = Math.round(totalRevenue * (commissionPct / 100));

      result.push({
        mechanicId: m.userId,
        name: m.name,
        jobCardsCount: mechanicJobCards.length,
        invoicesCount: completedInvoicesCount,
        attributedRevenue: totalRevenue,
        commissionPct,
        estimatedCommission: estCommission,
      });
    }

    return reply.send(result);
  });

  // 7. Received Payments
  app.get("/reports/payments", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    const conditions = [eq(invoices.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(invoices.branchId, branchId));
    if (start) conditions.push(gte(payments.paidAt, start));
    if (end) conditions.push(lte(payments.paidAt, end));

    const rows = await db.select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      mode: payments.mode,
      amount: payments.amount,
      txnRef: payments.txnRef,
      paidAt: payments.paidAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      plateNumber: vehicles.plateNumber,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(vehicles, eq(invoices.vehicleId, vehicles.id))
    .where(and(...conditions))
    .orderBy(desc(payments.paidAt));

    return reply.send(rows);
  });

  // 8. Balance Reports / Outstanding Payments
  app.get("/reports/balance-due", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const { start, end } = parseDateParams(startDate, endDate);

    // Calculate dynamic Opening Balance
    const baselineDate = new Date("2026-06-01T00:00:00Z");
    const baseOpeningBalance = 1807000; // paise (₹18,070.00)

    let totalInflowsBefore = 0;
    let totalOutflowsBefore = 0;

    if (start && start > baselineDate) {
      // Sum payments before `start`
      const payBefore = await db
        .select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
          and(
            eq(invoices.orgId, auth.orgId),
            branchId && branchId !== "all" ? eq(invoices.branchId, branchId) : sql`true`,
            lt(payments.paidAt, start)
          )
        );
      
      // Sum wallet topups before `start`
      const walletBefore = await db
        .select({ sum: sql<number>`coalesce(sum(${walletTransactions.amount}), 0)::int` })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, "credit"),
            inArray(walletTransactions.source, ["topup", "cashback", "referral_bonus"]),
            lt(walletTransactions.createdAt, start)
          )
        );

      // Sum expenses before `start`
      const expBefore = await db
        .select({ sum: sql<number>`coalesce(sum(${expenses.amount}), 0)::int` })
        .from(expenses)
        .where(
          and(
            eq(expenses.orgId, auth.orgId),
            branchId && branchId !== "all" ? eq(expenses.branchId, branchId) : sql`true`,
            lt(expenses.expenseDate, startDate || "2026-06-01")
          )
        );

      totalInflowsBefore = (payBefore[0]?.sum ?? 0) + (walletBefore[0]?.sum ?? 0);
      totalOutflowsBefore = expBefore[0]?.sum ?? 0;
    }

    const openingBalance = baseOpeningBalance + totalInflowsBefore - totalOutflowsBefore;

    // 1. Fetch Inflows within date range
    const payRows = await db.select({
      amount: payments.amount,
      paidAt: payments.paidAt,
      invoiceNo: invoices.invoiceNo,
      invoiceCreatedAt: invoices.createdAt,
      invoiceTotal: invoices.total,
      invoiceStatus: invoices.status,
      clientName: clients.name,
      clientPhone: clients.phone,
      branchName: branches.name,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(branches, eq(invoices.branchId, branches.id))
    .where(
      and(
        eq(invoices.orgId, auth.orgId),
        branchId && branchId !== "all" ? eq(invoices.branchId, branchId) : sql`true`,
        start ? gte(payments.paidAt, start) : sql`true`,
        end ? lte(payments.paidAt, end) : sql`true`
      )
    );

    const walletRows = await db.select({
      amount: walletTransactions.amount,
      createdAt: walletTransactions.createdAt,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(walletTransactions)
    .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
    .innerJoin(clients, eq(wallets.clientId, clients.id))
    .where(
      and(
        eq(wallets.orgId, auth.orgId),
        eq(walletTransactions.type, "credit"),
        inArray(walletTransactions.source, ["topup", "cashback", "referral_bonus"]),
        start ? gte(walletTransactions.createdAt, start) : sql`true`,
        end ? lte(walletTransactions.createdAt, end) : sql`true`
      )
    );

    const primaryBranch = await db.query.branches.findFirst({ where: eq(branches.orgId, auth.orgId) });
    const primaryBranchName = primaryBranch?.name ?? "Senthil nagar";

    const received: any[] = [];

    for (const p of payRows) {
      const invoiceCreatedAt = new Date(p.invoiceCreatedAt);
      const paymentPaidAt = new Date(p.paidAt);
      
      const isPendingPayment = paymentPaidAt.getDate() !== invoiceCreatedAt.getDate() ||
                               paymentPaidAt.getMonth() !== invoiceCreatedAt.getMonth() ||
                               p.invoiceStatus === "partial";
      const type = isPendingPayment ? "Pending payment" : "Bill";

      received.push({
        date: p.paidAt,
        branchName: p.branchName,
        invoiceNo: type === "Bill" ? p.invoiceNo : null,
        clientName: p.clientName,
        clientPhone: p.clientPhone,
        advanceReceived: 0,
        pendingPayment: p.invoiceTotal - p.amount,
        amountReceived: p.amount,
        type,
      });
    }

    for (const w of walletRows) {
      received.push({
        date: w.createdAt,
        branchName: primaryBranchName,
        invoiceNo: null,
        clientName: w.clientName,
        clientPhone: w.clientPhone,
        advanceReceived: 0,
        pendingPayment: 0,
        amountReceived: w.amount,
        type: "Wallet",
      });
    }

    received.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Fetch Outflows within date range
    const expRows = await db.select({
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      paidBy: expenses.paidBy,
      categoryName: expenseCategories.name,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        eq(expenses.orgId, auth.orgId),
        branchId && branchId !== "all" ? eq(expenses.branchId, branchId) : sql`true`,
        startDate ? gte(expenses.expenseDate, startDate) : sql`true`,
        endDate ? lte(expenses.expenseDate, endDate) : sql`true`
      )
    );

    const expensesMapped = expRows.map((e) => ({
      date: e.expenseDate,
      category: e.categoryName,
      amountPaid: e.amount,
      paidBy: e.paidBy || "—",
    }));

    expensesMapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalReceived = received.reduce((sum, r) => sum + r.amountReceived, 0);
    const totalPaid = expensesMapped.reduce((sum, e) => sum + e.amountPaid, 0);
    const closingBalance = openingBalance + totalReceived - totalPaid;

    return reply.send({
      openingBalance,
      totalReceived,
      totalPaid,
      closingBalance,
      received,
      expenses: expensesMapped,
    });
  });

  // 9. Attendance Report
  app.get("/reports/attendance", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, userId, startDate, endDate } = req.query as {
      branchId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    };

    const conditions = [eq(attendance.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(attendance.branchId, branchId));
    if (userId && userId !== "all") conditions.push(eq(attendance.userId, userId));
    if (startDate) conditions.push(gte(attendance.date, startDate));
    if (endDate) conditions.push(lte(attendance.date, endDate));

    const rows = await db.select({
      id: attendance.id,
      date: attendance.date,
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      hoursWorked: attendance.hoursWorked,
      notes: attendance.notes,
      employeeName: users.name,
    })
    .from(attendance)
    .innerJoin(users, eq(attendance.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.date));

    return reply.send(rows);
  });

  // 10. SMS History / Lead communications
  app.get("/reports/sms-history", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId, startDate, endDate } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
    };

    const conditions = [eq(enquiries.orgId, auth.orgId)];
    if (branchId && branchId !== "all") conditions.push(eq(enquiries.branchId, branchId));
    if (startDate) conditions.push(gte(enquiries.createdAt, new Date(`${startDate}T00:00:00Z`)));
    if (endDate) conditions.push(lte(enquiries.createdAt, new Date(`${endDate}T23:59:59Z`)));

    // Since we don't have a separate sms table, we query enquiries that are sent via channels
    const rows = await db.select({
      id: enquiries.id,
      createdAt: enquiries.createdAt,
      clientName: enquiries.clientName,
      contactNumber: enquiries.contactNumber,
      channel: enquiries.channel,
      enquiryFor: enquiries.enquiryFor,
      leadStatus: enquiries.leadStatus,
      followUpDate: enquiries.dateToFollow,
    })
    .from(enquiries)
    .where(and(...conditions))
    .orderBy(desc(enquiries.createdAt));

    return reply.send(rows);
  });
}
