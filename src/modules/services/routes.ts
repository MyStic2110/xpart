import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { services } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const createSchema = z.object({
  name: z.string().min(1),
  defaultPrice: z.coerce.number().nonnegative(),
  recurrenceDays: z.coerce.number().positive().optional(),
});
const updateSchema = z.object({ recurrenceDays: z.coerce.number().positive().nullable() });
const canManage = [requireAuth, requireRole("org_owner", "admin", "branch_manager")];

export async function servicesRoutes(app: FastifyInstance) {
  app.get("/services", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db.select().from(services).where(and(eq(services.orgId, auth.orgId), eq(services.isActive, true)));
    return reply.send(rows);
  });

  app.post("/services", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [row] = await db
      .insert(services)
      .values({
        orgId: auth.orgId,
        name: parsed.data.name,
        defaultPrice: Math.round(parsed.data.defaultPrice * 100),
        recurrenceDays: parsed.data.recurrenceDays ?? null,
      })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch("/services/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [row] = await db
      .update(services)
      .set({ recurrenceDays: parsed.data.recurrenceDays })
      .where(and(eq(services.id, id), eq(services.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "service not found" });
    return reply.send(row);
  });
}
