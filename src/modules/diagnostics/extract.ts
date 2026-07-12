import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------------------------
// Deterministic extraction from a diagnostic PDF's text layer.
// Works offline and free for searchable PDFs (Autel/Launch/Bosch exports,
// dealer reports). Scanned image-only PDFs have no text layer — those are
// flagged so the AI engine (ai.ts) can take over when configured.
// ---------------------------------------------------------------------------

export interface ExtractedFault {
  code: string;
  description?: string | null;
  ecu?: string | null;
  status?: string | null;
}

export interface ExtractedSensor {
  name: string;
  value: string;
  unit?: string | null;
}

export interface Extraction {
  vehicle: {
    vin?: string | null;
    plateNumber?: string | null;
    make?: string | null;
    model?: string | null;
    fuelType?: string | null;
    year?: number | null;
    odometerKm?: number | null;
  };
  reportDate?: string | null; // YYYY-MM-DD
  workshopName?: string | null;
  technicianName?: string | null;
  faults: ExtractedFault[];
  sensors: ExtractedSensor[];
  freezeFrames?: { code?: string; values: ExtractedSensor[] }[];
  remarks?: string[];
  partsReplaced?: string[];
}

export interface PdfTextResult {
  text: string;
  pages: number;
  hasTextLayer: boolean;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const parsed = await parser.getText();
    const text = parsed.text ?? "";
    // Scanned PDFs come back (near-)empty — under ~25 chars/page of real content
    // means there is no usable text layer.
    const dense = text.replace(/\s+/g, "");
    const hasTextLayer = dense.length >= Math.max(80, (parsed.total || 1) * 25);
    return { text, pages: parsed.total || 1, hasTextLayer };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// Tables are where diagnostic PDFs keep their real data — and where naive
// parsing bleeds neighbouring cell values into descriptions/statuses. OCR
// output preserves tables as markdown (`| code | desc | status |`), and
// pdf-parse collapses table cells to runs of spaces. Normalising both to
// wide column gaps lets one rule ("a description ends at 2+ spaces") handle
// table cells correctly everywhere.
function normalizeForParsing(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]*\|[ \t]*/g, "   ") // markdown/table pipes → column gaps
    .replace(/^[ \t]*[#>]+[ \t]*/gm, "") // markdown headings/quotes
    .replace(/\*\*?|__/g, "") // bold/italic markers
    .replace(/^[ \t]*[-–—=:]{3,}[ \t\-–—=:]*$/gm, ""); // rules + table separator rows
}

// --- individual field parsers ------------------------------------------------

const DTC_RE = /\b([PBCU][0-3][0-9A-F]{3})\b/g;
// 17 chars, no I/O/Q per VIN spec; require both letters and digits to avoid
// matching stray hex blobs.
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
// Indian plates: TN09AB1234 / MH 12 DE 1433 / DL4CAF4943 (+ BH series 22BH1234AA)
const PLATE_RE = /\b([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}|\d{2}[ -]?BH[ -]?\d{4}[ -]?[A-Z]{1,2})\b/g;

const STATUS_WORDS = /(active|current|confirmed|present|pending|intermittent|permanent|history|historic|stored|past|memorized)/i;
const ECU_WORDS =
  /(engine|ecm|pcm|powertrain|transmission|tcm|tcu|abs|esp|brake|airbag|srs|restraint|body|bcm|network|gateway|cluster|ipc|hvac|climate|steering|eps|immobilizer|battery|bms)/i;

const INDIAN_MAKES = [
  "Maruti Suzuki", "Maruti", "Hyundai", "Tata", "Mahindra", "Honda", "Toyota", "Kia", "Renault", "Nissan",
  "Skoda", "Volkswagen", "Ford", "MG", "Chevrolet", "Fiat", "Datsun", "Jeep", "Citroen", "BYD",
  "Hero", "Bajaj", "TVS", "Royal Enfield", "Yamaha", "Suzuki", "KTM", "Ather", "Ola Electric",
];

function labeled(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-#]\\s*([^\\n\\r]{2,60})`, "i");
    const m = text.match(re);
    if (m) {
      const v = m[1].trim().replace(/\s{2,}.*$/, ""); // cut at big gaps (table columns)
      if (v && !/^[-–_.]+$/.test(v)) return v;
    }
  }
  return null;
}

