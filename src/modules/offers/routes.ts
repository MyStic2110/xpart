import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { offers } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin")];

const createSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  discountType: z.enum(["flat", "percentage"]),
  value: z.coerce.number().positive(), // if flat -> rupees from client, if percentage -> percent points (e.g. 10)
  maxDiscount: z.coerce.number().nonnegative().optional(), // rupees
  minBillingAmount: z.coerce.number().nonnegative().optional(), // rupees
  targetType: z.string().default("all"),
  isActive: z.boolean().optional(),
  restrictedDays: z.array(z.string()).optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  value: z.coerce.number().positive().optional(),
  maxDiscount: z.coerce.number().nonnegative().optional(),
  minBillingAmount: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
  restrictedDays: z.array(z.string()).optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
});


export async function offersRoutes(app: FastifyInstance) {
  app.get("/offers", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    
    const rows = await db.execute(sql`
      select
        o.id,
        o.code,
        o.title,
        o.description,
        o.discount_type as "discountType",
        o.value,
        o.max_discount as "maxDiscount",
        o.min_billing_amount as "minBillingAmount",
        o.target_type as "targetType",
        o.is_active as "isActive",
        o.restricted_days as "restrictedDays",
        o.start_time as "startTime",
        o.end_time as "endTime",
        (select count(*)::int from invoices i where i.applied_offer_id = o.id and i.status in ('paid','partial')) as "usageCount",
        (select coalesce(sum(i.discount),0)::int from invoices i where i.applied_offer_id = o.id and i.status in ('paid','partial')) as "totalDiscount",
        (select coalesce(sum(i.total),0)::int from invoices i where i.applied_offer_id = o.id and i.status in ('paid','partial')) as "totalRevenue"
      from offers o
      where o.org_id = ${auth.orgId}
      order by o.code
    `);
    
    return reply.send(rows);
  });

  app.post("/offers", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    // Check duplicate code
    const dup = await db.query.offers.findFirst({
      where: and(eq(offers.orgId, auth.orgId), eq(offers.code, d.code.toUpperCase().trim())),
    });
    if (dup) return reply.code(409).send({ error: "an offer with this coupon code already exists" });

    const valPaise = d.discountType === "flat" ? Math.round(d.value * 100) : d.value;
    const maxDiscPaise = d.maxDiscount ? Math.round(d.maxDiscount * 100) : 0;
    const minBillPaise = d.minBillingAmount ? Math.round(d.minBillingAmount * 100) : 0;

    const [row] = await db
      .insert(offers)
      .values({
        orgId: auth.orgId,
        code: d.code.toUpperCase().trim(),
        title: d.title,
        description: d.description,
        discountType: d.discountType,
        value: valPaise,
        maxDiscount: maxDiscPaise,
        minBillingAmount: minBillPaise,
        targetType: d.targetType,
        isActive: d.isActive ?? true,
        restrictedDays: d.restrictedDays || null,
        startTime: d.startTime || null,
        endTime: d.endTime || null,
      })
      .returning();
    
    return reply.code(201).send(row);
  });

  app.patch("/offers/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const existing = await db.query.offers.findFirst({
      where: and(eq(offers.id, id), eq(offers.orgId, auth.orgId)),
    });
    if (!existing) return reply.code(404).send({ error: "offer not found" });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.title !== undefined) updates.title = d.title;
    if (d.description !== undefined) updates.description = d.description;
    
    if (d.value !== undefined) {
      updates.value = existing.discountType === "flat" ? Math.round(d.value * 100) : d.value;
    }
    if (d.maxDiscount !== undefined) {
      updates.maxDiscount = Math.round(d.maxDiscount * 100);
    }
    if (d.minBillingAmount !== undefined) {
      updates.minBillingAmount = Math.round(d.minBillingAmount * 100);
    }
    if (d.isActive !== undefined) {
      updates.isActive = d.isActive;
    }
    if (d.restrictedDays !== undefined) {
      updates.restrictedDays = d.restrictedDays;
    }
    if (d.startTime !== undefined) {
      updates.startTime = d.startTime || null;
    }
    if (d.endTime !== undefined) {
      updates.endTime = d.endTime || null;
    }

    const [row] = await db
      .update(offers)
      .set(updates)
      .where(eq(offers.id, id))
      .returning();

    return reply.send(row);
  });

  app.delete("/offers/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };

    const [deleted] = await db
      .delete(offers)
      .where(and(eq(offers.id, id), eq(offers.orgId, auth.orgId)))
      .returning();
    
    if (!deleted) return reply.code(404).send({ error: "offer not found" });
    return reply.send({ success: true });
  });
}
