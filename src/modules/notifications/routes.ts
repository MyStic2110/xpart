import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireAuth } from "@/middleware/auth";

export async function createNotification(orgId: string, input: { title: string; message: string; type: string }) {
  try {
    await db.insert(notifications).values({
      orgId,
      title: input.title,
      message: input.message,
      type: input.type,
      isRead: false,
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.orgId, auth.orgId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    return reply.send(rows);
  });

  app.post("/notifications/read-all", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.orgId, auth.orgId), eq(notifications.isRead, false)));
    return reply.send({ success: true });
  });

  app.post("/notifications/:id/read", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.orgId, auth.orgId)));
    return reply.send({ success: true });
  });
}
