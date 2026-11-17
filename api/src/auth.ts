import crypto from "crypto";
import { promisify } from "util";
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db";

export const SESSION_COOKIE = "inviteme_session";
const SESSION_DAYS = 30;
const ACCESS_DAYS = 365;
const isProd = process.env.NODE_ENV === "production";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// Password del cliente (facoltativa, in aggiunta al link): scrypt con sale casuale, formato «scrypt$sale$chiave» in base64.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, saltB64, keyB64] = String(stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export const PASSWORD_MIN = 8;
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

export type SessionUser = { id: string; email: string; name: string; role: "user" | "admin" };

// Crea una sessione e imposta il cookie httpOnly. Il database conserva solo l'hash del token.
export async function startSession(reply: FastifyReply, userId: string) {
  const token = randomToken();
  await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)", [
    hashToken(token),
    userId,
    String(SESSION_DAYS),
  ]);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

// Utente della richiesta corrente, o null.
export async function currentUser(req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

// Ruolo da ADMIN_EMAIL: chi ha quell'indirizzo è amministratore, gli altri no. Si applica a ogni accesso.
export const roleForEmail = (email: string): "user" | "admin" =>
  process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() ? "admin" : "user";

// Link personale del cliente: un token casuale, salvato solo come hash, con scadenza e revoca.
export async function createAccessToken(userId: string, days = ACCESS_DAYS): Promise<string> {
  const token = randomToken();
  await pool.query("INSERT INTO access_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)", [
    hashToken(token),
    userId,
    String(days),
  ]);
  return token;
}

// Utente del link, se il token è valido, non scaduto e non revocato.
export async function userForAccessToken(token: string): Promise<SessionUser | null> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role FROM access_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

// Metriche e pannello admin: richiedono ADMIN_TOKEN. Senza ADMIN_TOKEN, solo fuori produzione.
export function adminAllowed(req: FastifyRequest): boolean {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return !isProd;
  const auth = req.headers.authorization ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return crypto.timingSafeEqual(Buffer.from(hashToken(given)), Buffer.from(hashToken(configured)));
}
