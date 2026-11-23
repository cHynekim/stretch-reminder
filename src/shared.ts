export type ToastPosition = "right-top" | "right-bottom" | "middle";
export type Language = "en" | "ko";

/** Mirrors `Settings` in src-tauri/src/lib.rs (serde camelCase). */
export interface Settings {
  language: Language;
  bodyParts: string[];
  intervalMinutes: number;
  position: ToastPosition;
  durationSeconds: number;
}

/** Mirrors `Stats` in src-tauri/src/lib.rs. */
export interface Stats {
  completed: number;
  missed: number;
}

/** Body part ids, in display order. Names and tips live in i18n.ts. */
export const BODY_PART_IDS = [
  "neck",
  "shoulders",
  "upper-back",
  "lower-back",
  "chest",
  "wrists",
  "hips",
  "hamstrings",
  "calves",
] as const;
export type BodyPartId = (typeof BODY_PART_IDS)[number];

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
  return navigator.languages?.some((l) => l.toLowerCase().startsWith("ko")) ? "ko" : "en";
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  bodyParts: [],
  intervalMinutes: 60,
  position: "right-bottom",
  durationSeconds: 60,
};

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
