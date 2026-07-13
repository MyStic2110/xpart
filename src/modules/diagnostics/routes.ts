import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { eq, and, or, isNull, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { diagnosticReports, diagnosticFaults, vehicles, clients } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { runExtraction, matchVehicle, analyzeAndPersist, compareWithPrevious } from "./service";
import type { Extraction } from "./extract";
import { schemaDoc } from "@/utils/swagger";
import { z } from "zod";

const UPLOAD_DIR = path.resolve("uploads");
const MAX_PDF_BYTES = 15 * 1024 * 1024; // diagnostic PDFs run bigger than photos

const REPORT_TYPES = [
  "obd_scan",
  "health_report",
  "service_invoice",
  "emission_test",
  "battery_report",
  "alignment_report",
  "insurance_inspection",
  "other",
] as const;

function fieldValue(fields: unknown, key: string): string | null {
  const f = (fields as Record<string, { value?: unknown } | undefined>)?.[key];
  const v = f && typeof f === "object" && "value" in f ? f.value : undefined;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

const canDelete = [requireAuth, requireRole("org_owner", "admin", "branch_manager")];

export async function diagnosticsRoutes(app: FastifyInstance) {
  // Upload a diagnostic PDF and process it synchronously (parser is instant;
  // the AI path takes a few seconds — acceptable for a counter workflow).
  app.post("/diagnostics/reports", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Upload and extract a diagnostic PDF report",
      description: "Uploads a raw OBD scan, health report or service invoice PDF. Auto-extracts vehicle detail, faults, health score, and comparison stats using smart rule-parsers or LLM OCR.",
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const file = await req.file({ limits: { fileSize: MAX_PDF_BYTES } });
    if (!file) return reply.code(400).send({ error: "no file provided" });
    if (file.mimetype !== "application/pdf") return reply.code(400).send({ error: "only PDF reports are supported" });

    const buffer = await file.toBuffer();
    const branchId = fieldValue(file.fields, "branchId");
    const explicitVehicleId = fieldValue(file.fields, "vehicleId");
    const reportTypeRaw = fieldValue(file.fields, "reportType") ?? "obd_scan";
    const reportType = (REPORT_TYPES as readonly string[]).includes(reportTypeRaw) ? reportTypeRaw : "other";

    await mkdir(UPLOAD_DIR, { recursive: true });
    const storedBase = randomUUID();
    await writeFile(path.join(UPLOAD_DIR, `${storedBase}.pdf`), buffer);

    const outcome = await runExtraction(orgId, buffer);
    // The whole document text lives as a flat .txt (tables kept as markdown) —
    // the LLM-ready artefact; no parse blobs beyond the structured fields.
    let textFileUrl: string | null = null;
    if (outcome.fullText) {
      await writeFile(path.join(UPLOAD_DIR, `${storedBase}.txt`), outcome.fullText, "utf8");
      textFileUrl = `/uploads/${storedBase}.txt`;
    }
    const { vehicleId, clientId } = await matchVehicle(orgId, outcome.extraction, explicitVehicleId);

    const [report] = await db
      .insert(diagnosticReports)
      .values({
        orgId,
        branchId: branchId || null,
        vehicleId,
        clientId,
        fileUrl: `/uploads/${storedBase}.pdf`,
        fileName: file.filename || `${storedBase}.pdf`,
        textFileUrl,
        aiAnalysis: outcome.aiAnalysis,
        reportType,
        status: outcome.status,
        engine: outcome.engine,
        summary: outcome.statusDetail, // overwritten by analysis when processed
        createdBy: req.auth!.userId,
      })
      .returning();

    if (outcome.status === "processed") {
      await analyzeAndPersist({ id: report.id, orgId, vehicleId }, outcome.extraction);
    }

    const detail = await loadReportDetail(orgId, report.id);
    return reply.code(201).send({ ...detail, statusDetail: outcome.statusDetail });
  });

  // List reports with vehicle/client context + fault counts.
  app.get("/diagnostics/reports", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "List all diagnostic reports",
      querystring: z.object({
        branchId: z.string().optional(),
        vehicleId: z.string().optional(),
        clientId: z.string().optional(),
        status: z.enum(["processed", "processing", "needs_ai", "failed"]).optional(),
      }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { branchId, vehicleId, clientId, status } = req.query as Record<string, string | undefined>;
    const conds = [eq(diagnosticReports.orgId, orgId)];
    if (branchId && branchId !== "all") {
      conds.push(or(eq(diagnosticReports.branchId, branchId), isNull(diagnosticReports.branchId))!);
    }
    if (vehicleId) conds.push(eq(diagnosticReports.vehicleId, vehicleId));
    if (clientId) conds.push(eq(diagnosticReports.clientId, clientId));
    if (status) conds.push(eq(diagnosticReports.status, status));

    const rows = await db
      .select({
        id: diagnosticReports.id,
        branchId: diagnosticReports.branchId,
        vehicleId: diagnosticReports.vehicleId,
        clientId: diagnosticReports.clientId,
        fileName: diagnosticReports.fileName,
        fileUrl: diagnosticReports.fileUrl,
        reportType: diagnosticReports.reportType,
        status: diagnosticReports.status,
        engine: diagnosticReports.engine,
        reportDate: diagnosticReports.reportDate,
        odometerKm: diagnosticReports.odometerKm,
        plateNumber: sql<string | null>`coalesce(${vehicles.plateNumber}, ${diagnosticReports.plateNumber})`,
        fuelType: vehicles.fuelType,
        clientName: clients.name,
        healthScore: diagnosticReports.healthScore,
        summary: diagnosticReports.summary,
        createdAt: diagnosticReports.createdAt,
        faultCount: sql<number>`(select count(*)::int from diagnostic_faults f where f.report_id = ${diagnosticReports.id})`,
        activeFaults: sql<number>`(select count(*)::int from diagnostic_faults f where f.report_id = ${diagnosticReports.id} and f.status in ('active','permanent'))`,
        criticalFaults: sql<number>`(select count(*)::int from diagnostic_faults f where f.report_id = ${diagnosticReports.id} and f.severity = 'critical' and f.status <> 'history')`,
      })
      .from(diagnosticReports)
      .leftJoin(vehicles, eq(diagnosticReports.vehicleId, vehicles.id))
      .leftJoin(clients, eq(diagnosticReports.clientId, clients.id))
      .where(and(...conds))
      .orderBy(desc(diagnosticReports.createdAt));

    return reply.send(rows);
  });

  // Dashboard KPIs for the module.
  app.get("/diagnostics/summary", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Get diagnostic dashboard analytics KPIs summary",
      querystring: z.object({ branchId: z.string().optional() }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { branchId } = req.query as { branchId?: string };
    const branchCond = branchId && branchId !== "all" ? sql`and (r.branch_id = ${branchId} or r.branch_id is null)` : sql``;

    const [row] = await db.execute<{
      total_reports: number;
      active_faults: number;
      critical_faults: number;
      vehicles_attention: number;
      avg_health: number | null;
      needs_ai: number;
    }>(sql`
      select
        (select count(*)::int from diagnostic_reports r where r.org_id = ${orgId} ${branchCond}) as total_reports,
        (select count(*)::int from diagnostic_faults f join diagnostic_reports r on r.id = f.report_id
          where f.org_id = ${orgId} and f.status in ('active','permanent') ${branchCond}) as active_faults,
        (select count(*)::int from diagnostic_faults f join diagnostic_reports r on r.id = f.report_id
          where f.org_id = ${orgId} and f.severity = 'critical' and f.status <> 'history' ${branchCond}) as critical_faults,
        (select count(distinct f.vehicle_id)::int from diagnostic_faults f join diagnostic_reports r on r.id = f.report_id
          where f.org_id = ${orgId} and f.vehicle_id is not null and f.severity in ('critical','high') and f.status in ('active','permanent') ${branchCond}) as vehicles_attention,
        (select round(avg(r.health_score))::int from diagnostic_reports r where r.org_id = ${orgId} and r.health_score is not null ${branchCond}) as avg_health,
        (select count(*)::int from diagnostic_reports r where r.org_id = ${orgId} and r.status = 'needs_ai' ${branchCond}) as needs_ai
    `);

    const topCodes = await db.execute<{ code: string; description: string; count: number }>(sql`
      select f.code, min(f.description) as description, count(*)::int as count
      from diagnostic_faults f join diagnostic_reports r on r.id = f.report_id
      where f.org_id = ${orgId} ${branchCond}
      group by f.code order by count(*) desc limit 5
    `);

    return reply.send({
      totalReports: row?.total_reports ?? 0,
      activeFaults: row?.active_faults ?? 0,
      criticalFaults: row?.critical_faults ?? 0,
      vehiclesNeedingAttention: row?.vehicles_attention ?? 0,
      avgHealthScore: row?.avg_health ?? null,
      needsAiCount: row?.needs_ai ?? 0,
      topCodes: [...topCodes],
    });
  });

  // Full report detail + history comparison.
  app.get("/diagnostics/reports/:id", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Get diagnostic report detail with historical fault comparison",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    const detail = await loadReportDetail(orgId, id);
    if (!detail) return reply.code(404).send({ error: "report not found" });
    return reply.send(detail);
  });

  // Re-run the pipeline on the stored file (e.g. after connecting the OCR
  // connector for a scanned report). `useOcr: true` forces the OCR path.
  app.post("/diagnostics/reports/:id/reprocess", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Force LLM OCR reprocessing of a PDF scan",
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ useOcr: z.boolean().optional() }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { useOcr?: boolean };
    const report = await db.query.diagnosticReports.findFirst({ where: and(eq(diagnosticReports.id, id), eq(diagnosticReports.orgId, orgId)) });
    if (!report) return reply.code(404).send({ error: "report not found" });

    let buffer: Buffer;
    try {
      buffer = await readFile(path.join(UPLOAD_DIR, path.basename(report.fileUrl)));
    } catch {
      return reply.code(410).send({ error: "stored PDF is no longer available" });
    }

    const outcome = await runExtraction(orgId, buffer, { forceOcr: body.useOcr === true });
    const storedBase = path.basename(report.fileUrl, ".pdf");
    let textFileUrl = report.textFileUrl;
    if (outcome.fullText) {
      await writeFile(path.join(UPLOAD_DIR, `${storedBase}.txt`), outcome.fullText, "utf8");
      textFileUrl = `/uploads/${storedBase}.txt`;
    }
    const { vehicleId, clientId } = await matchVehicle(orgId, outcome.extraction, report.vehicleId);
    await db
      .update(diagnosticReports)
      .set({
        status: outcome.status,
        engine: outcome.engine,
        vehicleId,
        clientId: clientId ?? report.clientId,
        textFileUrl,
        aiAnalysis: outcome.aiAnalysis,
        summary: outcome.statusDetail,
        updatedAt: new Date(),
      })
      .where(eq(diagnosticReports.id, id));

    if (outcome.status === "processed") {
      await analyzeAndPersist({ id, orgId, vehicleId }, outcome.extraction);
    } else {
      await db.delete(diagnosticFaults).where(eq(diagnosticFaults.reportId, id));
    }

    const detail = await loadReportDetail(orgId, id);
    return reply.send({ ...detail, statusDetail: outcome.statusDetail });
  });

  app.delete("/diagnostics/reports/:id", {
    preHandler: canDelete,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Delete a diagnostic report",
      params: z.object({ id: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    await db.delete(diagnosticReports).where(and(eq(diagnosticReports.id, id), eq(diagnosticReports.orgId, orgId)));
    return reply.send({ success: true });
  });

  // Chronological diagnostic history for one vehicle: reports, health trend,
  // codes that keep coming back.
  app.get("/diagnostics/vehicles/:vehicleId/timeline", {
    preHandler: requireAuth,
    ...schemaDoc({
      tags: ["Diagnostics"],
      summary: "Get diagnostic timeline for a vehicle",
      description: "Returns health scores timeline, list of scan reports, and recurring diagnostic trouble codes (DTCs).",
      params: z.object({ vehicleId: z.string().uuid() }),
    })
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { vehicleId } = req.params as { vehicleId: string };
    const vehicle = await db.query.vehicles.findFirst({ where: and(eq(vehicles.id, vehicleId), eq(vehicles.orgId, orgId)) });
    if (!vehicle) return reply.code(404).send({ error: "vehicle not found" });

    const reports = await db
      .select()
      .from(diagnosticReports)
      .where(and(eq(diagnosticReports.orgId, orgId), eq(diagnosticReports.vehicleId, vehicleId)))
      .orderBy(asc(diagnosticReports.createdAt));

    const faults = await db
      .select()
      .from(diagnosticFaults)
      .where(and(eq(diagnosticFaults.orgId, orgId), eq(diagnosticFaults.vehicleId, vehicleId)))
      .orderBy(asc(diagnosticFaults.createdAt));

    const byReport = new Map<string, typeof faults>();
    for (const f of faults) {
      const list = byReport.get(f.reportId) ?? [];
      list.push(f);
      byReport.set(f.reportId, list);
    }

    const codeReportCount = new Map<string, Set<string>>();
    for (const f of faults) {
      const set = codeReportCount.get(f.code) ?? new Set();
      set.add(f.reportId);
      codeReportCount.set(f.code, set);
    }
    const recurringCodes = [...codeReportCount.entries()]
      .filter(([, set]) => set.size >= 2)
      .map(([code, set]) => ({ code, occurrences: set.size, description: faults.find((f) => f.code === code)?.description ?? "" }));

    return reply.send({
      vehicle: { id: vehicle.id, plateNumber: vehicle.plateNumber },
      reports: reports.map((r) => ({ ...r, faults: byReport.get(r.id) ?? [] })),
      healthTrend: reports.filter((r) => r.healthScore != null).map((r) => ({ date: r.reportDate ?? r.createdAt.toISOString().slice(0, 10), score: r.healthScore })),
      recurringCodes,
    });
  });
}

async function loadReportDetail(orgId: string, id: string) {
  const report = await db.query.diagnosticReports.findFirst({ where: and(eq(diagnosticReports.id, id), eq(diagnosticReports.orgId, orgId)) });
  if (!report) return null;

  const faults = await db
    .select()
    .from(diagnosticFaults)
    .where(eq(diagnosticFaults.reportId, id))
    .orderBy(sql`case severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`);

  const vehicle = report.vehicleId
    ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, report.vehicleId) })
    : null;
  const client = report.clientId ? await db.query.clients.findFirst({ where: eq(clients.id, report.clientId) }) : null;

  const comparison = await compareWithPrevious(orgId, {
    id: report.id,
    vehicleId: report.vehicleId,
    createdAt: report.createdAt,
    healthScore: report.healthScore,
  });

  return {
    report: { ...report, extracted: (report.extracted ?? null) as Extraction | null },
    faults,
    vehicle: vehicle ? { id: vehicle.id, plateNumber: vehicle.plateNumber, year: vehicle.year, fuelType: vehicle.fuelType } : null,
    client: client ? { id: client.id, name: client.name, phone: client.phone } : null,
    comparison,
  };
}
