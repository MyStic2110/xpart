import { readFileSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import { organizations, branches, clients, vehicles, wallets, services, jobCards, jobCardServices, invoices, payments } from "@/db/schema";

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { organizations, branches, clients, vehicles, wallets, services, jobCards, jobCardServices, invoices, payments } });

interface Row {
  name: string;
  phone: string;
  firstVisit: string | null;
  lastVisit: string;
  lastService: string;
  lastBill: number;
  gender: string;
  points: number;
}

function primaryService(s: string) {
  return s.split(",")[0].trim();
}

// Recurrence cadence inferred from the service type (days). null = not a
// recurring service (e.g. one-off electrical/mechanical work).
function recurrenceFor(name: string): number | null {
  const n = name.toLowerCase();
  if (n.includes("wash") || n.includes("clean") || n.includes("chain lube")) return 30;
  if (n.includes("polish") || n.includes("wax")) return 90;
  if (n.includes("ppf") || n.includes("paint protection") || n.includes("ceramic")) return 365;
  return null;
}

function refCode(name: string) {
  const prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  return `${prefix}${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync("src/db/xpart-clients.json", "utf8"));

  const org = await db.query.organizations.findFirst({ where: eq(organizations.name, "Xpart Automotive") });
  if (!org) throw new Error("Org 'Xpart Automotive' not found — sign up first");
  const branch = await db.query.branches.findFirst({ where: and(eq(branches.orgId, org.id)) });
  if (!branch) throw new Error("No branch for org");

  // Build service catalog: avg bill = default price, recurrence per type.
  const byService = new Map<string, number[]>();
  for (const r of rows) {
    const svc = primaryService(r.lastService);
    if (!byService.has(svc)) byService.set(svc, []);
    byService.get(svc)!.push(r.lastBill);
  }

  const serviceIdByName = new Map<string, string>();
  for (const [name, bills] of byService) {
    const avg = Math.round(bills.reduce((a, b) => a + b, 0) / bills.length);
    const existing = await db.query.services.findFirst({ where: and(eq(services.orgId, org.id), eq(services.name, name)) });
    if (existing) {
      await db.update(services).set({ recurrenceDays: recurrenceFor(name), defaultPrice: avg * 100 }).where(eq(services.id, existing.id));
      serviceIdByName.set(name, existing.id);
    } else {
      const [created] = await db
        .insert(services)
        .values({ orgId: org.id, name, defaultPrice: avg * 100, recurrenceDays: recurrenceFor(name) })
        .returning();
      serviceIdByName.set(name, created.id);
    }
  }
  console.log(`Services: ${serviceIdByName.size}`);

  let importedClients = 0;
  let importedJobCards = 0;

  for (const r of rows) {
    let c = await db.query.clients.findFirst({ where: and(eq(clients.orgId, org.id), eq(clients.phone, r.phone)) });
    if (!c) {
      const [created] = await db
        .insert(clients)
        .values({
          orgId: org.id,
          name: r.name,
          phone: r.phone,
          gender: r.gender === "male" ? "male" : r.gender === "female" ? "female" : "unknown",
          sourceOfClient: "imported",
          referralCode: refCode(r.name),
        })
        .returning();
      c = created;
      await db.insert(wallets).values({ clientId: c.id, orgId: org.id, points: r.points });
      importedClients++;
    }

    const plate = `XP-${r.phone}`.slice(0, 20);
    let v = await db.query.vehicles.findFirst({ where: and(eq(vehicles.orgId, org.id), eq(vehicles.plateNumber, plate)) });
    if (!v) {
      const [created] = await db.insert(vehicles).values({ orgId: org.id, clientId: c.id, plateNumber: plate }).returning();
      v = created;
    }

    const svcId = serviceIdByName.get(primaryService(r.lastService))!;
    const billPaise = Math.round(r.lastBill * 100);

    // skip if a job card already exists for this client on that date (idempotent re-run)
    const dup = await db.query.jobCards.findFirst({
      where: and(eq(jobCards.clientId, c.id), eq(jobCards.jobDate, r.lastVisit)),
    });
    if (dup) continue;

    const [jc] = await db
      .insert(jobCards)
      .values({
        orgId: org.id,
        branchId: branch.id,
        clientId: c.id,
        vehicleId: v.id,
        jobDate: r.lastVisit,
        subtotal: billPaise,
        discount: 0,
        taxPercent: 0,
        total: billPaise,
        status: "billed",
        source: "imported",
      })
      .returning();
    await db.insert(jobCardServices).values({ jobCardId: jc.id, serviceId: svcId, qty: 1, price: billPaise });

    // The bill amount was actually paid — record a paid invoice + payment
    // dated at the visit so lifetime spend / historical revenue are accurate.
    if (billPaise > 0) {
      const paidAt = new Date(`${r.lastVisit}T12:00:00Z`);
      const [inv] = await db
        .insert(invoices)
        .values({
          orgId: org.id,
          branchId: branch.id,
          jobCardId: jc.id,
          clientId: c.id,
          vehicleId: v.id,
          subtotal: billPaise,
          discount: 0,
          total: billPaise,
          status: "paid",
          createdAt: paidAt,
          finalizedAt: paidAt,
        })
        .returning();
      await db.insert(payments).values({ invoiceId: inv.id, mode: "cash", amount: billPaise, txnRef: "imported", paidAt });
    }
    importedJobCards++;
  }

  console.log(`Imported ${importedClients} new clients, ${importedJobCards} job cards.`);
  await client.end();
}

main();
