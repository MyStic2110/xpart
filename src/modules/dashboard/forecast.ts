import { sql } from "drizzle-orm";
import { db } from "@/db/client";

// Forecasting here is deliberately "simple time-series expectation": we fit an
// ordinary least-squares trend line to the zero-filled historical buckets and
// project it forward. No external libs, no opaque ML — just a transparent trend
// the owner can reason about, plus a mild uncertainty band from residual error.

export type Granularity = "day" | "week" | "month";

interface GranCfg {
  unit: "day" | "week" | "month";
  lookback: string; // interval string for how far back to pull buckets
  maxHistory: number; // cap on history points fed to the regression
  horizon: number; // how many future periods to forecast
  step: string; // interval string for one period
}

const CFG: Record<Granularity, GranCfg> = {
  day: { unit: "day", lookback: "59 day", maxHistory: 30, horizon: 12, step: "1 day" },
  week: { unit: "week", lookback: "25 week", maxHistory: 16, horizon: 12, step: "1 week" },
  month: { unit: "month", lookback: "17 month", maxHistory: 12, horizon: 12, step: "1 month" },
};

interface Bucket {
  ts: number; // epoch seconds of the period start
  value: number;
}

// Pull revenue (paise collected) per period, zero-filled across the window.
async function fetchRevenueSeries(orgId: string, b: string | null, cfg: GranCfg): Promise<Bucket[]> {
  const branchFilter = b ? sql`and i.branch_id = ${b}` : sql``;
  const rows = await db.execute(sql`
    select extract(epoch from d.period)::bigint as ts,
           coalesce(sum(s.amount), 0)::bigint as value
    from generate_series(
      date_trunc(${cfg.unit}, current_date) - (${cfg.lookback})::interval,
      date_trunc(${cfg.unit}, current_date),
      (${cfg.step})::interval
    ) d(period)
    left join (
      select date_trunc(${cfg.unit}, p.paid_at) as bucket, p.amount
      from payments p
      join invoices i on i.id = p.invoice_id
      where i.org_id = ${orgId} ${branchFilter}
    ) s on s.bucket = d.period
    group by d.period
    order by d.period
  `);
  return (rows as unknown as { ts: string; value: string }[]).map((r) => ({ ts: Number(r.ts), value: Number(r.value) }));
}

// Pull expenses (paise spent) per period, zero-filled across the window.
async function fetchExpenseSeries(orgId: string, b: string | null, cfg: GranCfg): Promise<Bucket[]> {
  const branchFilter = b ? sql`and branch_id = ${b}` : sql``;
  const rows = await db.execute(sql`
    select extract(epoch from d.period)::bigint as ts,
           coalesce(sum(s.amount), 0)::bigint as value
    from generate_series(
      date_trunc(${cfg.unit}, current_date) - (${cfg.lookback})::interval,
      date_trunc(${cfg.unit}, current_date),
      (${cfg.step})::interval
    ) d(period)
    left join (
      select date_trunc(${cfg.unit}, e.expense_date) as bucket, e.amount
      from expenses e
      where e.org_id = ${orgId} ${branchFilter}
    ) s on s.bucket = d.period
    group by d.period
    order by d.period
  `);
  return (rows as unknown as { ts: string; value: string }[]).map((r) => ({ ts: Number(r.ts), value: Number(r.value) }));
}

// Pull new-customer acquisitions per period = clients whose FIRST job card falls
// in that period. clients.created_at is a bulk-import timestamp, so first visit
// is the only real "acquired on" signal. Zero-filled across the window.
async function fetchAcquisitionSeries(orgId: string, b: string | null, cfg: GranCfg): Promise<Bucket[]> {
  const branchFilter = b ? sql`and branch_id = ${b}` : sql``;
  const rows = await db.execute(sql`
    select extract(epoch from d.period)::bigint as ts,
           count(s.bucket)::int as value
    from generate_series(
      date_trunc(${cfg.unit}, current_date) - (${cfg.lookback})::interval,
      date_trunc(${cfg.unit}, current_date),
      (${cfg.step})::interval
    ) d(period)
    left join (
      select date_trunc(${cfg.unit}, fv.first_visit) as bucket
      from (
        select client_id, min(job_date) as first_visit
        from job_cards
        where org_id = ${orgId} ${branchFilter}
        group by client_id
      ) fv
    ) s on s.bucket = d.period
    group by d.period
    order by d.period
  `);
  return (rows as unknown as { ts: string; value: string }[]).map((r) => ({ ts: Number(r.ts), value: Number(r.value) }));
}

// Drop leading empty buckets (before the business had any data) so the trend is
// fit only on the live history, then cap to the most recent maxHistory points.
function trimAndCap(series: Bucket[], maxHistory: number): Bucket[] {
  const firstNonZero = series.findIndex((s) => s.value > 0);
  const trimmed = firstNonZero === -1 ? series : series.slice(firstNonZero);
  return trimmed.slice(-maxHistory);
}

