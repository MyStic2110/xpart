import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, wallets, jobCards, jobCardServices, services, invoices, branches, vehicles, offers, appointments } from "@/db/schema";
import { getAndUpdateUsablePoints } from "@/modules/invoices/service";

function generateReferralCode(name: string) {
  const prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export async function searchClients(orgId: string, query: string) {
  if (!query.trim()) return [];
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.orgId, orgId), or(ilike(clients.phone, `%${query}%`), ilike(clients.name, `%${query}%`))))
    .orderBy(desc(clients.createdAt))
    .limit(10);
}

export async function searchVehicles(orgId: string, query: string) {
  if (!query.trim()) return [];
  return db
    .select({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
      clientId: vehicles.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(vehicles)
    .innerJoin(clients, eq(clients.id, vehicles.clientId))
    .where(and(eq(vehicles.orgId, orgId), ilike(vehicles.plateNumber, `%${query}%`)))
    .orderBy(vehicles.plateNumber)
    .limit(20);
}

interface ClientUpsertInput {
  phone: string;
  name: string;
  address?: string;
  gender?: "male" | "female" | "other" | "unknown";
  dateOfBirth?: string;
  anniversary?: string;
  sourceOfClient?: string;
  clientType?: "customer" | "third_party";
  referredByCode?: string; // another client's referralCode — resolved to referredByClientId
}

// Find-or-create by phone (the autocomplete/dedup key) — updates any newly
// provided profile fields onto the existing record rather than overwriting blindly.
export async function findOrCreateClient(orgId: string, input: ClientUpsertInput) {
  const existing = await db.query.clients.findFirst({ where: and(eq(clients.orgId, orgId), eq(clients.phone, input.phone)) });

  // Resolve a referral code to the referring client (self-referrals ignored).
  let referredByClientId: string | null = null;
  if (input.referredByCode?.trim()) {
    const referrer = await db.query.clients.findFirst({
      where: and(eq(clients.orgId, orgId), eq(clients.referralCode, input.referredByCode.trim().toUpperCase())),
    });
    if (referrer && referrer.id !== existing?.id) referredByClientId = referrer.id;
  }

  if (existing) {
    const [updated] = await db
      .update(clients)
      .set({
        name: input.name || existing.name,
        address: input.address ?? existing.address,
        gender: input.gender ?? existing.gender,
        dateOfBirth: input.dateOfBirth ?? existing.dateOfBirth,
        anniversary: input.anniversary ?? existing.anniversary,
        sourceOfClient: input.sourceOfClient ?? existing.sourceOfClient,
        clientType: input.clientType ?? existing.clientType,
        // Referrer is set once, never overwritten — first attribution wins.
        referredByClientId: existing.referredByClientId ?? referredByClientId,
      })
      .where(eq(clients.id, existing.id))
      .returning();
    return { ...updated, wasCreated: false };
  }

  const [created] = await db
    .insert(clients)
    .values({
      orgId,
      name: input.name,
      phone: input.phone,
      address: input.address || null,
      gender: input.gender ?? "unknown",
      dateOfBirth: input.dateOfBirth || null,
      anniversary: input.anniversary || null,
      sourceOfClient: input.sourceOfClient || null,
      clientType: input.clientType ?? "customer",
      referredByClientId,
      referralCode: generateReferralCode(input.name),
    })
    .returning();

  await db.insert(wallets).values({ clientId: created.id, orgId });

  return { ...created, wasCreated: true };
}

// Client list with per-client aggregates computed via subselects (one query).
export async function listClients(orgId: string) {
  const rows = await db.execute(sql`
    select
      c.id, c.name, c.phone, c.gender, c.source_of_client as "sourceOfClient",
      c.client_type as "clientType",
      (select coalesce(sum(i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)), 0)
         from invoices i where i.client_id = c.id and i.status in ('draft','partial'))::int as "outstanding",
      (select count(*) from job_cards jc where jc.client_id = c.id)::int as "totalVisits",
      (select coalesce(sum(i.total),0) from invoices i where i.client_id = c.id and i.status in ('paid','partial'))::int as "totalSpend",
      (select max(jc.job_date) from job_cards jc where jc.client_id = c.id) as "lastVisit",
      (select count(*) from vehicles v where v.client_id = c.id)::int as "vehicleCount",
      coalesce(w.balance,0)::int as "walletBalance",
      coalesce(w.points,0)::int as "points"
    from clients c
    left join wallets w on w.client_id = c.id
    where c.org_id = ${orgId}
    order by "lastVisit" desc nulls last
  `);
  return rows as unknown as Array<{
    id: string; name: string; phone: string; gender: string; sourceOfClient: string | null;
    clientType: string; outstanding: number;
    totalVisits: number; totalSpend: number; lastVisit: string | null; vehicleCount: number;
    walletBalance: number; points: number;
  }>;
}

// Credit ledger for a client (built for third-party vendors who run a running
// tab): every unsettled invoice with its vehicle, what's been paid and what's
// still due — so frontdesk can chase and close vehicle-by-vehicle.
export async function getClientCredit(orgId: string, clientId: string) {
  const client = await db.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.orgId, orgId)) });
  if (!client) return null;

  const rows = await db.execute(sql`
    select
      i.id as "invoiceId",
      i.invoice_no as "invoiceNo",
      i.status,
      i.total::int,
      coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)::int as "paid",
      (i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0))::int as "balance",
      i.created_at::date::text as "invoiceDate",
      jc.job_date as "jobDate",
      v.plate_number as "plateNumber"
    from invoices i
    join job_cards jc on jc.id = i.job_card_id
    join vehicles v on v.id = i.vehicle_id
    where i.org_id = ${orgId} and i.client_id = ${clientId} and i.status in ('draft','partial')
    order by v.plate_number, jc.job_date
  `) as unknown as Array<{
    invoiceId: string; invoiceNo: string | null; status: string; total: number;
    paid: number; balance: number; invoiceDate: string; jobDate: string; plateNumber: string;
  }>;

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  return { clientId, clientType: client.clientType, openInvoices: rows, totalOutstanding };
}

