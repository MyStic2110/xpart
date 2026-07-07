import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const markSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().min(1), // YYYY-MM-DD
  status: z.enum(["present", "half_day", "absent", "leave", "lop"]),
  checkIn: z.string().optional().or(z.literal("")),
  checkOut: z.string().optional().or(z.literal("")),
  hoursWorked: z.coerce.number().min(0).max(24).optional(),
  notes: z.string().optional().or(z.literal("")),
  branchId: z.string().uuid().nullable().optional(),
});

const canMarkForOthers = [requireAuth, requireRole("org_owner", "admin", "branch_manager")];

export async function attendanceRoutes(app: FastifyInstance) {
  // Mark/update attendance for a given user+date (upsert). Self-marking is
  // allowed; marking on behalf of someone else requires a manager role.
  app.post("/attendance", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = markSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;

    if (data.userId !== auth.userId) {
      const isManager = auth.assignments.some((a) => ["org_owner", "admin", "branch_manager"].includes(a.role));
      if (!isManager) return reply.code(403).send({ error: "insufficient permissions" });
    }

    const [row] = await db
      .insert(attendance)
      .values({
        userId: data.userId,
        orgId: auth.orgId,
        branchId: data.branchId ?? null,
        date: data.date,
        status: data.status,
        checkIn: data.checkIn || null,
        checkOut: data.checkOut || null,
        hoursWorked: (data.hoursWorked ?? 0).toString(),
        notes: data.notes || null,
        markedBy: auth.userId,
      })
      .onConflictDoUpdate({
        target: [attendance.userId, attendance.date],
        set: {
          status: data.status,
          checkIn: data.checkIn || null,
          checkOut: data.checkOut || null,
          hoursWorked: (data.hoursWorked ?? 0).toString(),
          notes: data.notes || null,
          markedBy: auth.userId,
        },
      })
      .returning();

    return reply.code(201).send(row);
  });

  app.get("/attendance", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { userId, from, to } = req.query as { userId?: string; from?: string; to?: string };
    const targetUserId = userId || auth.userId;

    if (targetUserId !== auth.userId) {
      const isManager = auth.assignments.some((a) => ["org_owner", "admin", "branch_manager"].includes(a.role));
      if (!isManager) return reply.code(403).send({ error: "insufficient permissions" });
    }

    const conditions = [eq(attendance.orgId, auth.orgId), eq(attendance.userId, targetUserId)];
    if (from) conditions.push(gte(attendance.date, from));
    if (to) conditions.push(lte(attendance.date, to));

    const rows = await db
      .select()
      .from(attendance)
      .where(and(...conditions))
      .orderBy(attendance.date);

    return reply.send(rows);
  });

  // Monthly aggregates for a given year, used to render the avg-hours/days chart.
  app.get("/attendance/summary", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { userId, year } = req.query as { userId?: string; year?: string };
    const targetUserId = userId || auth.userId;
    const targetYear = year || new Date().getFullYear().toString();

    if (targetUserId !== auth.userId) {
      const isManager = auth.assignments.some((a) => ["org_owner", "admin", "branch_manager"].includes(a.role));
      if (!isManager) return reply.code(403).send({ error: "insufficient permissions" });
    }

    const rows = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.orgId, auth.orgId),
          eq(attendance.userId, targetUserId),
          gte(attendance.date, `${targetYear}-01-01`),
          lte(attendance.date, `${targetYear}-12-31`)
        )
      );

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, "0");
      const monthRows = rows.filter((r) => r.date.slice(5, 7) === m);
      const presentDays = monthRows.filter((r) => r.status === "present" || r.status === "half_day").length;
      const lopDays = monthRows.filter((r) => r.status === "lop").length;
      const leaveDays = monthRows.filter((r) => r.status === "leave").length;
      const absentDays = monthRows.filter((r) => r.status === "absent").length;
      const totalHours = monthRows.reduce((sum, r) => sum + Number(r.hoursWorked), 0);
      return {
        month: `${targetYear}-${m}`,
        presentDays,
        lopDays,
        leaveDays,
        absentDays,
        totalHours,
        avgHoursPerDay: presentDays > 0 ? Number((totalHours / presentDays).toFixed(1)) : 0,
      };
    });

    return reply.send(months);
  });
}