interface Fit {
  slope: number;
  intercept: number;
  rmse: number;
  n: number;
}

// Ordinary least squares on (index, value). With <2 points it degenerates to a
// flat line at the last/only value, which is the sensible "no trend" fallback.
function linearFit(values: number[]): Fit {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, rmse: 0, n };
  if (n === 1) return { slope: 0, intercept: values[0], rmse: 0, n };

  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    sse += (values[i] - pred) ** 2;
  }
  const rmse = Math.sqrt(sse / Math.max(n - 2, 1));
  return { slope, intercept, rmse, n };
}

function addPeriod(date: Date, unit: GranCfg["unit"], steps: number): Date {
  const d = new Date(date);
  if (unit === "month") d.setUTCMonth(d.getUTCMonth() + steps);
  else d.setUTCDate(d.getUTCDate() + (unit === "week" ? steps * 7 : steps));
  return d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function labelFor(date: Date, unit: GranCfg["unit"], isFirst: boolean): string {
  const mon = MONTHS[date.getUTCMonth()];
  if (unit === "month") {
    // Disambiguate years on January or the very first bucket.
    return isFirst || date.getUTCMonth() === 0 ? `${mon} '${String(date.getUTCFullYear()).slice(2)}` : mon;
  }
  return `${date.getUTCDate()} ${mon}`; // day & week start
}

interface Point {
  period: string; // ISO date of period start
  label: string;
  value: number;
}
interface ForecastPoint extends Point {
  lower: number;
  upper: number;
}

// Build the forecast points by extrapolating the fitted line, floored at 0, with
// a band that widens mildly with horizon distance (residual rmse based).
function project(fit: Fit, lastDate: Date, unit: GranCfg["unit"], horizon: number, integer: boolean): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const x = fit.n - 1 + h;
    const raw = fit.intercept + fit.slope * x;
    const point = Math.max(0, raw);
    const band = fit.rmse * (1 + (h - 1) * 0.15);
    const date = addPeriod(lastDate, unit, h);
    out.push({
      period: date.toISOString().slice(0, 10),
      label: labelFor(date, unit, false),
      value: integer ? Math.max(0, Math.round(point)) : Math.round(point),
      lower: integer ? Math.max(0, Math.round(point - band)) : Math.max(0, Math.round(point - band)),
      upper: integer ? Math.max(0, Math.round(point + band)) : Math.round(point + band),
    });
  }
  return out;
}

function toHistoryPoints(series: Bucket[], unit: GranCfg["unit"]): Point[] {
  return series.map((s, i) => {
    const date = new Date(s.ts * 1000);
    return { period: date.toISOString().slice(0, 10), label: labelFor(date, unit, i === 0), value: s.value };
  });
}

function buildMetric(series: Bucket[], cfg: GranCfg, integer: boolean) {
  const capped = trimAndCap(series, cfg.maxHistory);
  const history = toHistoryPoints(capped, cfg.unit);
  const fit = linearFit(capped.map((s) => s.value));
  const lastDate = capped.length ? new Date(capped[capped.length - 1].ts * 1000) : new Date();
  const forecast = project(fit, lastDate, cfg.unit, cfg.horizon, integer);

  const histAvg = capped.length ? capped.reduce((a, s) => a + s.value, 0) / capped.length : 0;
  const fcAvg = forecast.length ? forecast.reduce((a, p) => a + p.value, 0) / forecast.length : 0;
  const forecastTotal = forecast.reduce((a, p) => a + p.value, 0);
  const growthPct = histAvg > 0 ? Math.round(((fcAvg - histAvg) / histAvg) * 100) : 0;
  const trend: "up" | "down" | "flat" = fit.slope > 0 && growthPct >= 3 ? "up" : fit.slope < 0 && growthPct <= -3 ? "down" : "flat";

  return { history, forecast, forecastTotal, growthPct, trend };
}

export async function getForecast(orgId: string, branchId: string | null, granularity: Granularity) {
  const cfg = CFG[granularity];
  const [revenueSeries, acqSeries, expenseSeries] = await Promise.all([
    fetchRevenueSeries(orgId, branchId, cfg),
    fetchAcquisitionSeries(orgId, branchId, cfg),
    fetchExpenseSeries(orgId, branchId, cfg),
  ]);

  return {
    granularity,
    horizon: cfg.horizon,
    revenue: buildMetric(revenueSeries, cfg, false), // paise
    acquisitions: buildMetric(acqSeries, cfg, true), // whole customers
    expenses: buildMetric(expenseSeries, cfg, false), // paise
  };
}
