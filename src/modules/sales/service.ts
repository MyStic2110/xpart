import { eq, and, desc, or, sql, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  services,
  jobCards,
  jobCardServices,
  clients,
  vehicles,
  salesActions,
  salesActionLogs,
  appointments,
  branches,
} from "@/db/schema";

export class SalesError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Look this many days INTO THE FUTURE when generating actions, so the team
// can catch a client right as their cycle expires (highest conversion)
// instead of only after they've already lapsed.
const LOOKAHEAD_DAYS = 7;

// Scans every completed/billed job card line item for a recurring service
// (e.g. "Full Wash" with recurrenceDays=30), finds the client's most recent
// occurrence, and — if today is past lastServiceDate + recurrenceDays —
// opens a pending sales action so frontdesk has a daily call/WhatsApp queue
// instead of guessing who's due for a repeat visit.
export async function refreshSalesActions(orgId: string) {
  const recurringServices = await db
    .select()
    .from(services)
    .where(and(eq(services.orgId, orgId), eq(services.isActive, true)));

  const trackedServices = recurringServices.filter((s) => s.recurrenceDays != null);
  if (trackedServices.length === 0) return { created: 0 };

  let created = 0;

  for (const service of trackedServices) {
    // last occurrence of this service per client, from completed/billed job cards
    const rows = await db
      .select({
        clientId: jobCards.clientId,
        vehicleId: jobCards.vehicleId,
        branchId: jobCards.branchId,
        jobDate: jobCards.jobDate,
      })
      .from(jobCardServices)
      .innerJoin(jobCards, eq(jobCards.id, jobCardServices.jobCardId))
      .where(
        and(
          eq(jobCardServices.serviceId, service.id),
          eq(jobCards.orgId, orgId),
          or(eq(jobCards.status, "completed"), eq(jobCards.status, "billed"))
        )
      )
      .orderBy(desc(jobCards.jobDate));

    const latestByClient = new Map<string, { vehicleId: string; branchId: string; jobDate: string }>();
    for (const r of rows) {
      if (!latestByClient.has(r.clientId)) {
        latestByClient.set(r.clientId, { vehicleId: r.vehicleId, branchId: r.branchId, jobDate: r.jobDate });
      }
    }

    for (const [clientId, last] of latestByClient) {
      const dueDate = addDays(last.jobDate, service.recurrenceDays!);
      if (dueDate > addDays(today(), LOOKAHEAD_DAYS)) continue; // not due within the lookahead window yet

      const existing = await db.query.salesActions.findFirst({
        where: and(eq(salesActions.clientId, clientId), eq(salesActions.serviceId, service.id), eq(salesActions.dueDate, dueDate)),
      });
      if (existing) continue;

      await db.insert(salesActions).values({
        orgId,
        branchId: last.branchId,
        clientId,
        vehicleId: last.vehicleId,
        serviceId: service.id,
        lastServiceDate: last.jobDate,
        dueDate,
        potentialRevenue: service.defaultPrice,
        status: "pending",
      });
      created++;
    }
  }

  return { created };
}

export async function listSalesActions(orgId: string, statusFilter?: string, branchId?: string | null) {
  const conditions = [eq(salesActions.orgId, orgId)];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(salesActions.status, statusFilter as typeof salesActions.status.enumValues[number]));
  }
  if (branchId) conditions.push(eq(salesActions.branchId, branchId));

  const rows = await db
    .select({
      id: salesActions.id,
      clientId: salesActions.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      vehicleId: salesActions.vehicleId,
      plateNumber: vehicles.plateNumber,
      serviceId: salesActions.serviceId,
      serviceName: services.name,
      lastServiceDate: salesActions.lastServiceDate,
      dueDate: salesActions.dueDate,
      potentialRevenue: salesActions.potentialRevenue,
      status: salesActions.status,
      nextFollowUpDate: salesActions.nextFollowUpDate,
      appointmentId: salesActions.appointmentId,
      createdAt: salesActions.createdAt,
    })
    .from(salesActions)
    .innerJoin(clients, eq(clients.id, salesActions.clientId))
    .leftJoin(vehicles, eq(vehicles.id, salesActions.vehicleId))
    .innerJoin(services, eq(services.id, salesActions.serviceId))
    .where(and(...conditions))
    // 1) still-actionable rows first (closed/declined sink to the bottom),
    // 2) then by closeness to today's expiry — "expiring today" rises to the
    //    very top, then expiring-soon / just-lapsed, with long-cold leads last.
    .orderBy(
      sql`case when ${salesActions.status} in ('pending','contacted','rescheduled') then 0 else 1 end`,
      sql`abs(${salesActions.dueDate} - current_date)`
    );

  // Enrich with each client's ACTUAL most recent visit (date + all services on
  // it) so the caller has real context — what the customer last did with us —
  // which may differ from the single recurring service that triggered the action.
  const lastVisitByClient = await getLastVisitByClient(orgId, [...new Set(rows.map((r) => r.clientId))]);

  return rows.map((r) => ({
    ...r,
    lastVisitDate: lastVisitByClient.get(r.clientId)?.date ?? r.lastServiceDate,
    lastVisitServices: lastVisitByClient.get(r.clientId)?.services ?? r.serviceName,
  }));
}

