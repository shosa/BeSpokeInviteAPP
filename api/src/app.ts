import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart, { type MultipartFile } from "@fastify/multipart";
import staticFiles from "@fastify/static";
import {
  ADDON_KEYS,
  EVENT_TYPES,
  activeFeatures,
  defaultConfig,
  editRules,
  enabledThemes,
  formatPrice,
  getModel,
  getTheme,
  hasRsvp,
  makeSlug,
  sanitizeConfig,
  addonsCents,
  totalCents,
  type AddonKey,
  type EventType,
  type Catalog,
  type InviteConfig,
  type RsvpQuestion,
  normalizeSlug,
} from "@inviteme/shared";
import Anthropic from "@anthropic-ai/sdk";
import { pool, migrate, track } from "./db";
import { handleAssistant, type OwnedInvitation } from "./assistant";
import { searchPlaces } from "./places";
import { EFFORTS, listAssistantModels, loadAssistantSettings, saveAssistantSettings, type ModelOption } from "./assistantSettings";
import { invalidateCatalog, loadCatalog, loadFullCatalog, saveCatalog, themes } from "./catalog";
import { previewShell } from "./engine/previewShell";
import { renderInvitePage } from "./engine/page";
import { RUNTIME_PATH, sampleConfig } from "./engine/themes";
import { MEDIA_DIR, MediaError, convertMedia, ensureMediaDirs, INPUT_TYPES, type MediaKind } from "./media";
import { StockError, importStock, parseStockFilters, searchStock } from "./pixabay";
import { SESSION_COOKIE, adminAllowed, currentUser, endSession, startSession, type SessionUser, createAccessToken, roleForEmail, userForAccessToken } from "./auth";
import { appUrl, inviteEmail, orderEmail, rsvpNoticeEmail, sendMail, type MailMessage } from "./mail";
import { registerAdminInvitations } from "./adminInvitations";
import { registerAdminMedia } from "./adminMedia";
import { createCheckout, demoMode, invitationIdFromOrder, orderIdFromOrder, localCheckoutAllowed, shopifyConfigured, verifyShopifyWebhook } from "./shopify";

const isProd = process.env.NODE_ENV === "production";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, any>;

// Il codice della pagina invito (runtime del motore): letto una volta, incorporato in ogni pagina.
const RUNTIME = fs.readFileSync(RUNTIME_PATH, "utf8");

const textOf = (config: InviteConfig, key: string) => String(config.event[key] ?? "");

// Funzioni già pagate di un invito: le funzioni tolte e riaggiunte restano pagate, quindi gratuite.
const purchasedOf = (inv: { purchased_addons?: unknown; config?: unknown }) =>
  new Set<string>((inv.purchased_addons as string[] | null) ?? (inv.config as InviteConfig).addons ?? []);
// Funzioni in bozza che non sono ancora state pagate: servono un pagamento prima della conferma.
const pendingOf = (inv: { purchased_addons?: unknown; config?: unknown }) =>
  (inv.config as InviteConfig).addons.filter((a) => !purchasedOf(inv).has(a));
// Attributo del checkout Shopify (sta nelle note dell'ordine oppure nelle proprietà della riga).
function orderAttr(order: { note_attributes?: { name: string; value: string }[]; line_items?: { properties?: { name: string; value: string }[] }[] }, name: string): string | undefined {
  const fromNotes = order.note_attributes?.find((a) => a.name === name)?.value;
  if (fromNotes) return fromNotes;
  for (const item of order.line_items ?? []) {
    const v = item.properties?.find((x) => x.name === name)?.value;
    if (v) return v;
  }
  return undefined;
}
const titleOf = (config: InviteConfig) => textOf(config, "title");
const isMediaKind = (v: string): v is MediaKind => v === "photo" || v === "video" || v === "audio";

// Pagina dell'invito per una configurazione. Null se il tema non esiste più (invito da ricreare).
function renderFor(c: Catalog, slug: string, config: InviteConfig, preview = false, builder = false): string | null {
  const theme = themes().find((t) => t.manifest.id === config.themeId);
  if (!theme) return null;
  return renderInvitePage({ theme, config, slug, features: activeFeatures(c, config.model, config.addons), runtime: RUNTIME, preview, builder });
}