function parseDate(text: string): string | null {
  // dd/mm/yyyy or dd-mm-yyyy (Indian convention)
  let m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const day = Number(dd), mon = Number(mm);
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${yyyy}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  // yyyy-mm-dd
  m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m) return m[0];
  return null;
}

function parseOdometer(text: string): number | null {
  const m = text.match(/(?:odometer|odo(?:meter)?\s*reading|mileage|kilometers?|kms?\s*(?:run|driven|reading)?)\s*[:\-]?\s*([\d,]{3,9})(?:\s*(?:km|kms|kilometers?))?/i);
  if (!m) return null;
  const km = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(km) && km > 10 && km < 2_000_000 ? km : null;
}

// Live-data labels worth pulling out of any report.
const SENSOR_PATTERNS: { name: string; re: RegExp; unit: string }[] = [
  { name: "Engine RPM", re: /(?:engine\s*(?:speed|rpm)|rpm)\s*[:\-]?\s*(\d{2,5}(?:\.\d+)?)/i, unit: "rpm" },
  { name: "Coolant temperature", re: /coolant\s*temp(?:erature)?\s*[:\-]?\s*(-?\d{1,3}(?:\.\d+)?)/i, unit: "°C" },
  { name: "Battery voltage", re: /(?:battery|system|module)\s*voltage\s*[:\-]?\s*(\d{1,2}(?:\.\d+)?)/i, unit: "V" },
  { name: "Engine load", re: /(?:calculated\s*)?engine\s*load\s*(?:value)?\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)/i, unit: "%" },
  { name: "Fuel pressure", re: /fuel\s*(?:rail\s*)?pressure\s*[:\-]?\s*(\d{1,6}(?:\.\d+)?)/i, unit: "" },
  { name: "MAF rate", re: /(?:maf|mass\s*air\s*flow)(?:\s*(?:rate|sensor))?\s*[:\-]?\s*(\d{1,4}(?:\.\d+)?)/i, unit: "g/s" },
  { name: "Intake air temperature", re: /intake\s*(?:air\s*)?temp(?:erature)?\s*[:\-]?\s*(-?\d{1,3}(?:\.\d+)?)/i, unit: "°C" },
  { name: "Throttle position", re: /throttle\s*position\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)/i, unit: "%" },
  { name: "Short-term fuel trim", re: /(?:short[\s-]*term\s*fuel\s*trim|stft)\s*(?:b(?:ank)?\s*1)?\s*[:\-]?\s*(-?\d{1,3}(?:\.\d+)?)/i, unit: "%" },
  { name: "Long-term fuel trim", re: /(?:long[\s-]*term\s*fuel\s*trim|ltft)\s*(?:b(?:ank)?\s*1)?\s*[:\-]?\s*(-?\d{1,3}(?:\.\d+)?)/i, unit: "%" },
  { name: "Vehicle speed", re: /vehicle\s*speed\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)/i, unit: "km/h" },
  { name: "Boost pressure", re: /boost\s*pressure\s*[:\-]?\s*(-?\d{1,4}(?:\.\d+)?)/i, unit: "" },
];

