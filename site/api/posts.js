// GET  /api/posts?kind=bug&before=<id>  → newest posts (50 per page)
// POST /api/posts                       → create a post (nickname + password, no account)
import { KINDS, LIMITS, db, ensureSchema, field, hashPassword, ipHash, json } from "../lib/db.js";

const PAGE = 50;
const RATE = { posts: 3, minutes: 10 }; // max posts per IP per window

export async function GET(request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const kind = KINDS.includes(url.searchParams.get("kind")) ? url.searchParams.get("kind") : null;
    const before = Number(url.searchParams.get("before")) || null;
    const q = db();
    const rows = await q`
      SELECT id, kind, nickname, title, body, app_version, os, created_at
      FROM posts
      WHERE hidden = FALSE
        AND (${kind}::text IS NULL OR kind = ${kind})
        AND (${before}::bigint IS NULL OR id < ${before})
      ORDER BY id DESC
      LIMIT ${PAGE}`;
    return json({ posts: rows, more: rows.length === PAGE });
  } catch (e) {
    console.error("GET /api/posts", e);
    return json({ error: "게시글을 불러오지 못했어요." }, 500);
  }
}

export async function POST(request) {
  try {
    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "잘못된 요청이에요." }, 400);
    }

    // Honeypot: real users never see or fill this field.
    if (input.website) return json({ ok: true }, 201);

    const kind = KINDS.includes(input.kind) ? input.kind : null;
    const nickname = field(input.nickname, LIMITS.nickname);
    const password = field(input.password, LIMITS.password);
    const title = field(input.title, LIMITS.title);
    const body = field(input.body, LIMITS.body);
    if (!kind) return json({ error: "글 종류를 골라주세요." }, 400);
    if (!nickname) return json({ error: "닉네임은 1~20자로 적어주세요." }, 400);
    if (!password) return json({ error: "비밀번호는 4~64자로 적어주세요." }, 400);
    if (!title) return json({ error: "제목은 1~80자로 적어주세요." }, 400);
    if (!body) return json({ error: "내용은 1~2000자로 적어주세요." }, 400);
    const appVersion = field(input.appVersion ?? "", [0, 20]) || null;
    const os = field(input.os ?? "", [0, 20]) || null;

    await ensureSchema();
    const q = db();
    const ip = ipHash(request);
    const [{ count }] = await q`
      SELECT count(*)::int AS count FROM posts
      WHERE ip_hash = ${ip} AND created_at > now() - make_interval(mins => ${RATE.minutes})`;
    if (count >= RATE.posts) {
      return json({ error: `잠시 후 다시 시도해 주세요. (${RATE.minutes}분에 ${RATE.posts}개까지)` }, 429);
    }

    const pwHash = await hashPassword(password);
    const [post] = await q`
      INSERT INTO posts (kind, nickname, pw_hash, title, body, app_version, os, ip_hash)
      VALUES (${kind}, ${nickname}, ${pwHash}, ${title}, ${body}, ${appVersion}, ${os}, ${ip})
      RETURNING id, kind, nickname, title, body, app_version, os, created_at`;
    return json({ post }, 201);
  } catch (e) {
    console.error("POST /api/posts", e);
    return json({ error: "글을 저장하지 못했어요." }, 500);
  }
}
