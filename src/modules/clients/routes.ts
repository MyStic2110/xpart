import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { searchClients, getClient360, listClients, getClientDetail, findOrCreateClient, getClientCredit, searchVehicles } from "./service";
import { sendReferralInvite } from "@/modules/connectors/whatsapp";

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
  app.get("/clients", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await listClients(auth.orgId);
    return reply.send(rows);
  });

  // Add a client directly (customer or third-party vendor). Dedup key is phone —
  // an existing record is updated in place, same as the job-card flow.
  app.post("/clients", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
    const client = await findOrCreateClient(req.auth!.orgId, parsed.data);
    // New customers get the "Invite friends & earn points" WhatsApp with their
    // referral code (no-op result until the WhatsApp connector is activated).
    const referralInvite = client.wasCreated ? await sendReferralInvite(req.auth!.orgId, client) : null;
    return reply.code(201).send({ ...client, referralInvite });
  });

  // Credit ledger — open (unsettled) invoices per vehicle, mainly for third-party vendors.
  app.get("/clients/:id/credit", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ledger = await getClientCredit(req.auth!.orgId, id);
    if (!ledger) return reply.code(404).send({ error: "client not found" });
    return reply.send(ledger);
  });

  app.get("/clients/search", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { q } = req.query as { q?: string };
    const rows = await searchClients(auth.orgId, q ?? "");
    return reply.send(rows);
  });

  app.get("/vehicles/search", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { q } = req.query as { q?: string };
    const rows = await searchVehicles(auth.orgId, q ?? "");
    return reply.send(rows);
  });

  app.get("/clients/:id/360", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const view = await getClient360(auth.orgId, id);
    if (!view) return reply.code(404).send({ error: "client not found" });
    return reply.send(view);
  });

  app.get("/clients/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const detail = await getClientDetail(auth.orgId, id);
    if (!detail) return reply.code(404).send({ error: "client not found" });
    return reply.send(detail);
  });
}
