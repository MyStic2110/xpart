import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { attendance, staffProfiles, jobCardMechanics, invoices, salaryPayouts } from "@/db/schema";

export class PayrollError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

async function getRevenueForUser(orgId: string, userId: string, month: string) {
  const start = `${month}-01`;
  const end = `${month}-${daysInMonth(month).toString().padStart(2, "0")}`;

  const jobCardIds = await db
    .select({ jobCardId: jobCardMechanics.jobCardId })
    .from(jobCardMechanics)
    .where(eq(jobCardMechanics.mechanicId, userId));

  if (jobCardIds.length === 0) return 0;

  const ids = jobCardIds.map((r) => r.jobCardId);
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        inArray(invoices.jobCardId, ids),
        inArray(invoices.status, ["paid", "partial"]),
        gte(invoices.createdAt, new Date(`${start}T00:00:00Z`)),
        lte(invoices.createdAt, new Date(`${end}T23:59:59Z`))
      )
    );

  return invoiceRows.reduce((sum, inv) => sum + inv.total, 0);
}

export async function computeMonthlyPayroll(orgId: string, userId: string, month: string) {
  const profile = await db.query.staffProfiles.findFirst({ where: eq(staffProfiles.userId, userId) });
  if (!profile) throw new PayrollError("staff profile not found", 404);

  const start = `${month}-01`;
  const end = `${month}-${daysInMonth(month).toString().padStart(2, "0")}`;

  const attendanceRows = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, userId), gte(attendance.date, start), lte(attendance.date, end)));

  const presentDays = attendanceRows.filter((r) => r.status === "present" || r.status === "half_day").length;
  const lopDays = attendanceRows.filter((r) => r.status === "lop").length;
  const leaveDays = attendanceRows.filter((r) => r.status === "leave").length;

  const totalDaysInMonth = daysInMonth(month);
  const perDaySalary = profile.monthlySalary / totalDaysInMonth;
  const lopDeduction = Math.round(perDaySalary * lopDays);

  const revenueGenerated = await getRevenueForUser(orgId, userId, month);
  const serviceCommissionPct = Number(profile.serviceCommissionPct ?? 0);
  const serviceCommissionEarned = Math.round(revenueGenerated * (serviceCommissionPct / 100));
  // Product commission requires product-sale tracking (Products module not yet built);
  // kept as a structural placeholder so payroll doesn't need a schema change later.
  const productCommissionEarned = 0;

  const bonus = 0;
  const otherDeductions = 0;
  const netPayout =
    profile.monthlySalary - lopDeduction + serviceCommissionEarned + productCommissionEarned + bonus - otherDeductions;

  return {
    userId,
    month,
    baseSalary: profile.monthlySalary,
    presentDays,
    lopDays,
    leaveDays,
    lopDeduction,
    revenueGenerated,
    serviceCommissionEarned,
    productCommissionEarned,
    bonus,
    otherDeductions,
    netPayout,
  };
}

export async function finalizePayroll(orgId: string, userId: string, month: string) {
  const existing = await db.query.salaryPayouts.findFirst({
    where: and(eq(salaryPayouts.userId, userId), eq(salaryPayouts.month, month)),
  });
  if (existing?.status === "paid") throw new PayrollError("payroll for this month is already paid", 409);

  const breakdown = await computeMonthlyPayroll(orgId, userId, month);

  const [row] = await db
    .insert(salaryPayouts)
    .values({ ...breakdown, orgId, status: "paid", paidAt: new Date() })
    .onConflictDoUpdate({
      target: [salaryPayouts.userId, salaryPayouts.month],
      set: { ...breakdown, status: "paid", paidAt: new Date() },
    })
    .returning();

  return row;
}

export async function listPayrollHistory(userId: string) {
  return db.query.salaryPayouts.findMany({
    where: eq(salaryPayouts.userId, userId),
    orderBy: (t, { desc }) => [desc(t.month)],
  });
}
