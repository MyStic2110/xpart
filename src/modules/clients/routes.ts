import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { searchClients, getClient360, listClients, getClientDetail, findOrCreateClient, getClientCredit, searchVehicles, sendInsuranceExpiryReminders } from "./service";
import { sendReferralInvite } from "@/modules/connectors/whatsapp";
import { db } from "@/db/client";
import { vehicles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { schemaDoc } from "@/utils/swagger";

const createClientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  address: z.string().optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  dateOfBirth: z.string().optional(),
  anniversary: z.string().optional(),
  sourceOfClient: z.string().optional(),
  clientType: z.enum(["customer", "third_party"]).optional(),
  referredByCode: z.string().optional(),
});

export async function clientRoutes(app: FastifyInstance) {
  app.get("/clients", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Clients"],
      summary: "List all clients",
      description: "Returns a list of all clients in the organization.",
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await listClients(auth.orgId);
    return reply.send(rows);
  });

  // Add a client directly (customer or third-party vendor). Dedup key is phone —
  // an existing record is updated in place, same as the job-card flow.
  app.post("/clients", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Clients"],
      summary: "Create or retrieve client by phone",
      description: "Creates a new client or updates an existing client. Triggers a referral invite WhatsApp message if a new client is created.",
      body: createClientSchema,
    })
  }, async (req, reply) => {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
    const client = await findOrCreateClient(req.auth!.orgId, parsed.data);
    // New customers get the "Invite friends & earn points" WhatsApp with their
    // referral code (no-op result until the WhatsApp connector is activated).
    const referralInvite = client.wasCreated ? await sendReferralInvite(req.auth!.orgId, client) : null;
    return reply.code(201).send({ ...client, referralInvite });
  });

  app.get("/clients/search", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Clients"],
      summary: "Search clients by name, phone, or vehicle registration",
      querystring: z.object({ q: z.string().optional() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { q } = req.query as { q?: string };
    const rows = await searchClients(auth.orgId, q ?? "");
    return reply.send(rows);
  });

  app.get("/vehicles/search", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Vehicles"],
      summary: "Search vehicles by registration plate number query",
      querystring: z.object({ q: z.string().optional() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { q } = req.query as { q?: string };
    const rows = await searchVehicles(auth.orgId, q ?? "");
    return reply.send(rows);
  });

  app.get("/clients/:id/360", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Clients"],
      summary: "Get client 360 view history and statistics",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const view = await getClient360(auth.orgId, id);
    if (!view) return reply.code(404).send({ error: "client not found" });
    return reply.send(view);
  });

  app.get("/clients/:id", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Clients"],
      summary: "Get single client profile details",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const detail = await getClientDetail(auth.orgId, id);
    if (!detail) return reply.code(404).send({ error: "client not found" });
    return reply.send(detail);
  });

  app.patch("/vehicles/:id", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Vehicles"],
      summary: "Update vehicle images and insurance dates",
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        images: z.array(z.string()).optional(),
        insuranceExpiryDate: z.string().nullable().optional(),
      }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    const body = req.body as { images?: string[]; insuranceExpiryDate?: string | null };

    const updates: Record<string, any> = {};
    if (body.images !== undefined) updates.images = body.images || null;
    if (body.insuranceExpiryDate !== undefined) updates.insuranceExpiryDate = body.insuranceExpiryDate || null;

    const [updated] = await db
      .update(vehicles)
      .set(updates)
      .where(and(eq(vehicles.id, id), eq(vehicles.orgId, orgId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: "vehicle not found" });
    return reply.send(updated);
  });

  app.post("/vehicles/insurance-reminders/trigger", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Vehicles"],
      summary: "Trigger bulk insurance expiry reminders via WhatsApp",
      description: "Finds vehicles with expiring insurance in next 7 days and sends bulk WhatsApp alert notifications.",
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const results = await sendInsuranceExpiryReminders(orgId);
    return reply.send({ success: true, processed: results.length, details: results });
  });
}
