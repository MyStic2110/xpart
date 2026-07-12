import { lookupDtc, type DtcLookup, type DtcSeverity, type DtcSystem } from "./dtc-database";

// ---------------------------------------------------------------------------
// Analysis engine: turns a flat list of extracted DTCs into
//  1. enriched faults (KB description/system/severity merged with report data)
//  2. correlated root causes ("one vacuum leak, not three separate repairs")
//  3. a prioritised repair plan with Indian cost bands
//  4. overall + per-system health scores
// Deterministic and explainable — every root cause lists the codes it explains.
// ---------------------------------------------------------------------------

export interface EnrichedFault {
  code: string;
  description: string;
  system: DtcSystem;
  ecu: string | null;
  status: string; // active | pending | history | permanent | unknown
  severity: DtcSeverity;
  known: boolean;
  causes: string[];
  fix: string;
  costMin: number; // paise
  costMax: number;
  laborHours: number;
  isRecurring: boolean;
}

export interface RootCause {
  title: string;
  confidence: "high" | "medium";
  explanation: string;
  explains: string[]; // codes covered by this cause
  repairSequence: string[];
}

export interface Recommendation {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  codes: string[];
  estCostMin: number; // paise
  estCostMax: number;
  laborHours: number;
}

interface CorrelationRule {
  title: string;
  // every group must have ≥1 matching code; a group is a list of regexes
  groups: RegExp[][];
  confidence: "high" | "medium";
  explanation: string;
  repairSequence: string[];
}

const CORRELATION_RULES: CorrelationRule[] = [
  {
    title: "Intake vacuum leak causing lean running",
    groups: [[/^P017[14]$/], [/^P030\d$|^P03(0\d|1[0-2])$/]],
    confidence: "high",
    explanation:
      "Lean mixture codes together with misfires usually trace back to one unmetered-air leak (intake hose, manifold gasket, PCV). The misfires — and any catalyst-efficiency code — are downstream effects, not separate failures.",
    repairSequence: [
      "Smoke-test the intake and repair the leak",
      "Inspect ignition system (plugs/coils) for damage from lean running",
      "Verify oxygen sensor response",
      "Clear codes and re-test catalytic converter before quoting a new cat",
    ],
  },
  {
    title: "Misfire poisoning the catalytic converter",
    groups: [[/^P030\d$|^P03(0\d|1[0-2])$/], [/^P04[23]0$/]],
    confidence: "high",
    explanation:
      "An active misfire dumps unburnt fuel into the catalyst and trips the efficiency code. Fix the misfire first — the catalyst reading often recovers, saving the customer a ₹15,000–60,000 part.",
    repairSequence: [
      "Isolate the misfiring cylinder (swap coil/plug)",
      "Repair ignition/injection cause",
      "Drive cycle, then re-check catalyst efficiency before replacement",
    ],
  },
  {
    title: "Contaminated MAF sensor skewing fuelling",
    groups: [[/^P010[0-3]$/], [/^P017[1-5]$/]],
    confidence: "medium",
    explanation:
      "MAF circuit/performance codes alongside fuel-trim codes point at one dirty or failing airflow sensor mis-reporting to the ECU.",
    repairSequence: ["Clean MAF with sensor-safe cleaner", "Replace air filter", "Re-test trims; replace MAF only if still out of range"],
  },
  {
    title: "Weak battery / charging system causing phantom electrical codes",
    groups: [[/^P056[23]$/], [/^U0/]],
    confidence: "high",
    explanation:
      "Low system voltage makes modules drop off the CAN bus and log lost-communication codes. Test the battery and alternator before chasing any module fault — most of these codes will clear.",
    repairSequence: [
      "Load-test battery; check alternator charging voltage (13.8–14.5V)",
      "Clean battery terminals and ground straps",
      "Replace battery/alternator if weak, clear codes, re-scan",
    ],
  },
  {
    title: "Cooling system fault (thermostat / coolant)",
    groups: [[/^P011[5-8]$|^P012[58]$|^P0217$/], [/^P011[5-8]$|^P012[58]$|^P0217$|^P0125$/]],
    confidence: "medium",
    explanation:
      "Multiple coolant-temperature codes usually mean one cooling-system fault — a stuck thermostat, low coolant or a drifting sensor — not several failures.",
    repairSequence: ["Pressure-test cooling system for leaks", "Verify thermostat opening temperature", "Replace ECT sensor only if readings stay implausible"],
  },
  {
    title: "Diesel low rail pressure — fuel supply restriction",
    groups: [[/^P008[79]$|^P0091$|^P0191$/]],
    confidence: "high",
    explanation:
      "Rail-pressure codes on a common-rail diesel almost always start with fuel supply. The cheap fix (filter) resolves a large share of Indian cases — diagnose in cost order before condemning the pump or injectors.",
    repairSequence: [
      "Replace diesel filter and check for tank contamination",
      "Test low-pressure (lift) pump delivery",
      "Injector back-leak test",
      "High-pressure pump/SCV valve only after the above pass",
    ],
  },
  {
    title: "Turbo underboost — check plumbing before the turbo",
    groups: [[/^P0299$|^P0234$/]],
    confidence: "medium",
    explanation:
      "Most underboost cases are a split intercooler hose or sticking VGT actuator — far cheaper than a turbocharger. Condemn the turbo last.",
    repairSequence: ["Pressure-test boost pipes and intercooler", "Check/free VGT actuator movement", "Inspect turbo shaft play only if plumbing passes"],
  },
  {
    title: "DPF soot overload from short city trips",
    groups: [[/^P2002$|^P24(52|53|63)$/]],
    confidence: "high",
    explanation:
      "City-driven BS6 diesels rarely complete passive regeneration. A forced regen plus a highway run resolves most cases; DPF removal is illegal and fails PUC.",
    repairSequence: ["Forced regeneration with scan tool", "20–30 min sustained highway drive", "DPF chemical cleaning if soot load stays high", "Advise customer on regular highway runs"],
  },
  {
    title: "EVAP leak — start with the fuel cap",
    groups: [[/^P044[0-6]$|^P045[56]$/]],
    confidence: "medium",
    explanation: "The most common EVAP culprit is a loose or aged fuel cap seal — a near-zero-cost fix. Smoke-test only if the code returns.",
    repairSequence: ["Check/replace fuel cap", "Clear code and monitor", "Smoke-test EVAP lines and purge valve if it returns"],
  },
  {
    title: "Variable valve timing fault — oil condition first",
    groups: [[/^P001[1246]$|^P0017$/]],
    confidence: "medium",
    explanation:
      "VVT codes are frequently caused by degraded or low engine oil blocking the VVT solenoid screens. An oil service is the correct first step before parts.",
    repairSequence: ["Engine oil + filter change with correct grade", "Clean/replace VVT (OCV) solenoid", "Timing chain stretch inspection only if codes persist"],
  },
  {
    title: "Wheel speed sensor fault disabling ABS",
    groups: [[/^C00(35|40|45|50)$/]],
    confidence: "high",
    explanation:
      "A wheel-speed sensor code disables ABS/ESP entirely — braking is degraded. Often it's just metal debris on the sensor tip or a damaged tone ring.",
    repairSequence: ["Remove and clean sensor tip", "Inspect tone/reluctor ring for damage", "Replace sensor if signal still absent on live data"],
  },
  {
    title: "CAN bus wiring fault affecting multiple modules",
    groups: [[/^U0/], [/^U0/]],
    confidence: "medium",
    explanation:
      "Several lost-communication codes at once point at shared CAN wiring or a common power/ground — not multiple failed modules. (If battery-voltage codes are also present, test the battery first.)",
    repairSequence: ["Check shared fuses and ground points", "CAN bus resistance test (~60Ω across CAN-H/CAN-L)", "Unplug modules one at a time to find one dragging the bus down"],
  },
];

