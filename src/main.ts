import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { applyStatic, formatDate, formatInterval, partName, setLanguage, t } from "./i18n";
import {
  BODY_PART_IDS,
  DEFAULT_SETTINGS,
  GOAL,
  INTERVAL,
  Language,
  Settings,
  Stats,
  ToastPosition,
  formatClock,
  formatHMS,
  localDay,
  maxStretchesToday,
  normalizeParts,
  stepDuration,
  systemLanguage,
} from "./shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * first:  never set up → body parts, schedule, language
 * daily:  set up, but today's interval + goal not confirmed yet → schedule only
 * normal: everything
 */
type Mode = "first" | "daily" | "normal";

let settings: Settings = { ...DEFAULT_SETTINGS };
let saved: Settings | null = null;
let mode: Mode = "first";

function computeMode(): Mode {
  if (!saved) return "first";
  return saved.planDay === localDay() ? "normal" : "daily";
}

function renderParts() {
  $("parts").replaceChildren(
    ...BODY_PART_IDS.map((id) => {
      const label = document.createElement("label");
      label.className = "part-option";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = settings.bodyParts.includes(id);
      box.addEventListener("change", () => {
        settings.bodyParts = BODY_PART_IDS.filter((p) =>
          p === id ? box.checked : settings.bodyParts.includes(p),
        );
        renderSummary();
      });
      const name = document.createElement("span");
      name.textContent = partName(id);
      label.append(box, name);
      return label;
    }),
  );
}

