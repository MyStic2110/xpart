import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { vehicleMakes, vehicleModels } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const canManageCatalog = [requireAuth, requireRole("org_owner", "admin")];

const makeSchema = z.object({ name: z.string().min(1) });
const modelSchema = z.object({
  name: z.string().min(1),
  makeId: z.string().uuid(),
  segment: z.string().min(1),
});

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/vehicle-makes", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(vehicleMakes)
      .where(or(isNull(vehicleMakes.orgId), eq(vehicleMakes.orgId, auth.orgId)))
      .orderBy(vehicleMakes.name);
    return reply.send(rows);
  });

  app.post("/vehicle-makes", { preHandler: canManageCatalog }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = makeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const dup = await db
      .select()
      .from(vehicleMakes)
      .where(
        and(
          or(isNull(vehicleMakes.orgId), eq(vehicleMakes.orgId, auth.orgId)),
          sql`lower(${vehicleMakes.name}) = lower(${parsed.data.name})`
        )
      );
    if (dup.length > 0) return reply.code(409).send({ error: "make already exists" });

    const [row] = await db.insert(vehicleMakes).values({ orgId: auth.orgId, name: parsed.data.name }).returning();
    return reply.code(201).send(row);
  });

  app.delete("/vehicle-makes/:id", { preHandler: canManageCatalog }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const [deleted] = await db
      .delete(vehicleMakes)
      .where(and(eq(vehicleMakes.id, id), eq(vehicleMakes.orgId, auth.orgId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: "make not found or not deletable (global entries can't be removed)" });
    return reply.send({ success: true });
  });

  app.get("/vehicle-models", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select({
        id: vehicleModels.id,
        orgId: vehicleModels.orgId,
        name: vehicleModels.name,
        segment: vehicleModels.segment,
        makeId: vehicleModels.makeId,
        makeName: vehicleMakes.name,
      })
      .from(vehicleModels)
      .innerJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
      .where(or(isNull(vehicleModels.orgId), eq(vehicleModels.orgId, auth.orgId)))
      .orderBy(vehicleModels.name);
    return reply.send(rows);
  });

  app.post("/vehicle-models", { preHandler: canManageCatalog }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = modelSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const make = await db.query.vehicleMakes.findFirst({ where: eq(vehicleMakes.id, parsed.data.makeId) });
    if (!make || (make.orgId !== null && make.orgId !== auth.orgId)) {
      return reply.code(404).send({ error: "make not found" });
    }

    const dup = await db
      .select()
      .from(vehicleModels)
      .where(
        and(
          eq(vehicleModels.makeId, parsed.data.makeId),
          or(isNull(vehicleModels.orgId), eq(vehicleModels.orgId, auth.orgId)),
          sql`lower(${vehicleModels.name}) = lower(${parsed.data.name})`
        )
      );
    if (dup.length > 0) return reply.code(409).send({ error: "model already exists for this make" });

    const [row] = await db
      .insert(vehicleModels)
      .values({ orgId: auth.orgId, makeId: parsed.data.makeId, name: parsed.data.name, segment: parsed.data.segment })
      .returning();
    return reply.code(201).send(row);
  });

  app.delete("/vehicle-models/:id", { preHandler: canManageCatalog }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const [deleted] = await db
      .delete(vehicleModels)
      .where(and(eq(vehicleModels.id, id), eq(vehicleModels.orgId, auth.orgId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: "model not found or not deletable (global entries can't be removed)" });
    return reply.send({ success: true });
  });
}
