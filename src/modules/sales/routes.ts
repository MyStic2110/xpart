import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import {
  refreshSalesActions,
  listSalesActions,
  recordOutcome,
  getSalesActionLogs,
  listAppointments,
  updateAppointmentStatus,
  SalesError,
} from "./service";

const outcomeSchema = z.object({
  outcome: z.enum(["contacted", "appointment_booked", "rescheduled", "declined", "closed"]),
  note: z.string().min(1),
  nextFollowUpDate: z.string().optional().or(z.literal("")),
  appointmentDate: z.string().optional().or(z.literal("")),
  appointmentTime: z.string().optional().or(z.literal("")),
});

export async function salesRoutes(app: FastifyInstance) {
  app.post("/sales-actions/refresh", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const result = await refreshSalesActions(auth.orgId);
    return reply.send(result);
  });

  app.get("/sales-actions", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { status, branchId } = req.query as { status?: string; branchId?: string };
    const rows = await listSalesActions(auth.orgId, status, branchId && branchId !== "all" ? branchId : null);
    return reply.send(rows);
  });

  app.get("/sales-actions/:id/logs", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await getSalesActionLogs(id);
    return reply.send(rows);
  });

  app.post("/sales-actions/:id/outcome", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = outcomeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await recordOutcome(auth.orgId, id, { ...parsed.data, byUserId: auth.userId });
      return reply.send(result);
    } catch (err) {
      if (err instanceof SalesError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get("/appointments", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await listAppointments(auth.orgId);
    return reply.send(rows);
  });

  app.post("/appointments/:id/status", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const schema = z.object({ status: z.enum(["confirmed", "completed", "cancelled", "no_show"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await updateAppointmentStatus(auth.orgId, id, parsed.data.status);
      return reply.send(result);
    } catch (err) {
      if (err instanceof SalesError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
