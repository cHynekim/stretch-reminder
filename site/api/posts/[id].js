// DELETE /api/posts/:id  body { password }  → remove a post
// The author's password, or the admin token (env ADMIN_TOKEN), can delete it.
import { db, ensureSchema, isAdmin, json, verifyPassword } from "../../lib/db.js";

export async function DELETE(request) {
  try {
    const id = Number(new URL(request.url).pathname.split("/").pop());
    if (!Number.isInteger(id) || id <= 0) return json({ error: "잘못된 요청이에요." }, 400);

    let input = {};
    try {
      input = await request.json();
    } catch {
      /* empty body */
    }
    const password = typeof input.password === "string" ? input.password : "";
    if (!password) return json({ error: "비밀번호를 입력해 주세요." }, 400);

    await ensureSchema();
    const q = db();
    const [post] = await q`SELECT pw_hash FROM posts WHERE id = ${id} AND hidden = FALSE`;
    if (!post) return json({ error: "이미 삭제된 글이에요." }, 404);

    const allowed = isAdmin(password) || (await verifyPassword(password, post.pw_hash));
    if (!allowed) return json({ error: "비밀번호가 맞지 않아요." }, 403);

    await q`DELETE FROM posts WHERE id = ${id}`;
    return json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/posts/:id", e);
    return json({ error: "글을 삭제하지 못했어요." }, 500);
  }
}
