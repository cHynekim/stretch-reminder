const $ = (id) => document.getElementById(id);
const KIND_LABEL = { bug: "🐞 버그", request: "💡 요청", review: "⭐ 리뷰" };

// Opened from the app: ?v=0.1.1&os=macos (attached to new posts)
const params = new URLSearchParams(location.search);
const appVersion = params.get("v") || "";
const appOs = params.get("os") || "";

/* ---------------- 다운로드 ---------------- */

// Installers are built by GitHub Actions and attached to GitHub Releases.
const RELEASES_API = "https://api.github.com/repos/cHynekim/stretch-reminder/releases/latest";

const FILES = {
  macArm: { match: /_aarch64\.dmg$/, label: "Mac용 다운로드", note: "Apple Silicon (M1 이상)" },
  macIntel: { match: /_x64\.dmg$/, label: "Intel Mac용", note: "Intel Mac" },
  windows: { match: /_x64-setup\.exe$/, label: "Windows용 다운로드", note: "Windows 10/11 (64비트)" },
};

function detectOs() {
  return /Windows/i.test(navigator.userAgent) ? "windows" : "mac";
}

/** RELEASE_NOTES.md has <!-- ko --> / <!-- en --> sections; the site is Korean-only. */
function koreanNotes(body) {
  const text = (body || "").trim();
  const ko = text.match(/<!--\s*ko\s*-->([\s\S]*?)(?=<!--\s*(?:ko|en)\s*-->|$)/);
  return (ko ? ko[1] : text.replace(/<!--[\s\S]*?-->/g, "")).trim();
}

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
    for (const [key, spec] of Object.entries(FILES)) {
      if (spec.match.test(asset.name)) files[key] = { url: asset.browser_download_url, size: asset.size };
    }
  }
  if (!files.macArm && !files.macIntel && !files.windows) {
    $("release-empty").hidden = false;
    return;
  }

  const primaryKey =
    detectOs() === "windows" && files.windows ? "windows" : files.macArm ? "macArm" : files.windows ? "windows" : "macIntel";
  const primary = files[primaryKey];
  const version = release.tag_name.replace(/^v/, "");
  const date = new Date(release.published_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  $("primary-dl").href = primary.url;
  $("primary-dl").textContent = `⬇ ${FILES[primaryKey].label}`;
  $("release-meta").textContent = `버전 ${version} · ${date} · ${sizeText(primary.size)} · ${FILES[primaryKey].note}`;

  // The other downloads, as small links
  const others = Object.keys(FILES).filter((k) => k !== primaryKey && files[k]);
  const holder = $("other-dl").parentElement;
  holder.replaceChildren(
    ...others.flatMap((k, i) => {
      const a = document.createElement("a");
      a.href = files[k].url;
      a.textContent = `${k === "macArm" ? "Mac(Apple Silicon)용" : FILES[k].label.replace(" 다운로드", "")} (${sizeText(files[k].size)})`;
      return i ? [document.createTextNode(" · "), a] : [a];
    }),
  );
  holder.hidden = others.length === 0;

  $("release-notes").textContent = koreanNotes(release.body);
  $("release").hidden = false;
}

/* ---------------- 게시판 ---------------- */

let kind = "";
let lastId = null;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderPost(p) {
  const li = document.createElement("li");
  li.className = "card post";

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
  const who = document.createElement("span");
  const env = [p.app_version && `v${p.app_version}`, p.os].filter(Boolean).join(" · ");
  who.textContent = `${p.nickname} · ${formatDate(p.created_at)}${env ? ` · ${env}` : ""}`;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.textContent = "삭제";
  del.addEventListener("click", () => showDeleteForm(li, p.id, del));
  meta.append(who, del);

  li.append(head, body, meta);
  return li;
}

function showDeleteForm(li, id, delButton) {
  if (li.querySelector(".del-form")) return;
  const form = document.createElement("form");
  form.className = "del-form";
  const pw = document.createElement("input");
  pw.type = "password";
  pw.placeholder = "글 비밀번호";
  pw.required = true;
  const ok = document.createElement("button");
  ok.className = "btn primary";
  ok.textContent = "삭제하기";
  form.append(pw, ok);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ok.disabled = true;
    const res = await fetch(`/api/posts/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw.value }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) {
      li.remove();
      if (!$("posts").children.length) $("posts-empty").hidden = false;
    } else {
      ok.disabled = false;
      pw.value = "";
      pw.placeholder = data?.error || "삭제하지 못했어요";
    }
  });
  li.append(form);
  delButton.hidden = true;
  pw.focus();
}

async function loadPosts(reset) {
  if (reset) {
    lastId = null;
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
  $("write-toggle").addEventListener("click", () => {
    const form = $("write");
    form.hidden = !form.hidden;
    $("write-toggle").textContent = form.hidden ? "글쓰기" : "닫기";
    if (!form.hidden) form.nickname.focus();
  });

  if (appVersion || appOs) {
    $("env-note").textContent = `앱 정보(${[appVersion && `v${appVersion}`, appOs].filter(Boolean).join(" · ")})가 함께 등록돼요.`;
  }

  $("write").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $("form-msg");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    msg.className = "form-msg";
    msg.textContent = "등록 중…";
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
      msg.textContent = "등록했어요. 고마워요!";
      if (!kind || kind === payload.kind) {
        $("posts").prepend(renderPost(data.post));
        $("posts-empty").hidden = true;
      }
    } catch (err) {
      msg.className = "form-msg error";
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
