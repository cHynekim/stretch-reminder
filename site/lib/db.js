// Shared server code for the board API: DB access, schema, hashing, validation.
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

let sql = null;
let schemaReady = null;

/** Lazily create the client (DATABASE_URL comes from the Neon integration). */
export function db() {
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

/** Create the table once per function instance. */
export function ensureSchema() {
  if (!schemaReady) {
    const q = db();
    schemaReady = (async () => {
      await q`
        CREATE TABLE IF NOT EXISTS posts (
          id          BIGSERIAL PRIMARY KEY,
          kind        TEXT NOT NULL CHECK (kind IN ('bug', 'request', 'review')),
          nickname    TEXT NOT NULL,
          pw_hash     TEXT NOT NULL,
          title       TEXT NOT NULL,
          body        TEXT NOT NULL,
          app_version TEXT,
          os          TEXT,
          ip_hash     TEXT NOT NULL,
          hidden      BOOLEAN NOT NULL DEFAULT FALSE,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await q`ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;
      await q`CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC)`;
      await q`CREATE INDEX IF NOT EXISTS posts_ip_idx ON posts (ip_hash, created_at DESC)`;
      await q`
        CREATE TABLE IF NOT EXISTS pw_failures (
          ip_hash       TEXT PRIMARY KEY,
          fails         INT NOT NULL DEFAULT 0,
          blocked_until TIMESTAMPTZ
        )`;
    })().catch((e) => {
      schemaReady = null; // retry on the next request
      throw e;
    });
  }
  return schemaReady;
}

// ---- passwords (never stored in plain text) ----

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  const [algo, saltB64, keyB64] = String(stored).split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Admin token (env ADMIN_TOKEN) can delete any post. Constant-time compare. */
export function isAdmin(token) {
  const admin = process.env.ADMIN_TOKEN;
  if (!admin || !token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(admin);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- abuse protection ----

/** We only keep a salted hash of the IP, for rate limiting. */
export function ipHash(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update(`${process.env.IP_SALT || ""}:${ip}`).digest("hex");
}

/**
 * Wrong-password lockout: 5 wrong passwords in a row (edit/delete) blocks that IP from
 * editing, deleting and posting for LOCKOUT.hours. A correct password resets the count.
 */
export const LOCKOUT = { maxFails: 5, hours: 24 };

/** The block's end time if this IP is blocked now, else null (an expired block is cleared). */
export async function blockedUntil(q, ip) {
  const [row] = await q`SELECT blocked_until FROM pw_failures WHERE ip_hash = ${ip}`;
  if (!row?.blocked_until) return null;
  if (new Date(row.blocked_until) > new Date()) return new Date(row.blocked_until);
  await q`DELETE FROM pw_failures WHERE ip_hash = ${ip}`;
  return null;
}

/** Count one wrong password. Returns how many tries are left (0 = now blocked). */
export async function recordFailure(q, ip) {
  const [row] = await q`
    INSERT INTO pw_failures (ip_hash, fails) VALUES (${ip}, 1)
    ON CONFLICT (ip_hash) DO UPDATE SET fails = pw_failures.fails + 1
    RETURNING fails`;
  if (row.fails >= LOCKOUT.maxFails) {
    await q`
      UPDATE pw_failures SET blocked_until = now() + make_interval(hours => ${LOCKOUT.hours})
      WHERE ip_hash = ${ip}`;
    return 0;
  }
  return LOCKOUT.maxFails - row.fails;
}

export async function clearFailures(q, ip) {
  await q`DELETE FROM pw_failures WHERE ip_hash = ${ip}`;
}

export const BLOCKED_MESSAGE = `비밀번호를 ${LOCKOUT.maxFails}번 연속 틀려서 ${LOCKOUT.hours}시간 동안 글쓰기·수정·삭제가 막혔어요.`;

// ---- helpers ----

export const KINDS = ["bug", "request", "review"];

export const LIMITS = {
  nickname: [1, 20],
  password: [4, 12],
  title: [1, 80],
  body: [1, 2000],
};

// Invisible / control characters: C0/C1 controls (except tab and newline), zero-width chars and
// bidi overrides, which can be used to disguise text (e.g. make a title read backwards).
const UNSAFE_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Text shown on the page: unsafe characters removed, trimmed, within [min, max] chars, or null. */
export function field(value, [min, max]) {
  if (typeof value !== "string") return null;
  const v = value.replace(/\r\n?/g, "\n").replace(UNSAFE_CHARS, "").trim();
  return v.length >= min && v.length <= max ? v : null;
}

/** Password: used exactly as typed (no trimming), so hashing and checking always agree. */
export function secret(value, [min, max]) {
  if (typeof value !== "string") return null;
  return value.length >= min && value.length <= max ? value : null;
}

/** App info from the ?v=&os= link the app opens. Anything unexpected is dropped. */
export function appInfo(version, os) {
  const v = typeof version === "string" && /^\d{1,3}(\.\d{1,3}){1,3}$/.test(version) ? version : null;
  const o = ["macos", "windows", "linux"].includes(os) ? os : null;
  return { appVersion: v, os: o };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
