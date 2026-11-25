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
      await q`CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC)`;
      await q`CREATE INDEX IF NOT EXISTS posts_ip_idx ON posts (ip_hash, created_at DESC)`;
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

// ---- helpers ----

export const KINDS = ["bug", "request", "review"];

export const LIMITS = {
  nickname: [1, 20],
  password: [4, 64],
  title: [1, 80],
  body: [1, 2000],
};

/** Trimmed string within [min, max] chars, or null. */
export function field(value, [min, max]) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= min && v.length <= max ? v : null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
