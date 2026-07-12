import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { diagnosticReports, diagnosticFaults, vehicles } from "@/db/schema";
import { extractPdfText, parseTextReport, type Extraction } from "./extract";
import { ocrPdf } from "./ocr";
import { llmAnalyzeText } from "./llm";
import { analyzeFaults, type AnalysisResult } from "./rules";

// ---------------------------------------------------------------------------
// Pipeline orchestration — the flow is OCR → LLM → UI:
//   PDF buffer → text (text layer, or Mistral OCR for scanned docs)
//              → deterministic parser (fault rows, vehicle match, history SQL)
//              → AutoDiag India LLM analysis over the same text (OpenRouter,
//                when configured) stored as `aiAnalysis` and rendered in the UI.
// LLM failure never blocks a report. `fullText` is handed back so the route
// can save it as a plain .txt artefact.
// ---------------------------------------------------------------------------

export type ExtractionEngine = "parser" | "ocr" | "parser+llm" | "ocr+llm";

export interface ProcessOutcome {
  extraction: Extraction;
  engine: ExtractionEngine | null;
  status: "processed" | "needs_ai" | "failed";
  statusDetail: string | null; // honest note about how/why this path was taken
  fullText: string | null; // entire document text — saved as .txt for LLM use
  aiAnalysis: Record<string, unknown> | null; // AutoDiag India JSON, when LLM ran
}

const EMPTY_EXTRACTION: Extraction = { vehicle: {}, faults: [], sensors: [] };

// If the OpenRouter connector is active, run the AutoDiag India analysis over
// the document text. Failure never blocks the report — deterministic results
// stand on their own, with an honest note.
async function analyzeWithLlm(
  orgId: string,
  fullText: string,
  engine: "parser" | "ocr"
): Promise<{ engine: ExtractionEngine; aiAnalysis: Record<string, unknown> | null; note: string | null }> {
  const llm = await llmAnalyzeText(orgId, fullText);
  if (llm.used && llm.analysis) {
    return { engine: `${engine}+llm`, aiAnalysis: llm.analysis, note: null };
  }
  if (llm.reason === "api_error") {
    return { engine, aiAnalysis: null, note: `AI analysis failed (${llm.error ?? "error"}); showing deterministic results only.` };
  }
  return { engine, aiAnalysis: null, note: null }; // connector not configured — normal path
}

export async function runExtraction(orgId: string, buffer: Buffer, opts?: { forceOcr?: boolean }): Promise<ProcessOutcome> {
  let pdfText: { text: string; pages: number; hasTextLayer: boolean };
  try {
    pdfText = await extractPdfText(buffer);
  } catch (err) {
    console.error("[diagnostics] pdf parse failed:", err);
    return { extraction: EMPTY_EXTRACTION, engine: null, status: "failed", statusDetail: "Could not read this file as a PDF.", fullText: null, aiAnalysis: null };
  }

  // Searchable PDF → text layer directly (free, offline) unless OCR is forced.
  if (pdfText.hasTextLayer && !opts?.forceOcr) {
    const extraction = parseTextReport(pdfText.text);
    const { engine, aiAnalysis, note } = await analyzeWithLlm(orgId, pdfText.text, "parser");
    return { extraction, engine, status: "processed", statusDetail: note, fullText: pdfText.text, aiAnalysis };
  }

  // Scanned/image PDF (or forced) → Mistral OCR, if configured.
  const ocr = await ocrPdf(orgId, buffer);
  if (ocr.used && ocr.text) {
    const extraction = parseTextReport(ocr.text);
    const { engine, aiAnalysis, note } = await analyzeWithLlm(orgId, ocr.text, "ocr");
    return { extraction, engine, status: "processed", statusDetail: note, fullText: ocr.text, aiAnalysis };
  }

  // OCR unavailable/failed. If we at least have a text layer (forceOcr path),
  // fall back to it rather than losing the report.
  if (pdfText.hasTextLayer) {
    const extraction = parseTextReport(pdfText.text);
    const ocrNote = ocr.reason === "api_error" ? `OCR failed (${ocr.error ?? "error"}); used the PDF text layer instead.` : null;
    const { engine, aiAnalysis, note } = await analyzeWithLlm(orgId, pdfText.text, "parser");
    return {
      extraction,
      engine,
      status: "processed",
      statusDetail: [ocrNote, note].filter(Boolean).join(" ") || null,
      fullText: pdfText.text,
      aiAnalysis,
    };
  }

  return {
    extraction: EMPTY_EXTRACTION,
    engine: null,
    status: "needs_ai",
    statusDetail:
      ocr.reason === "api_error"
        ? `This PDF is scanned (no text layer) and OCR failed: ${ocr.error ?? "error"}.`
        : "This PDF is scanned (no text layer). Connect the Mistral OCR connector in Settings → Connectors to read scanned reports.",
    fullText: null,
    aiAnalysis: null,
  };
}

