import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import {
  applyStatic,
  formatInterval,
  partName,
  partTip,
  randomCheer,
  randomFinalCheer,
  randomTitle,
  setLanguage,
  t,
} from "./i18n";
import { BODY_PART_IDS, HOLD_SECONDS, Settings, Stats, formatClock, normalizeParts } from "./shared";
import { startSparkles } from "./sparkles";

/**
 * A small square notification that closes on its own after `durationSeconds`,
 * unless the user has started stretching. Then it stays until they finish.
 *
 * Each row is just [checkbox] [body part]. Clicking the body part opens its
 * guide (accordion). The checkbox unlocks after the guide has been open for
 * HOLD_SECONDS; ticking it collapses the row back. Clicking anywhere on the
 * card that isn't a button opens the main app window.
 */
interface Item {
  id: string;
  heldMs: number; // time spent with the guide open
  done: boolean;
  el: HTMLLIElement;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const HOLD_MS = HOLD_SECONDS * 1000;
const IDLE_NUDGE_MS = 60_000; // shake if a started session sits idle for a minute
const FAIL_COOLDOWN_MS = 2_500; // lock "Complete" after a premature click
const NAG_MS = 3_000;

let items: Item[] = [];
let openItem: Item | null = null;
let intervalMinutes = 60;
let finalOfDay = false; // this completion reaches today's goal; the app quits afterwards
let lifetimeMs = 60_000;
let shownAt = Date.now();
let lastTick = Date.now();
let engaged = false; // opened a guide at least once, so auto-dismiss is off
let lastActivity = Date.now();
let cooldownUntil = 0;
let nag: { text: string; tone: "warn" | "ok"; until: number } | null = null;
let finished = false;

const ready = (i: Item) => !i.done && i.heldMs >= HOLD_MS;
const secsLeft = (i: Item) => Math.ceil((HOLD_MS - i.heldMs) / 1000);

function activity() {
  lastActivity = Date.now();
}

function say(text: string, tone: "warn" | "ok" = "warn", ms = NAG_MS) {
  nag = { text, tone, until: Date.now() + ms };
}

function wiggle(el: HTMLElement) {
  el.classList.remove("wiggle");
  void el.offsetWidth; // restart the animation
  el.classList.add("wiggle");
}

function setOpen(item: Item | null) {
  openItem = item;
  if (item && !item.done) engaged = true;
  for (const i of items) i.el.classList.toggle("open", i === item);
  item?.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function buildItem(id: string): Item {
  const li = document.createElement("li");
  li.className = "toast-item";
  li.innerHTML = `
    <div class="row">
      <button type="button" class="check">
        <svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">
          <path d="M2 6h2v2H2zM4 8h2v2H4zM6 6h2v2H6zM8 4h2v2H8zM10 2h1v2h-1z" />
        </svg>
      </button>
      <button type="button" class="part-name" aria-expanded="false"><span></span><b class="chev" aria-hidden="true">▸</b></button>
    </div>
    <div class="panel"><div class="panel-inner">
      <p class="tip"></p>
      <div class="hold"><div class="hold-bar"><span></span></div><span class="hold-label"></span></div>
    </div></div>`;
  li.querySelector(".check")!.setAttribute("aria-label", t("toast.mark", { name: partName(id) }));
  li.querySelector(".part-name span")!.textContent = partName(id);
  li.querySelector(".tip")!.textContent = partTip(id);

  const item: Item = { id, heldMs: 0, done: false, el: li };

  li.querySelector<HTMLButtonElement>(".part-name")!.addEventListener("click", () => {
    activity();
    setOpen(openItem === item ? null : item);
    render();
  });

  li.querySelector<HTMLButtonElement>(".check")!.addEventListener("click", () => {
    activity();
    if (item.done) return;
    if (ready(item)) {
      item.done = true;
      setOpen(null); // collapse back to the plain row
    } else {
      wiggle(li);
      if (openItem !== item) {
        setOpen(item);
        say(t("toast.holdFirst", { s: HOLD_SECONDS }));
      } else {
        say(t("toast.holdMore", { s: secsLeft(item) }));
      }
    }
    render();
  });

  return item;
}

function render() {
  const now = Date.now();

  for (const item of items) {
    const { el } = item;
    el.dataset.state = item.done ? "done" : ready(item) ? "ready" : "idle";
    el.querySelector(".part-name")!.setAttribute("aria-expanded", String(item === openItem));
    el.querySelector<HTMLSpanElement>(".hold-bar span")!.style.width =
      `${Math.min(1, item.heldMs / HOLD_MS) * 100}%`;
    el.querySelector(".hold-label")!.textContent = item.done
      ? t("toast.partDone")
      : ready(item)
        ? t("toast.tick")
        : t("toast.secs", { s: secsLeft(item) });
  }

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const left = Math.max(0, shownAt + lifetimeMs - now);

  const sub = $("toast-sub");
  if (nag && now < nag.until) {
    sub.textContent = nag.text;
    sub.className = `toast-sub ${nag.tone}`;
  } else {
    sub.textContent = engaged
      ? t("toast.engaged", { done, total })
      : t("toast.closes", { done, total, t: formatClock(left / 1000) });
    sub.className = "toast-sub";
  }

  const complete = $<HTMLButtonElement>("complete");
  const cooling = now < cooldownUntil;
  complete.classList.toggle("locked", done < total || cooling);
  complete.textContent = cooling
    ? t("toast.wait", { s: Math.ceil((cooldownUntil - now) / 1000) })
    : done < total
      ? `${t("toast.complete")} ${done}/${total}`
      : t("toast.complete");

  const bar = $("lifetime-bar");
  // Before starting: time left until auto-close. After starting: stretching progress, from 0.
  bar.style.width = engaged ? `${(done / total) * 100}%` : `${(left / lifetimeMs) * 100}%`;
  bar.classList.toggle("engaged", engaged);
}

function tick() {
  if (finished) return;
  const now = Date.now();
  const dt = now - lastTick;
  lastTick = now;

  // The hold only counts while that part's guide is open.
  if (openItem && !openItem.done && openItem.heldMs < HOLD_MS) {
    openItem.heldMs = Math.min(HOLD_MS, openItem.heldMs + dt);
    if (openItem.heldMs >= HOLD_MS) activity();
  }
  render();

  if (!engaged && now >= shownAt + lifetimeMs) {
    finished = true;
    invoke("dismiss_toast").catch(() => {});
    return;
  }

  if (engaged && now - lastActivity > IDLE_NUDGE_MS) {
    activity();
    say(t("toast.keepGoing"));
    invoke("nudge_toast").catch(() => {});
  }
}

function onComplete() {
  activity();
  if (finished || Date.now() < cooldownUntil) return;

  const left = items.filter((i) => !i.done);
  if (left.length) {
    cooldownUntil = Date.now() + FAIL_COOLDOWN_MS;
    const list = left.map((i) => partName(i.id)).join(", ");
    say(t("toast.notSoFast", { n: left.length, list }), "warn", 4000);
    invoke("nudge_toast").catch(() => {});
    render();
    return;
  }

  finished = true;
  $<HTMLButtonElement>("complete").disabled = true;
  showCelebration();
}

const CELEBRATE_MS = 5000; // the reward message closes itself after this long

/** Reward message over pixel sparkles; it closes itself and finishes the session. */
function showCelebration() {
  const cheer = finalOfDay ? randomFinalCheer() : randomCheer(formatInterval(intervalMinutes));
  $("cheer-title").textContent = cheer.title;
  $("cheer-body").textContent = cheer.body;

  const modal = $("celebrate");
  modal.hidden = false;
  $("card").classList.add("celebrating");
  const stop = startSparkles($<HTMLCanvasElement>("sparkles"));
  requestAnimationFrame(() => modal.classList.add("show"));

  setTimeout(() => {
    stop();
    invoke("complete_stretch").catch(() => {});
  }, CELEBRATE_MS);
}

async function init() {
  const [settings, stats] = await Promise.all([
    invoke<Settings | null>("get_settings"),
    invoke<Stats>("get_stats"),
  ]);
  finalOfDay = !!settings && stats.completed + 1 >= settings.goal;
  setLanguage(settings?.language ?? "en");
  applyStatic();
  $("toast-title").textContent = randomTitle();

  const ids = normalizeParts(settings?.bodyParts ?? []);

  intervalMinutes = settings?.intervalMinutes ?? 60;
  lifetimeMs = (settings?.durationSeconds ?? 20) * 1000;
  items = (ids.length ? ids : BODY_PART_IDS.slice(0, 2)).map(buildItem);
  $("list").replaceChildren(...items.map((i) => i.el));

  $("complete").addEventListener("click", onComplete);

  // Clicking the notification itself (anything on the card that isn't a button) opens the app.
  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("button") || target.closest(".celebrate") || !target.closest(".toast-card")) return;
    invoke("open_main").catch(() => {});
  });
  document.addEventListener("pointerdown", activity);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w")) {
      e.preventDefault();
    }
  });

  render();
  setInterval(tick, 100);
  requestAnimationFrame(() => {
    shownAt = lastTick = Date.now(); // countdown starts when it actually appears
    invoke("toast_ready").catch(() => {});
  });
}

init();
