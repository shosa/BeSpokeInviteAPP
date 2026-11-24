import os from "os";
import path from "path";
import fs from "fs";
import { pool } from "../../src/db";
import { hashToken } from "../../src/auth";

// Pool pg simulato per i test delle rotte: nessun database vero. Ogni query passa dal gestore del test,
// che restituisce le righe (o undefined: nessuna riga). Le transazioni (connect) usano lo stesso gestore.
export type Result = { rows?: Record<string, unknown>[]; rowCount?: number } | undefined;
export type Handler = (sql: string, params: unknown[]) => Result | Promise<Result>;

let handler: Handler = () => undefined;
export const queries: { sql: string; params: unknown[] }[] = [];

export function setHandler(h: Handler) {
  handler = h;
  queries.length = 0;
}

async function run(sql: unknown, params?: unknown[]) {
  const text = typeof sql === "string" ? sql : String((sql as { text?: string })?.text ?? "");
  const p = params ?? [];
  queries.push({ sql: text, params: p });
  const r = (await handler(text, p)) ?? {};
  const rows = r.rows ?? [];
  return { rows, rowCount: r.rowCount ?? rows.length };
}

(pool as unknown as { query: unknown }).query = run;
(pool as unknown as { connect: unknown }).connect = async () => ({ query: run, release: () => undefined });

process.env.LOG_LEVEL ??= "silent";

// Cartella dei file temporanea: buildApp crea MEDIA_DIR/tmp.
process.env.MEDIA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), "bespoke-test-media-"));

// Sessione finta: il cookie «tok-<id>» corrisponde all'utente indicato.
export const sessionCookie = (userId: string) => `inviteme_session=tok-${userId}`;
export function sessionUser(sql: string, params: unknown[], users: Record<string, { email: string; role?: string; name?: string }>): Result | null {
  if (!/FROM sessions s JOIN users u/.test(sql)) return null;
  for (const [id, u] of Object.entries(users)) {
    if (params[0] === hashToken(`tok-${id}`)) return { rows: [{ id, email: u.email, name: u.name ?? "Test", role: u.role ?? "user" }] };
  }
  return { rows: [] };
}

export const sql = (q: string) => q.replace(/\s+/g, " ").trim();
