import { randomUUID } from "crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Catalog } from "@inviteme/shared";
import { pool } from "./db";
import { COLLECTIONS, forecastFor, isCollectionKind, sanitizeDocs, sanitizeItem, type CollectionKind, type FolderValue } from "./planner";
import { geocodeOne } from "./places";
import { INPUT_TYPES, MediaError, convertMedia } from "./media";
import { buildPlannerPdf, isPdfChoice, type PdfChoice } from "./planner-pdf";
import type { SessionUser } from "./auth";

// Planner come servizio a sé: si compra a parte (variante Shopify «planner»), ha un suo evento (titolo, data, luogo)
// e si può collegare a un invito del cliente. Collegato, legge dall'invito le conferme di presenza e il link da condividere.
// Le righe di invitati, budget, attività, fornitori e tavoli appartengono al planner (colonna planner_id).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Deps = {
  requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<SessionUser | null>;
  loadCatalog: () => Promise<Catalog>;
};

// bannerImage e archImage: foto scelte dal cliente per la testata del planner (sfondo e arco). Solo file caricati qui.
// groupQuotas: quante persone può invitare ogni gruppo (es. «Famiglia di Marco»: 20), per avvisare quando lo supera.
export type PlannerData = { notes?: string; docs?: Record<string, FolderValue>; budgetCents?: number; guestQuota?: number; groupQuotas?: Record<string, number>; bannerImage?: string; archImage?: string };

// Limiti per gruppo: nomi di gruppo come nella lista invitati (fino a 80 caratteri), numeri da 1 a 5000; 0 toglie il limite.
function sanitizeGroupQuotas(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 200)) {
    const name = k.trim().slice(0, 80);
    if (name && typeof n === "number" && n >= 1) out[name] = Math.min(5000, Math.round(n));
  }
  return out;
}
const IMAGE_SLOTS = { banner: "bannerImage", arch: "archImage" } as const;

