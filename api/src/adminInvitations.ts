import fs from "fs";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db";
import { MEDIA_DIR } from "./media";
import { loadAssistantSettings } from "./assistantSettings";
import { sessionsOf } from "./editActivity";

// Inviti dei clienti, dalla console admin: ricerca, dettaglio, riapertura della modifica, eliminazione.
// Ogni azione lascia una riga in events, così resta traccia di chi ha fatto cosa.

type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_NAME = /\/api\/media\/([0-9a-f-]{36}\.(?:jpg|png|mp4|mp3))/gi;
const PAGE = 50;

// Tutti i file pubblicati da un invito, letti dalla sua configurazione.
export function mediaNames(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    for (const m of value.matchAll(MEDIA_NAME)) out.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const v of value) mediaNames(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) mediaNames(v, out);
  }
  return out;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function registerAdminInvitations(app: FastifyInstance, requireAdmin: Guard) {
  app.get<{ Querystring: { q?: string; status?: string; model?: string; theme?: string; user?: string; offset?: string; activity?: string } }>(
    "/api/admin/invitations",
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;
      const f = req.query;
      const where: string[] = [];
      const args: unknown[] = [];
      const arg = (v: unknown) => {
        args.push(v);
        return `$${args.length}`;
      };
      const q = (f.q ?? "").trim();
      if (q) {
        const p = arg(`%${escapeLike(q)}%`);
        where.push(`(i.slug ILIKE ${p} OR coalesce(i.config->'event'->>'title', '') ILIKE ${p} OR u.email ILIKE ${p} OR i.id::text ILIKE ${p})`);
      }
      if (f.status === "paid" || f.status === "draft") where.push(`i.status = ${arg(f.status)}`);
      if (f.model) where.push(`i.config->>'model' = ${arg(f.model)}`);
      if (f.theme) where.push(`i.config->>'themeId' = ${arg(f.theme)}`);
      if (f.user && UUID.test(f.user)) where.push(`i.user_id = ${arg(f.user)}`);
      // Attività nell'editor: chi sta modificando ora, bozze non pubblicate, mai pubblicati, fermi da più di 7 giorni.
      if (f.activity === "live") where.push("i.editor_seen_at > now() - interval '90 seconds'");
      if (f.activity === "dirty") where.push("i.edit_count >= 1 AND i.config IS DISTINCT FROM i.published_config");
      if (f.activity === "never") where.push("i.status = 'paid' AND i.edit_count = 0");
      if (f.activity === "stale") where.push("i.status = 'paid' AND i.edit_count = 0 AND COALESCE(i.last_edit_at, i.created_at) < now() - interval '7 days'");
      const offset = Math.max(0, Math.floor(Number(f.offset) || 0));
      const sql = `
        SELECT i.id, i.slug, i.status, i.created_at, i.views, i.edit_count,
               i.config->>'model' AS model, i.config->>'themeId' AS theme,
               i.config->'event'->>'title' AS title, u.id AS user_id, u.email, u.name,
               (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps,
               jsonb_array_length(i.guests) AS guests,
               i.last_edit_at, i.last_published_at,
               (i.editor_seen_at > now() - interval '90 seconds') AS live,
               (i.edit_count >= 1 AND i.config IS DISTINCT FROM i.published_config) AS dirty,
               i.assistant_calls, i.assistant_bonus
        FROM invitations i JOIN users u ON u.id = i.user_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY ${f.activity ? "COALESCE(i.editor_seen_at, i.last_edit_at, i.created_at) DESC" : "i.created_at DESC"}
        LIMIT ${PAGE + 1} OFFSET ${offset}`;
      const { rows } = await pool.query(sql, args);
      // Richieste di BeSpoke AI: limite = quello delle impostazioni + le ricariche dell'invito.
      const base = (await loadAssistantSettings()).settings.callLimit;
      return { rows: rows.slice(0, PAGE).map((r) => ({ ...r, assistant_limit: base + (r.assistant_bonus ?? 0) })), hasMore: rows.length > PAGE, offset };
    },
  );

  app.get<{ Params: { id: string } }>("/api/admin/invitations/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Invito non trovato" });
    const { rows } = await pool.query(
      `SELECT i.id, i.slug, i.status, i.created_at, i.views, i.edit_count, i.config, i.guests, i.planner,
              i.assistant_calls, i.assistant_bonus, i.last_edit_at, i.last_published_at,
              (i.editor_seen_at > now() - interval '90 seconds') AS live, i.editor_seen_at,
              (i.edit_count >= 1 AND i.config IS DISTINCT FROM i.published_config) AS dirty,
              u.id AS user_id, u.email, u.name
       FROM invitations i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [req.params.id],
    );
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const rsvps = await pool.query(
      "SELECT id, answers, created_at FROM rsvps WHERE invitation_id = $1 ORDER BY created_at DESC LIMIT 200",
      [req.params.id],
    );
    const orders = await pool.query(
      "SELECT id, amount_cents, currency, source, status, created_at FROM orders WHERE invitation_id = $1 ORDER BY created_at DESC",
      [req.params.id],
    );
    const limit = (await loadAssistantSettings()).settings.callLimit + (inv.assistant_bonus ?? 0);
    const edits = await pool.query("SELECT kind, sections, created_at FROM invitation_edits WHERE invitation_id = $1 ORDER BY created_at DESC LIMIT 300", [req.params.id]);
    return { ...inv, assistant_limit: limit, rsvps: rsvps.rows, orders: orders.rows, sessions: sessionsOf(edits.rows).slice(0, 30) };
  });

  // Richieste di BeSpoke AI dell'invito (azzerare o impostare). Le modifiche all'invito sono illimitate: niente più «riapri».
  app.patch<{ Params: { id: string } }>("/api/admin/invitations/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Invito non trovato" });
    const body = (req.body ?? {}) as { reopenEdit?: boolean; assistantCalls?: unknown };
    // Richieste di BeSpoke AI usate: si possono azzerare o portare a un numero (anche oltre il limite, per provare la ricarica).
    if (typeof body.assistantCalls === "number" && Number.isInteger(body.assistantCalls) && body.assistantCalls >= 0 && body.assistantCalls <= 10_000) {
      const { rowCount } = await pool.query("UPDATE invitations SET assistant_calls = $2, assistant_asked = false, assistant_free_run = 0 WHERE id = $1", [req.params.id, body.assistantCalls]);
      if (!rowCount) return reply.code(404).send({ error: "Invito non trovato" });
      return { ok: true };
    }
    return reply.code(400).send({ error: "Azione non valida" });
  });

  // Elimina l'invito con i suoi RSVP. Serve lo slug come conferma. Le foto usate solo da questo invito vengono rimosse.
  app.delete<{ Params: { id: string }; Querystring: { confirm?: string } }>("/api/admin/invitations/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Invito non trovato" });
    const { rows } = await pool.query("SELECT slug, config FROM invitations WHERE id = $1", [req.params.id]);
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (req.query.confirm !== inv.slug) return reply.code(400).send({ error: "Per confermare scrivi lo slug dell'invito" });

    const removed: string[] = [];
    for (const name of mediaNames(inv.config)) {
      // Il file resta se un altro invito o un brano della libreria lo usa ancora.
      const shared = await pool.query(
        `SELECT 1 FROM invitations WHERE id <> $1 AND config::text LIKE $2
         UNION ALL SELECT 1 FROM music_tracks WHERE url = $3 LIMIT 1`,
        [req.params.id, `%${name}%`, `/api/media/${name}`],
      );
      if (shared.rowCount) continue;
      fs.rmSync(path.join(MEDIA_DIR, path.basename(name)), { force: true });
      removed.push(name);
    }
    await pool.query("DELETE FROM invitations WHERE id = $1", [req.params.id]);
    await pool.query("INSERT INTO events (type, invitation_id) VALUES ('admin_delete_invitation', NULL)");
    return { ok: true, removedFiles: removed.length };
  });
}