function parseFaults(text: string): ExtractedFault[] {
  const faults: ExtractedFault[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  DTC_RE.lastIndex = 0;
  while ((m = DTC_RE.exec(text)) !== null) {
    const code = m[1].toUpperCase();
    // A VIN fragment or part number can false-match; DTCs practically start
    // with P0/P1/P2/P3, C0/C1, B0/B1, U0/U1.
    if (!/^[PBCU][0-3]/.test(code)) continue;

    // Context window around the hit → status keyword, ECU/module, description.
    const start = Math.max(0, m.index - 120);
    const end = Math.min(text.length, m.index + code.length + 160);
    const before = text.slice(start, m.index);
    const after = text.slice(m.index + code.length, end);

    const statusMatch = after.match(STATUS_WORDS) ?? before.match(STATUS_WORDS);
    // Same row first (table cells sit after the code), only then look back.
    const ecuMatch = after.match(ECU_WORDS) ?? before.match(ECU_WORDS);
    // Description: the text on the same line right after the code, up to a
    // status word or line break.
    const descMatch = after.match(/^[\s:\-–—]*([A-Za-z][^\n\r]{4,90})/);
    let description = descMatch ? descMatch[1].trim() : null;
    if (description) {
      description = description
        .replace(/\s{2,}.*$/, "") // stop at the next table column
        .replace(STATUS_WORDS, "")
        .replace(/[|,;:\-]\s*$/, "")
        .trim();
      // Reject cell-value bleed: "descriptions" that are just numbers/units.
      if (description.length < 5 || /^[\d.,\s%°CVAkmh/-]+$/i.test(description)) description = null;
    }

    if (seen.has(code)) {
      // Keep the occurrence that has a status word (dedupe handled in rules,
      // but avoid flooding one report with the same code from a summary page).
      if (!statusMatch) continue;
      const idx = faults.findIndex((f) => f.code === code);
      if (idx >= 0 && !faults[idx].status) faults[idx] = { ...faults[idx], status: statusMatch[1] };
      continue;
    }
    seen.add(code);
    faults.push({
      code,
      description,
      ecu: ecuMatch ? ecuMatch[1] : null,
      status: statusMatch ? statusMatch[1] : null,
    });
  }
  return faults;
}

export function parseTextReport(rawText: string): Extraction {
  const text = normalizeForParsing(rawText);
  const faults = parseFaults(text);

  const sensors: ExtractedSensor[] = [];
  for (const s of SENSOR_PATTERNS) {
    const m = text.match(s.re);
    if (m) sensors.push({ name: s.name, value: m[1], unit: s.unit || null });
  }

  // VIN — require a mix of letters and digits
  let vin: string | null = null;
  VIN_RE.lastIndex = 0;
  let vm: RegExpExecArray | null;
  while ((vm = VIN_RE.exec(text)) !== null) {
    if (/[A-Z]/.test(vm[1]) && /\d/.test(vm[1])) {
      vin = vm[1];
      break;
    }
  }

  const plateRaw = text.match(PLATE_RE)?.[0] ?? null;
  const make = INDIAN_MAKES.find((mk) => new RegExp(`\\b${mk.replace(/ /g, "\\s+")}\\b`, "i").test(text)) ?? null;

  const fuelMatch = text.match(/\b(petrol|diesel|cng|electric|hybrid)\b/i);
  const yearMatch = text.match(/(?:year|model\s*year|mfg\.?\s*(?:year|date)|manufactur\w*\s*(?:year|date))\s*[:\-]?\s*.*?(20[0-2]\d|19[89]\d)/i);

  return {
    vehicle: {
      vin,
      plateNumber: plateRaw ? plateRaw.replace(/[ -]/g, "").toUpperCase() : null,
      make,
      model: labeled(text, ["model"]),
      fuelType: fuelMatch ? fuelMatch[1].toLowerCase() : null,
      year: yearMatch ? Number(yearMatch[1]) : null,
      odometerKm: parseOdometer(text),
    },
    reportDate: parseDate(text),
    workshopName: labeled(text, ["workshop(?:\\s*name)?", "garage(?:\\s*name)?", "service\\s*cent(?:er|re)", "dealer(?:ship)?(?:\\s*name)?"]),
    technicianName: labeled(text, ["technician(?:\\s*name)?", "mechanic(?:\\s*name)?", "advisor(?:\\s*name)?", "inspected\\s*by", "tested\\s*by"]),
    faults,
    sensors,
    remarks: [],
    partsReplaced: [],
  };
}
