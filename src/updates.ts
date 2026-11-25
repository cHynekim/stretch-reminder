/**
 * In-app updates.
 *
 * On launch the settings window asks the updater plugin to read `latest.json` from the
 * community site (endpoint in tauri.conf.json). If a newer, correctly signed version exists,
 * an in-app toast offers: Update (download + install + restart), Later, or Skip this version.
 * No network / no site / no update → nothing happens.
 */
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { t } from "./i18n";

const SKIP_KEY = "skippedUpdateVersion"; // per-device convenience; safe to lose
const CHECK_DELAY_MS = 1500; // let the window settle first

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function skippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIP_KEY);
  } catch {
    return null;
  }
}

function skipVersion(version: string) {
  try {
    localStorage.setItem(SKIP_KEY, version);
  } catch {
    /* storage unavailable: the toast just comes back next launch */
  }
}

function show(el: HTMLElement) {
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
}

function hide(el: HTMLElement) {
  el.classList.remove("show");
  setTimeout(() => {
    if (!el.classList.contains("show")) el.hidden = true;
  }, 200);
}

function setBusy(text: string) {
  $("update-status").textContent = text;
  $("update-actions").hidden = true;
  $("update-status").hidden = false;
}

async function install(update: Update) {
  let total = 0;
  let received = 0;
  setBusy(t("update.downloading", { p: 0 }));
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") {
        received += event.data.chunkLength;
        const p = total ? Math.min(100, Math.round((received / total) * 100)) : 0;
        setBusy(t("update.downloading", { p }));
      }
      if (event.event === "Finished") setBusy(t("update.installing"));
    });
    // Windows: the installer closes the app itself. macOS: restart into the new version.
    await relaunch();
  } catch (e) {
    console.error("Update failed", e);
    $("update-status").hidden = true;
    $("update-actions").hidden = true;
    $("update-error").hidden = false;
  }
}

function present(update: Update) {
  const toast = $("update-toast");
  $("update-title").textContent = t("update.title", { v: update.version });
  $("update-body").textContent = update.body?.trim() || t("update.body");

  // Start screens (first run / daily plan): centred over a backdrop. Normal settings view: at the top.
  const centred = document.body.classList.contains("setup");
  const backdrop = $("update-backdrop");
  const close = () => {
    hide(toast);
    if (centred) hide(backdrop);
  };

  $("update-now").onclick = () => install(update);
  $("update-later").onclick = close;
  $("update-skip").onclick = () => {
    skipVersion(update.version);
    close();
  };
  $("update-site").onclick = () => invoke("open_community").catch(() => {});
  $("update-close").onclick = close;

  toast.classList.toggle("center", centred);
  if (centred) show(backdrop);
  show(toast);
}

/** Check once, a moment after launch. Fails silently (offline, site down, placeholder URL…). */
export function checkForUpdateSoon() {
  setTimeout(async () => {
    try {
      const update = await check();
      if (!update) return;
      if (skippedVersion() === update.version) return;
      present(update);
    } catch (e) {
      console.info("Update check skipped:", e);
    }
  }, CHECK_DELAY_MS);
}