async function getLastVisitByClient(orgId: string, clientIds: string[]) {
  const map = new Map<string, { date: string; jobCardId: string; services: string[] }>();
  if (clientIds.length === 0) return map;

  const visitRows = await db
    .select({
      clientId: jobCards.clientId,
      jobCardId: jobCards.id,
      jobDate: jobCards.jobDate,
      serviceName: services.name,
    })
    .from(jobCards)
    .innerJoin(jobCardServices, eq(jobCardServices.jobCardId, jobCards.id))
    .innerJoin(services, eq(services.id, jobCardServices.serviceId))
    .where(and(eq(jobCards.orgId, orgId), inArray(jobCards.clientId, clientIds)))
    .orderBy(desc(jobCards.jobDate));

  // rows arrive newest-first; the first job card seen per client is the latest,
  // and we collect every service line on that same job card.
  for (const r of visitRows) {
    const cur = map.get(r.clientId);
    if (!cur) {
      map.set(r.clientId, { date: r.jobDate, jobCardId: r.jobCardId, services: [r.serviceName] });
    } else if (r.jobCardId === cur.jobCardId) {
      cur.services.push(r.serviceName);
    }
  }

  return new Map(
    [...map].map(([clientId, v]) => [clientId, { date: v.date, services: v.services.join(", ") }])
  );
}

interface OutcomeInput {
  outcome: "contacted" | "appointment_booked" | "rescheduled" | "declined" | "closed";
  note: string;
  nextFollowUpDate?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  byUserId?: string;
}

export async function recordOutcome(orgId: string, actionId: string, input: OutcomeInput) {
  const action = await db.query.salesActions.findFirst({ where: and(eq(salesActions.id, actionId), eq(salesActions.orgId, orgId)) });
  if (!action) throw new SalesError("sales action not found", 404);

  return await db.transaction(async (tx) => {
    let appointmentId = action.appointmentId;

    if (input.outcome === "appointment_booked") {
      if (!input.appointmentDate) throw new SalesError("appointment date is required");
      const [appt] = await tx
        .insert(appointments)
        .values({
          orgId,
          branchId: action.branchId,
          clientId: action.clientId,
          vehicleId: action.vehicleId,
          serviceId: action.serviceId,
          scheduledDate: input.appointmentDate,
          scheduledTime: input.appointmentTime || null,
          status: "scheduled",
        })
        .returning();
      appointmentId = appt.id;
    }

    const [updated] = await tx
      .update(salesActions)
      .set({
        status: input.outcome,
        nextFollowUpDate: input.nextFollowUpDate || null,
        appointmentId,
        handledBy: input.byUserId || null,
        updatedAt: new Date(),
      })
      .where(eq(salesActions.id, actionId))
      .returning();

    await tx.insert(salesActionLogs).values({
      salesActionId: actionId,
      outcome: input.note,
      byUserId: input.byUserId || null,
    });

    return updated;
  });
}

export async function getSalesActionLogs(actionId: string) {
  return db.select().from(salesActionLogs).where(eq(salesActionLogs.salesActionId, actionId)).orderBy(desc(salesActionLogs.createdAt));
}

export async function listAppointments(orgId: string) {
  return db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      branchId: appointments.branchId,
      branchName: branches.name,
      serviceName: services.name,
      scheduledDate: appointments.scheduledDate,
      scheduledTime: appointments.scheduledTime,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(branches, eq(branches.id, appointments.branchId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .where(eq(appointments.orgId, orgId))
    .orderBy(appointments.scheduledDate);
}

export async function updateAppointmentStatus(orgId: string, id: string, status: "confirmed" | "completed" | "cancelled" | "no_show") {
  const [updated] = await db
    .update(appointments)
    .set({ status })
    .where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)))
    .returning();
  if (!updated) throw new SalesError("appointment not found", 404);

  // Closing the loop: once the appointment is completed, the originating
  // sales action is done — no more follow-up needed.
  if (status === "completed") {
    await db.update(salesActions).set({ status: "closed", updatedAt: new Date() }).where(eq(salesActions.appointmentId, id));
  }

  return updated;
}
