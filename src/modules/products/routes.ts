import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

// Writes restricted to platform/org administrators.
const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin")];

const baseSchema = {
  name: z.string().min(1),
  mrp: z.coerce.number().nonnegative(), // rupees from client → paise on save
  volume: z.string().optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  subCategory: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
};
const createSchema = z.object(baseSchema);
const updateSchema = z.object(baseSchema).partial();

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db.select().from(products).where(eq(products.orgId, auth.orgId)).orderBy(products.name);
    return reply.send(rows);
  });

  app.post("/products", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const dup = await db.query.products.findFirst({ where: and(eq(products.orgId, auth.orgId), eq(products.name, d.name)) });
    if (dup) return reply.code(409).send({ error: "a product with this name already exists" });

    const [row] = await db
      .insert(products)
      .values({
        orgId: auth.orgId,
        name: d.name,
        mrp: Math.round(d.mrp * 100),
        volume: clean(d.volume),
        barcode: clean(d.barcode),
        category: clean(d.category),
        subCategory: clean(d.subCategory),
        sku: clean(d.sku),
        isActive: d.isActive ?? true,
      })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch("/products/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.mrp !== undefined) updates.mrp = Math.round(d.mrp * 100);
    if (d.volume !== undefined) updates.volume = clean(d.volume);
    if (d.barcode !== undefined) updates.barcode = clean(d.barcode);
    if (d.category !== undefined) updates.category = clean(d.category);
    if (d.subCategory !== undefined) updates.subCategory = clean(d.subCategory);
    if (d.sku !== undefined) updates.sku = clean(d.sku);
    if (d.isActive !== undefined) updates.isActive = d.isActive;
    if (Object.keys(updates).length === 0) return reply.code(400).send({ error: "no fields to update" });

    const [row] = await db
      .update(products)
      .set(updates)
      .where(and(eq(products.id, id), eq(products.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "product not found" });
    return reply.send(row);
  });

  app.delete("/products/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.orgId, auth.orgId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: "product not found" });
    return reply.send({ success: true });
  });
}