const STATUS_WEIGHT: Record<string, number> = { active: 1, permanent: 1, pending: 0.6, unknown: 0.8, history: 0.25 };
const SEVERITY_DEDUCTION: Record<DtcSeverity, number> = { critical: 25, high: 14, medium: 7, low: 3, info: 1 };
const SEVERITY_PRIORITY: Record<DtcSeverity, Recommendation["priority"]> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "low",
};

export const ALL_SYSTEMS: DtcSystem[] = [
  "engine",
  "transmission",
  "abs_brakes",
  "airbag",
  "network",
  "electrical",
  "emissions",
  "cooling",
  "fuel",
  "body",
];

export interface AnalysisResult {
  faults: EnrichedFault[];
  healthScore: number;
  systemScores: Record<string, number>;
  rootCauses: RootCause[];
  recommendations: Recommendation[];
  summary: string;
}

function normaliseStatus(raw?: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (/perm/.test(s)) return "permanent";
  if (/active|current|confirmed|present/.test(s)) return "active";
  if (/pend|intermittent/.test(s)) return "pending";
  if (/hist|stored|past|memor/.test(s)) return "history";
  return "unknown";
}

export function enrichFault(
  raw: { code: string; description?: string | null; ecu?: string | null; status?: string | null },
  priorCodes: Set<string>
): EnrichedFault {
  const kb: DtcLookup = lookupDtc(raw.code);
  return {
    code: kb.code,
    // Prefer the scanner's own wording when the KB doesn't know the code.
    description: kb.known ? kb.description : raw.description?.trim() || kb.description,
    system: kb.system,
    ecu: raw.ecu?.trim() || null,
    status: normaliseStatus(raw.status),
    severity: kb.severity,
    known: kb.known,
    causes: kb.causes,
    fix: kb.fix,
    costMin: kb.costMin,
    costMax: kb.costMax,
    laborHours: kb.laborHours,
    isRecurring: priorCodes.has(kb.code),
  };
}