const NOT_FOUND_PAGE = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Invito non disponibile</title></head><body style="font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#17242A"><p>Questo invito non è disponibile.</p></body></html>`;

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 12 * 1024 * 1024 });
  await app.register(cookie);
  // Il limite più alto è quello dei video in ingresso: poi ffmpeg li riduce (vedi media.ts).
  await app.register(multipart, { limits: { fileSize: 150 * 1024 * 1024, files: 1 } });
  ensureMediaDirs();
  await app.register(staticFiles, { root: MEDIA_DIR, prefix: "/api/media/", decorateReply: false, maxAge: "7d" });
  // Asset di ogni tema (immagini, video, audio del tema), serviti dalla cartella del tema.
  for (const t of themes()) {
    const assets = path.join(t.dir, "assets");
    if (fs.existsSync(assets)) await app.register(staticFiles, { root: assets, prefix: `/api/themes/${t.manifest.id}/assets/`, decorateReply: false, index: false, maxAge: "7d" });
  }

  // Il webhook Shopify va verificato sul corpo grezzo: lo conserviamo accanto al JSON già parsato.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, body && (body as string).length ? JSON.parse(body as string) : {});
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  const requireUser = async (req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> => {
    const user = await currentUser(req);
    if (!user) reply.code(401).send({ error: "Accedi per continuare" });
    return user;
  };
  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    const user = await currentUser(req);
    if (user?.role === "admin" || adminAllowed(req)) return true;
    reply.code(403).send({ error: "Area riservata" });
    return false;
  };

  // Carica un invito verificando che appartenga all'utente. Non rivela l'esistenza di inviti altrui.
  async function ownedInvitation(id: string, userId: string): Promise<Row | null> {
    if (!UUID.test(id)) return null;
    const { rows } = await pool.query("SELECT * FROM invitations WHERE id = $1 AND user_id = $2", [id, userId]);
    return rows[0] ?? null;
  }

  // ───────────── Health & catalogo pubblico ─────────────
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/catalog", async () => {
    const c = await loadCatalog();
    return { ...c, eventTypes: EVENT_TYPES, shopify: shopifyConfigured(), demo: demoMode() };
  });

  // ───────────── Autenticazione ─────────────
  // Accesso con il link personale ricevuto dopo l'acquisto: il token apre la sessione, senza password.
  app.post("/api/auth/token", async (req, reply) => {
    const token = String(((req.body ?? {}) as { token?: string }).token ?? "");
    const found = token ? await userForAccessToken(token) : null;
    if (!found) return reply.code(401).send({ error: "Link non valido o scaduto" });
    const role = roleForEmail(found.email);
    const user = role === found.role ? found : { ...found, role };
    if (user !== found) await pool.query("UPDATE users SET role = $2 WHERE id = $1", [user.id, role]);
    await startSession(reply, user.id);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  app.get("/api/auth/me", async (req) => {
    const user = await currentUser(req);
    return { user };
  });

  app.delete("/api/auth/me", async (req, reply) => {
    await endSession(req, reply);
    return { ok: true };
  });

  // ───────────── Account e inviti del proprietario ─────────────
  app.get("/api/account/invitations", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const c = await loadFullCatalog();
    const { rows } = await pool.query(
      `SELECT i.id, i.slug, i.status, i.config, i.views, i.guests, i.created_at,
              (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps
       FROM invitations i WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
      [user.id],
    );
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      status: r.status,
      title: titleOf(r.config),
      eventDate: textOf(r.config, "eventDate"),
      model: getModel(c, r.config.model)?.name ?? r.config.model,
      views: r.views,
      guests: (r.guests ?? []).length,
      rsvps: r.rsvps,
    }));
  });

  app.post("/api/invitations", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const c = await loadCatalog();
    const b = (req.body ?? {}) as { model?: string; eventType?: string; themeId?: string };
    const model = getModel(c, String(b.model ?? ""));
    if (!model) return reply.code(400).send({ error: "Modello non disponibile" });
    // Un tema scelto esplicitamente non viene sostituito: se non è disponibile, la richiesta fallisce.
    const requested = b.themeId ? getTheme(c, String(b.themeId), model.id) : undefined;
    if (b.themeId && !requested) return reply.code(400).send({ error: "Tema non disponibile per questo modello" });
    const theme = requested ?? enabledThemes(c, model.id)[0];
    if (!theme) return reply.code(400).send({ error: "Nessun tema disponibile per questo modello" });
    const eventType = EVENT_TYPES.find((e) => e.id === b.eventType)?.id ?? "wedding";
    const config = defaultConfig(theme, model.id, eventType, activeFeatures(c, model.id, []));
    const id = randomUUID();
    const slug = makeSlug(titleOf(config));
    await pool.query("INSERT INTO invitations (id, slug, user_id, config) VALUES ($1, $2, $3, $4)", [id, slug, user.id, JSON.stringify(config)]);
    await track("invitation_created", id);
    return reply.code(201).send({ id, slug });
  });

  app.get<{ Params: { id: string } }>("/api/invitations/:id/manage", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const c = await loadFullCatalog();
    return {
      id: inv.id,
      slug: inv.slug,
      status: inv.status,
      config: inv.config as InviteConfig,
      guests: inv.guests,
      views: inv.views,
      planner: inv.planner ?? {},
      editCount: inv.edit_count ?? 0,
      editSession: inv.edit_session ?? null,
      purchasedAddons: (inv.purchased_addons ?? inv.config.addons ?? []) as string[],
      assistant: !!process.env.ANTHROPIC_KEY,
      assistantLimit: (await loadAssistantSettings()).settings.callLimit,
      assistantUsed: inv.assistant_calls ?? 0,
      catalog: c,
      hasRsvp: hasRsvp(c, inv.config),
    };
  });

  // Elimina una bozza. Un invito pagato non si cancella: è già stato acquistato e condiviso.
  app.delete<{ Params: { id: string } }>("/api/invitations/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status === "paid") return reply.code(409).send({ error: "Invito pagato: non si può eliminare" });
    await pool.query("DELETE FROM invitations WHERE id = $1 AND status <> 'paid'", [inv.id]);
    return reply.code(204).send();
  });

  // Link dell'invito: si può cambiare solo finché l'invito è in bozza. Un invito pubblicato mantiene il suo link.
  app.put<{ Params: { id: string }; Body: { slug?: unknown } }>("/api/invitations/:id/slug", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status === "paid") return reply.code(409).send({ error: "Il link di un invito pubblicato non cambia: gli ospiti lo hanno già ricevuto." });
    const slug = normalizeSlug((req.body ?? {}).slug);
    if (!slug) return reply.code(400).send({ error: "Il link può contenere solo lettere minuscole, numeri e trattini (3–60 caratteri)." });
    try {
      await pool.query("UPDATE invitations SET slug = $1 WHERE id = $2", [slug, inv.id]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return reply.code(409).send({ error: "Questo link è già in uso: scegline un altro." });
      throw e;
    }
    return { slug };
  });

  // Console admin: modello, sforzo e limite di richieste dell'assistente. I modelli arrivano dall'API di Anthropic.
  app.get("/api/admin/assistant", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { settings, source } = await loadAssistantSettings();
    const key = process.env.ANTHROPIC_KEY;
    let models: ModelOption[] = [];
    let modelsError: string | null = null;
    if (key) {
      try {
        models = await listAssistantModels(key);
      } catch {
        modelsError = "Non riesco a leggere i modelli da Anthropic. Riprova tra poco.";
      }
    }
    return { configured: !!key, settings, source, models, modelsError, efforts: EFFORTS };
  });

  app.put("/api/admin/assistant", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const key = process.env.ANTHROPIC_KEY;
    if (!key) return reply.code(409).send({ error: "Chiave del modello non configurata sul server" });
    const b = (req.body ?? {}) as { model?: unknown; effort?: unknown; callLimit?: unknown };
    let models: ModelOption[];
    try {
      models = await listAssistantModels(key);
    } catch {
      return reply.code(502).send({ error: "Non riesco a leggere i modelli da Anthropic. Riprova tra poco." });
    }
    // Solo un modello che Anthropic elenca per questa chiave: niente testo libero.
    const model = models.find((m) => m.id === b.model)?.id;
    if (!model) return reply.code(400).send({ error: "Modello non disponibile per questa chiave" });
    const effort = EFFORTS.find((e) => e === b.effort);
    if (!effort) return reply.code(400).send({ error: "Sforzo non valido" });
    const callLimit = Number(b.callLimit);
    if (!Number.isInteger(callLimit) || callLimit < 1 || callLimit > 500) return reply.code(400).send({ error: "Il limite deve essere un numero da 1 a 500" });
    await saveAssistantSettings({ model, effort, callLimit });
    return { ok: true };
  });

  // Assistente del builder: risponde e propone modifiche validate. La chiave del modello sta solo qui, da ANTHROPIC_KEY.
  app.post<{ Params: { id: string }; Body: unknown }>("/api/invitations/:id/assistant", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const out = await handleAssistant(
      {
        findOwned: async (id, userId) => {
          const inv = await ownedInvitation(id, userId);
          // Stesso dato dell'editor: le funzioni già attive per l'invito (pagate, o scelte in bozza).
          return inv ? { ...inv, purchased_addons: inv.purchased_addons ?? inv.config.addons ?? [] } as OwnedInvitation : null;
        },
        loadCatalog,
        apiKey: process.env.ANTHROPIC_KEY || undefined,
        loadSettings: async () => (await loadAssistantSettings()).settings,
        // Foto stock solo se Pixabay è configurato: il modello cerca, il server importa il file.
        places: searchPlaces,
        stock: process.env.PIXABAY_API_KEY
          ? {
              search: async (query) => (await searchStock(parseStockFilters({ q: query }))).map((p) => ({ id: p.id, tags: p.tags })),
              import: (id) => importStock(id),
            }
          : undefined,
        makeCall: (apiKey) => {
          const client = new Anthropic({ apiKey });
          return (params) => client.messages.create(params);
        },
        recordUsage: async (invitationId, model, usage, actions, state) => {
          await pool.query(
            `WITH bump AS (
               UPDATE invitations SET assistant_calls = assistant_calls + $8, assistant_asked = $9, assistant_free_run = $10
               WHERE id = $1 RETURNING id)
             INSERT INTO assistant_usage (invitation_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, actions, counted)
             SELECT id, $2, $3, $4, $5, $6, $7, $11 FROM bump`,
            [invitationId, model, usage.input, usage.output, usage.cacheRead, usage.cacheWrite, actions, state.counted ? 1 : 0, state.asked, state.freeRun, state.counted],
          );
        },
      },
      { id: req.params.id, userId: user.id, body: req.body },
    );
    return reply.code(out.status).send(out.body);
  });

  app.put<{ Params: { id: string } }>("/api/invitations/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const config = sanitizeConfig(await loadCatalog(), req.body);
    if (!config) return reply.code(400).send({ error: "Configurazione non valida" });
    const rules = editRules({ status: inv.status, edit_count: inv.edit_count });
    if (rules.readOnly) return reply.code(409).send({ error: "Modifica già confermata: l'invito non si modifica più" });
    if (rules.themeLocked && config.themeId !== (inv.config as InviteConfig).themeId) return reply.code(409).send({ error: "Dopo l'acquisto il template non si cambia" });
    // Funzioni nuove: restano in bozza finché non sono pagate (vedi confirm-edit e checkout). Quelle già pagate sono gratuite.
    await pool.query("UPDATE invitations SET config = $1 WHERE id = $2", [JSON.stringify(config), inv.id]);
    return { ok: true };
  });

  // Conferma della modifica dopo l'acquisto: chiude la possibilità di modificare l'invito.
  app.post<{ Params: { id: string } }>("/api/invitations/:id/confirm-edit", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status !== "paid") return reply.code(409).send({ error: "L'invito non è ancora pagato" });
    if (inv.edit_count >= 1) return reply.code(409).send({ error: "Modifica già confermata" });
    // Funzioni nuove in bozza: prima va pagata la differenza, altrimenti la pubblicazione non le includerebbe.
    const pending = pendingOf(inv);
    if (pending.length) {
      const c = await loadCatalog();
      return reply.code(409).send({ error: "Per le funzioni nuove serve il pagamento", code: "payment_required", amountCents: addonsCents(c, inv.config.model, pending) });
    }
    // Conferma = pubblicazione: la bozza diventa la versione che vedono gli ospiti, e la modifica si chiude.
    await pool.query("UPDATE invitations SET edit_count = 1, published_config = config WHERE id = $1", [inv.id]);
    return { ok: true, editCount: 1 };
  });

  app.post<{ Params: { id: string } }>("/api/invitations/:id/guests", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status !== "paid") return reply.code(409).send({ error: "Paga l'invito prima di inviarlo agli ospiti" });

    const b = (req.body ?? {}) as { emails?: unknown; message?: unknown };
    const list = (Array.isArray(b.emails) ? b.emails : [])
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => EMAIL.test(e));
    const unique = [...new Set(list)].slice(0, 100);
    if (unique.length === 0) return reply.code(400).send({ error: "Nessun indirizzo email valido" });
    const personal = typeof b.message === "string" ? b.message.slice(0, 500) : undefined;

    const sent: string[] = [];
    const failed: string[] = [];
    for (const to of unique) {
      try {
        await sendMail(inviteEmail({ to, hosts: textOf(inv.config, "hosts"), title: titleOf(inv.config), slug: inv.slug, personal }));
        sent.push(to);
      } catch {
        failed.push(to);
      }
    }
    const now = new Date().toISOString();
    const guests = [...(inv.guests as Row[])];
    for (const email of sent) if (!guests.some((g) => g.email === email)) guests.push({ email, sentAt: now });
    await pool.query("UPDATE invitations SET guests = $1 WHERE id = $2", [JSON.stringify(guests), inv.id]);
    return { sent: sent.length, failed };
  });

  // Note del pianificatore: testo libero per l'organizzatore (promemoria, nota del conto alla rovescia). Non va nella pagina invito.
  app.put<{ Params: { id: string } }>("/api/invitations/:id/planner", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status !== "paid") return reply.code(409).send({ error: "Il pannello è disponibile dopo il pagamento" });
    const b = (req.body ?? {}) as { notes?: unknown; countdownNote?: unknown };
    const planner = {
      notes: typeof b.notes === "string" ? b.notes.slice(0, 4000) : "",
      countdownNote: typeof b.countdownNote === "string" ? b.countdownNote.slice(0, 200) : "",
    };
    await pool.query("UPDATE invitations SET planner = $1 WHERE id = $2", [JSON.stringify(planner), inv.id]);
    return { ok: true, planner };
  });

  app.get<{ Params: { id: string }; Querystring: { format?: string } }>("/api/invitations/:id/rsvps", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const { rows } = await pool.query("SELECT id, answers, created_at FROM rsvps WHERE invitation_id = $1 ORDER BY created_at DESC", [inv.id]);
    const questions = (inv.config.rsvpQuestions ?? []) as Row[];

    if (req.query.format === "csv") {
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Ricevuta il", ...questions.map((q) => q.label)];
      const lines = rows.map((r) =>
        [
          new Date(r.created_at).toLocaleString("it-IT"),
          ...questions.map((q) => {
            const a = r.answers[q.id];
            return q.type === "yes-no" ? (a === true ? "Sì" : a === false ? "No" : "") : a;
          }),
        ].map(esc).join(","),
      );
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="rsvp-${inv.slug}.csv"`);
      return "﻿" + [header.map(esc).join(","), ...lines].join("\n");
    }

    const yes = rows.filter((r) => r.answers.attending === true);
    return {
      total: rows.length,
      attending: yes.length,
      declined: rows.filter((r) => r.answers.attending === false).length,
      guests: yes.reduce((s, r) => s + (Number(r.answers.guests) || 1), 0),
      questions,
      rsvps: rows.map((r) => ({ id: r.id, createdAt: r.created_at, answers: r.answers })),
    };
  });

  // ───────────── Pubblico: pagina dell'invito, conferme ─────────────
  app.get<{ Params: { slug: string } }>("/api/public/invitations/:slug/page", async (req, reply) => {
    const { rows } = await pool.query("SELECT * FROM invitations WHERE slug = $1 AND status = 'paid'", [req.params.slug]);
    const inv = rows[0];
    if (!inv) return reply.code(404).type("text/html; charset=utf-8").send(NOT_FOUND_PAGE);
    const c = await loadCatalog();
    // Agli ospiti va la versione pubblicata; le modifiche in bozza restano private fino alla conferma.
    const html = renderFor(c, inv.slug, (inv.published_config ?? inv.config) as InviteConfig);
    if (!html) return reply.code(410).type("text/html; charset=utf-8").send(NOT_FOUND_PAGE);
    await pool.query("UPDATE invitations SET views = views + 1 WHERE id = $1", [inv.id]);
    await track("invitation_viewed", inv.id);
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-cache").send(html);
  });

  // Pagina dimostrativa di un tema, con dati d'esempio: la usano la home e la scheda dei modelli.
  // Suggerimenti di indirizzo mentre si scrive (OpenStreetMap, senza chiave). Risultati in cache per 10 minuti.
  const geoCache = new Map<string, { at: number; results: string[] }>();
  app.get("/api/geocode", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const q = String((req.query as { q?: string }).q ?? "").trim().slice(0, 200);
    if (q.length < 3) return { results: [] };
    const hit = geoCache.get(q);
    if (hit && Date.now() - hit.at < 600_000) return { results: hit.results };
    let results: string[] = [];
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=it&q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": "InviteMe/1.0 (https://demo.shosa.me)" },
      });
      const list = (await res.json()) as { display_name?: string }[];
      results = list.map((x) => x.display_name ?? "").filter(Boolean);
    } catch {
      results = [];
    }
    geoCache.set(q, { at: Date.now(), results });
    return { results };
  });

  // Anteprima dedicata di uno stile: telefono o desktop contenuto; a schermo intero da telefono.
  app.get<{ Params: { id: string } }>("/api/themes/:id/anteprima", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    if (!theme) return reply.code(404).type("text/plain; charset=utf-8").send("Tema non trovato");
    const q = req.query as { lang?: string; s?: string };
    const lang = q.lang === "en" ? "en" : "it";
    const seed = /^[a-z0-9]{1,12}$/i.test(q.s ?? "") ? (q.s as string) : "x";
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(previewShell(theme.manifest.id, theme.manifest.name, lang, seed));
  });

  app.get<{ Params: { id: string } }>("/api/themes/:id/demo", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    if (!theme) return reply.code(404).type("text/plain; charset=utf-8").send("Tema non trovato");
    const lang = (req.query as { lang?: string }).lang === "en" ? "en" : "it";
    const html = renderInvitePage({ theme, config: sampleConfig(theme.manifest, lang), slug: "demo", features: new Set(ADDON_KEYS), runtime: RUNTIME, preview: true });
    // Ogni caricamento è un esempio diverso: niente cache.
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(html);
  });

  // Anteprima del builder: stessa pagina, con la configurazione in corso. Non viene salvata.
  app.post<{ Params: { id: string } }>("/api/invitations/:id/preview", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const c = await loadCatalog();
    const config = sanitizeConfig(c, req.body);
    if (!config) return reply.code(400).send({ error: "Configurazione non valida" });
    // Di default l'anteprima mostra la pagina senza busta: il cliente vede subito i contenuti. ?cover=1 la mostra.
    const showCover = (req.query as { cover?: string }).cover === "1";
    const html = renderFor(c, inv.slug, config, !showCover, true);
    if (!html) return reply.code(400).send({ error: "Tema non disponibile" });
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(html);
  });

  // Carica un file del cliente (foto, video, audio): ffmpeg lo converte prima di salvarlo. Chiuso solo dopo la conferma della modifica.
  app.post<{ Params: { id: string }; Querystring: { kind?: string } }>("/api/invitations/:id/media", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (editRules({ status: inv.status, edit_count: inv.edit_count }).readOnly) return reply.code(409).send({ error: "Modifica già confermata: l'invito non si modifica più" });
    const kind = String(req.query.kind ?? "");
    if (!isMediaKind(kind)) return reply.code(400).send({ error: "Tipo di file non valido" });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Nessun file ricevuto" });
    const ext = INPUT_TYPES[kind][file.mimetype];
    if (!ext) return reply.code(415).send({ error: "Formato non supportato" });
    const buffer = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: "File troppo grande" });
    try {
      const saved = await convertMedia(kind, buffer, ext);
      return reply.code(201).send({ url: saved.url, kind, bytes: saved.bytes });
    } catch (e) {
      if (e instanceof MediaError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
  });

  // Foto da Pixabay: la ricerca e l'importazione passano dal server, che tiene la chiave.
  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>("/api/invitations/:id/stock/search", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    try {
      return { photos: await searchStock(parseStockFilters(req.query)) };
    } catch (e) {
      if (e instanceof StockError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
  });

  app.post<{ Params: { id: string }; Body: { id?: number } }>("/api/invitations/:id/stock/import", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (editRules({ status: inv.status, edit_count: inv.edit_count }).readOnly) return reply.code(409).send({ error: "Modifica già confermata: l'invito non si modifica più" });
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: "Foto non valida" });
    try {
      const saved = await importStock(id);
      return reply.code(201).send({ url: saved.url, kind: "photo", bytes: saved.bytes });
    } catch (e) {
      if (e instanceof StockError || e instanceof MediaError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
  });

  // Ricerca luoghi per il campo di ricerca (assistente e wizard): solo utenti registrati, risultati in cache.
  app.get<{ Querystring: { q?: string } }>("/api/places", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    return { places: await searchPlaces(String(req.query.q ?? "")) };
  });

  app.post("/api/rsvp", async (req, reply) => {
    const b = (req.body ?? {}) as { slug?: string; answers?: Record<string, unknown>; website?: unknown };
    // Campo trappola: un ospite vero non lo compila mai. Se arriva pieno è un bot: risposta ok, nulla salvato.
    if (typeof b.website === "string" && b.website.trim()) return reply.code(201).send({ ok: true });
    if (!b.slug || !b.answers || typeof b.answers !== "object") return reply.code(400).send({ error: "Dati mancanti" });
    const { rows } = await pool.query(
      `SELECT i.id, i.config, u.email AS owner_email FROM invitations i JOIN users u ON u.id = i.user_id
       WHERE i.slug = $1 AND i.status = 'paid'`,
      [b.slug],
    );
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const c = await loadCatalog();
    if (!hasRsvp(c, inv.config)) return reply.code(400).send({ error: "Questo invito non prevede conferma di presenza" });

    // Solo le domande configurate, con valori del tipo giusto. Quelle obbligatorie devono esserci.
    const questions = (inv.config.rsvpQuestions as RsvpQuestion[]) ?? [];
    const answers: Record<string, string | number | boolean> = {};
    for (const q of questions) {
      const v = b.answers[q.id];
      if (q.type === "yes-no" && typeof v === "boolean") answers[q.id] = v;
      else if (q.type === "number" && typeof v === "number" && v >= 0 && v <= 50) answers[q.id] = Math.round(v);
      else if (q.type === "text" && typeof v === "string" && v.trim()) answers[q.id] = v.trim().slice(0, 500);
      else if (q.type === "choice" && typeof v === "string" && (q.options ?? []).includes(v)) answers[q.id] = v;
      if (q.required && answers[q.id] === undefined) return reply.code(400).send({ error: `Manca una risposta: ${q.label}` });
    }

    await pool.query("INSERT INTO rsvps (id, invitation_id, answers) VALUES ($1, $2, $3)", [randomUUID(), inv.id, JSON.stringify(answers)]);
    await track("rsvp_submitted", inv.id);
    // Notifica al proprietario: un errore di posta non blocca la risposta dell'ospite.
    await sendMail(
      rsvpNoticeEmail({ to: inv.owner_email, title: titleOf(inv.config), attending: answers.attending === true, invitationId: inv.id }),
    ).catch((e) => req.log.warn({ err: e }, "notifica RSVP non inviata"));
    return reply.code(201).send({ ok: true });
  });

  // ───────────── Pagamento ─────────────
  app.post("/api/checkout", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const b = (req.body ?? {}) as { invitationId?: string };
    const inv = b.invitationId && UUID.test(b.invitationId) ? await ownedInvitation(b.invitationId, user.id) : null;
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    // Invito già pagato: si paga solo la differenza delle funzioni nuove (ordine «upgrade»), non il modello.
    const upgrade = inv.status === "paid";
    if (upgrade && inv.edit_count >= 1) return reply.code(409).send({ error: "Modifica già confermata: l'invito non si modifica più" });
    const pending = upgrade ? pendingOf(inv) : [];
    if (upgrade && pending.length === 0) return reply.code(409).send({ error: "Nessuna funzione da pagare" });
    if (!shopifyConfigured() && !localCheckoutAllowed()) {
      return reply.code(503).send({ error: "I pagamenti non sono ancora attivi su questo server" });
    }
    const c = await loadCatalog();
    const selected = upgrade
      ? pending
      : [...activeFeatures(c, inv.config.model, inv.config.addons)].filter((k) => inv.config.addons.includes(k));
    const amount = upgrade ? addonsCents(c, inv.config.model, pending) : totalCents(c, inv.config.model, inv.config.addons);
    try {
      const checkout = await createCheckout({
        invitationId: inv.id,
        slug: inv.slug,
        addons: selected,
        totalCents: amount,
        origin: appUrl(),
        kind: upgrade ? "upgrade" : "initial",
      });
      await pool.query(
        "INSERT INTO orders (id, invitation_id, amount_cents, currency, source, status, checkout_url, kind, addons) VALUES ($1, $2, $3, 'EUR', $4, 'pending', $5, $6, $7)",
        [randomUUID(), inv.id, amount, checkout.source, checkout.checkoutUrl, upgrade ? "upgrade" : "initial", JSON.stringify(selected)],
      );
      await track("checkout_started", inv.id);
      return { checkoutUrl: checkout.checkoutUrl };
    } catch (e) {
      return reply.code(502).send({ error: e instanceof Error ? e.message : "Errore checkout" });
    }
  });

  // Solo checkout di prova: disattivato con Shopify e in produzione (salvo ALLOW_LOCAL_CHECKOUT=true).
  app.post("/api/checkout/complete", async (req, reply) => {
    if (shopifyConfigured() || !localCheckoutAllowed()) return reply.code(403).send({ error: "Checkout di prova non disponibile" });
    const user = await requireUser(req, reply);
    if (!user) return;
    const b = (req.body ?? {}) as { invitationId?: string; orderId?: string };
    if (b.orderId) {
      const { rows } = await pool.query("SELECT id, user_id, draft, amount_cents, invitation_id FROM orders WHERE id = $1 AND user_id = $2 AND status = 'pending' AND draft IS NOT NULL", [b.orderId, user.id]);
      if (!rows[0]) return reply.code(404).send({ error: "Ordine non trovato" });
      if (rows[0].invitation_id) return { ok: true, invitationId: rows[0].invitation_id };
      const invitationId = await createInvitationFromOrder(rows[0], "local", `TEST-${Date.now()}`);
      return { ok: true, invitationId };
    }
    const inv = b.invitationId && UUID.test(b.invitationId) ? await ownedInvitation(b.invitationId, user.id) : null;
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status === "paid") {
      // Già pagato: si chiude l'ordine di aggiornamento in attesa, non l'acquisto.
      const { rows } = await pool.query("SELECT addons, amount_cents FROM orders WHERE invitation_id = $1 AND kind = 'upgrade' AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [inv.id]);
      if (!rows[0]) return reply.code(409).send({ error: "Nessun pagamento in attesa" });
      await applyUpgrade(inv.id, rows[0].addons ?? [], rows[0].amount_cents, "local", randomUUID());
      return { ok: true };
    }
    const c = await loadCatalog();
    await markPaid(inv.id, `TEST-${Date.now()}`, totalCents(c, inv.config.model, inv.config.addons), "local");
    return { ok: true };
  });

  // Aggiornamento dopo l'acquisto: le funzioni pagate diventano acquistate. La versione pubblicata e lo stato non cambiano:
  // la bozza va pubblicata con la conferma.
  async function applyUpgrade(invitationId: string, addons: string[], amountCents: number, source: "shopify" | "local", orderId: string) {
    const { rows } = await pool.query("SELECT purchased_addons, config FROM invitations WHERE id = $1", [invitationId]);
    const owned = new Set<string>(rows[0]?.purchased_addons ?? rows[0]?.config?.addons ?? []);
    for (const a of addons) owned.add(a);
    await pool.query("UPDATE invitations SET purchased_addons = $2 WHERE id = $1", [invitationId, JSON.stringify([...owned])]);
    await pool.query("UPDATE orders SET status = 'paid' WHERE invitation_id = $1 AND kind = 'upgrade' AND status = 'pending'", [invitationId]);
    await pool.query(
      "INSERT INTO orders (id, invitation_id, amount_cents, currency, source, status, kind, addons) VALUES ($1, $2, $3, 'EUR', $4, 'paid', 'upgrade', $5) ON CONFLICT (id) DO NOTHING",
      [orderId, invitationId, amountCents, source, JSON.stringify(addons)],
    );
    await track("upgrade_paid", invitationId);
  }

  // Dopo il pagamento di un ordine nato dalla home: l'invito nasce nel profilo, acquistato e ancora non pubblicato.
  // Resta modificabile dal builder finché non si pubblica (conferma).
  async function createInvitationFromOrder(order: { id: string; user_id: string; draft: { model: string; themeId: string; eventType: string; addons: string[] }; amount_cents: number }, source: "shopify" | "local", orderRef: string): Promise<string> {
    const c = await loadCatalog();
    const d = order.draft;
    const theme = getTheme(c, d.themeId, d.model) ?? enabledThemes(c, d.model)[0];
    if (!theme) throw new Error("Nessun tema disponibile");
    const eventType = (EVENT_TYPES.find((e) => e.id === d.eventType)?.id ?? "wedding") as EventType;
    const addons = d.addons as AddonKey[];
    const config = { ...defaultConfig(theme, d.model, eventType, activeFeatures(c, d.model, addons)), addons };
    const id = randomUUID();
    const slug = makeSlug(titleOf(config));
    await pool.query(
      "INSERT INTO invitations (id, slug, user_id, config, status, purchased_addons, published_config, order_ref) VALUES ($1, $2, $3, $4, 'paid', $5, $4, $6)",
      [id, slug, order.user_id, JSON.stringify(config), JSON.stringify(d.addons), orderRef],
    );
    await pool.query("UPDATE orders SET status = 'paid', invitation_id = $2, source = $3 WHERE id = $1", [order.id, id, source]);
    await track("order_paid", id);
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [order.user_id]);
    if (rows[0]) {
      await sendMail(orderEmail({ to: rows[0].email, title: titleOf(config), amount: formatPrice(order.amount_cents), slug })).catch((e) => app.log.warn({ err: e }, "conferma d'ordine non inviata"));
    }
    return id;
  }

  // Modalità demo (DEMO_MODE=true, senza Shopify): crea un invito di prova senza pagamento, per provare il builder.
  // Senza sessione crea un utente demo e apre la sessione. Non esiste con Shopify configurato.
  app.post("/api/demo/invitations", async (req, reply) => {
    if (!demoMode()) return reply.code(404).send({ error: "Modalità demo non attiva" });
    let user = await currentUser(req);
    if (!user) {
      const id = randomUUID();
      const { rows } = await pool.query("INSERT INTO users (id, email, name) VALUES ($1, $2, 'Demo') RETURNING id, email, name, role", [id, `demo-${id.slice(0, 8)}@demo.invalid`]);
      user = rows[0];
      await startSession(reply, user!.id);
    }
    const c = await loadCatalog();
    const b = (req.body ?? {}) as { model?: string; themeId?: string; eventType?: string; addons?: unknown };
    const model = getModel(c, String(b.model ?? "")) ?? c.models[0];
    if (!model) return reply.code(400).send({ error: "Nessun modello disponibile" });
    const theme = (b.themeId ? getTheme(c, String(b.themeId), model.id) : undefined) ?? enabledThemes(c, model.id)[0];
    if (!theme) return reply.code(400).send({ error: "Nessun tema disponibile per questo modello" });
    const eventType = EVENT_TYPES.find((e) => e.id === b.eventType)?.id ?? "wedding";
    const addons = Array.isArray(b.addons) ? [...new Set(b.addons.filter((k): k is string => typeof k === "string" && model.options.includes(k as AddonKey)))] : [];
    const amount = totalCents(c, model.id, addons);
    const orderId = randomUUID();
    const draft = { model: model.id, themeId: theme.id, eventType, addons };
    await pool.query(
      "INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, checkout_url, kind, draft) VALUES ($1, $2, NULL, $3, 'EUR', 'local', 'pending', '', 'initial', $4)",
      [orderId, user!.id, amount, JSON.stringify(draft)],
    );
    const invitationId = await createInvitationFromOrder({ id: orderId, user_id: user!.id, draft, amount_cents: amount }, "local", `DEMO-${Date.now()}`);
    return { invitationId };
  });

  // Acquisto prima dell'invito: si crea il pagamento con la scelta; l'invito nasce al pagamento riuscito.
  app.post("/api/checkout/new", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!shopifyConfigured() && !localCheckoutAllowed()) return reply.code(503).send({ error: "I pagamenti non sono ancora attivi su questo server" });
    const c = await loadCatalog();
    const b = (req.body ?? {}) as { model?: string; themeId?: string; eventType?: string; addons?: unknown };
    const model = getModel(c, String(b.model ?? ""));
    if (!model) return reply.code(400).send({ error: "Modello non disponibile" });
    const requested = b.themeId ? getTheme(c, String(b.themeId), model.id) : undefined;
    if (b.themeId && !requested) return reply.code(400).send({ error: "Tema non disponibile per questo modello" });
    const theme = requested ?? enabledThemes(c, model.id)[0];
    if (!theme) return reply.code(400).send({ error: "Nessun tema disponibile per questo modello" });
    const eventType = EVENT_TYPES.find((e) => e.id === b.eventType)?.id ?? "wedding";
    const addons = Array.isArray(b.addons) ? [...new Set(b.addons.filter((k): k is string => typeof k === "string" && model.options.includes(k as AddonKey)))] : [];
    const amount = totalCents(c, model.id, addons);
    const orderId = randomUUID();
    const draft = { model: model.id, themeId: theme.id, eventType, addons };
    try {
      const checkout = await createCheckout({ orderId, addons, totalCents: amount, origin: appUrl(), kind: "initial" });
      await pool.query(
        "INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, checkout_url, kind, draft) VALUES ($1, $2, NULL, $3, 'EUR', $4, 'pending', $5, 'initial', $6)",
        [orderId, user.id, amount, checkout.source, checkout.checkoutUrl, JSON.stringify(draft)],
      );
      await track("checkout_started", orderId);
      return { checkoutUrl: checkout.checkoutUrl };
    } catch (e) {
      return reply.code(502).send({ error: e instanceof Error ? e.message : "Errore checkout" });
    }
  });

  async function markPaid(invitationId: string, orderRef: string, amountCents: number, source: "shopify" | "local") {
    // Al pagamento si registra cosa è stato acquistato e la versione che va online.
    await pool.query("UPDATE invitations SET status = 'paid', order_ref = $2, purchased_addons = config->'addons', published_config = config WHERE id = $1", [invitationId, orderRef]);
    await pool.query(
      `UPDATE orders SET status = 'paid' WHERE invitation_id = $1 AND status = 'pending'`,
      [invitationId],
    );
    await pool.query(
      "INSERT INTO orders (id, invitation_id, amount_cents, currency, source, status) SELECT $1, $2, $3, 'EUR', $4, 'paid' WHERE NOT EXISTS (SELECT 1 FROM orders WHERE invitation_id = $2 AND status = 'paid')",
      [randomUUID(), invitationId, amountCents, source],
    );
    await track("order_paid", invitationId);
    const { rows } = await pool.query(
      `SELECT i.slug, i.config, u.email FROM invitations i JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
      [invitationId],
    );
    if (rows[0]) {
      await sendMail(
        orderEmail({ to: rows[0].email, title: titleOf(rows[0].config), amount: formatPrice(amountCents), slug: rows[0].slug }),
      ).catch((e) => app.log.warn({ err: e }, "conferma d'ordine non inviata"));
    }
  }

  // Webhook Shopify orders/paid: firma verificata sul corpo grezzo, poi attivazione dell'invito.
  app.post("/api/webhooks/shopify", async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? "";
    if (!verifyShopifyWebhook(raw, req.headers["x-shopify-hmac-sha256"] as string | undefined)) {
      return reply.code(401).send({ error: "Firma non valida" });
    }
    if (req.headers["x-shopify-topic"] !== "orders/paid") return { ok: true, ignored: true };
    const order = req.body as {
      id: number;
      name: string;
      total_price: string;
      currency: string;
      note_attributes?: { name: string; value: string }[];
      line_items?: { properties?: { name: string; value: string }[] }[];
    };
    const orderId = orderIdFromOrder(order);
    if (orderId) {
      const { rows } = await pool.query("SELECT id, user_id, draft, amount_cents, invitation_id FROM orders WHERE id = $1 AND status = 'pending' AND draft IS NOT NULL", [orderId]);
      if (rows[0] && !rows[0].invitation_id) await createInvitationFromOrder(rows[0], "shopify", order.name);
    }
    const invitationId = invitationIdFromOrder(order);
    const amountCents = Math.round(Number(order.total_price) * 100);
    if (invitationId && UUID.test(invitationId)) {
      const { rows } = await pool.query("SELECT id, status FROM invitations WHERE id = $1", [invitationId]);
      if (rows[0]?.status === "paid") {
        // Già pagato: conta solo un ordine di aggiornamento che dichiara le funzioni nuove.
        if (orderAttr(order, "kind") === "upgrade") {
          const addons = (orderAttr(order, "addons") ?? "").split(",").filter((k) => k && k !== "none");
          await applyUpgrade(invitationId, addons, amountCents, "shopify", String(order.id));
        }
      } else if (rows[0]) await markPaid(invitationId, order.name, amountCents, "shopify");
    }
    await pool.query(
      `INSERT INTO orders (id, invitation_id, amount_cents, currency, source, status) VALUES ($1, $2, $3, $4, 'shopify', 'paid')
       ON CONFLICT (id) DO NOTHING`,
      [String(order.id), invitationId && UUID.test(invitationId) ? invitationId : null, Math.round(Number(order.total_price) * 100), order.currency],
    );
    return { ok: true };
  });

  // ───────────── Admin: metriche, catalogo, musica, ordini, utenti ─────────────
  app.get("/api/admin/metrics", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM invitations) AS invitations,
        (SELECT count(*)::int FROM invitations WHERE status = 'paid') AS paid,
        (SELECT coalesce(sum(amount_cents), 0)::int FROM orders WHERE status = 'paid') AS revenue_cents,
        (SELECT count(*)::int FROM orders WHERE status = 'paid') AS orders,
        (SELECT coalesce(sum(views), 0)::int FROM invitations) AS views,
        (SELECT count(*)::int FROM rsvps) AS rsvps,
        (SELECT coalesce(sum(jsonb_array_length(guests)), 0)::int FROM invitations) AS guest_emails,
        (SELECT count(*)::int FROM events WHERE type = 'checkout_started') AS checkouts`);
    const byModel = await pool.query("SELECT config->>'model' AS model, count(*)::int AS n FROM invitations GROUP BY 1");
    const m = rows[0];
    return {
      users: m.users,
      invitations: m.invitations,
      drafts: m.invitations - m.paid,
      paid: m.paid,
      orders: m.orders,
      revenueCents: m.revenue_cents,
      views: m.views,
      rsvps: m.rsvps,
      guestEmailsSent: m.guest_emails,
      checkoutsStarted: m.checkouts,
      conversionRate: m.invitations ? m.paid / m.invitations : 0,
      byModel: Object.fromEntries(byModel.rows.map((r) => [r.model, r.n])),
    };
  });

  app.get("/api/admin/catalog", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return loadFullCatalog();
  });

  // Salva modelli, funzioni e attivazione dei temi. Ogni valore viene validato: l'admin non può inserire HTML o prezzi negativi.
  app.put("/api/admin/catalog", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const b = (req.body ?? {}) as { models?: Row[]; addons?: Row[]; themes?: { id?: unknown; enabled?: unknown }[] };
    const addonKeys = ["rsvp", "program", "map", "music", "countdown", "gallery"];
    const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

    const addons = (b.addons ?? []).filter((a) => addonKeys.includes(a.key)).map((a) => ({
      key: a.key,
      label: text(a.label, 80),
      description: text(a.description, 160),
      cents: Math.round(Math.max(0, Math.min(100_000_00, Number(a.cents) || 0))),
      enabled: !!a.enabled,
    }));
    const keySet = new Set(addons.map((a) => a.key));
    const models = (b.models ?? []).slice(0, 12).map((m, i) => ({
      id: text(m.id, 40).replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `modello-${i}`,
      name: text(m.name, 80),
      tagline: text(m.tagline, 120),
      description: text(m.description, 400),
      priceCents: Math.round(Math.max(0, Math.min(100_000_00, Number(m.priceCents) || 0))),
      included: (Array.isArray(m.included) ? m.included : []).filter((k: string) => keySet.has(k)),
      options: (Array.isArray(m.options) ? m.options : []).filter((k: string) => keySet.has(k) && !(m.included ?? []).includes(k)),
      enabled: !!m.enabled,
      sort: Number.isFinite(Number(m.sort)) ? Number(m.sort) : i,
      ...(m.en && typeof m.en === "object" ? { en: { name: text((m.en as Row).name, 80), tagline: text((m.en as Row).tagline, 120), description: text((m.en as Row).description, 400) } } : {}),
    }));
    // I temi sono file del repository: qui si decide solo quali sono attivi.
    const known = new Set(themes().map((t) => t.manifest.id));
    const themeList = (Array.isArray(b.themes) ? b.themes : [])
      .filter((t) => known.has(String(t.id)))
      .map((t) => ({ id: String(t.id), enabled: t.enabled !== false }));
    if (models.length === 0 || !themeList.some((t) => t.enabled)) return reply.code(400).send({ error: "Serve almeno un modello e un tema attivo" });
    await saveCatalog({ models, addons, themes: themeList });
    return { ok: true };
  });

  // Attiva o disattiva un tema.
  app.patch<{ Params: { id: string } }>("/api/admin/themes/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const c = await loadFullCatalog();
    if (!c.themes.some((t) => t.manifest.id === req.params.id)) return reply.code(404).send({ error: "Tema non trovato" });
    const enabled = (req.body as { enabled?: boolean })?.enabled === true;
    const next = c.themes.map((t) => ({ id: t.manifest.id, enabled: t.manifest.id === req.params.id ? enabled : t.enabled }));
    if (!next.some((t) => t.enabled)) return reply.code(400).send({ error: "Serve almeno un tema attivo" });
    await saveCatalog({ models: c.models, addons: c.addons, themes: next });
    return { ok: true };
  });

  app.get("/api/admin/music", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query("SELECT id, title, artist, url, license, enabled, created_at FROM music_tracks ORDER BY created_at DESC");
    return rows;
  });

  // Carica un brano nella libreria. Serve la conferma dei diritti: è una responsabilità dell'admin. ffmpeg lo porta in MP3.
  app.post("/api/admin/music", async (req, reply) => {
    invalidateCatalog();
    if (!(await requireAdmin(req, reply))) return;
    // Il form può arrivare con i campi prima o dopo il file: li leggiamo tutti prima di decidere.
    let file: MultipartFile | undefined;
    let buffer: Buffer | undefined;
    const fields: Record<string, string> = {};
    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (part.fieldname === "file" && !file) {
          file = part;
          buffer = await part.toBuffer();
        } else {
          await part.toBuffer();
        }
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
    if (!file || !buffer) return reply.code(400).send({ error: "Nessun file ricevuto" });
    const ext = INPUT_TYPES.audio[file.mimetype];
    if (!ext) return reply.code(400).send({ error: "Formato non supportato: usa MP3, M4A, OGG o WAV" });
    const title = String(fields.title || file.filename).slice(0, 120).trim();
    const artist = String(fields.artist ?? "").slice(0, 120);
    const license = String(fields.license ?? "").slice(0, 300);
    if (fields.rights !== "true") return reply.code(400).send({ error: "Conferma di avere i diritti del brano" });
    if (!title) return reply.code(400).send({ error: "Inserisci il titolo" });
    if (file.file.truncated) return reply.code(413).send({ error: "File troppo grande" });
    try {
      const saved = await convertMedia("audio", buffer, ext);
      const id = randomUUID();
      await pool.query("INSERT INTO music_tracks (id, title, artist, url, license) VALUES ($1, $2, $3, $4, $5)", [id, title, artist, saved.url, license]);
      return reply.code(201).send({ id, title });
    } catch (e) {
      if (e instanceof MediaError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
  });

  app.post<{ Params: { id: string } }>("/api/admin/music/:id", async (req, reply) => {
    invalidateCatalog();
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Brano non trovato" });
    const b = (req.body ?? {}) as { title?: string; artist?: string; license?: string; enabled?: boolean };
    await pool.query(
      `UPDATE music_tracks SET title = coalesce($2, title), artist = coalesce($3, artist), license = coalesce($4, license),
       enabled = coalesce($5, enabled) WHERE id = $1`,
      [req.params.id, b.title?.slice(0, 120) ?? null, b.artist?.slice(0, 120) ?? null, b.license?.slice(0, 300) ?? null, typeof b.enabled === "boolean" ? b.enabled : null],
    );
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/admin/music/:id", async (req, reply) => {
    invalidateCatalog();
    if (!(await requireAdmin(req, reply))) return;
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Brano non trovato" });
    const { rows } = await pool.query("DELETE FROM music_tracks WHERE id = $1 RETURNING url", [req.params.id]);
    if (rows[0]?.url?.startsWith("/api/media/")) fs.rmSync(path.join(MEDIA_DIR, path.basename(rows[0].url)), { force: true });
    return { ok: true };
  });

  app.get("/api/admin/orders", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query(
      `SELECT o.id, o.amount_cents, o.source, o.status, o.created_at, i.config->>'title' AS title, u.email
       FROM orders o LEFT JOIN invitations i ON i.id = o.invitation_id LEFT JOIN users u ON u.id = i.user_id
       ORDER BY o.created_at DESC LIMIT 200`,
    );
    return rows;
  });

  app.get("/api/admin/users", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, (SELECT count(*)::int FROM invitations i WHERE i.user_id = u.id) AS invitations
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
    );
    return rows;
  });

  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const role = (req.body as { role?: string })?.role;
    if (role !== "admin" && role !== "user") return reply.code(400).send({ error: "Ruolo non valido" });
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: "Utente non trovato" });
    await pool.query("UPDATE users SET role = $2 WHERE id = $1", [req.params.id, role]);
    return { ok: true };
  });

  // Solo fuori produzione: le email in outbox, per verificare il flusso senza provider di posta.
  app.get("/api/dev/outbox", async (_req, reply) => {
    if (isProd) return reply.code(404).send({ error: "Non disponibile" });
    const { rows } = await pool.query("SELECT to_address AS to, subject, text, created_at FROM outbox ORDER BY id DESC LIMIT 100");
    return rows;
  });

  registerAdminInvitations(app, requireAdmin);
  registerAdminMedia(app, requireAdmin);
  return app;
}

export async function startApi() {
  await migrate();
  // Se ADMIN_EMAIL è impostata, quell'utente diventa admin all'avvio (utile dopo il primo deploy).
  if (process.env.ADMIN_EMAIL) {
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [process.env.ADMIN_EMAIL.toLowerCase()]);
  }
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
  return app;
}

export type { Catalog, AddonKey, MailMessage, InviteConfig };
