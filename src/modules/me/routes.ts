import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { organizations, branches, users } from "@/db/schema";
import { requireAuth } from "@/middleware/auth";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;

    const [org] = await db.select().from(organizations).where(eq(organizations.id, auth.orgId));
    const [user] = await db.select().from(users).where(eq(users.id, auth.userId));

    const orgWide = auth.assignments.some((a) => a.branchId === null);
    const branchIds = auth.assignments.map((a) => a.branchId).filter((b): b is string => b !== null);

    const orgBranches = orgWide
      ? await db.select().from(branches).where(eq(branches.orgId, auth.orgId))
      : branchIds.length > 0
        ? await db.select().from(branches).where(inArray(branches.id, branchIds))
        : [];

    return reply.send({
      user: { id: user.id, name: user.name, phone: user.phone },
      org: { id: org.id, name: org.name, plan: org.plan, status: org.status, walletEnabled: org.walletEnabled },
      roles: auth.assignments.map((a) => a.role),
      branches: orgBranches,
    });
  });
}
