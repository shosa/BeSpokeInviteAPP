import { randomUUID } from "crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isEventType, type Catalog } from "@inviteme/shared";
import { pool } from "./db";
import { createAccessToken, currentUser, type SessionUser } from "./auth";
import { accessEmail, appUrl, sendMail } from "./mail";

// Bespoke Pro: area dei wedding planner. Uno studio è un utente con una riga in pro_studios: ha i suoi clienti
// (pro_clients) e crea per loro inviti e planner scalando i crediti. La console assegna i crediti a mano o con un
// piano mensile; ogni movimento resta in pro_ledger. La coppia può ricevere un accesso al suo invito e/o planner
// (pro_access), che lo studio può togliere: inviti e planner restano dello studio.

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Deps = {
  requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
  loadCatalog: () => Promise<Catalog>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
const validDate = (v: unknown): string | null => (typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00")) ? v : null);

const STUDIO_COLS = "user_id, name, active, inv_credits, pl_credits, monthly_inv, monthly_pl, renew_day, rollover, to_char(last_renewal, 'YYYY-MM-DD') AS last_renewal, created_at";

function studioJson(s: Row) {
  return {
    id: s.user_id,
    name: s.name,
    active: s.active,
    credits: { invitations: s.inv_credits, planners: s.pl_credits },
    plan: { invitations: s.monthly_inv, planners: s.monthly_pl, renewDay: s.renew_day, rollover: s.rollover },
    nextRenewal: nextRenewal(s),
    createdAt: s.created_at,
  };
}

// Prossimo rinnovo: il giorno di rinnovo di questo mese se non è ancora passato (o non è stato fatto), altrimenti del prossimo.
function nextRenewal(s: Row): string | null {
  if (!s.monthly_inv && !s.monthly_pl) return null;
  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), s.renew_day));
  const done = s.last_renewal && s.last_renewal >= thisMonth.toISOString().slice(0, 10);
  const d = done || now > thisMonth ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, s.renew_day)) : thisMonth;
  return d.toISOString().slice(0, 10);
}

// Ultima scadenza di rinnovo già passata (oggi compreso) per quel giorno del mese.
function lastDue(day: number): string {
  const now = new Date();
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  const d = now >= thisMonth ? thisMonth : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day));
  return d.toISOString().slice(0, 10);
}

// Rinnovo mensile: al giorno di rinnovo i crediti del piano si aggiungono (rollover) o sostituiscono quelli rimasti.
export async function runProRenewals(): Promise<number> {
  const { rows } = await pool.query(`SELECT ${STUDIO_COLS} FROM pro_studios WHERE active AND (monthly_inv > 0 OR monthly_pl > 0)`);
  const now = new Date();
  let n = 0;
  for (const s of rows) {
    const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), s.renew_day)).toISOString().slice(0, 10);
    if (now.toISOString().slice(0, 10) < due || (s.last_renewal && s.last_renewal >= due)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: cur } = await client.query("SELECT inv_credits, pl_credits, last_renewal FROM pro_studios WHERE user_id = $1 FOR UPDATE", [s.user_id]);
      if (!cur[0] || (cur[0].last_renewal && new Date(cur[0].last_renewal).toISOString().slice(0, 10) >= due)) { await client.query("ROLLBACK"); continue; }
      const inv = s.rollover ? cur[0].inv_credits + s.monthly_inv : s.monthly_inv;
      const pl = s.rollover ? cur[0].pl_credits + s.monthly_pl : s.monthly_pl;
      await client.query("UPDATE pro_studios SET inv_credits = $2, pl_credits = $3, last_renewal = $4 WHERE user_id = $1", [s.user_id, inv, pl, due]);
      const lost = s.rollover ? "" : cur[0].inv_credits || cur[0].pl_credits ? ` (non usati scaduti: ${cur[0].inv_credits} inviti, ${cur[0].pl_credits} planner)` : "";
      await client.query("INSERT INTO pro_ledger (studio_id, delta_inv, delta_pl, reason) VALUES ($1, $2, $3, $4)", [s.user_id, inv - cur[0].inv_credits, pl - cur[0].pl_credits, `Rinnovo mensile${lost}`]);
      await client.query("COMMIT");
      n++;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[pro] rinnovo non riuscito", s.user_id, e);
    } finally {
      client.release();
    }
  }
  return n;
}

