const $ = (id) => document.getElementById(id);
const KIND_LABEL = { bug: "🐞 버그", request: "💡 요청", review: "⭐ 리뷰" };
const BODY_PLACEHOLDER = {
  bug: "어떤 상황에서 버그가 발생했는지 알려주시면 큰 도움이 돼요.",
  request: "원하는 기능 또는 기능 수정이 있다면 알려주세요.",
  review: "사용하시면서 불편한 점 또는 좋은 점을 자유롭게 적어주세요. (칭찬은 개발자를 춤 추게 해요!)",
};

const ICON = {
  pen: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

// Opened from the app: ?v=0.1.1&os=macos (attached to new posts)
const params = new URLSearchParams(location.search);
const appVersion = params.get("v") || "";
const appOs = params.get("os") || "";

/* ---------------- TEMP (dev): 라이트/다크 토글 ---------------- */

const THEME_KEY = "theme";
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
try {
  applyTheme(localStorage.getItem(THEME_KEY));
} catch {
  /* storage unavailable: follow the OS */
}
$("theme-toggle").addEventListener("click", () => {
  const current =
    document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
});

/* ---------------- 안내 토스트 ---------------- */

let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------------- 다운로드 ---------------- */

// Installers are built by GitHub Actions and attached to GitHub Releases.
const RELEASES_API = "https://api.github.com/repos/cHynekim/stretch-reminder/releases/latest";
const DOWNLOAD_PREFIX = "https://github.com/cHynekim/stretch-reminder/releases/download/";

const FILES = {
  macArm: /_aarch64\.dmg$/,
  macIntel: /_x64\.dmg$/,
  windows: /_x64-setup\.exe$/,
};

function sizeText(bytes) {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : "";
}

async function loadRelease() {
  let release = null;
  try {
    const res = await fetch(RELEASES_API, { headers: { accept: "application/vnd.github+json" } });
    if (res.ok) release = await res.json();
  } catch {
    /* no release yet / offline / rate-limited */
  }

  const files = {};
  for (const asset of release?.assets ?? []) {
    // Only ever link to this repo's own release files on GitHub.
    if (typeof asset.browser_download_url !== "string" || !asset.browser_download_url.startsWith(DOWNLOAD_PREFIX)) continue;
    for (const [key, match] of Object.entries(FILES)) {
      if (match.test(asset.name)) files[key] = { url: asset.browser_download_url, size: asset.size };
    }
  }
  if (!files.macArm && !files.macIntel && !files.windows) {
    $("release-empty").hidden = false;
    return;
  }

  const fill = (el, file) => {
    if (!file) return;
    el.href = file.url;
    el.querySelector(".size").textContent = sizeText(file.size);
    el.hidden = false;
  };
  fill($("dl-mac"), files.macArm);
  fill($("dl-win"), files.windows);

  if (files.macIntel) {
    $("dl-intel").href = files.macIntel.url;
    $("dl-intel").textContent = `Intel Mac용 (${sizeText(files.macIntel.size)})`;
    $("intel-line").hidden = false;
  }

  const version = release.tag_name.replace(/^v/, "");
  const date = new Date(release.published_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  $("release-meta").textContent = `버전 ${version} · ${date} · Mac은 Apple Silicon(M1 이상)용이에요`;
  $("release").hidden = false;
}

/* ---------------- 게시판 ---------------- */

let kind = "";
let lastId = null;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function iconButton(icon, label, extraClass = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `icon-btn ${extraClass}`.trim();
  b.innerHTML = ICON[icon]; // static SVG markup only
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}

function renderPost(p) {
  const li = document.createElement("li");
  li.className = "card post";
  li.dataset.id = p.id;

  const head = document.createElement("div");
  head.className = "post-head";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = KIND_LABEL[p.kind] ?? p.kind;
  const title = document.createElement("span");
  title.className = "post-title";
  title.textContent = p.title;
  head.append(badge, title);

  const body = document.createElement("p");
  body.className = "post-body";
  body.textContent = p.body;

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const env = [p.app_version && `v${p.app_version}`, p.os].filter(Boolean).join(" · ");
  meta.textContent = `${p.nickname} · ${formatDate(p.created_at)}${env ? ` · ${env}` : ""}${p.updated_at ? " · 수정됨" : ""}`;

  const actions = document.createElement("div");
  actions.className = "post-actions";
  const edit = iconButton("pen", "수정");
  const del = iconButton("x", "삭제", "danger");
  edit.addEventListener("click", () => openPasswordPop(li, p, "edit"));
  del.addEventListener("click", () => openPasswordPop(li, p, "delete"));
  actions.append(edit, del);

  li.append(actions, head, body, meta);
  return li;
}

/* 비밀번호 팝오버: 한 번에 하나만 */
let openPop = null;
function closePop() {
  openPop?.remove();
  openPop = null;
}
document.addEventListener("click", (e) => {
  if (openPop && !openPop.contains(e.target) && !e.target.closest(".post-actions")) closePop();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePop();
});

async function callPost(id, method, payload) {
  const res = await fetch(`/api/posts/${id}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) ?? {};
  return { ok: !!res?.ok, data };
}

function openPasswordPop(li, post, mode) {
  const same = openPop && openPop.parentElement === li && openPop.dataset.mode === mode;
  closePop();
  if (same) return; // clicking the same icon again closes it

  const form = document.createElement("form");
  form.className = "pw-pop";
  form.dataset.mode = mode;
  const label = document.createElement("span");
  label.className = "pw-label";
  label.textContent = mode === "edit" ? "글 비밀번호를 입력하면 수정할 수 있어요" : "글 비밀번호를 입력하면 삭제돼요";
  const row = document.createElement("div");
  row.className = "pw-row";
  const pw = document.createElement("input");
  pw.type = "password";
  pw.placeholder = "비밀번호";
  pw.required = true;
  pw.autocomplete = "current-password";
  const ok = document.createElement("button");
  ok.type = "submit";
  ok.className = `btn small ${mode === "edit" ? "primary" : "danger"}`;
  ok.textContent = mode === "edit" ? "확인" : "삭제";
  row.append(pw, ok);
  const error = document.createElement("span");
  error.className = "pw-error";
  error.hidden = true;
  form.append(label, row, error);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ok.disabled = true;
    error.hidden = true;
    // Edit: password-only PATCH just checks it; the save sends it again.
    const { ok: success, data } = await callPost(post.id, mode === "edit" ? "PATCH" : "DELETE", { password: pw.value });
    if (success) {
      closePop();
      if (mode === "edit") startEdit(li, post, pw.value);
      else {
        li.remove();
        if (!$("posts").children.length) $("posts-empty").hidden = false;
        toast("삭제했어요.");
      }
    } else {
      ok.disabled = false;
      pw.value = "";
      pw.focus();
      error.textContent = data.error || "잠시 후 다시 시도해 주세요.";
      error.hidden = false;
    }
  });

  li.append(form);
  openPop = form;
  pw.focus();
}

function startEdit(li, post, password) {
  const title = document.createElement("input");
  title.maxLength = 80;
  title.value = post.title;
  const body = document.createElement("textarea");
  body.maxLength = 2000;
  body.rows = 5;
  body.value = post.body;
  const msg = document.createElement("p");
  msg.className = "form-msg";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn small secondary";
  cancel.textContent = "취소";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn small primary";
  save.textContent = "저장";
  const foot = document.createElement("div");
  foot.className = "edit-foot";
  foot.append(msg, cancel, save);

  const form = document.createElement("form");
  form.className = "edit";
  form.append(title, body, foot);

  const original = [...li.children];
  li.replaceChildren(form);
  title.focus();

  cancel.addEventListener("click", () => li.replaceChildren(...original));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    save.disabled = true;
    msg.textContent = "";
    const { ok, data } = await callPost(post.id, "PATCH", { password, title: title.value, body: body.value });
    if (ok) {
      li.replaceWith(renderPost(data.post));
      toast("수정했어요.");
    } else {
      save.disabled = false;
      msg.textContent = data.error || "수정하지 못했어요.";
    }
  });
}

async function loadPosts(reset) {
  if (reset) {
    lastId = null;
    closePop();
    $("posts").replaceChildren();
  }
  const url = new URL("/api/posts", location.origin);
  if (kind) url.searchParams.set("kind", kind);
  if (lastId) url.searchParams.set("before", lastId);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    for (const p of data.posts) $("posts").append(renderPost(p));
    if (data.posts.length) lastId = data.posts[data.posts.length - 1].id;
    $("more").hidden = !data.more;
    $("posts-empty").hidden = $("posts").children.length > 0;
  } catch {
    $("posts-empty").hidden = false;
    $("posts-empty").textContent = "게시글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

function wireBoard() {
  const form = $("write");
  const setPlaceholder = () => (form.body.placeholder = BODY_PLACEHOLDER[form.kind.value] ?? "");
  setPlaceholder();
  form.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener("change", setPlaceholder));

  const openForm = () => {
    form.hidden = false;
    $("write-toggle").hidden = true;
    form.nickname.focus();
  };
  const closeForm = () => {
    form.hidden = true;
    $("form-msg").textContent = "";
    $("write-toggle").hidden = false;
  };
  $("write-toggle").addEventListener("click", openForm);
  $("write-close").addEventListener("click", closeForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("form-msg");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    msg.textContent = "";
    const payload = Object.fromEntries(new FormData(form));
    payload.appVersion = appVersion;
    payload.os = appOs;
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "등록하지 못했어요.");
      form.title.value = "";
      form.body.value = "";
      closeForm();
      toast("등록 성공! 귀중한 시간 감사드립니다.");
      if (data.post && (!kind || kind === payload.kind)) {
        $("posts").prepend(renderPost(data.post));
        $("posts-empty").hidden = true;
      }
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
      kind = b.dataset.kind;
      loadPosts(true);
    }),
  );
  $("more").addEventListener("click", () => loadPosts(false));
}

loadRelease();
wireBoard();
loadPosts(true);
