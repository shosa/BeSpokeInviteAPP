import { randomUUID } from "crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db";
import { createAccessToken, currentUser } from "./auth";
import { accessEmail, appUrl, purchaseEmail, sendMail } from "./mail";
import { getLastMailResult } from "./mailSettings";
import { getShopifyIds } from "./shopifySettings";

// Console admin: panoramica (cose da fare e attività, niente importi: quelli stanno su Shopify), scheda cliente,
// acquisti assegnati a mano, link di accesso, elenco planner, ricerca ovunque e uso dei template.

type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
type Deps = { requireAdmin: Guard; enabledThemeIds: () => Promise<{ id: string; name: string; enabled: boolean }[]> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
// Un acquisto è «da attivare» finché non ha né invito né planner.
const PENDING = "o.source = 'shopify' AND o.status = 'paid' AND o.invitation_id IS NULL AND o.planner_id IS NULL";
const GRANT_REASONS = ["omaggio", "sostituzione", "prova", "fuori-shopify"] as const;

export function registerAdminConsole(app: FastifyInstance, deps: Deps) {
  const { requireAdmin } = deps;

  app.get("/api/admin/overview", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const [counts, stale, recent, past] = await Promise.all([
      pool.query(`SELECT
          (SELECT count(*)::int FROM orders o WHERE ${PENDING}) AS pending,
          (SELECT count(*)::int FROM invitations WHERE status = 'paid' AND edit_count >= 1) AS live,
          (SELECT count(*)::int FROM invitations WHERE status = 'paid' AND edit_count = 0) AS in_progress,
          (SELECT count(*)::int FROM invitations WHERE edit_count >= 1 AND created_at > now() - interval '30 days') AS published_30,
          (SELECT count(*)::int FROM planners) AS planners,
          (SELECT count(*)::int FROM planners WHERE invitation_id IS NOT NULL) AS planners_linked,
          (SELECT count(*)::int FROM rsvps WHERE created_at > now() - interval '7 days') AS rsvps_7,
          (SELECT count(*)::int FROM users WHERE created_at > now() - interval '30 days') AS customers_30`),
      pool.query(`SELECT o.id, o.created_at, COALESCE(o.draft->>'product', 'invitation') AS product, u.id AS user_id, u.name, u.email
                  FROM orders o JOIN users u ON u.id = o.user_id
                  WHERE ${PENDING} AND o.created_at < now() - interval '3 days' ORDER BY o.created_at LIMIT 10`),
      // Attività recente: acquisti, pubblicazioni, planner e risposte, senza importi.
      pool.query(`(SELECT 'order' AS kind, o.created_at AS at, COALESCE(o.draft->>'product', 'invitation') AS detail, u.name AS who, u.id AS user_id, NULL::text AS ref
                    FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 8)
                  UNION ALL
                  (SELECT 'planner', p.created_at, p.title, u.name, u.id, p.id::text FROM planners p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 8)
                  UNION ALL
                  (SELECT 'rsvp', r.created_at, i.config->'event'->>'title', NULL, i.user_id, i.id::text FROM rsvps r JOIN invitations i ON i.id = r.invitation_id ORDER BY r.created_at DESC LIMIT 8)
                  UNION ALL
                  (SELECT 'invitation', i.created_at, i.config->'event'->>'title', u.name, u.id, i.id::text FROM invitations i JOIN users u ON u.id = i.user_id ORDER BY i.created_at DESC LIMIT 8)
                  ORDER BY at DESC LIMIT 12`),
      pool.query(`SELECT count(*)::int AS n FROM invitations
                  WHERE edit_count >= 1 AND (config->'event'->>'eventDate') ~ '^\\d{4}-\\d{2}-\\d{2}$'
                    AND (config->'event'->>'eventDate')::date < current_date - 7`),
    ]);
    const themes = await deps.enabledThemeIds();
    const mail = getLastMailResult();
    const todo: { kind: string; count?: number }[] = [];
    if (!getShopifyIds().plannerProductId) todo.push({ kind: "shopify-planner" });
    if (stale.rows.length) todo.push({ kind: "stale-pending", count: stale.rows.length });
    if (mail && !mail.ok) todo.push({ kind: "mail-failed" });
    const off = themes.filter((t) => !t.enabled);
    if (off.length) todo.push({ kind: "themes-off", count: off.length });
    if (past.rows[0].n > 0) todo.push({ kind: "past-events", count: past.rows[0].n });
    return { counts: counts.rows[0], stale: stale.rows, todo, mail, themesOff: off.map((t) => t.name), recent: recent.rows };
  });

  // Scheda cliente: inviti, planner, acquisti da attivare e storia degli ordini (senza importi).
  app.get<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Utente non trovato" });
    const id = req.params.id;
    const { rows: users } = await pool.query("SELECT id, email, name, role, created_at FROM users WHERE id = $1", [id]);
    if (!users[0]) return reply.code(404).send({ error: "Utente non trovato" });
    const [invitations, planners, pending, orders] = await Promise.all([
      pool.query(`SELECT i.id, i.slug, i.status, i.edit_count, i.views, i.created_at, i.config->>'themeId' AS theme,
                         i.config->'event'->>'title' AS title, i.config->'event'->>'eventDate' AS event_date,
                         (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps
                  FROM invitations i WHERE i.user_id = $1 ORDER BY i.created_at DESC`, [id]),
      pool.query(`SELECT p.id, p.title, to_char(p.event_date, 'YYYY-MM-DD') AS event_date, p.invitation_id, p.created_at,
                         (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id) AS tasks,
                         (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id AND t.done) AS tasks_done
                  FROM planners p WHERE p.user_id = $1 ORDER BY p.created_at DESC`, [id]),
      pool.query(`SELECT o.id, o.created_at, COALESCE(o.draft->>'product', 'invitation') AS product, COALESCE(o.draft->>'plan', 'full') AS plan, o.draft->'manual' AS manual
                  FROM orders o WHERE o.user_id = $1 AND ${PENDING} ORDER BY o.created_at`, [id]),
      pool.query(`SELECT o.id, o.created_at, o.status, o.kind, COALESCE(o.draft->>'product', 'invitation') AS product, COALESCE(o.draft->>'plan', 'full') AS plan,
                         o.draft->'manual' AS manual, o.invitation_id, o.planner_id
                  FROM orders o LEFT JOIN invitations i ON i.id = o.invitation_id
                  WHERE COALESCE(i.user_id, o.user_id) = $1 ORDER BY o.created_at DESC LIMIT 30`, [id]),
    ]);
    return { user: users[0], invitations: invitations.rows, planners: planners.rows, pending: pending.rows, orders: orders.rows };
  });

  // Assegna un acquisto a mano: compare nell'area del cliente come «da attivare», come uno dal negozio.
  app.post<{ Params: { id: string } }>("/api/admin/users/:id/grant", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Utente non trovato" });
    const b = (req.body ?? {}) as { product?: unknown; qty?: unknown; reason?: unknown; notify?: unknown };
    // invitation: invito completo; basic: invito base (solo template non Premium); planner; bundle: invito + planner.
    const product = b.product === "planner" || b.product === "bundle" || b.product === "basic" ? b.product : "invitation";
    const qty = Math.max(1, Math.min(10, Math.round(Number(b.qty) || 1)));
    const reason = (GRANT_REASONS as readonly string[]).includes(String(b.reason)) ? String(b.reason) : "omaggio";
    const { rows: users } = await pool.query("SELECT id, email FROM users WHERE id = $1", [req.params.id]);
    if (!users[0]) return reply.code(404).send({ error: "Utente non trovato" });
    const manual = { reason, at: new Date().toISOString(), by: (await currentUser(req))?.email ?? null };
    const invitationDraft = { model: "invitation-rsvp", themeId: "", eventType: "wedding", addons: [], tier: "rsvp", manual, ...(product === "basic" ? { plan: "base" } : {}) };
    const rows: Record<string, unknown>[] = [];
    for (let n = 0; n < qty; n++) {
      if (product !== "planner") rows.push(invitationDraft);
      if (product === "planner" || product === "bundle") rows.push({ product: "planner", manual });
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    for (const draft of rows) {
      await pool.query(
        "INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, kind, draft) VALUES ($1, $2, NULL, 0, 'EUR', 'shopify', 'paid', 'initial', $3)",
        [`manuale-${stamp}-${randomUUID().slice(0, 8)}`, users[0].id, JSON.stringify(draft)],
      );
    }
    await pool.query("INSERT INTO events (type, invitation_id) VALUES ('admin_grant', NULL)");
    let mailed = false;
    if (b.notify === true) {
      const token = await createAccessToken(users[0].id);
      const link = `${appUrl()}/accesso/${token}`;
      const lang = req.cookies.lang === "en" ? "en" : "it";
      mailed = await sendMail(product === "planner" ? accessEmail({ to: users[0].email, link, lang }) : purchaseEmail({ to: users[0].email, link, lang }), "order")
        .then(() => true)
        .catch(() => false);
    }
    return { ok: true, added: rows.length, mailed };
  });

  // Togli un acquisto da attivare (solo se non è stato ancora usato).
  app.delete<{ Params: { id: string } }>("/api/admin/pending/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rowCount } = await pool.query(`DELETE FROM orders o WHERE o.id = $1 AND ${PENDING}`, [req.params.id]);
    if (!rowCount) return reply.code(404).send({ error: "Acquisto non trovato o già attivato" });
    return { ok: true };
  });

  // Manda (o rimanda) il link personale per entrare.
  app.post<{ Params: { id: string } }>("/api/admin/users/:id/access-link", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Utente non trovato" });
    const { rows } = await pool.query("SELECT id, email FROM users WHERE id = $1", [req.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: "Utente non trovato" });
    const token = await createAccessToken(rows[0].id);
    const lang = req.cookies.lang === "en" ? "en" : "it";
    try {
      await sendMail(accessEmail({ to: rows[0].email, link: `${appUrl()}/accesso/${token}`, lang }), "other");
    } catch {
      return reply.code(502).send({ error: "Email non inviata" });
    }
    return { ok: true };
  });

  app.get<{ Querystring: { q?: string } }>("/api/admin/planners", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const q = (req.query.q ?? "").trim();
    const { rows } = await pool.query(
      `SELECT p.id, p.title, to_char(p.event_date, 'YYYY-MM-DD') AS event_date, p.venue, p.created_at, p.invitation_id,
              i.config->'event'->>'title' AS invitation_title, u.id AS user_id, u.name, u.email,
              (SELECT count(*)::int FROM planner_guests g WHERE g.planner_id = p.id) AS guests,
              (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id) AS tasks,
              (SELECT count(*)::int FROM planner_tasks t WHERE t.planner_id = p.id AND t.done) AS tasks_done
       FROM planners p JOIN users u ON u.id = p.user_id LEFT JOIN invitations i ON i.id = p.invitation_id
       ${q ? "WHERE p.title ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1" : ""}
       ORDER BY p.created_at DESC LIMIT 200`,
      q ? [`%${escapeLike(q)}%`] : [],
    );
    return rows;
  });

  // Cerca ovunque: clienti, inviti, planner e ordini, pochi risultati per tipo.
  app.get<{ Querystring: { q?: string } }>("/api/admin/search", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const q = (req.query.q ?? "").trim();
    if (q.length < 2) return { users: [], invitations: [], planners: [], orders: [] };
    const like = `%${escapeLike(q)}%`;
    const [users, invitations, planners, orders] = await Promise.all([
      pool.query("SELECT id, name, email FROM users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY created_at DESC LIMIT 5", [like]),
      pool.query(`SELECT i.id, i.slug, i.config->'event'->>'title' AS title, i.edit_count >= 1 AS live, u.email FROM invitations i JOIN users u ON u.id = i.user_id
                  WHERE i.slug ILIKE $1 OR coalesce(i.config->'event'->>'title', '') ILIKE $1 OR i.id::text ILIKE $1 ORDER BY i.created_at DESC LIMIT 5`, [like]),
      pool.query("SELECT p.id, p.title, u.email FROM planners p JOIN users u ON u.id = p.user_id WHERE p.title ILIKE $1 OR p.id::text ILIKE $1 ORDER BY p.created_at DESC LIMIT 5", [like]),
      pool.query(`SELECT o.id, COALESCE(o.draft->>'product', 'invitation') AS product, u.id AS user_id, u.email FROM orders o LEFT JOIN users u ON u.id = o.user_id
                  WHERE o.id ILIKE $1 OR u.email ILIKE $1 ORDER BY o.created_at DESC LIMIT 5`, [like]),
    ]);
    return { users: users.rows, invitations: invitations.rows, planners: planners.rows, orders: orders.rows };
  });

  // Quanti inviti usano ogni template.
  app.get("/api/admin/themes/usage", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query("SELECT config->>'themeId' AS theme, count(*)::int AS n FROM invitations GROUP BY 1");
    return Object.fromEntries(rows.filter((r) => r.theme).map((r) => [r.theme, r.n]));
  });
}