const validDate = (v: unknown): string | null => (typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00")) ? v : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Planner del cliente, con la data come testo (aaaa-mm-gg).
async function ownedPlanner(id: string, userId: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query(
    "SELECT id, user_id, invitation_id, title, to_char(event_date, 'YYYY-MM-DD') AS event_date, venue, address, data, created_at FROM planners WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] ?? null;
}

// Invito collegato: quel che serve al planner (titolo, link pubblico, colore del tema, risposte).
async function linkedInvitation(invitationId: string | null, catalog: Catalog) {
  if (!invitationId) return null;
  const { rows } = await pool.query(
    "SELECT i.id, i.slug, i.edit_count, i.status, i.config, (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps FROM invitations i WHERE i.id = $1",
    [invitationId],
  );
  const r = rows[0];
  if (!r) return null;
  const theme = catalog.themes.find((t) => t.manifest.id === r.config?.themeId)?.manifest;
  return {
    id: r.id as string,
    title: String(r.config?.event?.title ?? ""),
    slug: r.slug as string,
    published: r.status === "paid" && r.edit_count >= 1,
    themeId: (r.config?.themeId as string) ?? "",
    themeColor: theme?.themeColor ?? "#8a6427",
    rsvps: r.rsvps as number,
  };
}

// Statistiche brevi per l'area cliente: attività fatte, budget speso e previsto.
async function plannerStats(id: string) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM planner_tasks WHERE planner_id = $1) AS tasks,
            (SELECT count(*)::int FROM planner_tasks WHERE planner_id = $1 AND done) AS tasks_done,
            ((SELECT COALESCE(SUM(amount_cents), 0) FROM planner_quotes WHERE planner_id = $1 AND booked)
             + (SELECT COALESCE(SUM(amount_cents), 0) FROM planner_budget_items WHERE planner_id = $1 AND quote_id IS NULL))::bigint AS spent,
            (SELECT count(*)::int FROM planner_guests WHERE planner_id = $1) AS guests`,
    [id],
  );
  return { tasks: rows[0].tasks, tasksDone: rows[0].tasks_done, spentCents: Number(rows[0].spent), guests: rows[0].guests };
}

// Un pagamento può riferirsi solo a un preventivo dello stesso planner.
async function quoteBelongs(quoteId: unknown, plannerId: string): Promise<boolean> {
  if (quoteId === undefined || quoteId === null) return true;
  const { rows } = await pool.query("SELECT 1 FROM planner_quotes WHERE id = $1 AND planner_id = $2", [quoteId, plannerId]);
  return rows.length > 0;
}

export function registerPlannerRoutes(app: FastifyInstance, deps: Deps) {
  async function plannerOf(req: FastifyRequest, reply: FastifyReply): Promise<Row | null> {
    const user = await deps.requireUser(req, reply);
    if (!user) return null;
    const p = await ownedPlanner((req.params as { id: string }).id, user.id);
    if (!p) {
      reply.code(404).send({ error: "Planner non trovato" });
      return null;
    }
    return p;
  }

  // Elenco dei planner del cliente, per l'area cliente.
  app.get("/api/account/planners", async (req, reply) => {
    const user = await deps.requireUser(req, reply);
    if (!user) return;
    const catalog = await deps.loadCatalog();
    const { rows } = await pool.query(
      "SELECT id, invitation_id, title, to_char(event_date, 'YYYY-MM-DD') AS event_date, venue, data FROM planners WHERE user_id = $1 ORDER BY event_date NULLS LAST, created_at",
      [user.id],
    );
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        title: r.title,
        eventDate: r.event_date ?? "",
        venue: r.venue,
        budgetCents: Number((r.data as PlannerData)?.budgetCents ?? 0),
        ...(await plannerStats(r.id)),
        invitation: await linkedInvitation(r.invitation_id, catalog),
      })),
    );
  });

  // Attivazione di un acquisto planner: il cliente dà nome e data all'evento e, se vuole, lo collega a un suo invito.
  app.post("/api/account/planner-claim", async (req, reply) => {
    const user = await deps.requireUser(req, reply);
    if (!user) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const orderId = typeof b.orderId === "string" ? b.orderId : "";
    const title = text(b.title, 120);
    const eventDate = b.eventDate ? validDate(b.eventDate) : null;
    if (!title) return reply.code(400).send({ error: "Scrivete il nome dell'evento" });
    if (b.eventDate && !eventDate) return reply.code(400).send({ error: "Inserite una data valida" });
    const invitationId = typeof b.invitationId === "string" && b.invitationId ? b.invitationId : null;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT id FROM orders WHERE id = $1 AND user_id = $2 AND status = 'paid' AND invitation_id IS NULL AND planner_id IS NULL AND draft->>'product' = 'planner' FOR UPDATE",
        [orderId, user.id],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Acquisto non trovato o già attivato" });
      }
      if (invitationId) {
        const inv = await client.query("SELECT id FROM invitations WHERE id = $1 AND user_id = $2", [invitationId, user.id]);
        if (!inv.rows[0]) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "Invito non trovato" }); }
        const taken = await client.query("SELECT id FROM planners WHERE invitation_id = $1", [invitationId]);
        if (taken.rows[0]) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Quell'invito ha già un planner collegato" }); }
      }
      const id = randomUUID();
      await client.query(
        "INSERT INTO planners (id, user_id, invitation_id, title, event_date, venue, address, data, order_ref) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8)",
        [id, user.id, invitationId, title, eventDate, text(b.venue, 160), text(b.address, 200), orderId],
      );
      await client.query("UPDATE orders SET planner_id = $1 WHERE id = $2", [id, orderId]);
      await client.query("COMMIT");
      return reply.code(201).send({ plannerId: id });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  });

  app.get<{ Params: { id: string } }>("/api/planners/:id/data", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const catalog = await deps.loadCatalog();
    const [guests, budget, tasks, vendors, tables, quotes, linkable] = await Promise.all([
      pool.query("SELECT id, name, group_name, party_size, response, table_id FROM planner_guests WHERE planner_id = $1 ORDER BY group_name, name", [p.id]),
      pool.query("SELECT id, category, label, amount_cents, to_char(due_date, 'YYYY-MM-DD') AS due_date, paid, quote_id FROM planner_budget_items WHERE planner_id = $1 ORDER BY due_date NULLS LAST, created_at", [p.id]),
      pool.query("SELECT id, title, done, days_before FROM planner_tasks WHERE planner_id = $1 ORDER BY days_before DESC, created_at", [p.id]),
      pool.query("SELECT id, name, role, contact, contract_status FROM planner_vendors WHERE planner_id = $1 ORDER BY created_at", [p.id]),
      pool.query("SELECT id, name, seats FROM planner_tables WHERE planner_id = $1 ORDER BY created_at", [p.id]),
      pool.query("SELECT id, category, name, amount_cents, rating, notes, booked, signed, arrival, contact, tip_cents, envelope FROM planner_quotes WHERE planner_id = $1 ORDER BY category, amount_cents", [p.id]),
      // Inviti del cliente che si possono collegare: quelli senza un altro planner.
      pool.query(
        "SELECT i.id, i.config->'event'->>'title' AS title FROM invitations i WHERE i.user_id = $1 AND i.status = 'paid' AND NOT EXISTS (SELECT 1 FROM planners x WHERE x.invitation_id = i.id AND x.id <> $2) ORDER BY i.created_at DESC",
        [p.user_id, p.id],
      ),
    ]);
    const invitation = await linkedInvitation(p.invitation_id, catalog);
    const data = (p.data ?? {}) as PlannerData;
    return {
      id: p.id,
      event: { title: p.title, eventDate: p.event_date ?? "", venue: p.venue, address: p.address },
      invitation,
      linkable: linkable.rows.map((r) => ({ id: r.id, title: r.title || "Invito senza titolo" })),
      tables: tables.rows,
      quotes: quotes.rows,
      guests: guests.rows,
      budget: budget.rows,
      tasks: tasks.rows,
      vendors: vendors.rows,
      rsvpResponses: invitation?.rsvps ?? 0,
      docs: data.docs ?? {},
      notes: data.notes ?? "",
      bannerImage: data.bannerImage ?? null,
      archImage: data.archImage ?? null,
      budgetCents: data.budgetCents ?? 0,
      guestQuota: data.guestQuota ?? 0,
      groupQuotas: data.groupQuotas ?? {},
    };
  });

  // Modifica dei dati del planner: evento (titolo, data, luogo) e dati dell'organizzatore. Ogni campo è facoltativo.
  app.put<{ Params: { id: string } }>("/api/planners/:id", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const data = { ...((p.data ?? {}) as PlannerData) };
    if (b.docs !== undefined) {
      const docs = sanitizeDocs(b.docs);
      if (!docs) return reply.code(400).send({ error: "Cartella non valida" });
      data.docs = docs;
    }
    if (typeof b.notes === "string") data.notes = b.notes.slice(0, 4000);
    if (typeof b.budgetCents === "number" && b.budgetCents >= 0) data.budgetCents = Math.min(1_000_000_000, Math.round(b.budgetCents));
    if (typeof b.guestQuota === "number" && b.guestQuota >= 0) data.guestQuota = Math.min(5000, Math.round(b.guestQuota));
    if (b.groupQuotas !== undefined) {
      const quotas = sanitizeGroupQuotas(b.groupQuotas);
      if (!quotas) return reply.code(400).send({ error: "Limiti dei gruppi non validi" });
      data.groupQuotas = quotas;
    }
    const title = b.title !== undefined ? text(b.title, 120) : p.title;
    if (!title) return reply.code(400).send({ error: "Il nome dell'evento non può essere vuoto" });
    let eventDate = p.event_date;
    if (b.eventDate !== undefined) {
      eventDate = b.eventDate === "" ? null : validDate(b.eventDate);
      if (b.eventDate !== "" && !eventDate) return reply.code(400).send({ error: "Inserite una data valida" });
    }
    await pool.query("UPDATE planners SET title = $2, event_date = $3, venue = $4, address = $5, data = $6 WHERE id = $1", [
      p.id, title, eventDate, b.venue !== undefined ? text(b.venue, 160) : p.venue, b.address !== undefined ? text(b.address, 200) : p.address, JSON.stringify(data),
    ]);
    return { ok: true };
  });

  // Immagini della testata: il cliente carica una foto per lo sfondo (banner) o per l'arco; DELETE torna a quella del tema.
  app.post<{ Params: { id: string; slot: string } }>("/api/planners/:id/image/:slot", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const key = IMAGE_SLOTS[req.params.slot as keyof typeof IMAGE_SLOTS];
    if (!key) return reply.code(404).send({ error: "Elemento non trovato" });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Nessun file ricevuto" });
    const ext = INPUT_TYPES.photo[file.mimetype];
    if (!ext) return reply.code(415).send({ error: "Formato non supportato" });
    const buffer = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: "File troppo grande" });
    try {
      const saved = await convertMedia("photo", buffer, ext);
      await pool.query("UPDATE planners SET data = jsonb_set(coalesce(data, '{}'::jsonb), $2, to_jsonb($3::text)) WHERE id = $1", [p.id, `{${key}}`, saved.url]);
      return reply.code(201).send({ url: saved.url });
    } catch (e) {
      if (e instanceof MediaError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
  });

  app.delete<{ Params: { id: string; slot: string } }>("/api/planners/:id/image/:slot", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const key = IMAGE_SLOTS[req.params.slot as keyof typeof IMAGE_SLOTS];
    if (!key) return reply.code(404).send({ error: "Elemento non trovato" });
    await pool.query("UPDATE planners SET data = coalesce(data, '{}'::jsonb) - $2 WHERE id = $1", [p.id, key]);
    return { ok: true };
  });

  // Collega o scollega un invito del cliente. Un invito ha al massimo un planner.
  app.post<{ Params: { id: string } }>("/api/planners/:id/link", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const invitationId = (req.body as { invitationId?: unknown } | undefined)?.invitationId;
    if (invitationId === null || invitationId === "") {
      await pool.query("UPDATE planners SET invitation_id = NULL WHERE id = $1", [p.id]);
      return { ok: true, invitationId: null };
    }
    if (typeof invitationId !== "string" || !UUID.test(invitationId)) return reply.code(400).send({ error: "Invito non valido" });
    const inv = await pool.query("SELECT id FROM invitations WHERE id = $1 AND user_id = $2", [invitationId, p.user_id]);
    if (!inv.rows[0]) return reply.code(404).send({ error: "Invito non trovato" });
    const taken = await pool.query("SELECT id FROM planners WHERE invitation_id = $1 AND id <> $2", [invitationId, p.id]);
    if (taken.rows[0]) return reply.code(409).send({ error: "Quell'invito ha già un planner collegato" });
    await pool.query("UPDATE planners SET invitation_id = $2 WHERE id = $1", [p.id, invitationId]);
    return { ok: true, invitationId };
  });

  // Meteo del giorno dell'evento, nel luogo del planner. Oltre i giorni di previsione non c'è un dato affidabile.
  app.get<{ Params: { id: string } }>("/api/planners/:id/weather", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const date = p.event_date ?? "";
    if (!ISO_DATE.test(date)) return { forecast: null, reason: "date" };
    const place = await geocodeOne(p.address || p.venue || "");
    if (!place) return { forecast: null, reason: "place" };
    const forecast = await forecastFor(place.lat, place.lon, date);
    return forecast ? { forecast, place: place.name } : { forecast: null, reason: "range", place: place.name };
  });

  // Cartella in PDF: l'organizzatore sceglie le parti; il colore viene dal tema dell'invito collegato, se c'è.
  app.post<{ Params: { id: string } }>("/api/planners/:id/pdf", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const b = (req.body ?? {}) as { include?: unknown; lang?: unknown };
    const include = (Array.isArray(b.include) ? b.include : []).filter((x): x is PdfChoice => typeof x === "string" && isPdfChoice(x));
    if (include.length === 0) return reply.code(400).send({ error: "Scegliete almeno una parte da includere" });
    const [guests, tables, budget, tasks, vendors, quotes] = await Promise.all([
      pool.query("SELECT name, group_name, party_size, response, table_id FROM planner_guests WHERE planner_id = $1 ORDER BY group_name, name", [p.id]),
      pool.query("SELECT id, name, seats FROM planner_tables WHERE planner_id = $1 ORDER BY created_at", [p.id]),
      pool.query("SELECT label, category, amount_cents, to_char(due_date, 'YYYY-MM-DD') AS due_date, paid, quote_id FROM planner_budget_items WHERE planner_id = $1 ORDER BY due_date NULLS LAST, created_at", [p.id]),
      pool.query("SELECT title, done, days_before FROM planner_tasks WHERE planner_id = $1 ORDER BY days_before DESC, created_at", [p.id]),
      pool.query("SELECT name, role, contact, contract_status FROM planner_vendors WHERE planner_id = $1 ORDER BY created_at", [p.id]),
      pool.query("SELECT id, category, name, amount_cents, booked, signed FROM planner_quotes WHERE planner_id = $1 ORDER BY category, amount_cents", [p.id]),
    ]);
    // Lingua del documento: quella scelta nel planner, altrimenti quella del sito.
    const lang = (b.lang ?? req.cookies.lang) === "en" ? "en" : "it";
    const invitation = await linkedInvitation(p.invitation_id, await deps.loadCatalog());
    const data = (p.data ?? {}) as PlannerData;
    const pdf = await buildPlannerPdf(
      {
        title: p.title,
        eventDate: p.event_date ?? "",
        venue: p.venue,
        accent: invitation?.themeColor ?? "#8a6427",
        budgetCents: data.budgetCents ?? 0,
        guestQuota: data.guestQuota ?? 0,
        guests: guests.rows,
        tables: tables.rows,
        budget: budget.rows,
        tasks: tasks.rows,
        vendors: vendors.rows,
        quotes: quotes.rows,
        docs: data.docs ?? {},
        lang,
      },
      include,
    );
    return reply.header("Content-Type", "application/pdf").header("Content-Disposition", `attachment; filename="${lang === "en" ? "event-folder" : "cartella-evento"}.pdf"`).send(pdf);
  });

  app.post<{ Params: { id: string; kind: string } }>("/api/planners/:id/:kind", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const kind = req.params.kind;
    if (!isCollectionKind(kind)) return reply.code(404).send({ error: "Raccolta non trovata" });
    const clean = sanitizeItem(kind, req.body, false);
    if (!clean.ok) return reply.code(400).send({ error: clean.error });
    if ("table_id" in clean.values) return reply.code(400).send({ error: "Assegna il posto dopo aver creato l'invitato" });
    if (!(await quoteBelongs(clean.values.quote_id, p.id))) return reply.code(404).send({ error: "Fornitore non trovato" });
    const cols = Object.keys(clean.values);
    const table = COLLECTIONS[kind].table;
    const { rows } = await pool.query(
      `INSERT INTO ${table} (id, planner_id, ${cols.join(", ")}) VALUES ($1, $2, ${cols.map((_, i) => "$" + (i + 3)).join(", ")}) RETURNING *`,
      [randomUUID(), p.id, ...cols.map((c) => clean.values[c])],
    );
    return reply.code(201).send(rows[0]);
  });

  app.patch<{ Params: { id: string; kind: string; itemId: string } }>("/api/planners/:id/:kind/:itemId", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const kind = req.params.kind;
    if (!isCollectionKind(kind) || !UUID.test(req.params.itemId)) return reply.code(404).send({ error: "Elemento non trovato" });
    const clean = sanitizeItem(kind, req.body, true);
    if (!clean.ok) return reply.code(400).send({ error: clean.error });
    const cols = Object.keys(clean.values);
    if (cols.length === 0) return reply.code(400).send({ error: "Nessun dato da salvare" });
    if (!(await quoteBelongs(clean.values.quote_id, p.id))) return reply.code(404).send({ error: "Fornitore non trovato" });
    // Posti: il tavolo deve essere del planner e non superare la capienza.
    if (kind === "guests" && clean.values.table_id) {
      const t = await pool.query("SELECT seats FROM planner_tables WHERE id = $1 AND planner_id = $2", [clean.values.table_id, p.id]);
      if (!t.rows[0]) return reply.code(404).send({ error: "Tavolo non trovato" });
      const g = await pool.query("SELECT party_size FROM planner_guests WHERE id = $1 AND planner_id = $2", [req.params.itemId, p.id]);
      const used = await pool.query("SELECT COALESCE(SUM(party_size), 0)::int AS n FROM planner_guests WHERE table_id = $1 AND id <> $2", [clean.values.table_id, req.params.itemId]);
      if (used.rows[0].n + (g.rows[0]?.party_size ?? 0) > t.rows[0].seats) return reply.code(409).send({ error: "Tavolo pieno" });
    }
    if (kind === "tables" && typeof clean.values.seats === "number") {
      const used = await pool.query("SELECT COALESCE(SUM(party_size), 0)::int AS n FROM planner_guests WHERE table_id = $1", [req.params.itemId]);
      if (used.rows[0].n > (clean.values.seats as number)) return reply.code(409).send({ error: "Ci sono già più persone sedute di questi posti" });
    }
    const table = COLLECTIONS[kind].table;
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${cols.map((c, i) => c + " = $" + (i + 3)).join(", ")} WHERE id = $1 AND planner_id = $2 RETURNING *`,
      [req.params.itemId, p.id, ...cols.map((c) => clean.values[c])],
    );
    if (!rows[0]) return reply.code(404).send({ error: "Elemento non trovato" });
    return rows[0];
  });

  app.delete<{ Params: { id: string; kind: string; itemId: string } }>("/api/planners/:id/:kind/:itemId", async (req, reply) => {
    const p = await plannerOf(req, reply);
    if (!p) return;
    const kind = req.params.kind;
    if (!isCollectionKind(kind) || !UUID.test(req.params.itemId)) return reply.code(404).send({ error: "Elemento non trovato" });
    await pool.query(`DELETE FROM ${COLLECTIONS[kind as CollectionKind].table} WHERE id = $1 AND planner_id = $2`, [req.params.itemId, p.id]);
    return { ok: true };
  });
}
