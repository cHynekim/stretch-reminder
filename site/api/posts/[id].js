// PATCH  /api/posts/:id  body { password }                → check the password only (before editing)
// PATCH  /api/posts/:id  body { password, title, body }   → edit a post
// DELETE /api/posts/:id  body { password }                → remove a post
// The author's password, or the admin token (env ADMIN_TOKEN), is accepted.
// 5 wrong passwords in a row from one IP → that IP is blocked for 24h (see LOCKOUT in lib/db.js).
import {
  BLOCKED_MESSAGE, LIMITS, LOCKOUT, blockedUntil, clearFailures, db, ensureSchema, field, ipHash, isAdmin, json,
  recordFailure, verifyPassword,
} from "../../lib/db.js";

/** Parse the id + body and check the password. Returns { id, input, q } or { error: Response }. */
async function authorize(request) {
  const id = Number(new URL(request.url).pathname.split("/").pop());
  if (!Number.isInteger(id) || id <= 0) return { error: json({ error: "잘못된 요청이에요." }, 400) };

  let input = {};
  try {
    input = await request.json();
  } catch {
    /* empty body */
  }
  const password = typeof input.password === "string" ? input.password : "";
  if (!password) return { error: json({ error: "비밀번호를 입력해 주세요." }, 400) };
  // Long enough for the admin token, short enough that hashing can't be abused to burn CPU.
  if (password.length > 128) return { error: json({ error: "비밀번호가 맞지 않아요." }, 400) };

  await ensureSchema();
  const q = db();
  const ip = ipHash(request);
  if (await blockedUntil(q, ip)) return { error: json({ error: BLOCKED_MESSAGE }, 429) };

  const [post] = await q`SELECT pw_hash FROM posts WHERE id = ${id} AND hidden = FALSE`;
  if (!post) return { error: json({ error: "이미 삭제된 글이에요." }, 404) };

  const allowed = isAdmin(password) || (await verifyPassword(password, post.pw_hash));
  if (!allowed) {
    const left = await recordFailure(q, ip);
    const error = left ? `비밀번호가 맞지 않아요. (${left}번 더 틀리면 ${LOCKOUT.hours}시간 동안 막혀요)` : BLOCKED_MESSAGE;
    return { error: json({ error }, left ? 403 : 429) };
  }
  await clearFailures(q, ip);
  return { id, input, q };
}

export async function PATCH(request) {
  try {
    const { error, id, input, q } = await authorize(request);
    if (error) return error;

    // Password check only (the page asks for it before showing the editor).
    if (input.title === undefined && input.body === undefined) return json({ ok: true });

    const title = field(input.title, LIMITS.title);
    const body = field(input.body, LIMITS.body);
    if (!title) return json({ error: "제목은 1~80자로 적어주세요." }, 400);
    if (!body) return json({ error: "내용은 1~2000자로 적어주세요." }, 400);

    const [post] = await q`
      UPDATE posts SET title = ${title}, body = ${body}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, kind, nickname, title, body, app_version, os, created_at, updated_at`;
    return json({ post });
  } catch (e) {
    console.error("PATCH /api/posts/:id", e);
    return json({ error: "글을 수정하지 못했어요." }, 500);
  }
}

export async function DELETE(request) {
  try {
    const { error, id, q } = await authorize(request);
    if (error) return error;
    await q`DELETE FROM posts WHERE id = ${id}`;
    return json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/posts/:id", e);
    return json({ error: "글을 삭제하지 못했어요." }, 500);
  }
}
