import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { connectors } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { PROVIDER_REGISTRY, getProvider, maskConfig } from "./registry";

const canManage = [requireAuth, requireRole("org_owner", "admin")];

export async function connectorRoutes(app: FastifyInstance) {
  // Registry + this org's saved connections (config returned masked).
  app.get("/connectors", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const saved = await db.select().from(connectors).where(eq(connectors.orgId, auth.orgId));
    const savedByProvider = new Map(saved.map((s) => [s.provider, s]));

    const result = PROVIDER_REGISTRY.map((def) => {
      const conn = savedByProvider.get(def.provider);
      return {
        ...def,
        connected: Boolean(conn),
        status: conn?.status ?? null,
        config: conn ? maskConfig(def, conn.config as Record<string, unknown>) : null,
        connectedAt: conn?.createdAt ?? null,
      };
    });
    return reply.send(result);
  });

  // Connect / update a connector. Secrets sent as masked previews (••••) are
  // ignored so an edit doesn't overwrite a stored secret with its mask.
  app.put("/connectors/:provider", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { provider } = req.params as { provider: string };
    const def = getProvider(provider);
    if (!def) return reply.code(404).send({ error: "unknown provider" });

    const parsed = z.object({ config: z.record(z.string()) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const existing = await db.query.connectors.findFirst({
      where: and(eq(connectors.orgId, auth.orgId), eq(connectors.provider, provider)),
    });
    const existingConfig = (existing?.config as Record<string, unknown>) ?? {};

    const merged: Record<string, string> = {};
    for (const field of def.fields) {
      const incoming = parsed.data.config[field.key];
      if (incoming === undefined || incoming === "" || incoming.startsWith("••••")) {
        merged[field.key] = String(existingConfig[field.key] ?? "");
      } else {
        merged[field.key] = incoming;
      }
    }

    if (existing) {
      await db
        .update(connectors)
        .set({ config: merged, status: "active", updatedAt: new Date() })
        .where(eq(connectors.id, existing.id));
    } else {
      await db.insert(connectors).values({ orgId: auth.orgId, provider, config: merged, status: "active" });
    }

    return reply.code(201).send({ provider, connected: true, config: maskConfig(def, merged) });
  });

  app.delete("/connectors/:provider", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { provider } = req.params as { provider: string };
    await db.delete(connectors).where(and(eq(connectors.orgId, auth.orgId), eq(connectors.provider, provider)));
    return reply.send({ success: true });
  });
}
