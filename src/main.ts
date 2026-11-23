import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { hydrateSprites } from "./pixels";
import { applyStatic, formatInterval, partName, partTip, setLanguage, t } from "./i18n";
import {
  BODY_PART_IDS,
  DEFAULT_SETTINGS,
  INTERVAL,
  Language,
  Settings,
  Stats,
  ToastPosition,
  formatClock,
  stepDuration,
  systemLanguage,
} from "./shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings = { ...DEFAULT_SETTINGS };
let saved: Settings | null = null;
let firstRun = true;

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

/** Stretch guide for the parts that are actually saved (what the notification will ask for). */
function renderGuide() {
  const ids = BODY_PART_IDS.filter((id) => saved?.bodyParts.includes(id));
  $("guide").replaceChildren(
    ...ids.map((id) => {
      const li = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = partName(id);
      const tip = document.createElement("span");
      tip.className = "muted small";
      tip.textContent = partTip(id);
      li.append(name, tip);
      return li;
    }),
  );
}

function renderSummary() {
  $("interval-value").textContent = formatInterval(settings.intervalMinutes);
  $("duration-value").textContent = formatClock(settings.durationSeconds);

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
    settings.bodyParts.length === 0 || (!firstRun && !dirty);
}

/** Re-render every piece of text in the current language. */
function renderLanguage() {
  setLanguage(settings.language);
  applyStatic();
  for (const id of ["details", "adjust-heading", "advanced", "quit", "test", "status"]) {
    $(id).hidden = firstRun;
  }
  $("title").textContent = t(firstRun ? "title.setup" : "title.main");
  $("subtitle").textContent = t(firstRun ? "subtitle.setup" : "subtitle.main");
  $("save").textContent = t(firstRun ? "start" : "save");
  document.title = t("title.main");
  renderParts();
  renderGuide();
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
      saved = structuredClone(settings);
      if (firstRun) {
        firstRun = false;
        renderLanguage();
        await invoke("hide_main");
      } else {
        renderGuide();
        renderSummary();
        setMessage(t("saved"));
      }
      refreshStatus();
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

async function refreshStatus() {
  if (firstRun) return;
  try {
    const [secs, stats] = await Promise.all([
      invoke<number | null>("seconds_until_next"),
      invoke<Stats>("get_stats"),
    ]);
    const next =
      secs === null
        ? t("stat.now")
        : secs >= 60
          ? formatInterval(Math.ceil(secs / 60))
          : formatClock(secs);
    $("stat-next").textContent = next;
    $("stat-done").textContent = String(stats.completed);
    $("stat-missed").textContent = String(stats.missed);
    $("status").textContent = secs === null ? t("status.now") : t("status.next", { t: next });
    $("status").classList.toggle("live", secs === null);
  } catch {
    /* backend not ready yet */
  }
}

async function init() {
  const loaded = await invoke<Settings | null>("get_settings");
  firstRun = loaded === null;
  // Same key order as `settings`, so the unsaved-changes check can compare JSON.
  saved = loaded ? { ...DEFAULT_SETTINGS, ...loaded } : null;
  settings = saved ? structuredClone(saved) : { ...DEFAULT_SETTINGS, language: systemLanguage() };

  hydrateSprites();
  wireControls();
  renderLanguage();
  setInterval(refreshStatus, 1000);
}

init();
