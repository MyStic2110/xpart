import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { vehicles, jobCards, jobCardServices, jobCardProducts, branches, services, users, clients, invoices, enquiries } from "@/db/schema";
import { findOrCreateClient } from "@/modules/clients/service";
import { sendReferralInvite } from "@/modules/connectors/whatsapp";
import type { AuthContext } from "@/middleware/auth";

export class JobCardError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

interface ClientInput {
  phone: string;
  name: string;
  address?: string;
  gender?: "male" | "female" | "other" | "unknown";
  dateOfBirth?: string;
  anniversary?: string;
  sourceOfClient?: string;
}

interface VehicleInput {
  plateNumber: string;
  makeId?: string;
  modelId?: string;
  segment?: string;
  year?: number;
  color?: string;
  fuelType?: "petrol" | "diesel" | "cng" | "electric" | "hybrid";
  odometerReading?: number;
  nextServiceDate?: string;
}

interface LineItemInput {
  serviceId: string;
  qty: number;
  price: number; // paise
}

interface ProductItemInput {
  productId?: string | null;
  productName: string;
  qty: number;
  price: number; // paise
}

export interface CreateJobCardInput {
  branchId: string;
  jobDate: string;
  serviceAdvisorId?: string;
  client: ClientInput;
  vehicle: VehicleInput;
  lineItems: LineItemInput[];
  productItems?: ProductItemInput[];
  discount: number; // paise
  taxPercent: number; // 0 or 18
  images?: string[];
  appliedOfferId?: string;
  enquiryId?: string;
}

