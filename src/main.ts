import { invoke } from "@tauri-apps/api/core";
import {
  BODY_PARTS,
  DEFAULT_SETTINGS,
  INTERVAL,
  Settings,
  Stats,
  ToastPosition,
  formatClock,
  formatInterval,
  stepDuration,
} from "./shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings = { ...DEFAULT_SETTINGS };
let saved: Settings | null = null;
let firstRun = true;

function renderParts() {
  $("parts").replaceChildren(
    ...BODY_PARTS.map((part) => {
      const label = document.createElement("label");
      label.className = "part-option";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = settings.bodyParts.includes(part.id);
      box.addEventListener("change", () => {
        settings.bodyParts = BODY_PARTS.map((p) => p.id).filter((id) =>
          id === part.id ? box.checked : settings.bodyParts.includes(id),
        );
        renderSummary();
      });
      const name = document.createElement("span");
      name.textContent = part.name;
      label.append(box, name);
      return label;
    }),
  );
}

/** Stretch guide for the parts that are actually saved (what the notification will ask for). */
function renderGuide() {
  const parts = BODY_PARTS.filter((p) => saved?.bodyParts.includes(p.id));
  $("guide").replaceChildren(
    ...parts.map((p) => {
      const li = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = p.name;
      const tip = document.createElement("span");
      tip.className = "muted small";
      tip.textContent = p.tip;
      li.append(name, tip);
      return li;
    }),
  );
}

function renderSummary() {
  $("interval-value").textContent = formatInterval(settings.intervalMinutes);
  $("duration-value").textContent = formatClock(settings.durationSeconds);

  document.querySelectorAll<HTMLButtonElement>("#position button").forEach((b) => {
    const on = b.dataset.value === settings.position;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const save = $<HTMLButtonElement>("save");
  save.disabled = settings.bodyParts.length === 0 || (!firstRun && !dirty);
}

function applyMode() {
  for (const id of ["details", "adjust-heading", "advanced", "quit", "test", "status"]) {
    $(id).hidden = firstRun;
  }
  $("title").textContent = firstRun ? "Let's set up your stretch routine" : "Stretch Reminder";
  $("subtitle").textContent = firstRun
    ? "Pick what you want to stretch and how often. We'll let you know when it's time."
    : "Closing this window keeps reminders running in the menu bar.";
  $("save").textContent = firstRun ? "Start reminding me" : "Save changes";
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

  $("select-all").addEventListener("click", () => {
    settings.bodyParts = BODY_PARTS.map((p) => p.id);
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
      renderGuide();
      if (firstRun) {
        firstRun = false;
        applyMode();
        await invoke("hide_main");
      } else {
        setMessage("Saved. The countdown has restarted.");
      }
      renderSummary();
      refreshStatus();
    } catch (e) {
      setMessage(String(e), "error");
    }
  });

  $("test").addEventListener("click", () => {
    invoke("stretch_now").catch((e) => setMessage(String(e), "error"));
  });

  $("quit").addEventListener("click", () => {
    if (confirm("Quit Stretch Reminder? You won't get any more reminders until you open it again.")) {
      invoke("quit_app");
    }
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
      secs === null ? "Now" : secs >= 60 ? formatInterval(Math.ceil(secs / 60)) : `${secs}s`;
    $("stat-next").textContent = next;
    $("stat-done").textContent = String(stats.completed);
    $("stat-missed").textContent = String(stats.missed);
    $("status").textContent = secs === null ? "Time to stretch" : `Next in ${next}`;
    $("status").classList.toggle("live", secs === null);
  } catch {
    /* backend not ready yet */
  }
}

async function init() {
  saved = await invoke<Settings | null>("get_settings");
  firstRun = saved === null;
  if (saved) settings = { ...DEFAULT_SETTINGS, ...saved };

  renderParts();
  renderGuide();
  wireControls();
  applyMode();
  renderSummary();
  refreshStatus();
  setInterval(refreshStatus, 1000);
}

init();
