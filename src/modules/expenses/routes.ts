import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, expenseCategories } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

// Categories are master data → admin-gated, like products. Recording an expense
// is an everyday operational action → any authenticated staffer may do it.
const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
});

const expenseSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  expenseDate: z.string().min(1),
  amount: z.coerce.number().nonnegative(), // rupees from client → paise on save
  paymentMode: z.string().min(1).default("Cash"), // free text: "Cash", "Online payment", "UPI"…
  recipient: z.string().optional().or(z.literal("")),
  paidBy: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
const expenseUpdateSchema = expenseSchema.partial();

const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export async function expenseRoutes(app: FastifyInstance) {
  // ---- Categories (org-wide) ----
  app.get("/expense-categories", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.orgId, auth.orgId))
      .orderBy(expenseCategories.name);
    return reply.send(rows);
  });

  app.post("/expense-categories", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const dup = await db.query.expenseCategories.findFirst({
      where: and(eq(expenseCategories.orgId, auth.orgId), eq(expenseCategories.name, d.name)),
    });
    if (dup) return reply.code(409).send({ error: "a category with this name already exists" });

    const [row] = await db
      .insert(expenseCategories)
      .values({ orgId: auth.orgId, name: d.name, description: clean(d.description) })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch("/expense-categories/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.description !== undefined) updates.description = clean(d.description);
    if (Object.keys(updates).length === 0) return reply.code(400).send({ error: "no fields to update" });

    const [row] = await db
      .update(expenseCategories)
      .set(updates)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "category not found" });
    return reply.send(row);
  });

  app.delete("/expense-categories/:id", { preHandler: canManage }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    // Expenses keep their history — categoryId is set null on delete by the FK.
    const [deleted] = await db
      .delete(expenseCategories)
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.orgId, auth.orgId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: "category not found" });
    return reply.send({ success: true });
  });

  // ---- Expenses (branch-scoped) ----
  app.get("/expenses", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const q = req.query as Record<string, string | undefined>;

    const conds: SQL[] = [eq(expenses.orgId, auth.orgId)];
    if (q.branchId && q.branchId !== "all") conds.push(eq(expenses.branchId, q.branchId));
    if (q.categoryId) conds.push(eq(expenses.categoryId, q.categoryId));
    if (q.mode) conds.push(eq(expenses.paymentMode, q.mode));
    if (q.from) conds.push(gte(expenses.expenseDate, q.from));
    if (q.to) conds.push(lte(expenses.expenseDate, q.to));

    const rows = await db
      .select({
        id: expenses.id,
        branchId: expenses.branchId,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        expenseDate: expenses.expenseDate,
        amount: expenses.amount,
        paymentMode: expenses.paymentMode,
        recipient: expenses.recipient,
        paidBy: expenses.paidBy,
        notes: expenses.notes,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .where(and(...conds))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

    return reply.send(rows);
  });

  app.get("/expenses/summary", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const q = req.query as Record<string, string | undefined>;

    const conds: SQL[] = [eq(expenses.orgId, auth.orgId)];
    if (q.branchId && q.branchId !== "all") conds.push(eq(expenses.branchId, q.branchId));

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
        monthTotal: sql<number>`coalesce(sum(${expenses.amount}) filter (where ${expenses.expenseDate} >= ${monthStartStr}), 0)::int`,
      })
      .from(expenses)
      .where(and(...conds));

    return reply.send(row ?? { count: 0, total: 0, monthTotal: 0 });
  });

  app.post("/expenses", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const [row] = await db
      .insert(expenses)
      .values({
        orgId: auth.orgId,
        branchId: d.branchId || null,
        categoryId: d.categoryId || null,
        expenseDate: d.expenseDate,
        amount: Math.round(d.amount * 100),
        paymentMode: d.paymentMode,
        recipient: clean(d.recipient),
        paidBy: clean(d.paidBy),
        notes: clean(d.notes),
      })
      .returning();
    return reply.code(201).send(row);
  });

  app.patch("/expenses/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = expenseUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (d.branchId !== undefined) updates.branchId = d.branchId || null;
    if (d.categoryId !== undefined) updates.categoryId = d.categoryId || null;
    if (d.expenseDate !== undefined) updates.expenseDate = d.expenseDate;
    if (d.amount !== undefined) updates.amount = Math.round(d.amount * 100);
    if (d.paymentMode !== undefined) updates.paymentMode = d.paymentMode;
    if (d.recipient !== undefined) updates.recipient = clean(d.recipient);
    if (d.paidBy !== undefined) updates.paidBy = clean(d.paidBy);
    if (d.notes !== undefined) updates.notes = clean(d.notes);

    const [row] = await db
      .update(expenses)
      .set(updates)
      .where(and(eq(expenses.id, id), eq(expenses.orgId, auth.orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "expense not found" });
    return reply.send(row);
  });

  app.delete("/expenses/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const [deleted] = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.orgId, auth.orgId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: "expense not found" });
    return reply.send({ success: true });
  });
}
