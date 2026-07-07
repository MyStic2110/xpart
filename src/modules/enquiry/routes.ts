import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, gte, lte, ilike, desc, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { enquiries, users, vehicleMakes, vehicleModels } from "@/db/schema";
import { requireAuth } from "@/middleware/auth";
import { createNotification } from "@/modules/notifications/routes";

const createSchema = z.object({
  contactNumber: z.string().min(1),
  clientName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  branchId: z.string().uuid().optional().or(z.literal("")),
  enquiryFor: z.string().min(1),
  enquiryType: z.string().min(1),
  response: z.string().optional().or(z.literal("")),
  dateToFollow: z.string().min(1),
  sourceOfEnquiry: z.string().min(1),
  leadRepresentativeId: z.string().uuid().optional().or(z.literal("")),
  leadStatus: z.enum(["pending", "contacted", "follow_up", "converted", "lost"]).default("pending"),
  channel: z.enum(["sms", "whatsapp"]).default("sms"),
  vehicleNumber: z.string().optional().or(z.literal("")),
  makeId: z.string().uuid().optional().or(z.literal("")),
  modelId: z.string().uuid().optional().or(z.literal("")),
  segment: z.string().optional().or(z.literal("")),
  year: z.coerce.number().optional(),
  color: z.string().optional().or(z.literal("")),
  fuelType: z.string().optional().or(z.literal("")),
});

const updateSchema = z.object({
  leadStatus: z.enum(["pending", "contacted", "follow_up", "converted", "lost"]).optional(),
  response: z.string().optional(),
  dateToFollow: z.string().optional(),
  leadRepresentativeId: z.string().uuid().optional().or(z.literal("")),
});

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function enquiryRoutes(app: FastifyInstance) {
  app.get("/enquiries", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const q = req.query as Record<string, string | undefined>;

    const conds: SQL[] = [eq(enquiries.orgId, auth.orgId)];
    if (q.branchId && q.branchId !== "all") conds.push(eq(enquiries.branchId, q.branchId));
    if (q.from) conds.push(gte(enquiries.dateToFollow, q.from));
    if (q.to) conds.push(lte(enquiries.dateToFollow, q.to));
    if (q.type) conds.push(eq(enquiries.enquiryType, q.type));
    if (q.source) conds.push(eq(enquiries.sourceOfEnquiry, q.source));
    if (q.status) conds.push(eq(enquiries.leadStatus, q.status as typeof enquiries.leadStatus.enumValues[number]));
    if (q.rep) conds.push(eq(enquiries.leadRepresentativeId, q.rep));
    if (q.enquiryFor) conds.push(ilike(enquiries.enquiryFor, `%${q.enquiryFor}%`));

    const rows = await db
      .select({
        id: enquiries.id,
        contactNumber: enquiries.contactNumber,
        clientName: enquiries.clientName,
        email: enquiries.email,
        address: enquiries.address,
        enquiryFor: enquiries.enquiryFor,
        enquiryType: enquiries.enquiryType,
        response: enquiries.response,
        dateToFollow: enquiries.dateToFollow,
        sourceOfEnquiry: enquiries.sourceOfEnquiry,
        leadStatus: enquiries.leadStatus,
        channel: enquiries.channel,
        vehicleNumber: enquiries.vehicleNumber,
        makeId: enquiries.makeId,
        modelId: enquiries.modelId,
        segment: enquiries.segment,
        year: enquiries.year,
        color: enquiries.color,
        fuelType: enquiries.fuelType,
        leadRepName: users.name,
        leadRepId: enquiries.leadRepresentativeId,
        createdAt: enquiries.createdAt,
      })
      .from(enquiries)
      .leftJoin(users, eq(users.id, enquiries.leadRepresentativeId))
      .where(and(...conds))
      .orderBy(desc(enquiries.dateToFollow));

    return reply.send(rows);
  });

  app.post("/enquiries", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const [row] = await db
      .insert(enquiries)
      .values({
        orgId: auth.orgId,
        branchId: d.branchId || null,
        contactNumber: d.contactNumber,
        clientName: d.clientName,
        email: clean(d.email),
        address: clean(d.address),
        enquiryFor: d.enquiryFor,
        enquiryType: d.enquiryType,
        response: clean(d.response),
        dateToFollow: d.dateToFollow,
        sourceOfEnquiry: d.sourceOfEnquiry,
        leadRepresentativeId: d.leadRepresentativeId || auth.userId,
        leadStatus: d.leadStatus,
        channel: d.channel,
        vehicleNumber: clean(d.vehicleNumber),
        makeId: d.makeId || null,
        modelId: d.modelId || null,
        segment: clean(d.segment),
        year: d.year ?? null,
        color: clean(d.color),
        fuelType: clean(d.fuelType),
      })
      .returning();
    await createNotification(auth.orgId, {
      title: "New Enquiry Created",
      message: `Enquiry for ${row.enquiryFor || "general services"} created for ${row.clientName} (${row.contactNumber}).`,
      type: "enquiry",
    });

    return reply.code(201).send(row);
  });

  app.patch("/enquiries/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.leadStatus !== undefined) updates.leadStatus = d.leadStatus;
    if (d.response !== undefined) updates.response = clean(d.response);
    if (d.dateToFollow !== undefined) updates.dateToFollow = d.dateToFollow;
    if (d.leadRepresentativeId !== undefined) updates.leadRepresentativeId = d.leadRepresentativeId || null;

    const [row] = await db
      .update(enquiries)
      .set(updates)
      .where(and(eq(enquiries.id, id), eq(enquiries.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "enquiry not found" });
    return reply.send(row);
  });
}