function renderSummary() {
  $("interval-value").textContent = formatInterval(settings.intervalMinutes);
  $("duration-value").textContent = formatClock(settings.durationSeconds);
  $("goal-value").textContent = t("goal.value", { n: settings.goal });
  renderGoalHint();

  for (const [group, value] of [
    ["position", settings.position],
    ["language", settings.language],
  ] as const) {
    document.querySelectorAll<HTMLButtonElement>(`#${group} button`).forEach((b) => {
      const on = b.dataset.value === value;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  $<HTMLButtonElement>("save").disabled =
    settings.bodyParts.length === 0 || (mode === "normal" && !dirty);
}

/** "From now until 6 PM, this interval fits up to N." Recomputed as the clock moves. */
function renderGoalHint() {
  const n = maxStretchesToday(settings.intervalMinutes);
  $("goal-hint").textContent = n > 0 ? t("goal.hint", { n }) : t("goal.hintLate");
}

/** Re-render every piece of text in the current language and mode. */
function renderLanguage() {
  setLanguage(settings.language);
  applyStatic();
  // Setup screens (first run, daily plan) get the centred, box-less start-screen look.
  document.body.classList.toggle("setup", mode !== "normal");

  const visible: Record<string, Mode[]> = {
    details: ["normal"],
    "parts-card": ["first", "normal"],
    advanced: ["normal"],
    "language-card": ["first", "normal"],
    quit: ["normal"],
    test: ["normal"],
  };
  for (const [id, modes] of Object.entries(visible)) $(id).hidden = !modes.includes(mode);

  const title = { first: "title.setup", daily: "title.daily", normal: "title.main" } as const;
  const subtitle = { first: "subtitle.setup", daily: "subtitle.daily", normal: "subtitle.main" } as const;
  const action = { first: "start", daily: "startDay", normal: "save" } as const;
  $("title").textContent = t(title[mode]);
  $("subtitle").textContent = t(subtitle[mode]);
  $("save").textContent = t(action[mode]);
  document.title = t("title.main");

  renderParts();
  renderSummary();
  refreshStatus();
}

function setMessage(text: string, tone: "ok" | "error" = "ok") {
  const el = $("message");
  el.textContent = text;
  el.className = `message ${tone}`;
}

function clamp(v: number, { min, max }: { min: number; max: number }) {
  return Math.min(max, Math.max(min, v));
}

function wireControls() {
  document.querySelectorAll<HTMLElement>("[data-stepper]").forEach((stepper) => {
    const kind = stepper.dataset.stepper;
    stepper.querySelectorAll<HTMLButtonElement>(".step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = Number(btn.dataset.dir) as 1 | -1;
        if (kind === "interval") {
          settings.intervalMinutes = clamp(settings.intervalMinutes + dir * INTERVAL.step, INTERVAL);
        } else if (kind === "goal") {
          settings.goal = clamp(settings.goal + dir * GOAL.step, GOAL);
        } else {
          settings.durationSeconds = stepDuration(settings.durationSeconds, dir);
        }
        renderSummary();
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>("#position button").forEach((b) => {
    b.addEventListener("click", () => {
      settings.position = b.dataset.value as ToastPosition;
      renderSummary();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("#language button").forEach((b) => {
    b.addEventListener("click", () => {
      settings.language = b.dataset.value as Language;
      setMessage("");
      renderLanguage();
    });
  });

  $("select-all").addEventListener("click", () => {
    settings.bodyParts = [...BODY_PART_IDS];
    renderParts();
    renderSummary();
  });
  $("select-none").addEventListener("click", () => {
    settings.bodyParts = [];
    renderParts();
    renderSummary();
  });

  $("save").addEventListener("click", async () => {
    try {
      await invoke("save_settings", { settings });
      // The backend stamps today's date as the plan day.
      settings = { ...settings, planDay: localDay() };
      saved = structuredClone(settings);
      const wasSetup = mode !== "normal";
      mode = "normal";
      renderLanguage();
      if (wasSetup) {
        await invoke("hide_main");
      } else {
        setMessage(t("saved"));
      }
    } catch (e) {
      setMessage(String(e), "error");
    }
  });

  $("test").addEventListener("click", () => {
    invoke("stretch_now").catch((e) => setMessage(String(e), "error"));
  });

  // Tauri webviews don't show window.confirm(), so confirm with an in-app toast.
  const quitToast = $("quit-toast");
  const closeQuitToast = () => {
    quitToast.classList.remove("show");
    setTimeout(() => {
      if (!quitToast.classList.contains("show")) quitToast.hidden = true;
    }, 200);
    $("quit").focus();
  };
  $("quit").addEventListener("click", () => {
    quitToast.hidden = false;
    requestAnimationFrame(() => quitToast.classList.add("show"));
    $("quit-cancel").focus();
  });
  $("quit-cancel").addEventListener("click", closeQuitToast);
  $("quit-confirm").addEventListener("click", () => invoke("quit_app"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !quitToast.hidden) closeQuitToast();
  });
}

/** Summary line under the countdown: done · missed · goal. */
function renderSummaryLine(stats: Stats, goal: number) {
  $("legend-done").textContent = t("legend.done", { n: stats.completed });
  $("legend-missed").textContent = t("legend.missed", { n: stats.missed });
  $("legend-goal").textContent = t("legend.goal", { n: goal });
}

/** Each new day starts from a 1-hour interval; the goal keeps yesterday's value if it still fits before 6 PM. */
function applyDailyDefaults() {
  settings.intervalMinutes = 60;
  const fits = maxStretchesToday(settings.intervalMinutes);
  if (fits > 0) settings.goal = clamp(settings.goal, { min: GOAL.min, max: fits });
}

async function refreshStatus() {
  renderGoalHint();
  // A new day may have started while the window was open.
  if (saved && mode === "normal" && computeMode() === "daily") {
    mode = "daily";
    applyDailyDefaults();
    renderLanguage();
    return;
  }
  if (mode !== "normal") return;
  $("today").textContent = formatDate(new Date());
  try {
    const [secs, stats] = await Promise.all([
      invoke<number | null>("seconds_until_next"),
      invoke<Stats>("get_stats"),
    ]);
    const countdown = $("countdown");
    countdown.textContent = secs === null ? t("stat.now") : formatHMS(secs);
    countdown.classList.toggle("live", secs === null);
    renderSummaryLine(stats, saved?.goal ?? settings.goal);
  } catch {
    /* backend not ready yet */
  }
}

async function init() {
  const loaded = await invoke<Settings | null>("get_settings");
  // Same key order as `settings`, so the unsaved-changes check can compare JSON.
  saved = loaded
    ? { ...DEFAULT_SETTINGS, ...loaded, bodyParts: normalizeParts(loaded.bodyParts) }
    : null;
  settings = saved ? structuredClone(saved) : { ...DEFAULT_SETTINGS, language: systemLanguage() };
  mode = computeMode();
  if (mode !== "normal") applyDailyDefaults();

  wireControls();
  renderLanguage();
  setInterval(refreshStatus, 1000);
}

init();