async function findOrCreateVehicle(orgId: string, clientId: string, input: VehicleInput) {
  const existing = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.orgId, orgId), eq(vehicles.plateNumber, input.plateNumber)),
  });

  const values = {
    clientId,
    makeId: input.makeId || null,
    modelId: input.modelId || null,
    segment: input.segment || null,
    year: input.year ?? null,
    color: input.color || null,
    fuelType: input.fuelType ?? null,
    odometerReading: input.odometerReading ?? null,
    nextServiceDate: input.nextServiceDate || null,
  };

  if (existing) {
    const [updated] = await db.update(vehicles).set(values).where(eq(vehicles.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db
    .insert(vehicles)
    .values({ orgId, plateNumber: input.plateNumber, ...values })
    .returning();
  return created;
}

export async function createJobCard(auth: AuthContext, input: CreateJobCardInput) {
  const branch = await db.query.branches.findFirst({ where: eq(branches.id, input.branchId) });
  if (!branch || branch.orgId !== auth.orgId) throw new JobCardError("branch not found", 404);

  if (input.lineItems.length === 0 && (!input.productItems || input.productItems.length === 0)) {
    throw new JobCardError("at least one service or product item is required");
  }

  if (input.serviceAdvisorId) {
    const advisor = await db.query.users.findFirst({ where: eq(users.id, input.serviceAdvisorId) });
    if (!advisor) throw new JobCardError("service advisor not found", 404);
  }

  const servicesSubtotal = input.lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);
  const productsSubtotal = (input.productItems || []).reduce((sum, pi) => sum + pi.qty * pi.price, 0);
  const subtotal = servicesSubtotal + productsSubtotal;
  const discounted = Math.max(subtotal - input.discount, 0);
  const total = Math.round(discounted * (1 + input.taxPercent / 100));

  return await db.transaction(async (tx) => {
    const client = await findOrCreateClient(auth.orgId, input.client);
    // Vendors on a credit tab get no offers — enforce even if the UI is bypassed.
    if (input.appliedOfferId && client.clientType === "third_party") {
      throw new JobCardError("offers cannot be applied for third-party vendors");
    }
    const vehicle = await findOrCreateVehicle(auth.orgId, client.id, input.vehicle);

    const [jobCard] = await tx
      .insert(jobCards)
      .values({
        orgId: auth.orgId,
        branchId: input.branchId,
        clientId: client.id,
        vehicleId: vehicle.id,
        appliedOfferId: input.appliedOfferId || null,
        enquiryId: input.enquiryId || null,
        jobDate: input.jobDate,
        serviceAdvisorId: input.serviceAdvisorId || null,
        images: input.images && input.images.length > 0 ? input.images : null,
        subtotal,
        discount: input.discount,
        taxPercent: input.taxPercent,
        total,
        status: "in_progress",
      })
      .returning();

    if (input.enquiryId) {
      await tx
        .update(enquiries)
        .set({ leadStatus: "converted", updatedAt: new Date() })
        .where(eq(enquiries.id, input.enquiryId));
    }

    let lineItemRows: any[] = [];
    if (input.lineItems.length > 0) {
      lineItemRows = await tx
        .insert(jobCardServices)
        .values(input.lineItems.map((li) => ({ jobCardId: jobCard.id, serviceId: li.serviceId, qty: li.qty, price: li.price })))
        .returning();
    }

    let productItemRows: any[] = [];
    if (input.productItems && input.productItems.length > 0) {
      productItemRows = await tx
        .insert(jobCardProducts)
        .values(
          input.productItems.map((pi) => ({
            jobCardId: jobCard.id,
            productId: pi.productId || null,
            productName: pi.productName,
            qty: pi.qty,
            price: pi.price,
          }))
        )
        .returning();
    }

    return { jobCard, client, vehicle, lineItems: lineItemRows, productItems: productItemRows };
  }).then(async (result) => {
    // First-time walk-ins created via the job-card flow also get the referral
    // invite — fire-and-forget outside the transaction.
    if (result.client.wasCreated) await sendReferralInvite(auth.orgId, result.client);
    return result;
  });
}


export async function listJobCards(orgId: string, branchId?: string | null) {
  const conds = [eq(jobCards.orgId, orgId)];
  if (branchId) conds.push(eq(jobCards.branchId, branchId));
  return db
    .select({
      id: jobCards.id,
      jobDate: jobCards.jobDate,
      status: jobCards.status,
      total: jobCards.total,
      clientId: jobCards.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      vehicleId: jobCards.vehicleId,
      plateNumber: vehicles.plateNumber,
      branchId: jobCards.branchId,
      createdAt: jobCards.createdAt,
      hasInvoice: invoices.id,
    })
    .from(jobCards)
    .innerJoin(clients, eq(clients.id, jobCards.clientId))
    .innerJoin(vehicles, eq(vehicles.id, jobCards.vehicleId))
    .leftJoin(invoices, eq(invoices.jobCardId, jobCards.id))
    .where(and(...conds))
    .orderBy(desc(jobCards.createdAt));
}

export async function recalculateJobCardTotals(tx: any, jobCardId: string) {
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
  if (!jc) return null;

  const discounted = Math.max(subtotal - jc.discount, 0);
  const total = Math.round(discounted * (1 + jc.taxPercent / 100));

  const [updated] = await tx
    .update(jobCards)
    .set({ subtotal, total })
    .where(eq(jobCards.id, jobCardId))
    .returning();

  const inv = await tx.query.invoices.findFirst({ where: eq(invoices.jobCardId, jobCardId) });
  if (inv) {
    await tx
      .update(invoices)
      .set({ subtotal, total })
      .where(eq(invoices.id, inv.id));
  }

  return updated;
}

export async function addJobCardItems(
  auth: AuthContext,
  jobCardId: string,
  input: { services?: LineItemInput[]; products?: ProductItemInput[] }
) {
  const jc = await db.query.jobCards.findFirst({
    where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, auth.orgId)),
  });
  if (!jc) throw new JobCardError("job card not found", 404);
  if (jc.status !== "draft" && jc.status !== "in_progress") {
    throw new JobCardError("cannot modify a completed, billed, or cancelled job card", 409);
  }

  const serviceLines = input.services ?? [];
  const productLines = input.products ?? [];
  if (serviceLines.length === 0 && productLines.length === 0) {
    throw new JobCardError("at least one service or product item is required");
  }

  if (serviceLines.length > 0) {
    const requestedIds = [...new Set(serviceLines.map((s) => s.serviceId))];
    const found = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.orgId, auth.orgId), inArray(services.id, requestedIds)));
    if (found.length !== requestedIds.length) {
      throw new JobCardError("one or more selected services were not found", 400);
    }
  }

  return await db.transaction(async (tx) => {
    const addedServices = serviceLines.length > 0
      ? await tx
          .insert(jobCardServices)
          .values(serviceLines.map((li) => ({ jobCardId, serviceId: li.serviceId, qty: li.qty, price: li.price })))
          .returning()
      : [];

    const addedProducts = productLines.length > 0
      ? await tx
          .insert(jobCardProducts)
          .values(
            productLines.map((pi) => ({
              jobCardId,
              productId: pi.productId || null,
              productName: pi.productName,
              qty: pi.qty,
              price: pi.price,
            }))
          )
          .returning()
      : [];

    const updatedJobCard = await recalculateJobCardTotals(tx, jobCardId);
    return { jobCard: updatedJobCard, addedServices, addedProducts };
  });
}

