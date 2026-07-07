// Indian national + Tamil Nadu festival calendar used by the planner.
// Curated static dataset (lunar-calendar dates are approximations — verify and
// extend yearly; a per-org editable holiday table is the eventual home).
//
// `washRush: true` marks festivals Indians traditionally clean/decorate
// vehicles for — the 1–3 days BEFORE these are the highest-demand windows a
// car wash sees all year (Diwali, Pongal, Ayudha Puja...).

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  kind: "national" | "festival" | "regional";
  washRush?: boolean;
}

export const HOLIDAYS: Holiday[] = [
  // ---- 2026 ----
  { date: "2026-01-01", name: "New Year's Day", kind: "festival", washRush: true },
  { date: "2026-01-14", name: "Pongal / Makar Sankranti", kind: "regional", washRush: true },
  { date: "2026-01-15", name: "Thiruvalluvar Day", kind: "regional" },
  { date: "2026-01-16", name: "Uzhavar Thirunal", kind: "regional" },
  { date: "2026-01-26", name: "Republic Day", kind: "national" },
  { date: "2026-03-04", name: "Holi", kind: "festival" },
  { date: "2026-03-21", name: "Eid ul-Fitr", kind: "festival" },
  { date: "2026-04-03", name: "Good Friday", kind: "national" },
  { date: "2026-04-14", name: "Tamil New Year / Ambedkar Jayanti", kind: "regional", washRush: true },
  { date: "2026-05-01", name: "May Day", kind: "national" },
  { date: "2026-05-28", name: "Bakrid / Eid al-Adha", kind: "festival" },
  { date: "2026-06-26", name: "Muharram", kind: "festival" },
  { date: "2026-08-15", name: "Independence Day", kind: "national" },
  { date: "2026-08-26", name: "Onam", kind: "regional" },
  { date: "2026-08-28", name: "Raksha Bandhan", kind: "festival" },
  { date: "2026-09-04", name: "Krishna Janmashtami", kind: "festival" },
  { date: "2026-09-14", name: "Ganesh Chaturthi", kind: "festival", washRush: true },
  { date: "2026-10-02", name: "Gandhi Jayanti", kind: "national" },
  { date: "2026-10-19", name: "Ayudha Puja", kind: "regional", washRush: true },
  { date: "2026-10-20", name: "Vijayadashami / Dussehra", kind: "festival", washRush: true },
  { date: "2026-11-08", name: "Diwali / Deepavali", kind: "festival", washRush: true },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", kind: "festival" },
  { date: "2026-12-25", name: "Christmas", kind: "national", washRush: true },
  // ---- 2027 (extend as the year approaches) ----
  { date: "2027-01-01", name: "New Year's Day", kind: "festival", washRush: true },
  { date: "2027-01-14", name: "Pongal / Makar Sankranti", kind: "regional", washRush: true },
  { date: "2027-01-15", name: "Thiruvalluvar Day", kind: "regional" },
  { date: "2027-01-26", name: "Republic Day", kind: "national" },
];

const holidayByDate = new Map(HOLIDAYS.map((h) => [h.date, h]));

export function holidayOn(date: string): Holiday | undefined {
  return holidayByDate.get(date);
}

function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay(); // 0=Sun
}

// A date is part of a long weekend when a holiday sits adjacent to (or on) a
// weekend forming a 3+ day off-block, e.g. Fri holiday + Sat + Sun.
export function isLongWeekendDay(date: string): boolean {
  const isOff = (d: string) => dayOfWeek(d) === 0 || dayOfWeek(d) === 6 || holidayByDate.has(d);
  if (!isOff(date)) return false;
  // Find the contiguous off-block around this date and require length >= 3
  // with at least one actual holiday in it (plain weekends don't count).
  let start = date;
  while (isOff(addDays(start, -1))) start = addDays(start, -1);
  let end = date;
  while (isOff(addDays(end, 1))) end = addDays(end, 1);
  const len = (new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime()) / 86400000 + 1;
  if (len < 3) return false;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (holidayByDate.has(d)) return true;
  }
  return false;
}

// Days until the next wash-rush festival within `window` days (for the
// "pre-festival rush" demand signal). Returns null when none is close.
export function upcomingWashRush(date: string, window = 3): { holiday: Holiday; daysAway: number } | null {
  for (let i = 1; i <= window; i++) {
    const h = holidayByDate.get(addDays(date, i));
    if (h?.washRush) return { holiday: h, daysAway: i };
  }
  return null;
}
