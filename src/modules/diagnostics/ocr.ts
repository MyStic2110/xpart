import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { connectors } from "@/db/schema";

// ---------------------------------------------------------------------------
// OCR via Mistral's dedicated OCR API — used when a PDF is scanned (no text
// layer). Returns the document as plain text with tables preserved as
// markdown; the SAME deterministic parser (extract.ts) then runs over it, so
// there is only one extraction rule-set to maintain and nothing an LLM
// "imagined" ever enters the data. We keep only the concatenated text — the
// raw OCR response (per-page objects, images) is never stored.
// Gated behind the `mistral_ocr` connector: no API key → skip gracefully,
// the report is honestly marked `needs_ai`.
// ---------------------------------------------------------------------------

export interface OcrResult {
  used: boolean;
  reason?: "connector_not_configured" | "api_error";
  text?: string; // full document text, markdown tables intact
  error?: string;
}

interface MistralOcrResponse {
  pages?: { index?: number; markdown?: string }[];
}

export async function ocrPdf(orgId: string, pdfBuffer: Buffer): Promise<OcrResult> {
  const conn = await db.query.connectors.findFirst({
    where: and(eq(connectors.orgId, orgId), eq(connectors.provider, "mistral_ocr"), eq(connectors.status, "active")),
  });
  const config = (conn?.config ?? {}) as Record<string, string>;
  if (!conn || !config.apiKey) {
    return { used: false, reason: "connector_not_configured" };
  }

  try {
    const res = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model || "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
        },
        include_image_base64: false, // text only — we never store page images
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[diagnostics:ocr] Mistral OCR error (${res.status}):`, errBody.slice(0, 500));
      return { used: false, reason: "api_error", error: `Mistral OCR ${res.status}` };
    }

    const data = (await res.json()) as MistralOcrResponse;
    const pages = Array.isArray(data.pages) ? data.pages : [];
    const text = pages
      .map((p) => p.markdown ?? "")
      .join("\n\n")
      .trim();
    if (!text) {
      return { used: false, reason: "api_error", error: "OCR returned no text" };
    }
    return { used: true, text };
  } catch (err) {
    console.error("[diagnostics:ocr] request failed:", err);
    return { used: false, reason: "api_error", error: err instanceof Error ? err.message : "unknown error" };
  }
}