export async function getClientDetail(orgId: string, clientId: string) {
  const client = await db.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.orgId, orgId)) });
  if (!client) return null;

  const summary = await getClient360(orgId, clientId);
  const clientVehicles = await db.select().from(vehicles).where(eq(vehicles.clientId, clientId));

  // Fetch client appointments
  const clientAppointments = await db
    .select({
      id: appointments.id,
      branchId: appointments.branchId,
      branchName: branches.name,
      scheduledDate: appointments.scheduledDate,
      scheduledTime: appointments.scheduledTime,
      status: appointments.status,
      serviceName: services.name,
      notes: appointments.notes,
    })
    .from(appointments)
    .leftJoin(branches, eq(branches.id, appointments.branchId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.scheduledDate));

  // Visit history: each job card with its services rolled up.
  const visitRows = await db
    .select({
      jobCardId: jobCards.id,
      jobDate: jobCards.jobDate,
      status: jobCards.status,
      total: jobCards.total,
      serviceName: services.name,
    })
    .from(jobCards)
    .leftJoin(jobCardServices, eq(jobCardServices.jobCardId, jobCards.id))
    .leftJoin(services, eq(services.id, jobCardServices.serviceId))
    .where(eq(jobCards.clientId, clientId))
    .orderBy(desc(jobCards.jobDate));

  const visitsMap = new Map<string, { jobCardId: string; jobDate: string; status: string; total: number; services: string[] }>();
  for (const r of visitRows) {
    const v = visitsMap.get(r.jobCardId);
    if (!v) {
      visitsMap.set(r.jobCardId, { jobCardId: r.jobCardId, jobDate: r.jobDate, status: r.status, total: r.total, services: r.serviceName ? [r.serviceName] : [] });
    } else if (r.serviceName) {
      v.services.push(r.serviceName);
    }
  }

  // Vendors run a credit tab — ship the open-invoice ledger with the detail view.
  const credit = client.clientType === "third_party" ? await getClientCredit(orgId, clientId) : null;

  // Referral programme view: who referred this client, and everyone they
  // referred with whether the friend has actually joined and billed yet.
  let referredBy: { id: string; name: string; phone: string } | null = null;
  if (client.referredByClientId) {
    const r = await db.query.clients.findFirst({ where: eq(clients.id, client.referredByClientId) });
    if (r) referredBy = { id: r.id, name: r.name, phone: r.phone };
  }
  const referrals = await db.execute(sql`
    select
      c.id, c.name, c.phone,
      c.created_at::date::text as "joinedOn",
      exists(select 1 from invoices i where i.client_id = c.id and i.status = 'paid') as "hasBilled",
      (select min(i.finalized_at)::date::text from invoices i where i.client_id = c.id and i.status = 'paid') as "firstBilledOn"
    from clients c
    where c.org_id = ${orgId} and c.referred_by_client_id = ${clientId}
    order by c.created_at desc
  `) as unknown as Array<{ id: string; name: string; phone: string; joinedOn: string; hasBilled: boolean; firstBilledOn: string | null }>;

  return {
    client,
    summary,
    vehicles: clientVehicles,
    visits: [...visitsMap.values()],
    appointments: clientAppointments,
    credit,
    referredBy,
    referrals,
  };
}