function scoreFaults(faults: EnrichedFault[]): { healthScore: number; systemScores: Record<string, number> } {
  const systemScores: Record<string, number> = {};
  for (const sys of ALL_SYSTEMS) systemScores[sys] = 100;

  let totalDeduction = 0;
  for (const f of faults) {
    const deduction = SEVERITY_DEDUCTION[f.severity] * (STATUS_WEIGHT[f.status] ?? 0.8) * (f.isRecurring ? 1.25 : 1);
    totalDeduction += deduction;
    const sys = f.system === "unknown" ? "engine" : f.system;
    systemScores[sys] = Math.max(5, Math.round((systemScores[sys] ?? 100) - deduction * 1.8));
  }
  return { healthScore: Math.max(5, Math.round(100 - totalDeduction)), systemScores };
}

function findRootCauses(faults: EnrichedFault[]): RootCause[] {
  // History-only codes shouldn't drive today's repair plan.
  const liveCodes = faults.filter((f) => f.status !== "history").map((f) => f.code);
  const out: RootCause[] = [];
  const claimed = new Set<string>();

  for (const rule of CORRELATION_RULES) {
    const matchedPerGroup = rule.groups.map((group) => liveCodes.filter((c) => group.some((re) => re.test(c))));
    if (matchedPerGroup.some((m) => m.length === 0)) continue;
    const explains = [...new Set(matchedPerGroup.flat())];
    // Prefer the first (most specific) rule that claims a code set.
    if (explains.every((c) => claimed.has(c))) continue;
    explains.forEach((c) => claimed.add(c));
    out.push({
      title: rule.title,
      confidence: rule.confidence,
      explanation: rule.explanation,
      explains,
      repairSequence: rule.repairSequence,
    });
  }
  return out;
}

function buildRecommendations(faults: EnrichedFault[]): Recommendation[] {
  // Merge faults that share the same fix (e.g. 3 misfire codes → one ignition job).
  const byFix = new Map<string, EnrichedFault[]>();
  for (const f of faults) {
    if (f.status === "history") continue;
    const list = byFix.get(f.fix) ?? [];
    list.push(f);
    byFix.set(f.fix, list);
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const recs: Recommendation[] = [...byFix.entries()].map(([fix, group]) => {
    const top = group.reduce((a, b) => (order[SEVERITY_PRIORITY[a.severity]] <= order[SEVERITY_PRIORITY[b.severity]] ? a : b));
    return {
      action: fix,
      priority: SEVERITY_PRIORITY[top.severity],
      codes: group.map((g) => g.code),
      estCostMin: Math.max(...group.map((g) => g.costMin)), // shared fix: pay once, take widest band
      estCostMax: Math.max(...group.map((g) => g.costMax)),
      laborHours: Math.max(...group.map((g) => g.laborHours)),
    };
  });
  recs.sort((a, b) => order[a.priority] - order[b.priority]);
  return recs;
}

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function buildSummary(faults: EnrichedFault[], rootCauses: RootCause[], recs: Recommendation[], healthScore: number): string {
  if (faults.length === 0) {
    return "No fault codes found in this report. Vehicle scanned clean.";
  }
  const active = faults.filter((f) => f.status === "active" || f.status === "permanent");
  const critical = faults.filter((f) => f.severity === "critical" && f.status !== "history");
  const recurring = faults.filter((f) => f.isRecurring);

  const parts: string[] = [];
  parts.push(
    `${faults.length} fault code${faults.length === 1 ? "" : "s"} found (${active.length} active${critical.length ? `, ${critical.length} critical` : ""}). Vehicle health ${healthScore}/100.`
  );
  if (rootCauses.length > 0) {
    parts.push(`Most likely underlying issue: ${rootCauses[0].title.toLowerCase()} — ${rootCauses[0].explains.join(", ")} trace back to it.`);
  }
  if (recurring.length > 0) {
    parts.push(`⚠ Recurring: ${recurring.map((f) => f.code).join(", ")} appeared in earlier reports for this vehicle — previous repair may not have held.`);
  }
  const costMin = recs.reduce((s, r) => s + r.estCostMin, 0);
  const costMax = recs.reduce((s, r) => s + r.estCostMax, 0);
  if (costMax > 0) {
    parts.push(`Estimated repair band: ${inr(costMin)}–${inr(costMax)} (indicative, parts + labour).`);
  }
  return parts.join(" ");
}

export function analyzeFaults(
  rawFaults: { code: string; description?: string | null; ecu?: string | null; status?: string | null }[],
  priorCodes: Set<string>
): AnalysisResult {
  // Dedupe by code, keeping the "worst" status occurrence.
  const statusRank: Record<string, number> = { active: 0, permanent: 0, unknown: 1, pending: 2, history: 3 };
  const byCode = new Map<string, EnrichedFault>();
  for (const raw of rawFaults) {
    const f = enrichFault(raw, priorCodes);
    const existing = byCode.get(f.code);
    if (!existing || (statusRank[f.status] ?? 1) < (statusRank[existing.status] ?? 1)) byCode.set(f.code, f);
  }
  const faults = [...byCode.values()];
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  faults.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const { healthScore, systemScores } = scoreFaults(faults);
  const rootCauses = findRootCauses(faults);
  const recommendations = buildRecommendations(faults);
  const summary = buildSummary(faults, rootCauses, recommendations, healthScore);

  return { faults, healthScore, systemScores, rootCauses, recommendations, summary };
}
