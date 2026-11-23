export type ToastPosition = "right-top" | "right-bottom" | "middle";

/** Mirrors `Settings` in src-tauri/src/lib.rs (serde camelCase). */
export interface Settings {
  bodyParts: string[];
  intervalMinutes: number;
  position: ToastPosition;
  durationSeconds: number;
}

export interface BodyPart {
  id: string;
  name: string;
  tip: string;
}

export const BODY_PARTS: BodyPart[] = [
  { id: "neck", name: "Neck", tip: "Tilt your ear toward your shoulder. Hold, then switch sides." },
  { id: "shoulders", name: "Shoulders", tip: "Roll your shoulders back 10 times, then pull each arm across your chest." },
  { id: "upper-back", name: "Upper back", tip: "Clasp your hands in front of you, round your back and push them away." },
  { id: "lower-back", name: "Lower back", tip: "Seated twist: hold the back of the chair and rotate gently. Do both sides." },
  { id: "chest", name: "Chest", tip: "Clasp your hands behind you, open your chest and lift your arms slightly." },
  { id: "wrists", name: "Wrists & forearms", tip: "Arm out, palm up. Gently pull your fingers back, then swap arms." },
  { id: "hips", name: "Hips", tip: "Stand and step into a lunge, then press your hips forward. Switch legs." },
  { id: "hamstrings", name: "Hamstrings", tip: "Put a heel on a low surface and hinge forward with a flat back." },
  { id: "calves", name: "Calves", tip: "Hands on a wall, one leg back. Press that heel into the floor." },
];

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

/** Hold time for each body part once the user starts stretching. */
export const HOLD_SECONDS = 20;

/** Mirrors `Stats` in src-tauri/src/lib.rs. */
export interface Stats {
  completed: number;
  missed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  bodyParts: [],
  intervalMinutes: 60,
  position: "right-bottom",
  durationSeconds: 60,
};

export function formatInterval(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