export async function getClient360(orgId: string, clientId: string) {
  const client = await db.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.orgId, orgId)) });
  if (!client) return null;

  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.clientId, clientId) });

  const visits = await db
    .select({ jobDate: jobCards.jobDate, branchId: jobCards.branchId })
    .from(jobCards)
    .where(eq(jobCards.clientId, clientId))
    .orderBy(desc(jobCards.jobDate))
    .limit(1);

  const totalVisitsResult = await db.execute(
    sql`select count(*)::int as count from job_cards where client_id = ${clientId}`
  );
  const totalVisits = Number((totalVisitsResult as unknown as { count: number }[])[0]?.count ?? 0);

  const spendResult = await db.execute(
    sql`select coalesce(sum(total), 0)::int as total from invoices where client_id = ${clientId} and status in ('paid', 'partial')`
  );
  const totalSpendings = Number((spendResult as unknown as { total: number }[])[0]?.total ?? 0);

  let branchName: string | null = null;
  if (visits[0]?.branchId) {
    const branch = await db.query.branches.findFirst({ where: eq(branches.id, visits[0].branchId) });
    branchName = branch?.name ?? null;
  }

  const activeOffers = await db.query.offers.findMany({
    where: and(eq(offers.orgId, orgId), eq(offers.isActive, true)),
  });

  let isChurnRisk = false;
  if (visits[0]?.jobDate) {
    const lastDate = new Date(visits[0].jobDate + "T00:00:00");
    const days = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 60) isChurnRisk = true;
  }

  const gotPremium = await db
    .select({ id: jobCardServices.id })
    .from(jobCardServices)
    .innerJoin(services, eq(services.id, jobCardServices.serviceId))
    .innerJoin(jobCards, eq(jobCards.id, jobCardServices.jobCardId))
    .where(and(
      eq(jobCards.clientId, clientId),
      or(
        ilike(services.name, "%polish%"),
        ilike(services.name, "%coat%"),
        ilike(services.name, "%ppf%")
      )
    ))
    .limit(1);

  const isDetailingUpsell = totalVisits >= 2 && gotPremium.length === 0;

  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  const currentDay = today.getDate();

  let isBirthdayToday = false;
  if (client.dateOfBirth) {
    const dob = new Date(client.dateOfBirth + "T00:00:00");
    if (dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay) {
      isBirthdayToday = true;
    }
  }

  let isAnniversaryToday = false;
  if (client.anniversary) {
    const anni = new Date(client.anniversary + "T00:00:00");
    if (anni.getMonth() + 1 === currentMonth && anni.getDate() === currentDay) {
      isAnniversaryToday = true;
    }
  }

  // Third-party vendors are not customers — no targeted offers, coupons or pitch cues.
  const offerPool = client.clientType === "third_party" ? [] : activeOffers;
  const eligibleOffers = offerPool.filter((o) => {
    if (o.targetType === "new_client") return totalVisits <= 1;
    if (o.targetType === "churn_risk") return isChurnRisk;
    if (o.targetType === "loyal_client") return totalVisits >= 5;
    if (o.targetType === "detailing_upsell") return isDetailingUpsell;
    if (o.targetType === "birthday_special") return isBirthdayToday;
    if (o.targetType === "anniversary_special") return isAnniversaryToday;
    
    // Day constraints (0 = Sunday, 1 = Monday, etc.)
    if (o.restrictedDays && o.restrictedDays.length > 0) {
      const dayStr = today.getDay().toString();
      if (!o.restrictedDays.includes(dayStr)) return false;
    }
    
    // Time constraints (HH:MM format)
    if (o.startTime && o.endTime) {
      const currentHours = today.getHours();
      const currentMins = today.getMinutes();
      const currentTimeVal = currentHours * 60 + currentMins;
      
      const [startH, startM] = o.startTime.split(":").map(Number);
      const [endH, endM] = o.endTime.split(":").map(Number);
      const startTimeVal = startH * 60 + startM;
      const endTimeVal = endH * 60 + endM;
      
      if (currentTimeVal < startTimeVal || currentTimeVal > endTimeVal) return false;
    }
    
    return true;
  }).map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    description: o.description,
    discountType: o.discountType,
    value: o.value,
    minBillingAmount: o.minBillingAmount,
  }));

  let rewardPoints = 0;
  if (wallet) {
    rewardPoints = await db.transaction(async (tx) => {
      return await getAndUpdateUsablePoints(tx, wallet.id, orgId);
    });
  }

  return {
    branch: branchName,
    lastVisitOn: visits[0]?.jobDate ?? null,
    totalVisits,
    totalSpendings,
    membership: null,
    activePackages: null,
    lastFeedback: null,
    walletBalance: wallet?.balance ?? 0,
    rewardPoints,
    gender: client.gender,
    dateOfBirth: client.dateOfBirth,
    anniversary: client.anniversary,
    sourceOfClient: client.sourceOfClient,
    offers: eligibleOffers,
  };
}
