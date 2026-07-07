import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "@/middleware/auth";
import { computeMonthlyPayroll, finalizePayroll, listPayrollHistory, PayrollError } from "./service";

const canManagePayroll = [requireAuth, requireRole("org_owner", "admin")];

export async function payrollRoutes(app: FastifyInstance) {
  app.get("/payroll/:userId/:month/preview", { preHandler: canManagePayroll }, async (req, reply) => {
    const auth = req.auth!;
    const { userId, month } = req.params as { userId: string; month: string };
    try {
      const breakdown = await computeMonthlyPayroll(auth.orgId, userId, month);
      return reply.send(breakdown);
    } catch (err) {
      if (err instanceof PayrollError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/payroll/:userId/:month/finalize", { preHandler: canManagePayroll }, async (req, reply) => {
    const auth = req.auth!;
    const { userId, month } = req.params as { userId: string; month: string };
    try {
      const row = await finalizePayroll(auth.orgId, userId, month);
      return reply.code(201).send(row);
    } catch (err) {
      if (err instanceof PayrollError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.get("/payroll/:userId/history", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { userId } = req.params as { userId: string };
    if (userId !== auth.userId) {
      const isManager = auth.assignments.some((a) => ["org_owner", "admin"].includes(a.role));
      if (!isManager) return reply.code(403).send({ error: "insufficient permissions" });
    }
    const rows = await listPayrollHistory(userId);
    return reply.send(rows);
  });
}
