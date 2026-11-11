import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, asc, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { services } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const createSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  defaultPrice: z.coerce.number().nonnegative(),
  recurrenceDays: z.coerce.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").optional(),
  defaultPrice: z.coerce.number().nonnegative().optional(),
  recurrenceDays: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

export async function servicesRoutes(app: FastifyInstance) {
  app.get("/services", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(services)
      .where(and(eq(services.orgId, auth.orgId), eq(services.isActive, true)))
      .orderBy(asc(services.name));
    return reply.send(rows);
  });

  app.post("/services", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const existing = await db.query.services.findFirst({
      where: and(eq(services.orgId, auth.orgId), eq(services.name, d.name)),
    });

    if (existing) {
      if (existing.isActive) {
        return reply.code(409).send({ error: "a service with this name already exists" });
      }
      // Reactivate previously archived service with updated pricing/recurrence.
      const [reactivated] = await db
        .update(services)
        .set({
          defaultPrice: Math.round(d.defaultPrice * 100),
          recurrenceDays: d.recurrenceDays ?? null,
          isActive: true,
        })
        .where(eq(services.id, existing.id))
        .returning();
      return reply.code(201).send(reactivated);
    }

    const [row] = await db
      .insert(services)
      .values({
        orgId: auth.orgId,
        name: d.name,
        defaultPrice: Math.round(d.defaultPrice * 100),
        recurrenceDays: d.recurrenceDays ?? null,
      })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch("/services/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    if (d.name !== undefined) {
      const dup = await db.query.services.findFirst({
        where: and(eq(services.orgId, auth.orgId), eq(services.name, d.name), ne(services.id, id)),
      });
      if (dup) return reply.code(409).send({ error: "a service with this name already exists" });
    }

    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.defaultPrice !== undefined) updates.defaultPrice = Math.round(d.defaultPrice * 100);
    if (d.recurrenceDays !== undefined) updates.recurrenceDays = d.recurrenceDays;
    if (d.isActive !== undefined) updates.isActive = d.isActive;
    if (Object.keys(updates).length === 0) return reply.code(400).send({ error: "no fields to update" });

    const [row] = await db
      .update(services)
      .set(updates)
      .where(and(eq(services.id, id), eq(services.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "service not found" });
    return reply.send(row);
  });

  app.delete("/services/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };

    const existing = await db.query.services.findFirst({
      where: and(eq(services.id, id), eq(services.orgId, auth.orgId)),
    });
    if (!existing) return reply.code(404).send({ error: "service not found" });

    try {
      await db.delete(services).where(and(eq(services.id, id), eq(services.orgId, auth.orgId)));
      return reply.send({ success: true, archived: false });
    } catch (err: unknown) {
      const pgCode = (err as { code?: string; cause?: { code?: string } })?.code
        ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === "23503") {
        await db
          .update(services)
          .set({ isActive: false })
          .where(and(eq(services.id, id), eq(services.orgId, auth.orgId)));
        return reply.send({ success: true, archived: true });
      }
      throw err;
    }
  });
}