export async function removeJobCardItem(
  auth: AuthContext,
  jobCardId: string,
  itemId: string,
  type: "service" | "product"
) {
  const jc = await db.query.jobCards.findFirst({
    where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, auth.orgId)),
  });
  if (!jc) throw new JobCardError("job card not found", 404);
  if (jc.status !== "draft" && jc.status !== "in_progress") {
    throw new JobCardError("cannot modify a completed, billed, or cancelled job card", 409);
  }

  return await db.transaction(async (tx) => {
    if (type === "service") {
      const [deleted] = await tx
        .delete(jobCardServices)
        .where(and(eq(jobCardServices.id, itemId), eq(jobCardServices.jobCardId, jobCardId)))
        .returning();
      if (!deleted) throw new JobCardError("service line item not found", 404);
    } else {
      const [deleted] = await tx
        .delete(jobCardProducts)
        .where(and(eq(jobCardProducts.id, itemId), eq(jobCardProducts.jobCardId, jobCardId)))
        .returning();
      if (!deleted) throw new JobCardError("product line item not found", 404);
    }

    const updatedJobCard = await recalculateJobCardTotals(tx, jobCardId);
    return { success: true, jobCard: updatedJobCard };
  });
}

export async function updateJobCard(
  auth: AuthContext,
  jobCardId: string,
  input: { discount?: number; taxPercent?: number; status?: "draft" | "in_progress" }
) {
  const jc = await db.query.jobCards.findFirst({
    where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, auth.orgId)),
  });
  if (!jc) throw new JobCardError("job card not found", 404);

  const isReopen = jc.status === "completed" && input.status === "in_progress";
  if (jc.status !== "draft" && jc.status !== "in_progress" && !isReopen) {
    throw new JobCardError("cannot modify a completed, billed, or cancelled job card", 409);
  }
  if (isReopen) {
    const existingInvoice = await db.query.invoices.findFirst({ where: eq(invoices.jobCardId, jobCardId) });
    if (existingInvoice) {
      throw new JobCardError("cannot reopen a job card that already has an invoice", 409);
    }
  }

  return await db.transaction(async (tx) => {
    const patch: Record<string, unknown> = {};
    if (input.discount !== undefined) patch.discount = input.discount;
    if (input.taxPercent !== undefined) patch.taxPercent = input.taxPercent;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (isReopen) patch.completedAt = null;
    }

    if (Object.keys(patch).length > 0) {
      await tx.update(jobCards).set(patch).where(eq(jobCards.id, jobCardId));
    }
    const updatedJobCard = await recalculateJobCardTotals(tx, jobCardId);
    return { jobCard: updatedJobCard };
  });
}

export async function markJobCardComplete(orgId: string, jobCardId: string) {
  const jc = await db.query.jobCards.findFirst({
    where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, orgId)),
  });
  if (!jc) throw new JobCardError("job card not found", 404);
  if (jc.status === "cancelled") throw new JobCardError("cannot complete a cancelled job card", 409);
  if (jc.status === "completed" || jc.status === "billed") {
    return { jobCard: jc, alreadyCompleted: true };
  }

  const [svcCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobCardServices)
    .where(eq(jobCardServices.jobCardId, jobCardId));
  const [prodCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobCardProducts)
    .where(eq(jobCardProducts.jobCardId, jobCardId));
  if ((svcCount?.count ?? 0) + (prodCount?.count ?? 0) === 0) {
    throw new JobCardError("add at least one service or product before completing the job card", 400);
  }

  const [updated] = await db
    .update(jobCards)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, orgId)))
    .returning();
  return { jobCard: updated, alreadyCompleted: false };
}
