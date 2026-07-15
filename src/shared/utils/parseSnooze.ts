/**
 * Natural-language snooze parser.
 *
 * Converts a free-text phrase into a unix-seconds timestamp, or `null` when the
 * phrase can't be understood. Pure (no I/O, no deps) so it's trivially testable.
 *
 * Supported shapes (case-insensitive):
 *   - "tonight" / "this evening"        → 20:00 local today (or +1 day if past)
 *   - "tomorrow" [h[:mm]][am|pm]        → next day at that time (default 09:00)
 *   - "next monday" / "monday"          → upcoming weekday at 09:00
 *   - "in <n> minutes|hours|days|weeks"  → now + offset
 *   - "<n>h" / "<n>m" / "<n>d"          → now + offset
 *   - "friday 3pm" / "fri"              → upcoming weekday at given time
 *   - ISO-ish "2026-07-20" / "07/20"    → that calendar date at 09:00
 *
 * Falls back to `null` so callers keep their preset picker as the safe default.
 */
export type SnoozeParseResult = { until: number; label: string } | null;

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function atTime(base: Date, h: number, m: number): number {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function nextWeekday(from: Date, target: number, hour: number, minute: number): number {
  const base = startOfDay(from);
  const today = base.getDay();
  let delta = (target - today + 7) % 7;
  if (delta === 0) delta = 7; // "monday" means the *next* Monday, not today
  base.setDate(base.getDate() + delta);
  return atTime(base, hour, minute);
}

export function parseSnooze(input: string, now: Date = new Date()): SnoozeParseResult {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const nowSec = Math.floor(now.getTime() / 1000);

  // "in <n> <unit>"
  const inRe = /^in\s+(\d+)\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)?$/;
  const inM = raw.match(inRe);
  if (inM) {
    if (!inM[1]) return null;
    const n = parseInt(inM[1], 10);
    const unit = inM[2] ?? "minutes";
    const sec = unit.startsWith("w") ? 604800
      : unit.startsWith("d") ? 86400
      : unit.startsWith("h") ? 3600
      : 60;
    return { until: nowSec + n * sec, label: raw };
  }

  // "<n>h" / "<n>m" / "<n>d"
  const shortRe = /^(\d+)\s*([hmd])$/;
  const sm = raw.match(shortRe);
  if (sm) {
    if (!sm[1]) return null;
    const n = parseInt(sm[1], 10);
    const unit = sm[2];
    const sec = unit === "d" ? 86400 : unit === "h" ? 3600 : 60;
    return { until: nowSec + n * sec, label: raw };
  }

  // "tonight" / "this evening"
  if (/(tonight|this evening|this night)/.test(raw)) {
    const d = new Date(now);
    let target = atTime(d, 20, 0);
    if (target <= nowSec) target = atTime(new Date(d.getTime() + 86400000), 20, 0);
    return { until: target, label: "Tonight" };
  }

  // "tomorrow [h[:mm]][am|pm]"
  const tomRe = /^tomorrow\s*(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/;
  const tom = raw.match(tomRe);
  if (tom) {
    let h = parseInt(tom[1] ?? "9", 10);
    const m = tom[2] ? parseInt(tom[2], 10) : 0;
    const ap = tom[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const base = startOfDay(new Date(now.getTime() + 86400000));
    return { until: atTime(base, h, m), label: `Tomorrow ${h}:${m}` };
  }

  // "<weekday> [h[:mm]][am|pm]" or "next <weekday>"
  const wdRe = /^(?:next\s+)?(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat)(?:\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/;
  const wd = raw.match(wdRe);
  if (wd) {
    if (!wd[1]) return null;
    const day = WEEKDAYS[wd[1]] ?? 0;
    let h = wd[2] ? parseInt(wd[2], 10) : 9;
    const m = wd[3] ? parseInt(wd[3], 10) : 0;
    const ap = wd[4];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { until: nextWeekday(now, day, h, m), label: wd[1] };
  }

  // ISO date "2026-07-20" or "07/20" / "07/20/2026"
  const isoRe = /^(\d{4})-(\d{2})-(\d{2})$/;
  const iso = raw.match(isoRe);
  if (iso) {
    if (!iso[1] || !iso[2] || !iso[3]) return null;
    const y = parseInt(iso[1], 10), mo = parseInt(iso[2], 10) - 1, da = parseInt(iso[3], 10);
    const d = new Date(y, mo, da, 9, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return { until: Math.floor(d.getTime() / 1000), label: iso[0] };
  }
  const usRe = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;
  const us = raw.match(usRe);
  if (us) {
    if (!us[1] || !us[2]) return null;
    const mo = parseInt(us[1], 10) - 1, da = parseInt(us[2], 10);
    const y = us[3] ? parseInt(us[3], 10) : now.getFullYear();
    const d = new Date(y, mo, da, 9, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return { until: Math.floor(d.getTime() / 1000), label: us[0] };
  }

  return null;
}
