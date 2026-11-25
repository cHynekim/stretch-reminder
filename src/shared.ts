export type ToastPosition = "right-top" | "right-bottom" | "middle";
export type Language = "en" | "ko";

/** Mirrors `Settings` in src-tauri/src/lib.rs (serde camelCase). */
export interface Settings {
  language: Language;
  bodyParts: string[];
  intervalMinutes: number;
  position: ToastPosition;
  durationSeconds: number;
  /** Stretches to complete today. Reaching it ends the day (the app quits). */
  goal: number;
  /** Local day ("YYYY-MM-DD") today's interval + goal were confirmed. Set by the backend. */
  planDay: string;
}

/** Mirrors `Stats` in src-tauri/src/lib.rs. Counts for today. */
export interface Stats {
  day: string;
  completed: number;
  missed: number;
  /** Outcomes in order: "c" = completed, "m" = missed. */
  events: string;
}

export const GOAL = { min: 1, max: 20, step: 1 };

/** End of the workday (6 PM, local time), used to suggest how many stretches still fit today. */
export const WORKDAY_END_HOUR = 18;

/** Default goal when the day's plan is made after 6 PM (or before 5 AM). */
export const LATE_DEFAULT_GOAL = 3;

/** Minutes from now until 6 PM today (0 after 6 PM, and before 5 AM, which still counts as last night). */
export function minutesUntilWorkdayEnd(now = new Date()): number {
  if (now.getHours() < DAY_START_HOUR) return 0;
  const end = new Date(now);
  end.setHours(WORKDAY_END_HOUR, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
}

/** How many stretches fit between now and 6 PM at this interval. */
export function maxStretchesToday(intervalMinutes: number, now = new Date()): number {
  return Math.floor(minutesUntilWorkdayEnd(now) / intervalMinutes);
}

/** e.g. 3725 → "01:02:05" */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * The app's day starts at 5 AM, not midnight, so working past midnight still counts as the
 * same day; the next day's plan is asked for after 5 AM. Must match DAY_START_HOUR in lib.rs.
 */
export const DAY_START_HOUR = 5;

/** The date the app's day belongs to (before 5 AM → still yesterday). */
export function appDate(now = new Date()): Date {
  return new Date(now.getTime() - DAY_START_HOUR * 60 * 60 * 1000);
}

/** The app's day as YYYY-MM-DD; the key the backend uses for the daily plan and stats. */
export function localDay(now = new Date()): string {
  const d = appDate(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Body part ids, in display order. Names and tips live in i18n.ts. */
export const BODY_PART_IDS = [
  "neck",
  "shoulders",
  "upper-back",
  "lower-back",
  "chest",
  "wrists",
  "arms",
  "lower-body",
] as const;
export type BodyPartId = (typeof BODY_PART_IDS)[number];

/** Ids from older versions, mapped to their current replacement. */
const LEGACY_PARTS: Record<string, BodyPartId> = {
  hips: "lower-body",
  hamstrings: "lower-body",
  calves: "lower-body",
};

/** Map legacy ids, drop unknown ones, de-duplicate, keep display order. */
export function normalizeParts(ids: string[]): BodyPartId[] {
  const wanted = new Set(ids.map((id) => LEGACY_PARTS[id] ?? id));
  return BODY_PART_IDS.filter((id) => wanted.has(id));
}

export const INTERVAL = { min: 15, max: 240, step: 15 };

/** How long the toast stays before auto-dismissing: 20s–1m in 10s steps, then 30s steps up to 7m. */
export const DURATION_STEPS: number[] = [
  20, 30, 40, 50, 60,
  ...Array.from({ length: 12 }, (_, i) => 90 + i * 30), // 90 … 420
];

export function stepDuration(current: number, dir: 1 | -1): number {
  const idx = DURATION_STEPS.findIndex((v) => v >= current);
  const i = idx === -1 ? DURATION_STEPS.length - 1 : idx;
  const next = Math.min(DURATION_STEPS.length - 1, Math.max(0, i + dir));
  return DURATION_STEPS[next];
}

/** How long each body part's guide must stay open before its checkbox unlocks. */
export const HOLD_SECONDS = 7;

/** Language to suggest on first launch, from the OS/browser locale. */
export function systemLanguage(): Language {
  return (navigator.language ?? "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  bodyParts: [],
  intervalMinutes: 60,
  position: "right-bottom",
  durationSeconds: 20,
  goal: 6,
  planDay: "",
};

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