// Explicit vehicleId wins; otherwise match the plate printed on the report
// against the org's vehicles (normalised: uppercase, no spaces/dashes).
export async function matchVehicle(
  orgId: string,
  extraction: Extraction,
  explicitVehicleId?: string | null
): Promise<{ vehicleId: string | null; clientId: string | null }> {
  if (explicitVehicleId) {
    const v = await db.query.vehicles.findFirst({ where: and(eq(vehicles.id, explicitVehicleId), eq(vehicles.orgId, orgId)) });
    if (v) return { vehicleId: v.id, clientId: v.clientId };
  }
  const plate = extraction.vehicle?.plateNumber?.replace(/[ -]/g, "").toUpperCase();
  if (plate) {
    const [v] = await db
      .select({ id: vehicles.id, clientId: vehicles.clientId })
      .from(vehicles)
      .where(and(eq(vehicles.orgId, orgId), sql`upper(replace(replace(${vehicles.plateNumber}, ' ', ''), '-', '')) = ${plate}`))
      .limit(1);
    if (v) return { vehicleId: v.id, clientId: v.clientId };
  }
  return { vehicleId: null, clientId: null };
}

// Codes seen in this vehicle's OTHER reports — powers recurring-fault flags.
export async function priorCodesForVehicle(orgId: string, vehicleId: string | null, excludeReportId?: string): Promise<Set<string>> {
  if (!vehicleId) return new Set();
  const conds = [eq(diagnosticFaults.orgId, orgId), eq(diagnosticFaults.vehicleId, vehicleId)];
  if (excludeReportId) conds.push(ne(diagnosticFaults.reportId, excludeReportId));
  const rows = await db.select({ code: diagnosticFaults.code }).from(diagnosticFaults).where(and(...conds));
  return new Set(rows.map((r) => r.code));
}

export async function analyzeAndPersist(
  report: { id: string; orgId: string; vehicleId: string | null },
  extraction: Extraction
): Promise<AnalysisResult> {
  const priorCodes = await priorCodesForVehicle(report.orgId, report.vehicleId, report.id);
  const analysis = analyzeFaults(extraction.faults ?? [], priorCodes);

  await db.delete(diagnosticFaults).where(eq(diagnosticFaults.reportId, report.id));
  if (analysis.faults.length > 0) {
    await db.insert(diagnosticFaults).values(
      analysis.faults.map((f) => ({
        orgId: report.orgId,
        reportId: report.id,
        vehicleId: report.vehicleId,
        code: f.code,
        description: f.description,
        system: f.system,
        ecu: f.ecu,
        status: f.status,
        severity: f.severity,
        isRecurring: f.isRecurring,
      }))
    );
  }

  await db
    .update(diagnosticReports)
    .set({
      reportDate: extraction.reportDate ?? null,
      odometerKm: extraction.vehicle?.odometerKm ?? null,
      vin: extraction.vehicle?.vin ?? null,
      plateNumber: extraction.vehicle?.plateNumber ?? null,
      workshopName: extraction.workshopName ?? null,
      technicianName: extraction.technicianName ?? null,
      extracted: extraction,
      healthScore: analysis.healthScore,
      systemScores: analysis.systemScores,
      rootCauses: analysis.rootCauses,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
      updatedAt: new Date(),
    })
    .where(eq(diagnosticReports.id, report.id));

  return analysis;
}

// Compare a report against the previous one for the same vehicle.
export async function compareWithPrevious(orgId: string, report: { id: string; vehicleId: string | null; createdAt: Date; healthScore: number | null }) {
  if (!report.vehicleId) return null;
  const [prev] = await db
    .select()
    .from(diagnosticReports)
    .where(
      and(
        eq(diagnosticReports.orgId, orgId),
        eq(diagnosticReports.vehicleId, report.vehicleId),
        ne(diagnosticReports.id, report.id),
        sql`${diagnosticReports.createdAt} < ${report.createdAt.toISOString()}`
      )
    )
    .orderBy(sql`${diagnosticReports.createdAt} desc`)
    .limit(1);
  if (!prev) return null;

  const [currFaults, prevFaults] = await Promise.all([
    db.select({ code: diagnosticFaults.code }).from(diagnosticFaults).where(eq(diagnosticFaults.reportId, report.id)),
    db.select({ code: diagnosticFaults.code }).from(diagnosticFaults).where(eq(diagnosticFaults.reportId, prev.id)),
  ]);
  const curr = new Set(currFaults.map((f) => f.code));
  const before = new Set(prevFaults.map((f) => f.code));

  return {
    previousReportId: prev.id,
    previousDate: prev.reportDate ?? prev.createdAt.toISOString().slice(0, 10),
    previousHealthScore: prev.healthScore,
    healthDelta: report.healthScore != null && prev.healthScore != null ? report.healthScore - prev.healthScore : null,
    newCodes: [...curr].filter((c) => !before.has(c)),
    resolvedCodes: [...before].filter((c) => !curr.has(c)),
    recurringCodes: [...curr].filter((c) => before.has(c)),
  };
}
