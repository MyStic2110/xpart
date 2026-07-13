import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireAuth } from "@/middleware/auth";
import { HOLIDAYS, holidayOn, isLongWeekendDay, upcomingWashRush } from "./holidays";
import { getRainForecast, DayWeather } from "./weather";

// ---------------------------------------------------------------------------
// Planner calendar: day-by-day operational heatmap (revenue / jobs /
// appointments / expenses) + demand intelligence for Indian conditions —
// weekday patterns learned from the org's own history, festival & long-weekend
// effects, and rain forecast (rain = empty wash bays).
// ---------------------------------------------------------------------------

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dow(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DemandDay {
  date: string;
  score: number; // 1.0 = an average day for this shop
  level: "low" | "normal" | "high" | "peak";
  drivers: string[];
  tip: string | null;
  expectedRevenue: number | null; // paise — projection for today/future days only
}

export async function calendarRoutes(app: FastifyInstance) {
  app.get("/calendar", { preHandler: requireAuth }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { month, branchId } = req.query as { month?: string; branchId?: string };
    const b = branchId && branchId !== "all" ? branchId : null;

    const now = new Date();
    const ym = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : now.toISOString().slice(0, 7);
    const monthStart = `${ym}-01`;
    const nextMonthStart = addDays(`${ym}-28`, 4).slice(0, 7) + "-01";
    const daysInMonth = Math.round(
      (new Date(nextMonthStart + "T00:00:00Z").getTime() - new Date(monthStart + "T00:00:00Z").getTime()) / 86400000
    );

    const jcB = b ? sql`and jc.branch_id = ${b}` : sql``;
    const invB = b ? sql`and i.branch_id = ${b}` : sql``;

    // One row per calendar day with every operational count/sum for the month.
    // Optimized with CTE pre-aggregations to avoid executing 150+ subqueries per request.
    const dayRows = (await db.execute(sql`
      with date_series as (
        select d.date::date as date
        from generate_series(${monthStart}::date, ${monthStart}::date + interval '${sql.raw(String(daysInMonth - 1))} days', '1 day') d(date)
      ),
      daily_payments as (
        select p.paid_at::date as date, coalesce(sum(p.amount), 0)::int as revenue
        from payments p
        join invoices i on i.id = p.invoice_id
        where i.org_id = ${orgId} ${invB}
          and p.paid_at >= ${monthStart}::date and p.paid_at < ${nextMonthStart}::date
        group by p.paid_at::date
      ),
      daily_expenses as (
        select e.expense_date as date, coalesce(sum(e.amount), 0)::int as expenses
        from expenses e
        where e.org_id = ${orgId} ${b ? sql`and e.branch_id = ${b}` : sql``}
          and e.expense_date >= ${monthStart}::date and e.expense_date < ${nextMonthStart}::date
        group by e.expense_date
      ),
      daily_job_cards as (
        select jc.job_date as date, count(*)::int as job_cards
        from job_cards jc
        where jc.org_id = ${orgId} ${jcB}
          and jc.job_date >= ${monthStart}::date and jc.job_date < ${nextMonthStart}::date
        group by jc.job_date
      ),
      daily_appointments as (
        select a.scheduled_date as date, count(*)::int as appointments
        from appointments a
        where a.org_id = ${orgId} ${b ? sql`and a.branch_id = ${b}` : sql``}
          and a.scheduled_date >= ${monthStart}::date and a.scheduled_date < ${nextMonthStart}::date
          and a.status in ('scheduled','confirmed')
        group by a.scheduled_date
      ),
      daily_enquiries as (
        select q.created_at::date as date, count(*)::int as enquiries
        from enquiries q
        where q.org_id = ${orgId} ${b ? sql`and q.branch_id = ${b}` : sql``}
          and q.created_at >= ${monthStart}::date and q.created_at < ${nextMonthStart}::date
        group by q.created_at::date
      )
      select
        ds.date::text as date,
        coalesce(dp.revenue, 0)::int as revenue,
        coalesce(de.expenses, 0)::int as expenses,
        coalesce(djc.job_cards, 0)::int as "jobCards",
        coalesce(dapt.appointments, 0)::int as appointments,
        coalesce(deq.enquiries, 0)::int as enquiries
      from date_series ds
      left join daily_payments dp on dp.date = ds.date
      left join daily_expenses de on de.date = ds.date
      left join daily_job_cards djc on djc.date = ds.date
      left join daily_appointments dapt on dapt.date = ds.date
      left join daily_enquiries deq on deq.date = ds.date
      order by ds.date
    `)) as unknown as Array<{ date: string; revenue: number; expenses: number; jobCards: number; appointments: number; enquiries: number }>;

    // Weekday demand pattern from the org's own last 180 days of collections —
    // this is where "weekends are always busy" is inferred rather than assumed.
    const dowRows = (await db.execute(sql`
      select
        extract(dow from p.paid_at)::int as dow,
        sum(p.amount)::bigint as revenue,
        count(distinct p.paid_at::date)::int as days
      from payments p join invoices i on i.id = p.invoice_id
      where i.org_id = ${orgId} ${invB} and p.paid_at >= current_date - interval '180 days'
      group by 1
    `)) as unknown as Array<{ dow: number; revenue: string; days: number }>;

    const dowAvg: number[] = Array(7).fill(0);
    for (const r of dowRows) dowAvg[r.dow] = r.days > 0 ? Number(r.revenue) / r.days : 0;
    const overallAvg = dowAvg.reduce((s, v) => s + v, 0) / (dowAvg.filter((v) => v > 0).length || 1);
    const dowIndex = dowAvg.map((v) => (overallAvg > 0 && v > 0 ? v / overallAvg : 1));
    const dowStats = dowAvg.map((avg, i) => ({
      dow: i,
      name: DOW_NAMES[i],
      avgRevenue: Math.round(avg),
      index: Number(dowIndex[i].toFixed(2)),
    }));

    // Rain forecast for the branch city (falls back to the org's first branch).
    let city = "Chennai";
    const branchRow = (await db.execute(
      b
        ? sql`select city from branches where id = ${b} limit 1`
        : sql`select city from branches where org_id = ${orgId} order by created_at limit 1`
    )) as unknown as Array<{ city: string | null }>;
    if (branchRow[0]?.city) city = branchRow[0].city;
    const weather = await getRainForecast(city);
    const weatherByDate = new Map<string, DayWeather>((weather ?? []).map((w) => [w.date, w]));

    // Demand model for every day of the requested month (past days too, so the
    // owner can see what drove a good/bad day retrospectively).
    const today = new Date().toISOString().slice(0, 10);
    const demand: DemandDay[] = dayRows.map((d) => {
      const drivers: string[] = [];
      let score = dowIndex[dow(d.date)];
      const idxPct = Math.round((dowIndex[dow(d.date)] - 1) * 100);
      if (Math.abs(idxPct) >= 10) {
        drivers.push(`${DOW_NAMES[dow(d.date)]} pattern (${idxPct > 0 ? "+" : ""}${idxPct}% vs avg day)`);
      }

      const h = holidayOn(d.date);
      const rush = upcomingWashRush(d.date, 3);
      if (rush) {
        score *= rush.holiday.name.includes("Diwali") || rush.holiday.name.includes("Pongal") ? 1.6 : 1.35;
        drivers.push(`${rush.holiday.name} in ${rush.daysAway} day${rush.daysAway > 1 ? "s" : ""} — pre-festival wash rush`);
      }
      if (h) {
        if (h.washRush) {
          score *= 1.1;
          drivers.push(`${h.name} — festive footfall`);
        } else {
          drivers.push(`${h.name} (holiday)`);
        }
      }
      if (isLongWeekendDay(d.date)) {
        score *= 1.2;
        drivers.push("Long weekend — outstation trips, wash before & after");
      }

      const wx = weatherByDate.get(d.date);
      if (wx) {
        if (wx.rainProbability >= 70) {
          score *= 0.4;
          drivers.push(`Rain very likely (${wx.rainProbability}%) — walk-ins will drop`);
        } else if (wx.rainProbability >= 40) {
          score *= 0.7;
          drivers.push(`Chance of rain (${wx.rainProbability}%)`);
        }
      }

      const level: DemandDay["level"] = score >= 1.5 ? "peak" : score >= 1.15 ? "high" : score <= 0.6 ? "low" : "normal";

      let tip: string | null = null;
      if (d.date >= today) {
        if (level === "peak") tip = "Full staff + stock up consumables. Open early; push high-margin add-ons (polish, interior).";
        else if (level === "high") tip = "Busy day expected — pre-assign mechanics and confirm appointments a day before.";
        else if (level === "low" && wx && wx.rainProbability >= 40)
          tip = "Rain day — bays will be free. Call churn-risk clients for interior detailing / underbody coating (indoor work), offer pickup-drop.";
        else if (level === "low") tip = "Slow day expected — run the Client 360° follow-up queue and schedule staff training/maintenance.";
      }

      // Rupee projection makes the score tangible: score × the shop's own
      // average daily collection over the last 180 days.
      const expectedRevenue = d.date >= today && overallAvg > 0 ? Math.round(score * overallAvg) : null;

      return { date: d.date, score: Number(score.toFixed(2)), level, drivers, tip, expectedRevenue };
    });

    // Month money summary: collected so far, last month's total, and a
    // projection = collected-to-date + expected revenue of the remaining days.
    const monthToDate = dayRows.filter((d) => d.date <= today).reduce((s, d) => s + d.revenue, 0);
    const projectedRemaining = demand.filter((d) => d.date > today).reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);
    const prevMonthStart = addDays(monthStart, -1).slice(0, 7) + "-01";
    const prevRow = (await db.execute(sql`
      select coalesce(sum(p.amount),0)::bigint as total
      from payments p join invoices i on i.id = p.invoice_id
      where i.org_id = ${orgId} ${invB}
        and p.paid_at >= ${prevMonthStart}::date and p.paid_at < ${monthStart}::date
    `)) as unknown as Array<{ total: string }>;
    const prevMonthRevenue = Number(prevRow[0]?.total ?? 0);
    const bestSoFar = dayRows.filter((d) => d.date <= today).sort((a, c) => c.revenue - a.revenue)[0];
    const next7Expected = demand
      .filter((d) => d.date >= today && d.date < addDays(today, 7))
      .reduce((s, d) => s + (d.expectedRevenue ?? 0), 0);

    // Forward-looking planning insights (next 30 days from today, not month-bound).
    const insights: Array<{ date: string; endDate?: string; type: "rush" | "rain" | "longweekend" | "pattern"; title: string; detail: string }> = [];
    for (let i = 0; i <= 30; i++) {
      const d = addDays(today, i);
      const h = holidayOn(d);
      if (h?.washRush) {
        insights.push({
          date: addDays(d, -3),
          endDate: addDays(d, -1),
          type: "rush",
          title: `${h.name} rush window`,
          detail: `Expect the 3 days before ${h.name} (${addDays(d, -3)} → ${addDays(d, -1)}) to run 1.4–1.6× a normal day. Roster full staff, stock shampoo/wax, and WhatsApp regulars a festive-clean offer a week early.`,
        });
      } else if (h && isLongWeekendDay(d)) {
        insights.push({
          date: d,
          type: "longweekend",
          title: `Long weekend around ${h.name}`,
          detail: `Travel weekend — expect pre-trip washes before and mud-heavy washes after. Consider a "trip-ready check" combo offer.`,
        });
      }
    }
    for (const w of weather ?? []) {
      if (w.date >= today && w.rainProbability >= 70) {
        insights.push({
          date: w.date,
          type: "rain",
          title: `Rain likely on ${DOW_NAMES[dow(w.date)]} (${w.rainProbability}%)`,
          detail: `Walk-ins will drop — shift focus to indoor jobs (interior detailing, coating) and use free bays to clear pending job cards. Rebook that day's appointments proactively.`,
        });
      }
    }
    const best = [...dowStats].sort((a, c) => c.index - a.index)[0];
    const worst = [...dowStats].filter((s) => s.avgRevenue > 0).sort((a, c) => a.index - c.index)[0];
    if (best && worst && best.index > 1.1) {
      insights.push({
        date: today,
        type: "pattern",
        title: `${best.name}s are your strongest day (+${Math.round((best.index - 1) * 100)}%)`,
        detail: `Your last 180 days show ${best.name}s earn ${Math.round((best.index - 1) * 100)}% above an average day, while ${worst.name}s run ${Math.round((1 - worst.index) * 100)}% below. Never under-staff a ${best.name}; use ${worst.name}s for follow-up calls and deep-clean backlog.`,
      });
    }
    insights.sort((a, c) => a.date.localeCompare(c.date));

    return reply.send({
      month: ym,
      today,
      city,
      days: dayRows,
      dowStats,
      holidays: HOLIDAYS.filter((h) => h.date >= addDays(monthStart, -7) && h.date < addDays(nextMonthStart, 7)).map((h) => ({
        ...h,
        longWeekend: isLongWeekendDay(h.date),
      })),
      weather,
      demand,
      insights: insights.slice(0, 8),
      avgDailyRevenue: Math.round(overallAvg),
      summary: {
        monthToDate,
        projected: monthToDate + projectedRemaining,
        prevMonthRevenue,
        bestDay: bestSoFar && bestSoFar.revenue > 0 ? { date: bestSoFar.date, revenue: bestSoFar.revenue } : null,
        next7Expected,
      },
    });
  });

  // Everything that happened / is planned on one day — powers the day panel.
  app.get("/calendar/day", { preHandler: requireAuth }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { date, branchId } = req.query as { date?: string; branchId?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply.code(400).send({ error: "date=YYYY-MM-DD required" });
    const b = branchId && branchId !== "all" ? branchId : null;

    const jobCards = (await db.execute(sql`
      select jc.id, jc.status, jc.total::int, c.name as "clientName", v.plate_number as "plateNumber"
      from job_cards jc join clients c on c.id = jc.client_id join vehicles v on v.id = jc.vehicle_id
      where jc.org_id = ${orgId} ${b ? sql`and jc.branch_id = ${b}` : sql``} and jc.job_date = ${date}
      order by jc.created_at
    `)) as unknown as Array<{ id: string; status: string; total: number; clientName: string; plateNumber: string }>;

    const appointments = (await db.execute(sql`
      select a.id, a.scheduled_time as "scheduledTime", a.status, c.name as "clientName", c.phone, s.name as "serviceName"
      from appointments a join clients c on c.id = a.client_id left join services s on s.id = a.service_id
      where a.org_id = ${orgId} ${b ? sql`and a.branch_id = ${b}` : sql``} and a.scheduled_date = ${date}
      order by a.scheduled_time nulls last
    `)) as unknown as Array<{ id: string; scheduledTime: string | null; status: string; clientName: string; phone: string; serviceName: string | null }>;

    const expenses = (await db.execute(sql`
      select e.id, e.amount::int, e.recipient, coalesce(ec.name, 'Uncategorised') as category
      from expenses e left join expense_categories ec on ec.id = e.category_id
      where e.org_id = ${orgId} ${b ? sql`and e.branch_id = ${b}` : sql``} and e.expense_date = ${date}
      order by e.amount desc
    `)) as unknown as Array<{ id: string; amount: number; recipient: string | null; category: string }>;

    const payments = (await db.execute(sql`
      select p.mode, sum(p.amount)::int as amount
      from payments p join invoices i on i.id = p.invoice_id
      where i.org_id = ${orgId} ${b ? sql`and i.branch_id = ${b}` : sql``} and p.paid_at::date = ${date}
      group by p.mode order by amount desc
    `)) as unknown as Array<{ mode: string; amount: number }>;

    return reply.send({
      date,
      jobCards,
      appointments,
      expenses,
      payments,
      revenue: payments.reduce((s, p) => s + p.amount, 0),
      expenseTotal: expenses.reduce((s, e) => s + e.amount, 0),
    });
  });
}
