import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { feedback } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createNotification } from "@/modules/notifications/routes";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

export async function feedbackRoutes(app: FastifyInstance) {
  app.get("/feedback", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { source } = req.query as { source?: string };
    const conds: SQL[] = [eq(feedback.orgId, auth.orgId)];
    if (source && source !== "all") conds.push(eq(feedback.source, source as typeof feedback.source.enumValues[number]));

    const rows = await db.select().from(feedback).where(and(...conds)).orderBy(desc(feedback.reviewDate), desc(feedback.createdAt));
    return reply.send(rows);
  });

  app.get("/feedback/summary", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const result = await db.execute(sql`
      select
        count(*)::int as total,
        coalesce(round(avg(rating)::numeric, 2), 0) as avg_rating,
        count(*) filter (where rating >= 4)::int as positive,
        count(*) filter (where rating <= 2)::int as negative,
        count(*) filter (where source = 'google')::int as google_count
      from feedback where org_id = ${auth.orgId} and rating is not null
    `);
    const r = (result as unknown as Record<string, string | number>[])[0];
    return reply.send({
      total: Number(r.total ?? 0),
      avgRating: Number(r.avg_rating ?? 0),
      positive: Number(r.positive ?? 0),
      negative: Number(r.negative ?? 0),
      googleCount: Number(r.google_count ?? 0),
    });
  });

  const createSchema = z.object({
    source: z.enum(["in_app", "google", "whatsapp", "manual"]).default("manual"),
    reviewerName: z.string().optional().or(z.literal("")),
    rating: z.coerce.number().min(1).max(5).optional(),
    comment: z.string().optional().or(z.literal("")),
    reviewDate: z.string().optional().or(z.literal("")),
  });

  app.post("/feedback", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const [row] = await db
      .insert(feedback)
      .values({
        orgId: auth.orgId,
        source: d.source,
        reviewerName: d.reviewerName || null,
        rating: d.rating ?? null,
        comment: d.comment || null,
        reviewDate: d.reviewDate || null,
      })
      .returning();

    await createNotification(auth.orgId, {
      title: `New Feedback (${d.rating || 5} Stars)`,
      message: `${d.reviewerName || "Anonymous"} left a review on ${d.source}: "${d.comment || "No comment left"}"`,
      type: "feedback",
    });

    return reply.code(201).send(row);
  });

  app.patch("/feedback/:id/reply", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = z.object({ reply: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .update(feedback)
      .set({ reply: parsed.data.reply })
      .where(and(eq(feedback.id, id), eq(feedback.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "feedback not found" });
    return reply.send(row);
  });

  // Bulk-import reviews (e.g. from Google Places API or a paid review service).
  // Deduplicates on externalId so re-running won't create duplicates.
  const importSchema = z.object({
    source: z.enum(["google", "whatsapp", "in_app", "manual"]).default("google"),
    reviews: z
      .array(
        z.object({
          externalId: z.string().optional(),
          reviewerName: z.string().optional(),
          rating: z.coerce.number().min(1).max(5).optional(),
          comment: z.string().optional(),
          reviewDate: z.string().optional(),
        })
      )
      .min(1),
  });

  app.post("/feedback/import", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    let imported = 0;
    for (const rv of parsed.data.reviews) {
      if (rv.externalId) {
        const dup = await db.query.feedback.findFirst({
          where: and(eq(feedback.orgId, auth.orgId), eq(feedback.externalId, rv.externalId)),
        });
        if (dup) continue;
      }
      await db.insert(feedback).values({
        orgId: auth.orgId,
        source: parsed.data.source,
        reviewerName: rv.reviewerName || null,
        rating: rv.rating ?? null,
        comment: rv.comment || null,
        reviewDate: rv.reviewDate || null,
        externalId: rv.externalId || null,
      });
      imported++;
    }
    return reply.code(201).send({ imported });
  });
}