// Utente esistente per email, o nuovo (senza password: entra con il link).
async function userForEmail(email: string, name: string): Promise<string> {
  const { rows } = await pool.query(
    "INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, '') ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
    [randomUUID(), email.toLowerCase(), name || email.split("@")[0]],
  );
  return rows[0].id;
}

export async function isStudio(userId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT 1 FROM pro_studios WHERE user_id = $1", [userId]);
  return rows.length > 0;
}

export function registerProRoutes(app: FastifyInstance, deps: Deps) {
  const { requireUser, requireAdmin } = deps;

  async function studioOf(req: FastifyRequest, reply: FastifyReply, write = false): Promise<Row | null> {
    const user = await requireUser(req, reply);
    if (!user) return null;
    const { rows } = await pool.query(`SELECT ${STUDIO_COLS} FROM pro_studios WHERE user_id = $1`, [user.id]);
    if (!rows[0]) { reply.code(403).send({ error: "Area riservata agli studi Bespoke Pro" }); return null; }
    if (write && !rows[0].active) { reply.code(403).send({ error: "Lo studio è sospeso: scrivi a Bespoke per riattivarlo" }); return null; }
    return rows[0];
  }

  async function clientOf(studioId: string, id: string): Promise<Row | null> {
    if (!UUID.test(id)) return null;
    const { rows } = await pool.query("SELECT *, to_char(event_date, 'YYYY-MM-DD') AS event_date FROM pro_clients WHERE id = $1 AND studio_id = $2", [id, studioId]);
    return rows[0] ?? null;
  }

  // Crea l'invito (un acquisto da attivare: lo studio sceglie il template come i clienti) e/o il planner di un cliente,
  // scalando i crediti nella stessa transazione.
  async function spend(studioId: string, c: Row, wants: { invitation: boolean; planner: boolean }, by: string | null) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const { rows } = await db.query("SELECT inv_credits, pl_credits FROM pro_studios WHERE user_id = $1 FOR UPDATE", [studioId]);
      const s = rows[0];
      if (wants.invitation && s.inv_credits < 1) throw new ProError("Crediti invito esauriti: chiedi a Bespoke di aggiungerne");
      if (wants.planner && s.pl_credits < 1) throw new ProError("Crediti planner esauriti: chiedi a Bespoke di aggiungerne");
      let orderId: string | null = null;
      let plannerId: string | null = null;
      if (wants.invitation) {
        orderId = `pro-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8)}`;
        const draft = { model: "invitation-rsvp", themeId: "", eventType: c.event_type, addons: [], tier: "rsvp", pro: true };
        await db.query(
          "INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, kind, draft, pro_client_id) VALUES ($1, $2, NULL, 0, 'EUR', 'shopify', 'paid', 'initial', $3, $4)",
          [orderId, studioId, JSON.stringify(draft), c.id],
        );
      }
      if (wants.planner) {
        plannerId = randomUUID();
        // Se il cliente ha già un invito, il planner nasce collegato.
        const { rows: inv } = await db.query("SELECT id FROM invitations WHERE pro_client_id = $1 AND NOT EXISTS (SELECT 1 FROM planners p WHERE p.invitation_id = invitations.id) ORDER BY created_at LIMIT 1", [c.id]);
        await db.query(
          "INSERT INTO planners (id, user_id, invitation_id, title, event_date, venue, address, data, event_type, pro_client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8, $9)",
          [plannerId, studioId, inv[0]?.id ?? null, c.name, c.event_date, c.venue, c.address, c.event_type, c.id],
        );
      }
      const dInv = wants.invitation ? -1 : 0;
      const dPl = wants.planner ? -1 : 0;
      if (dInv || dPl) {
        await db.query("UPDATE pro_studios SET inv_credits = inv_credits + $2, pl_credits = pl_credits + $3 WHERE user_id = $1", [studioId, dInv, dPl]);
        const what = [wants.invitation && "Invito", wants.planner && "planner"].filter(Boolean).join(" e ");
        await db.query("INSERT INTO pro_ledger (studio_id, delta_inv, delta_pl, reason, by_email, client_id) VALUES ($1, $2, $3, $4, $5, $6)", [studioId, dInv, dPl, `${what} · ${c.name}`, by, c.id]);
      }
      await db.query("COMMIT");
      return { orderId, plannerId };
    } catch (e) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      db.release();
    }
  }

  // ───────────── Area dello studio ─────────────

  app.get("/api/pro/me", async (req, reply) => {
    const s = await studioOf(req, reply);
    if (!s) return;
    const [{ rows: stats }, { rows: used }] = await Promise.all([
      pool.query(
        `SELECT (SELECT count(*)::int FROM pro_clients c WHERE c.studio_id = $1 AND NOT c.archived) AS clients,
                (SELECT count(*)::int FROM pro_clients c WHERE c.studio_id = $1 AND NOT c.archived AND (c.event_date IS NULL OR c.event_date >= current_date)) AS active,
                (SELECT count(*)::int FROM pro_clients c WHERE c.studio_id = $1 AND c.event_date BETWEEN current_date AND current_date + 30) AS next30,
                (SELECT count(*)::int FROM invitations i JOIN pro_clients c ON c.id = i.pro_client_id WHERE c.studio_id = $1 AND i.edit_count >= 1) AS online,
                (SELECT count(*)::int FROM rsvps r JOIN invitations i ON i.id = r.invitation_id JOIN pro_clients c ON c.id = i.pro_client_id WHERE c.studio_id = $1 AND r.created_at > now() - interval '7 days') AS rsvps7,
                (SELECT count(*)::int FROM orders o WHERE o.user_id = $1 AND o.pro_client_id IS NOT NULL AND o.invitation_id IS NULL) AS todo`,
        [s.user_id],
      ),
      pool.query(
        "SELECT COALESCE(-sum(delta_inv) FILTER (WHERE delta_inv < 0), 0)::int AS inv, COALESCE(-sum(delta_pl) FILTER (WHERE delta_pl < 0), 0)::int AS pl FROM pro_ledger WHERE studio_id = $1 AND created_at >= date_trunc('month', now()) AND client_id IS NOT NULL",
        [s.user_id],
      ),
    ]);
    return { ...studioJson(s), stats: stats[0], usedThisMonth: { invitations: used[0].inv, planners: used[0].pl } };
  });

  // Clienti con lo stato di invito, planner, risposte e accesso della coppia.
  app.get<{ Querystring: { q?: string } }>("/api/pro/clients", async (req, reply) => {
    const s = await studioOf(req, reply);
    if (!s) return;
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone, c.event_type, to_char(c.event_date, 'YYYY-MM-DD') AS event_date, c.venue, c.archived, c.created_at,
              i.id AS invitation_id, i.edit_count, i.config->>'themeId' AS theme_id,
              (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps,
              (SELECT p.id FROM planners p WHERE p.pro_client_id = c.id ORDER BY p.created_at LIMIT 1) AS planner_id,
              (SELECT COALESCE(sum(g.party_size), 0)::int FROM planner_guests g JOIN planners p ON p.id = g.planner_id WHERE p.pro_client_id = c.id) AS guests,
              (SELECT o.id FROM orders o WHERE o.pro_client_id = c.id AND o.invitation_id IS NULL LIMIT 1) AS pending_order,
              (SELECT count(*)::int FROM pro_access a WHERE a.client_id = c.id) AS access
       FROM pro_clients c
       LEFT JOIN LATERAL (SELECT * FROM invitations x WHERE x.pro_client_id = c.id ORDER BY x.created_at LIMIT 1) i ON true
       WHERE c.studio_id = $1
       ORDER BY c.archived, c.event_date NULLS LAST, c.created_at DESC`,
      [s.user_id],
    );
    return rows.map((r) => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone, eventType: r.event_type, eventDate: r.event_date ?? "", venue: r.venue, archived: r.archived,
      invitation: r.invitation_id ? { id: r.invitation_id, published: r.edit_count >= 1, themeId: r.theme_id ?? "", rsvps: r.rsvps } : null,
      pendingOrder: r.pending_order,
      plannerId: r.planner_id,
      guests: r.guests,
      access: r.access > 0,
    }));
  });

  app.post("/api/pro/clients", async (req, reply) => {
    const s = await studioOf(req, reply, true);
    if (!s) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = text(b.name, 120);
    if (!name) return reply.code(400).send({ error: "Scrivi il nome del cliente o dell'evento" });
    const email = text(b.email, 200);
    if (email && !EMAIL.test(email)) return reply.code(400).send({ error: "Email non valida" });
    if (b.eventDate && !validDate(b.eventDate)) return reply.code(400).send({ error: "Inserisci una data valida" });
    const id = randomUUID();
    const { rows } = await pool.query(
      "INSERT INTO pro_clients (id, studio_id, name, email, phone, event_type, event_date, venue, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *, to_char(event_date, 'YYYY-MM-DD') AS event_date",
      [id, s.user_id, name, email, text(b.phone, 40), isEventType(b.eventType) ? b.eventType : "wedding", validDate(b.eventDate), text(b.venue, 160), text(b.address, 200)],
    );
    try {
      const made = await spend(s.user_id, rows[0], { invitation: b.invitation === true, planner: b.planner === true }, (await currentUser(req))?.email ?? null);
      return reply.code(201).send({ id, ...made });
    } catch (e) {
      // Crediti finiti: il cliente resta, senza invito né planner; lo studio li aggiunge quando ha crediti.
      if (e instanceof ProError) return reply.code(409).send({ error: e.message, id });
      throw e;
    }
  });

  app.get<{ Params: { id: string } }>("/api/pro/clients/:id", async (req, reply) => {
    const s = await studioOf(req, reply);
    if (!s) return;
    const c = await clientOf(s.user_id, req.params.id);
    if (!c) return reply.code(404).send({ error: "Cliente non trovato" });
    const catalog = await deps.loadCatalog();
    const [inv, pl, pend, acc, log] = await Promise.all([
      pool.query("SELECT i.id, i.slug, i.edit_count, i.views, i.config->>'themeId' AS theme_id, (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps, (SELECT max(r.created_at) FROM rsvps r WHERE r.invitation_id = i.id) AS last_rsvp FROM invitations i WHERE i.pro_client_id = $1 ORDER BY i.created_at", [c.id]),
      pool.query(
        `SELECT p.id, (p.data->>'budgetCents')::bigint AS budget,
                (SELECT COALESCE(sum(b.amount_cents), 0)::bigint FROM planner_budget_items b WHERE b.planner_id = p.id) AS planned,
                (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id) AS tasks,
                (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id AND t.done) AS tasks_done,
                (SELECT count(*)::int FROM planner_tables t WHERE t.planner_id = p.id) AS tables,
                (SELECT COALESCE(sum(g.party_size), 0)::int FROM planner_guests g WHERE g.planner_id = p.id) AS guests
         FROM planners p WHERE p.pro_client_id = $1 ORDER BY p.created_at`,
        [c.id],
      ),
      pool.query("SELECT id FROM orders WHERE pro_client_id = $1 AND invitation_id IS NULL ORDER BY created_at", [c.id]),
      pool.query("SELECT u.email, a.can_invite, a.can_planner, a.sent_at, (SELECT max(s.expires_at) FROM sessions s WHERE s.user_id = u.id) AS session FROM pro_access a JOIN users u ON u.id = a.user_id WHERE a.client_id = $1 ORDER BY a.sent_at", [c.id]),
      pool.query("SELECT reason, delta_inv, delta_pl, created_at FROM pro_ledger WHERE client_id = $1 ORDER BY created_at DESC LIMIT 10", [c.id]),
    ]);
    const themeName = (id: string) => catalog.themes.find((t) => t.manifest.id === id)?.manifest.name ?? "";
    return {
      id: c.id, name: c.name, email: c.email, phone: c.phone, eventType: c.event_type, eventDate: c.event_date ?? "", venue: c.venue, address: c.address, notes: c.notes, archived: c.archived,
      invitations: inv.rows.map((r) => ({ id: r.id, slug: r.slug, published: r.edit_count >= 1, views: r.views, themeId: r.theme_id ?? "", themeName: themeName(r.theme_id ?? ""), rsvps: r.rsvps, lastRsvp: r.last_rsvp })),
      planners: pl.rows.map((r) => ({ id: r.id, budgetPct: Number(r.budget) > 0 ? Math.round((Number(r.planned) / Number(r.budget)) * 100) : null, tasks: r.tasks, tasksDone: r.tasks_done, tables: r.tables, guests: r.guests })),
      pendingOrders: pend.rows.map((r) => r.id),
      access: acc.rows.map((r) => ({ email: r.email, canInvite: r.can_invite, canPlanner: r.can_planner, sentAt: r.sent_at })),
      activity: log.rows.map((r) => ({ at: r.created_at, what: r.reason })),
      credits: { invitations: s.inv_credits, planners: s.pl_credits },
    };
  });

  app.patch<{ Params: { id: string } }>("/api/pro/clients/:id", async (req, reply) => {
    const s = await studioOf(req, reply, true);
    if (!s) return;
    const c = await clientOf(s.user_id, req.params.id);
    if (!c) return reply.code(404).send({ error: "Cliente non trovato" });
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.email !== undefined && text(b.email, 200) && !EMAIL.test(text(b.email, 200))) return reply.code(400).send({ error: "Email non valida" });
    if (b.eventDate !== undefined && b.eventDate !== "" && !validDate(b.eventDate)) return reply.code(400).send({ error: "Inserisci una data valida" });
    const name = b.name !== undefined ? text(b.name, 120) : c.name;
    if (!name) return reply.code(400).send({ error: "Il nome non può essere vuoto" });
    await pool.query(
      "UPDATE pro_clients SET name = $2, email = $3, phone = $4, event_type = $5, event_date = $6, venue = $7, address = $8, notes = $9, archived = $10 WHERE id = $1",
      [
        c.id, name,
        b.email !== undefined ? text(b.email, 200) : c.email,
        b.phone !== undefined ? text(b.phone, 40) : c.phone,
        isEventType(b.eventType) ? b.eventType : c.event_type,
        b.eventDate !== undefined ? validDate(b.eventDate) : c.event_date,
        b.venue !== undefined ? text(b.venue, 160) : c.venue,
        b.address !== undefined ? text(b.address, 200) : c.address,
        b.notes !== undefined ? text(b.notes, 4000) : c.notes,
        typeof b.archived === "boolean" ? b.archived : c.archived,
      ],
    );
    return { ok: true };
  });

  // Aggiunge invito o planner a un cliente esistente (un credito ciascuno).
  app.post<{ Params: { id: string } }>("/api/pro/clients/:id/create", async (req, reply) => {
    const s = await studioOf(req, reply, true);
    if (!s) return;
    const c = await clientOf(s.user_id, req.params.id);
    if (!c) return reply.code(404).send({ error: "Cliente non trovato" });
    const b = (req.body ?? {}) as { invitation?: unknown; planner?: unknown };
    if (b.invitation !== true && b.planner !== true) return reply.code(400).send({ error: "Scegli invito o planner" });
    try {
      return await spend(s.user_id, c, { invitation: b.invitation === true, planner: b.planner === true }, (await currentUser(req))?.email ?? null);
    } catch (e) {
      if (e instanceof ProError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });

  // Accesso della coppia: crea (o ritrova) l'utente con quell'email, salva i permessi e, se richiesto, manda il link.
  app.post<{ Params: { id: string } }>("/api/pro/clients/:id/access", async (req, reply) => {
    const s = await studioOf(req, reply, true);
    if (!s) return;
    const c = await clientOf(s.user_id, req.params.id);
    if (!c) return reply.code(404).send({ error: "Cliente non trovato" });
    const b = (req.body ?? {}) as { email?: unknown; canInvite?: unknown; canPlanner?: unknown; send?: unknown };
    const email = (text(b.email, 200) || c.email).toLowerCase();
    if (!EMAIL.test(email)) return reply.code(400).send({ error: "Serve l'email del cliente" });
    const userId = await userForEmail(email, c.name);
    if (userId === s.user_id) return reply.code(400).send({ error: "Questa è l'email dello studio" });
    await pool.query(
      `INSERT INTO pro_access (client_id, user_id, can_invite, can_planner) VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id, user_id) DO UPDATE SET can_invite = EXCLUDED.can_invite, can_planner = EXCLUDED.can_planner`,
      [c.id, userId, b.canInvite !== false, b.canPlanner !== false],
    );
    let mailed = false;
    let link: string | null = null;
    if (b.send === true) {
      const token = await createAccessToken(userId);
      link = `${appUrl()}/accesso/${token}`;
      mailed = await sendMail(accessEmail({ to: email, link, lang: req.cookies.lang === "en" ? "en" : "it" }), "other").then(() => true).catch(() => false);
      await pool.query("UPDATE pro_access SET sent_at = now() WHERE client_id = $1 AND user_id = $2", [c.id, userId]);
    }
    return { ok: true, mailed, link };
  });

  app.delete<{ Params: { id: string }; Querystring: { email?: string } }>("/api/pro/clients/:id/access", async (req, reply) => {
    const s = await studioOf(req, reply, true);
    if (!s) return;
    const c = await clientOf(s.user_id, req.params.id);
    if (!c) return reply.code(404).send({ error: "Cliente non trovato" });
    await pool.query("DELETE FROM pro_access a USING users u WHERE a.user_id = u.id AND a.client_id = $1 AND u.email = $2", [c.id, String(req.query.email ?? "").toLowerCase()]);
    return { ok: true };
  });

  app.get("/api/pro/ledger", async (req, reply) => {
    const s = await studioOf(req, reply);
    if (!s) return;
    const { rows } = await pool.query("SELECT reason, delta_inv, delta_pl, created_at FROM pro_ledger WHERE studio_id = $1 ORDER BY created_at DESC LIMIT 100", [s.user_id]);
    return rows.map((r) => ({ at: r.created_at, what: r.reason, invitations: r.delta_inv, planners: r.delta_pl }));
  });

  // ───────────── Console ─────────────

  app.get("/api/admin/pro", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query(
      `SELECT s.user_id, s.name, s.active, s.inv_credits, s.pl_credits, s.monthly_inv, s.monthly_pl, s.renew_day, s.rollover,
              to_char(s.last_renewal, 'YYYY-MM-DD') AS last_renewal, s.created_at, u.email,
              (SELECT count(*)::int FROM pro_clients c WHERE c.studio_id = s.user_id) AS clients
       FROM pro_studios s JOIN users u ON u.id = s.user_id ORDER BY s.active DESC, s.name`,
    );
    return rows.map((r) => ({ ...studioJson(r), email: r.email, clients: r.clients }));
  });

  app.get<{ Params: { id: string } }>("/api/admin/pro/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Studio non trovato" });
    const { rows } = await pool.query(`SELECT ${STUDIO_COLS} FROM pro_studios WHERE user_id = $1`, [req.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: "Studio non trovato" });
    const [u, cl, lg] = await Promise.all([
      pool.query("SELECT email FROM users WHERE id = $1", [req.params.id]),
      pool.query("SELECT count(*)::int AS n FROM pro_clients WHERE studio_id = $1", [req.params.id]),
      pool.query("SELECT reason, delta_inv, delta_pl, by_email, created_at FROM pro_ledger WHERE studio_id = $1 ORDER BY created_at DESC LIMIT 60", [req.params.id]),
    ]);
    return { ...studioJson(rows[0]), email: u.rows[0]?.email ?? "", clients: cl.rows[0].n, ledger: lg.rows.map((r) => ({ at: r.created_at, what: r.reason, invitations: r.delta_inv, planners: r.delta_pl, by: r.by_email })) };
  });

  // Nuovo studio: l'utente con quell'email (creato se non c'è) diventa uno studio Pro.
  app.post("/api/admin/pro", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const b = (req.body ?? {}) as { email?: unknown; name?: unknown; notify?: unknown };
    const email = text(b.email, 200).toLowerCase();
    const name = text(b.name, 120);
    if (!EMAIL.test(email)) return reply.code(400).send({ error: "Email non valida" });
    if (!name) return reply.code(400).send({ error: "Scrivi il nome dello studio" });
    const userId = await userForEmail(email, name);
    const { rowCount } = await pool.query("INSERT INTO pro_studios (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [userId, name]);
    if (!rowCount) return reply.code(409).send({ error: "Questo utente è già uno studio Pro" });
    let mailed = false;
    if (b.notify === true) {
      const token = await createAccessToken(userId);
      mailed = await sendMail(accessEmail({ to: email, link: `${appUrl()}/accesso/${token}`, lang: req.cookies.lang === "en" ? "en" : "it" }), "other").then(() => true).catch(() => false);
    }
    return reply.code(201).send({ id: userId, mailed });
  });

  app.patch<{ Params: { id: string } }>("/api/admin/pro/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Studio non trovato" });
    const { rows } = await pool.query(`SELECT ${STUDIO_COLS} FROM pro_studios WHERE user_id = $1`, [req.params.id]);
    const s = rows[0];
    if (!s) return reply.code(404).send({ error: "Studio non trovato" });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = b.name !== undefined ? text(b.name, 120) : s.name;
    if (!name) return reply.code(400).send({ error: "Il nome dello studio non può essere vuoto" });
    const plan = (b.plan ?? {}) as Record<string, unknown>;
    const monthlyInv = plan.invitations !== undefined ? int(plan.invitations, 0, 500) : s.monthly_inv;
    const monthlyPl = plan.planners !== undefined ? int(plan.planners, 0, 500) : s.monthly_pl;
    const renewDay = plan.renewDay !== undefined ? int(plan.renewDay, 1, 28) : s.renew_day;
    const rollover = typeof plan.rollover === "boolean" ? plan.rollover : s.rollover;
    // Attivando un piano i crediti del mese si aggiungono subito a quelli che lo studio ha già (senza toccare quelli
    // assegnati a mano); cambiando il giorno no. In entrambi i casi il prossimo rinnovo è la scadenza successiva.
    const activated = !s.monthly_inv && !s.monthly_pl && (monthlyInv > 0 || monthlyPl > 0);
    const restart = activated || renewDay !== s.renew_day;
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query(
        `UPDATE pro_studios SET name = $2, active = $3, monthly_inv = $4, monthly_pl = $5, renew_day = $6, rollover = $7${restart ? ", last_renewal = $8" : ""} WHERE user_id = $1`,
        [s.user_id, name, typeof b.active === "boolean" ? b.active : s.active, monthlyInv, monthlyPl, renewDay, rollover, ...(restart ? [lastDue(renewDay)] : [])],
      );
      if (activated) {
        await db.query("UPDATE pro_studios SET inv_credits = inv_credits + $2, pl_credits = pl_credits + $3 WHERE user_id = $1", [s.user_id, monthlyInv, monthlyPl]);
        await db.query("INSERT INTO pro_ledger (studio_id, delta_inv, delta_pl, reason, by_email) VALUES ($1, $2, $3, $4, $5)", [s.user_id, monthlyInv, monthlyPl, "Attivazione del piano mensile", (await currentUser(req))?.email ?? null]);
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      db.release();
    }
    return { ok: true };
  });

  // Crediti a mano: positivi o negativi, mai sotto zero.
  app.post<{ Params: { id: string } }>("/api/admin/pro/:id/credits", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Studio non trovato" });
    const b = (req.body ?? {}) as { invitations?: unknown; planners?: unknown; reason?: unknown };
    const dInv = int(b.invitations, -500, 500);
    const dPl = int(b.planners, -500, 500);
    if (!dInv && !dPl) return reply.code(400).send({ error: "Nessuna variazione" });
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const { rows } = await db.query("SELECT inv_credits, pl_credits FROM pro_studios WHERE user_id = $1 FOR UPDATE", [req.params.id]);
      if (!rows[0]) { await db.query("ROLLBACK"); return reply.code(404).send({ error: "Studio non trovato" }); }
      const inv = Math.max(0, rows[0].inv_credits + dInv);
      const pl = Math.max(0, rows[0].pl_credits + dPl);
      await db.query("UPDATE pro_studios SET inv_credits = $2, pl_credits = $3 WHERE user_id = $1", [req.params.id, inv, pl]);
      await db.query("INSERT INTO pro_ledger (studio_id, delta_inv, delta_pl, reason, by_email) VALUES ($1, $2, $3, $4, $5)", [
        req.params.id, inv - rows[0].inv_credits, pl - rows[0].pl_credits, text(b.reason, 160) || "Assegnati dalla console", (await currentUser(req))?.email ?? null,
      ]);
      await db.query("COMMIT");
      return { ok: true, credits: { invitations: inv, planners: pl } };
    } catch (e) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      db.release();
    }
  });

  // Rinnovi mensili: all'avvio e poi ogni ora.
  setTimeout(() => void runProRenewals().catch((e) => console.error("[pro] rinnovi", e)), 5_000);
  setInterval(() => void runProRenewals().catch((e) => console.error("[pro] rinnovi", e)), 3_600_000).unref();
}

class ProError extends Error {}
