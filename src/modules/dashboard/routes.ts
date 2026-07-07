import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireAuth } from "@/middleware/auth";
import { getForecast, Granularity } from "./forecast";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard/forecast", { preHandler: requireAuth }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { branchId, granularity } = req.query as { branchId?: string; granularity?: string };
    const b = branchId && branchId !== "all" ? branchId : null;
    const g: Granularity = granularity === "day" || granularity === "week" ? granularity : "month";
    const forecast = await getForecast(orgId, b, g);
    return reply.send(forecast);
  });

  app.get("/dashboard/metrics", { preHandler: requireAuth }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { branchId } = req.query as { branchId?: string };
    const b = branchId && branchId !== "all" ? branchId : null;

    // Branch filter fragments — applied per table when a branch is selected.
    const jc = b ? sql`and branch_id = ${b}` : sql``;
    const inv = b ? sql`and i.branch_id = ${b}` : sql``;
    const sa = b ? sql`and branch_id = ${b}` : sql``;
    const ap = b ? sql`and branch_id = ${b}` : sql``;
    // Clients/staff aren't branch-owned; in branch view we count those active at the branch.
    // Third-party vendors (mechanics on a credit tab) are not customers — keep
    // them out of the client count and surface their dues separately.
    const totalClients = b
      ? sql`(select count(distinct jc2.client_id) from job_cards jc2 join clients c2 on c2.id = jc2.client_id
              where jc2.org_id = ${orgId} and jc2.branch_id = ${b} and c2.client_type = 'customer')`
      : sql`(select count(*) from clients where org_id = ${orgId} and client_type = 'customer')`;
    const thirdPartyClients = b
      ? sql`(select count(distinct jc2.client_id) from job_cards jc2 join clients c2 on c2.id = jc2.client_id
              where jc2.org_id = ${orgId} and jc2.branch_id = ${b} and c2.client_type = 'third_party')`
      : sql`(select count(*) from clients where org_id = ${orgId} and client_type = 'third_party')`;
    const staffCount = b
      ? sql`(select count(distinct user_id) from staff_assignments where org_id = ${orgId} and branch_id = ${b})`
      : sql`(select count(*) from staff_profiles where org_id = ${orgId})`;

    const result = await db.execute(sql`
      select
        (select count(*) from job_cards where org_id = ${orgId} and job_date = current_date ${jc}) as job_cards_today,
        (select count(*) from job_cards where org_id = ${orgId} ${jc}) as job_cards_total,
        (select coalesce(sum(p.amount),0) from payments p join invoices i on i.id = p.invoice_id
           where i.org_id = ${orgId} and p.paid_at::date = current_date ${inv}) as revenue_today,
        (select coalesce(sum(p.amount),0) from payments p join invoices i on i.id = p.invoice_id
           where i.org_id = ${orgId} and date_trunc('week', p.paid_at) = date_trunc('week', current_date) ${inv}) as revenue_week,
        (select coalesce(sum(p.amount),0) from payments p join invoices i on i.id = p.invoice_id
           where i.org_id = ${orgId} and date_trunc('month', p.paid_at) = date_trunc('month', current_date) ${inv}) as revenue_month,
        (select coalesce(sum(amount),0) from expenses
           where org_id = ${orgId} and expense_date = current_date ${b ? sql`and branch_id = ${b}` : sql``}) as expense_today,
        (select coalesce(sum(amount),0) from expenses
           where org_id = ${orgId} and date_trunc('week', expense_date) = date_trunc('week', current_date) ${b ? sql`and branch_id = ${b}` : sql``}) as expense_week,
        (select coalesce(sum(amount),0) from expenses
           where org_id = ${orgId} and date_trunc('month', expense_date) = date_trunc('month', current_date) ${b ? sql`and branch_id = ${b}` : sql``}) as expense_month,
        ${totalClients} as total_clients,
        (select count(*) from invoices i where i.org_id = ${orgId} and i.status in ('draft','partial') ${inv}) as pending_invoices,
        (select coalesce(sum(i.total),0) from invoices i where i.org_id = ${orgId} and i.status in ('draft','partial') ${inv}) as pending_amount,
        (select count(*) from sales_actions where org_id = ${orgId} and status in ('pending','contacted','rescheduled') ${sa}) as open_followups,
        (select coalesce(sum(potential_revenue),0) from sales_actions
           where org_id = ${orgId} and status in ('pending','contacted','rescheduled') and abs(due_date - current_date) <= 7 ${sa}) as potential_today,
        (select coalesce(sum(potential_revenue),0) from sales_actions
           where org_id = ${orgId} and status in ('pending','contacted','rescheduled') ${sa}) as potential_open,
        (select count(*) from appointments where org_id = ${orgId} and status in ('scheduled','confirmed') and scheduled_date >= current_date ${ap}) as upcoming_appointments,
        ${thirdPartyClients} as third_party_clients,
        (select coalesce(sum(i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0)), 0)
           from invoices i join clients c3 on c3.id = i.client_id
           where i.org_id = ${orgId} and c3.client_type = 'third_party' and i.status in ('draft','partial') ${inv}) as third_party_outstanding,
        (select coalesce(sum(p.amount), 0) from payments p
           join invoices i on i.id = p.invoice_id join clients c4 on c4.id = i.client_id
           where i.org_id = ${orgId} and c4.client_type = 'third_party'
             and date_trunc('month', p.paid_at) = date_trunc('month', current_date) ${inv}) as third_party_collected_month,
        ${staffCount} as staff_count,
        (select count(*) from branches where org_id = ${orgId}) as branch_count,
        (select coalesce(sum((jcp.price - i.purchase_price) * jcp.qty), 0)
         from job_card_products jcp
         join job_cards jc2 on jc2.id = jcp.job_card_id
         join inventory_items i on i.id = jcp.inventory_item_id
         where jc2.org_id = ${orgId} and jc2.status in ('completed', 'billed') and jc2.job_date = current_date
           ${b ? sql`and jc2.branch_id = ${b}` : sql``}) as parts_margin_today,
        (select coalesce(sum((jcp.price - i.purchase_price) * jcp.qty), 0)
         from job_card_products jcp
         join job_cards jc2 on jc2.id = jcp.job_card_id
         join inventory_items i on i.id = jcp.inventory_item_id
         where jc2.org_id = ${orgId} and jc2.status in ('completed', 'billed')
           and date_trunc('week', jc2.job_date) = date_trunc('week', current_date)
           ${b ? sql`and jc2.branch_id = ${b}` : sql``}) as parts_margin_week,
        (select coalesce(sum((jcp.price - i.purchase_price) * jcp.qty), 0)
         from job_card_products jcp
         join job_cards jc2 on jc2.id = jcp.job_card_id
         join inventory_items i on i.id = jcp.inventory_item_id
         where jc2.org_id = ${orgId} and jc2.status in ('completed', 'billed')
           and date_trunc('month', jc2.job_date) = date_trunc('month', current_date)
           ${b ? sql`and jc2.branch_id = ${b}` : sql``}) as parts_margin_month
    `);

    const r = (result as unknown as Record<string, string | number>[])[0];
    const n = (k: string) => Number(r[k] ?? 0);

    // Org/branch filtering must happen on the payment rows BEFORE the left join
    // to the date series — otherwise sum() counts every org's payments and the
    // trend ignores the branch/org filter (appears static across branch switches).
    const dailyRevenueResult = await db.execute(sql`
      select
        d.date::date::text as date,
        coalesce(sum(scoped.amount), 0)::int as revenue
      from generate_series(current_date - interval '13 days', current_date, '1 day') d(date)
      left join (
        select p.paid_at::date as pdate, p.amount
        from payments p
        join invoices i on i.id = p.invoice_id
        where i.org_id = ${orgId} ${b ? sql`and i.branch_id = ${b}` : sql``}
      ) scoped on scoped.pdate = d.date::date
      group by d.date
      order by d.date
    `);

    // Client segmentation by visit recency (customers only, vendors excluded).
    // Thresholds match Client 360's churn logic: active ≤60d, churn risk 61–180d,
    // defected >180d or never visited. Branch view segments that branch's clients.
    const segmentationResult = await db.execute(sql`
      select
        count(*)::int as existing,
        count(*) filter (where last_visit >= current_date - 60)::int as active,
        count(*) filter (where last_visit < current_date - 60 and last_visit >= current_date - 180)::int as churn_risk,
        count(*) filter (where last_visit < current_date - 180 or last_visit is null)::int as defected
      from (
        select c.id,
          (select max(jc.job_date) from job_cards jc
             where jc.client_id = c.id ${b ? sql`and jc.branch_id = ${b}` : sql``}) as last_visit
        from clients c
        where c.org_id = ${orgId} and c.client_type = 'customer'
          ${b ? sql`and exists (select 1 from job_cards jc2 where jc2.client_id = c.id and jc2.branch_id = ${b})` : sql``}
      ) t
    `);
    const seg = (segmentationResult as unknown as Record<string, number>[])[0] ?? {};

    const statusResult = await db.execute(sql`
      select
        status,
        count(*)::int as count
      from job_cards
      where org_id = ${orgId} ${b ? sql`and branch_id = ${b}` : sql``}
      group by status
    `);

    const topServicesResult = await db.execute(sql`
      select
        s.name,
        count(jcs.id)::int as count
      from job_card_services jcs
      join services s on s.id = jcs.service_id
      join job_cards jc on jc.id = jcs.job_card_id
      where jc.org_id = ${orgId} ${b ? sql`and jc.branch_id = ${b}` : sql``}
      group by s.name
      order by count desc
      limit 5
    `);

    return reply.send({
      jobCardsToday: n("job_cards_today"),
      jobCardsTotal: n("job_cards_total"),
      revenueToday: n("revenue_today"),
      revenueWeek: n("revenue_week"),
      revenueMonth: n("revenue_month"),
      expenseToday: n("expense_today"),
      expenseWeek: n("expense_week"),
      expenseMonth: n("expense_month"),
      totalClients: n("total_clients"),
      pendingInvoices: n("pending_invoices"),
      pendingAmount: n("pending_amount"),
      openFollowUps: n("open_followups"),
      potentialToday: n("potential_today"),
      potentialOpen: n("potential_open"),
      upcomingAppointments: n("upcoming_appointments"),
      thirdPartyClients: n("third_party_clients"),
      thirdPartyOutstanding: n("third_party_outstanding"),
      thirdPartyCollectedMonth: n("third_party_collected_month"),
      staffCount: n("staff_count"),
      branchCount: n("branch_count"),
      partsMarginToday: n("parts_margin_today"),
      partsMarginWeek: n("parts_margin_week"),
      partsMarginMonth: n("parts_margin_month"),
      segmentation: {
        existing: Number(seg.existing ?? 0),
        active: Number(seg.active ?? 0),
        churnRisk: Number(seg.churn_risk ?? 0),
        defected: Number(seg.defected ?? 0),
      },
      dailyRevenueTrend: dailyRevenueResult as unknown as { date: string; revenue: number }[],
      statusDistribution: statusResult as unknown as { status: string; count: number }[],
      topServices: topServicesResult as unknown as { name: string; count: number }[],
    });
  });
}
