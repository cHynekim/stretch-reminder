import { invoke } from "@tauri-apps/api/core";
import { BODY_PARTS, BodyPart, HOLD_SECONDS, Settings, formatClock, formatInterval } from "./shared";

/**
 * The notification closes on its own after `durationSeconds`, unless the user
 * has started stretching. Then it stays until they finish.
 *
 * Each body part goes: idle → holding (timed) → ready (checkbox unlocks) → done.
 * "Complete" only works once every part is done. Clicking anywhere that isn't
 * a button opens the main app window.
 */
type PartState = "idle" | "holding" | "ready" | "done";

interface Item {
  part: BodyPart;
  state: PartState;
  holdEndsAt: number;
  el: HTMLLIElement;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HOLD_MS = HOLD_SECONDS * 1000;
const IDLE_NUDGE_MS = 60_000; // shake if a started session sits idle for a minute
const FAIL_COOLDOWN_MS = 3_000; // lock "Complete" after a premature click

let items: Item[] = [];
let intervalMinutes = 60;
let lifetimeMs = 60_000;
let shownAt = Date.now();
let engaged = false; // user pressed Start at least once, so auto-dismiss is off
let lastActivity = Date.now();
let cooldownUntil = 0;
let finished = false;

function activity() {
  lastActivity = Date.now();
}

function buildItem(part: BodyPart): Item {
  const li = document.createElement("li");
  li.className = "toast-item";
  li.innerHTML = `
    <button type="button" class="check" disabled aria-label="Mark ${part.name} as stretched">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </button>
    <div class="info">
      <div class="name"></div>
      <div class="tip"></div>
      <div class="bar"><span></span></div>
    </div>
    <button type="button" class="go"></button>`;
  li.querySelector(".name")!.textContent = part.name;
  li.querySelector(".tip")!.textContent = part.tip;

  const item: Item = { part, state: "idle", holdEndsAt: 0, el: li };

  li.querySelector<HTMLButtonElement>(".go")!.addEventListener("click", () => {
    activity();
    if (item.state !== "idle" || items.some((i) => i.state === "holding")) return;
    engaged = true;
    item.state = "holding";
    item.holdEndsAt = Date.now() + HOLD_MS;
    render();
  });

  li.querySelector<HTMLButtonElement>(".check")!.addEventListener("click", () => {
    activity();
    if (item.state === "ready") {
      item.state = "done";
      render();
    }
  });

  return item;
}

function render() {
  const now = Date.now();
  const someoneHolding = items.some((i) => i.state === "holding");

  for (const item of items) {
    const { el, state } = item;
    el.dataset.state = state;
    const go = el.querySelector<HTMLButtonElement>(".go")!;
    const check = el.querySelector<HTMLButtonElement>(".check")!;
    const bar = el.querySelector<HTMLSpanElement>(".bar span")!;

    check.disabled = state !== "ready";

    if (state === "idle") {
      go.hidden = false;
      go.disabled = someoneHolding;
      go.textContent = `Start ${HOLD_SECONDS}s`;
      bar.style.width = "0%";
    } else if (state === "holding") {
      const left = Math.max(0, item.holdEndsAt - now);
      go.hidden = false;
      go.disabled = true;
      go.textContent = `${Math.ceil(left / 1000)}s`;
      bar.style.width = `${(1 - left / HOLD_MS) * 100}%`;
    } else {
      go.hidden = true;
      bar.style.width = "100%";
    }
  }

  const done = items.filter((i) => i.state === "done").length;
  $("progress-count").textContent = `${done}/${items.length}`;
  $("ring").style.setProperty("--p", String(items.length ? done / items.length : 0));

  const complete = $<HTMLButtonElement>("complete");
  const cooling = now < cooldownUntil;
  complete.classList.toggle("locked", done < items.length || cooling);
  complete.textContent = cooling
    ? `Wait ${Math.ceil((cooldownUntil - now) / 1000)}s…`
    : done < items.length
      ? `Complete (${done}/${items.length})`
      : "Complete ✓";

  // Auto-dismiss countdown (frozen once the user starts stretching).
  const left = Math.max(0, shownAt + lifetimeMs - now);
  $("lifetime-bar").style.width = engaged ? "100%" : `${(left / lifetimeMs) * 100}%`;
  $("lifetime-bar").classList.toggle("engaged", engaged);
  $("hint").textContent = engaged
    ? "Click here to open the app · stays open until you finish"
    : `Click here to open the app · closes in ${formatClock(left / 1000)}`;
}

function tick() {
  if (finished) return;
  const now = Date.now();
  let changed = false;
  for (const item of items) {
    if (item.state === "holding" && now >= item.holdEndsAt) {
      item.state = "ready";
      changed = true;
    }
  }
  render();
  if (changed) activity();

  if (!engaged && now >= shownAt + lifetimeMs) {
    finished = true;
    invoke("dismiss_toast").catch(() => {});
    return;
  }

  if (engaged && now - lastActivity > IDLE_NUDGE_MS) {
    activity();
    setNag("You started, so finish! Keep stretching.", "warn");
    invoke("nudge_toast").catch(() => {});
  }
}

function setNag(text: string, tone: "warn" | "ok" | "" = "") {
  const nag = $("nag");
  nag.textContent = text;
  nag.className = `nag ${tone}`;
}

function rejectComplete(message: string) {
  cooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
  setNag(message, "warn");
  invoke("nudge_toast").catch(() => {});
  render();
}

function onComplete() {
  activity();
  if (finished || Date.now() < cooldownUntil) return;

  const notStarted = items.filter((i) => i.state === "idle");
  const holding = items.find((i) => i.state === "holding");
  const unchecked = items.filter((i) => i.state === "ready");

  if (notStarted.length || holding || unchecked.length) {
    let msg: string;
    if (holding) msg = `Not so fast! Keep holding your ${holding.part.name.toLowerCase()} stretch.`;
    else if (notStarted.length)
      msg = `Not so fast! Still to stretch: ${notStarted.map((i) => i.part.name).join(", ")}.`;
    else msg = `Tick off ${unchecked.map((i) => i.part.name).join(", ")} first.`;
    rejectComplete(msg);
    return;
  }

  finished = true;
  setNag(`Nice work! See you in ${formatInterval(intervalMinutes)}.`, "ok");
  $<HTMLButtonElement>("complete").disabled = true;
  setTimeout(() => invoke("complete_stretch").catch(() => {}), 1200);
}

async function init() {
  const settings = await invoke<Settings | null>("get_settings");
  const selected = new Set(settings?.bodyParts ?? []);
  const parts = BODY_PARTS.filter((p) => selected.has(p.id));
  const list = parts.length ? parts : BODY_PARTS.slice(0, 2);

  intervalMinutes = settings?.intervalMinutes ?? 60;
  lifetimeMs = (settings?.durationSeconds ?? 60) * 1000;
  items = list.map(buildItem);
  $("list").replaceChildren(...items.map((i) => i.el));
  $("toast-sub").textContent =
    `${items.length} part${items.length === 1 ? "" : "s"} · ${HOLD_SECONDS}s each. Hit Start, stretch, then tick it off.`;

  $("complete").addEventListener("click", onComplete);

  // Clicking the notification itself (anything that isn't a button) opens the app.
  document.addEventListener("click", (e) => {
    if ((e.target as Element).closest("button")) return;
    invoke("open_main").catch(() => {});
  });
  document.addEventListener("pointerdown", activity);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w")) {
      e.preventDefault();
    }
  });

  render();
  setInterval(tick, 200);
  requestAnimationFrame(() => {
    shownAt = Date.now(); // countdown starts when it actually appears
    invoke("toast_ready").catch(() => {});
  });
}

init();
