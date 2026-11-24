import { randomUUID } from "crypto";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import multipart, { type MultipartFile } from "@fastify/multipart";
import staticFiles from "@fastify/static";
import {
  ADDON_KEYS,
  EVENT_TYPES,
  isEventType,
  escapeHtml,
  isLibraryIcon,
  type TemplateCategory,
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
  attendanceOf,
  partySizeOf,
  applySetup,
  normalizeSlug,
  blockDef,
  withTheme,
  csvCell,
} from "@inviteme/shared";
import Anthropic from "@anthropic-ai/sdk";
import { pool, migrate, track } from "./db";
import { handleAssistant, type OwnedInvitation } from "./assistant";
import { searchPlaces } from "./places";
import { EFFORTS, listAssistantModels, loadAssistantSettings, saveAssistantSettings, type ModelOption } from "./assistantSettings";
import { invalidateCatalog, loadCatalog, loadFullCatalog, reloadThemes, saveCatalog, themes } from "./catalog";
import { previewShell } from "./engine/previewShell";
import { renderInvitePage } from "./engine/page";
import { RUNTIME_PATH, THEMES_DIR, sampleConfig } from "./engine/themes";
import { installThemeZip, removeThemeDir, ThemeUploadError } from "./themeUpload";
import { MEDIA_DIR, MediaError, convertMedia, ensureMediaDirs, INPUT_TYPES, makeThumbnail, type MediaKind } from "./media";
import { StockError, importStock, parseStockFilters, searchStock } from "./pixabay";
import { PASSWORD_MIN, SESSION_COOKIE, adminAllowed, currentUser, endSession, hashPassword, startSession, verifyPassword, type SessionUser, createAccessToken, roleForEmail, userForAccessToken } from "./auth";
import { accessEmail, appUrl, orderEmail, purchaseEmail, rsvpNoticeEmail, sendMail, type MailMessage } from "./mail";
import { getLastMailResult, getMailSettings, loadMailSettings, mailProvider, saveMailSettings, validateMailSettings, fromAddress, resendKey } from "./mailSettings";
import { getAllMailTemplates, isMailKind, loadMailTemplates, rsvpVerdict, saveMailTemplate, validateMailTemplate, MAIL_VARIABLES } from "./mailTemplates";
import { renderMail } from "./mail";
import { registerAdminInvitations } from "./adminInvitations";
import { registerAdminConsole } from "./adminConsole";
import { registerAdminMedia } from "./adminMedia";
import { getShopifyIds, loadShopifySettings, normalizeProduct, normalizeVariant, resolveCreditsId, shopLinks, shopifyStatus, saveShopifyIds, testShopify, validateShopifyIds } from "./shopifySettings";
import { isInviteTier } from "@inviteme/shared";
import { sanitizeDocs } from "./planner";
import { registerPlannerRoutes } from "./plannerRoutes";
import { isStudio, registerProRoutes } from "./pro";
import { changedSections, recordPublish, recordSave } from "./editActivity";
import { errorToEnglish } from "./errorsEn";
import { CreditsCheckoutError, createAiCreditsCheckout, createCheckout, demoMode, invitationIdFromOrder, orderIdFromOrder, localCheckoutAllowed, shopifyConfigured, verifyShopifyWebhook } from "./shopify";

const isProd = process.env.NODE_ENV === "production";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, any>;

// Il codice della pagina invito (runtime del motore): letto una volta, incorporato in ogni pagina.
const RUNTIME = fs.readFileSync(RUNTIME_PATH, "utf8");

const textOf = (config: InviteConfig, key: string) => String(config.event[key] ?? "");

// Funzioni già pagate di un invito: le funzioni tolte e riaggiunte restano pagate, quindi gratuite.
const purchasedOf = (_inv: { purchased_addons?: unknown; config?: unknown }) => new Set<string>(ADDON_KEYS);
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
// Anteprime (template e builder): nessuna barra di scorrimento. La pagina scorre comunque con rotella e dito.
const NO_SCROLLBAR = "<style>html,body{scrollbar-width:none;-ms-overflow-style:none}::-webkit-scrollbar{display:none}</style>";
const quietScroll = (html: string) => (html.includes("</head>") ? html.replace("</head>", `${NO_SCROLLBAR}</head>`) : NO_SCROLLBAR + html);

function renderFor(c: Catalog, slug: string, config: InviteConfig, preview = false, builder = false): string | null {
  const theme = themes().find((t) => t.manifest.id === config.themeId);
  if (!theme) return null;
  return renderInvitePage({ theme, config, slug, features: activeFeatures(c, config.model, config.addons), runtime: RUNTIME, preview, builder });
}

// Toglie da una mappa di limiti le voci più vecchie della finestra (at: istante della prima richiesta o dell'ultima).
function pruneExpired<V extends { at: number } | number>(map: Map<string, V>, windowMs: number) {
  const now = Date.now();
  for (const [k, v] of map) if (now - (typeof v === "number" ? v : v.at) > windowMs) map.delete(k);
}

const NOT_FOUND_PAGE = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Invito non disponibile · Invitation not available</title></head><body style="font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#17242A"><p>Questo invito non è disponibile.</p><p lang="en">This invitation is not available.</p></body></html>`;

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 12 * 1024 * 1024 });
  // Errori interni (5xx): nei log il dettaglio, al cliente in produzione solo un messaggio generico (il testo di
  // PostgreSQL o di una libreria può rivelare tabelle, colonne o percorsi). Gli errori 4xx restano come prima.
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    const status = typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err }, "errore interno");
      const message = process.env.NODE_ENV === "production" ? "Errore interno: riprova tra poco" : err.message;
      return reply.code(status).send({ statusCode: status, error: message, message });
    }
    return reply.code(status).send({ statusCode: status, ...(err.code ? { code: err.code } : {}), error: http.STATUS_CODES[status] ?? "Error", message: err.message });
  });
  await app.register(cookie);
  // Sito in inglese: i messaggi per il cliente ({ error }, { message }) partono tradotti. Vedi errorsEn.ts.
  app.addHook("preSerialization", async (req, _reply, payload) => {
    if (req.cookies.lang !== "en" || !payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const body = payload as Record<string, unknown>;
    if (typeof body.error !== "string" && typeof body.message !== "string") return payload;
    return {
      ...body,
      ...(typeof body.error === "string" ? { error: errorToEnglish(body.error) } : {}),
      ...(typeof body.message === "string" ? { message: errorToEnglish(body.message) } : {}),
    };
  });
  // Il limite più alto è quello dei video in ingresso: poi ffmpeg li riduce (vedi media.ts).
  await app.register(multipart, { limits: { fileSize: 150 * 1024 * 1024, files: 1 } });
  ensureMediaDirs();
  await app.register(staticFiles, { root: MEDIA_DIR, prefix: "/api/media/", decorateReply: false, maxAge: "7d" });
  // Asset dei temi (immagini, video, audio): una sola rotta per tutti, così un tema caricato dalla console
  // funziona subito, senza riavvio. sendFile gestisce tipi, cache e richieste parziali (video su Safari).
  await app.register(staticFiles, { root: THEMES_DIR, serve: false });
  app.get<{ Params: { id: string; "*": string } }>("/api/themes/:id/assets/*", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    const file = req.params["*"];
    if (!theme || !/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith(".")) return reply.code(404).send({ error: "File non trovato" });
    // I file dei temi non eseguono codice anche se aperti da soli (es. un SVG): niente script, contenuto isolato.
    reply.header("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.sendFile(file, path.join(theme.dir, "assets"), { maxAge: "7d", index: false });
  });

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
    // Proprietario, oppure la coppia a cui lo studio Pro ha dato accesso all'invito.
    const { rows } = await pool.query(
      `SELECT * FROM invitations i WHERE i.id = $1 AND (i.user_id = $2 OR EXISTS (
         SELECT 1 FROM pro_access a WHERE a.client_id = i.pro_client_id AND a.user_id = $2 AND a.can_invite))`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  // ───────────── Health & catalogo pubblico ─────────────
  app.get("/api/health", async () => ({ ok: true }));
  // Pagine prodotto del negozio per i pulsanti «Acquista» dell'area cliente.
  app.get("/api/shop/links", async () => shopLinks());

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
    // ADMIN_EMAIL promuove sempre; per gli altri vale il ruolo salvato nel database (così gli admin creati dalla console restano tali).
    const role = roleForEmail(found.email) === "admin" ? "admin" : found.role;
    const user = role === found.role ? found : { ...found, role };
    if (user !== found) await pool.query("UPDATE users SET role = $2 WHERE id = $1", [user.id, role]);
    await startSession(reply, user.id);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

  // Accesso dal sito: chi ha già un account inserisce l'email e riceve il link personale. La risposta è sempre la stessa,
  // e arriva subito (la ricerca e l'invio avvengono dopo), così né il testo né il tempo dicono chi è registrato.
  // Un indirizzo può chiedere un link al minuto; un account riceve al massimo LINKS_PER_HOUR link nuovi all'ora.
  const accessRequests = new Map<string, number>();
  const LINKS_PER_HOUR = 5;
  app.post("/api/auth/request", async (req, reply) => {
    const email = String(((req.body ?? {}) as { email?: unknown }).email ?? "").trim().toLowerCase();
    const reply200 = { ok: true, message: "Se l'email è quella dell'acquisto, ti abbiamo mandato il link per entrare." };
    if (!EMAIL.test(email)) return reply.code(400).send({ error: "Indirizzo email non valido" });
    // Mappa piena: si tolgono solo le voci scadute. Se resta piena (troppe richieste insieme) non si invia nulla.
    if (accessRequests.size > 5000) pruneExpired(accessRequests, 60_000);
    if (accessRequests.size > 5000) return reply.code(429).send({ error: "Troppe richieste: riprova tra un minuto" });
    const last = accessRequests.get(email) ?? 0;
    if (Date.now() - last < 60_000) return reply200;
    accessRequests.set(email, Date.now());
    const lang = req.cookies.lang === "en" ? "en" : "it";
    void (async () => {
      const { rows } = await pool.query(
        "SELECT u.id, (SELECT count(*)::int FROM access_tokens t WHERE t.user_id = u.id AND t.created_at > now() - interval '1 hour') AS recent FROM users u WHERE u.email = $1",
        [email],
      );
      if (!rows[0] || rows[0].recent >= LINKS_PER_HOUR) return;
      const token = await createAccessToken(rows[0].id);
      await sendMail(accessEmail({ to: email, link: `${appUrl()}/accesso/${token}`, lang }), "other");
    })().catch((e) => app.log.warn({ err: e }, "link di accesso non inviato"));
    return reply200;
  });

  // hasPassword: se il cliente ha già una password; altrimenti l'area cliente gli chiede di impostarla.
  app.get("/api/auth/me", async (req) => {
    const user = await currentUser(req);
    if (!user) return { user: null };
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    return { user: { ...user, hasPassword: String(rows[0]?.password_hash ?? "").startsWith("scrypt$"), pro: await isStudio(user.id) } };
  });

  // Accesso con email e password (in alternativa al link). Al massimo 6 tentativi ogni 15 minuti per email.
  // Nessun limite globale: con un tetto unico chiunque bloccherebbe il login di tutti (dietro i proxy l'API vede sempre
  // lo stesso indirizzo, quindi niente limite per IP). Le voci scadute si potano, la mappa non si svuota mai di colpo.
  const LOGIN_WINDOW = 15 * 60_000;
  const loginAttempts = new Map<string, { n: number; at: number }>();
  const tooMany = (key: string, max: number) => {
    const now = Date.now();
    const a = loginAttempts.get(key);
    if (!a || now - a.at > LOGIN_WINDOW) { loginAttempts.set(key, { n: 1, at: now }); return false; }
    a.n += 1;
    return a.n > max;
  };
  app.post("/api/auth/login", async (req, reply) => {
    const b = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!EMAIL.test(email) || !password) return reply.code(400).send({ error: "Inserisci email e password" });
    if (loginAttempts.size > 10_000) pruneExpired(loginAttempts, LOGIN_WINDOW);
    if (tooMany(`e:${email}`, 6)) return reply.code(429).send({ error: "Troppi tentativi: riprova tra qualche minuto, o entra con il link via email" });
    const { rows } = await pool.query("SELECT id, email, name, role, password_hash FROM users WHERE email = $1", [email]);
    const ok = rows[0] ? await verifyPassword(password, rows[0].password_hash) : await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    if (!rows[0] || !ok) return reply.code(401).send({ error: "Email o password non corretti" });
    loginAttempts.delete(`e:${email}`);
    const role = roleForEmail(rows[0].email) === "admin" ? "admin" : rows[0].role;
    if (role !== rows[0].role) await pool.query("UPDATE users SET role = $2 WHERE id = $1", [rows[0].id, role]);
    await startSession(reply, rows[0].id);
    return { id: rows[0].id, email: rows[0].email, name: rows[0].name, role };
  });

  // Imposta (o cambia) la password del cliente già entrato. Le altre sessioni restano aperte.
  app.post("/api/auth/password", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Accedi per continuare" });
    const password = String(((req.body ?? {}) as { password?: unknown }).password ?? "");
    if (password.length < PASSWORD_MIN || password.length > 200) return reply.code(400).send({ error: "La password deve avere almeno 8 caratteri" });
    if (password.trim().toLowerCase() === user.email.toLowerCase()) return reply.code(400).send({ error: "La password non può essere la tua email" });
    await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, await hashPassword(password)]);
    return { ok: true };
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
      `SELECT i.id, i.slug, i.status, i.tier, i.edit_count, i.config, i.views, i.guests, i.created_at,
              (SELECT count(*)::int FROM rsvps r WHERE r.invitation_id = i.id) AS rsvps,
              (SELECT p.id FROM planners p WHERE p.invitation_id = i.id) AS planner_id
       FROM invitations i WHERE (i.user_id = $1 AND i.pro_client_id IS NULL)
          OR EXISTS (SELECT 1 FROM pro_access a WHERE a.client_id = i.pro_client_id AND a.user_id = $1 AND a.can_invite)
       ORDER BY i.created_at DESC`,
      [user.id],
    );
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      status: r.status,
      published: r.edit_count >= 1,
      tier: r.tier,
      title: titleOf(r.config),
      eventDate: textOf(r.config, "eventDate"),
      model: getModel(c, r.config.model)?.name ?? r.config.model,
      views: r.views,
      guests: (r.guests ?? []).length,
      rsvps: r.rsvps,
      themeId: (r.config?.themeId as string) ?? "",
      eventType: (r.config?.eventType as string) ?? "wedding",
      plannerId: (r.planner_id as string | null) ?? null,
    }));
  });

  // Bozze senza acquisto: in produzione gli inviti nascono dagli ordini (claim, demo, studio Pro). Questa rotta resta
  // per gli admin, la modalità demo e lo sviluppo, con un tetto di bozze non pagate per utente (ognuna costa conversioni
  // di file e, se fosse pagata, richieste all'assistente).
  const MAX_DRAFTS = 5;
  app.post("/api/invitations", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (process.env.NODE_ENV === "production" && user.role !== "admin" && !demoMode()) return reply.code(403).send({ error: "Gli inviti nascono da un acquisto" });
    const { rows: drafts } = await pool.query("SELECT count(*)::int AS n FROM invitations WHERE user_id = $1 AND status <> 'paid'", [user.id]);
    if (user.role !== "admin" && (drafts[0]?.n ?? 0) >= MAX_DRAFTS) return reply.code(429).send({ error: "Hai già troppe bozze: eliminane una per crearne un'altra" });
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
    const config = await importStyleMedia(defaultConfig(theme, model.id, eventType, activeFeatures(c, model.id, [])), theme.id);
    const id = randomUUID();
    // Slug provvisorio: l'ID. Il link vero si sceglie solo alla pubblicazione.
    const slug = id;
    await pool.query("INSERT INTO invitations (id, slug, user_id, config, planner) VALUES ($1, $2, $3, $4, $5)", [id, slug, user.id, JSON.stringify(config), JSON.stringify({ templateMusic: templateMusicOf(config) })]);
    await track("invitation_created", id);
    return reply.code(201).send({ id, slug });
  });

  // Template Premium che l'invito non può usare: quelli dell'invito base (ordine con draft.plan = "base").
  async function lockedThemesFor(invitationId: string, c: Catalog): Promise<string[]> {
    const { rows } = await pool.query("SELECT 1 FROM orders WHERE invitation_id = $1 AND draft->>'plan' = 'base' LIMIT 1", [invitationId]);
    return rows.length ? c.themes.filter((t) => t.premium).map((t) => t.manifest.id) : [];
  }

  app.get<{ Params: { id: string } }>("/api/invitations/:id/manage", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const c = await loadFullCatalog();
    const linked = await pool.query("SELECT id FROM planners WHERE invitation_id = $1", [inv.id]);
    const locked = await lockedThemesFor(inv.id, c);
    return {
      id: inv.id,
      plannerId: (linked.rows[0]?.id as string | undefined) ?? null,
      slug: inv.slug,
      status: inv.status,
      config: inv.config as InviteConfig,
      guests: inv.guests,
      views: inv.views,
      planner: inv.planner ?? {},
      editCount: inv.edit_count ?? 0,
      editSession: inv.edit_session ?? null,
      purchasedAddons: [...ADDON_KEYS] as string[],
      assistant: !!process.env.ANTHROPIC_KEY,
      assistantLimit: (await loadAssistantSettings()).settings.callLimit + (inv.assistant_bonus ?? 0),
      assistantTopup: Boolean(getShopifyIds().variantAiCreditsId) && shopifyConfigured(),
      templateMusic: typeof inv.planner?.templateMusic === "string" ? inv.planner.templateMusic : null,
      assistantPack: Number(getShopifyIds().aiCreditsPerPack) || 20,
      assistantUsed: inv.assistant_calls ?? 0,
      catalog: c,
      hasRsvp: hasRsvp(c, inv.config),
      // Cambio di template dal builder: una sola volta per invito. locked: template Premium esclusi dall'invito base.
      themeChange: { available: !inv.theme_changed_at, locked },
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

  // Suggerimenti per il link, costruiti dai nomi e dalla data. Solo quelli liberi e validi.
  app.get<{ Params: { id: string } }>("/api/invitations/:id/slug-suggestions", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    const slugify = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    // Base: i nomi o il titolo dell'evento. Poi l'anno, e numeri casuali o un ID breve: nessuna parola generica.
    const names = slugify(titleOf(inv.config)) || "invito";
    const year = /^\d{4}/.exec(textOf(inv.config, "eventDate"))?.[0] ?? "";
    const digits = () => String(1000 + Math.floor(Math.random() * 9000));
    const candidates = [names, `${names}-${year}`, `${names}-${digits()}`, `${names}-${digits()}`, `${names}-${randomUUID().slice(0, 6)}`]
      .map((c) => normalizeSlug(c.replace(/-+$/g, "")))
      .filter((c): c is string => Boolean(c));
    const free: string[] = [];
    for (const c of [...new Set(candidates)]) {
      const { rows } = await pool.query("SELECT 1 FROM invitations WHERE slug = $1 AND id <> $2", [c, inv.id]);
      if (rows.length === 0) free.push(c);
      if (free.length >= 5) break;
    }
    while (free.length < 3) {
      const c = normalizeSlug(`${names}-${randomUUID().slice(0, 4)}`);
      if (c && !free.includes(c)) free.push(c);
    }
    return { suggestions: free, published: inv.edit_count >= 1, current: inv.slug };
  });

  // Link dell'invito: si può cambiare solo finché l'invito non è pubblicato. Un invito pubblicato mantiene il suo link.
  app.put<{ Params: { id: string }; Body: { slug?: unknown } }>("/api/invitations/:id/slug", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.edit_count >= 1) return reply.code(409).send({ error: "Il link di un invito pubblicato non cambia: gli ospiti lo hanno già ricevuto." });
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
  // Ricarica dei crediti di BeSpoke AI: carrello Shopify con la variante dei crediti, legato a questo invito.
  app.post<{ Params: { id: string } }>("/api/invitations/:id/assistant/topup", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (!shopifyConfigured() || !getShopifyIds().variantAiCreditsId) return reply.code(503).send({ error: "Ricarica dei crediti non disponibile in questo momento" });
    try {
      return { checkoutUrl: await createAiCreditsCheckout({ invitationId: inv.id, email: user.email }) };
    } catch (e) {
      req.log.warn({ err: e }, "checkout crediti non creato");
      if (e instanceof CreditsCheckoutError) return reply.code(503).send({ error: e.message });
      return reply.code(502).send({ error: "Il negozio non risponde: riprova tra poco" });
    }
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/invitations/:id/assistant", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const out = await handleAssistant(
      {
        findOwned: async (id, userId) => {
          const inv = await ownedInvitation(id, userId);
          // Le richieste all'assistente sono un servizio dell'invito acquistato: una bozza non pagata non ne ha.
          if (!inv || inv.status !== "paid") return null;
          // Stesso dato dell'editor: le funzioni già attive per l'invito (pagate, o scelte in bozza).
          return { ...inv, purchased_addons: [...ADDON_KEYS] } as OwnedInvitation;
        },
        loadCatalog,
        apiKey: process.env.ANTHROPIC_KEY || undefined,
        loadSettings: async () => (await loadAssistantSettings()).settings,
        // Foto stock solo se Pixabay è configurato: il modello cerca, il server importa il file.
        places: searchPlaces,
        stock: process.env.PIXABAY_API_KEY
          ? {
              search: async (query) => (await searchStock(parseStockFilters({ q: query }))).map((p) => ({ id: p.id, tags: p.tags, preview: p.preview })),
              import: (id) => importStock(id),
            }
          : undefined,
        makeCall: (apiKey) => {
          const client = new Anthropic({ apiKey });
          return (params) => client.messages.create(params);
        },
        // Prenotazione atomica: passa solo se il contatore è ancora sotto il limite (callLimit + crediti comprati).
        reserveCall: async (invitationId, limit) => {
          const { rowCount } = await pool.query("UPDATE invitations SET assistant_calls = assistant_calls + 1 WHERE id = $1 AND assistant_calls < $2", [invitationId, limit]);
          return rowCount === 1;
        },
        releaseCall: async (invitationId) => {
          await pool.query("UPDATE invitations SET assistant_calls = GREATEST(assistant_calls - 1, 0) WHERE id = $1", [invitationId]);
        },
        // La richiesta è già stata contata dalla prenotazione: qui si restituisce solo se non era da contare.
        recordUsage: async (invitationId, model, usage, actions, state) => {
          const delta = state.reserved ? (state.counted ? 0 : -1) : state.counted ? 1 : 0;
          await pool.query(
            `WITH bump AS (
               UPDATE invitations SET assistant_calls = GREATEST(assistant_calls + $8, 0), assistant_asked = $9, assistant_free_run = $10
               WHERE id = $1 RETURNING id)
             INSERT INTO assistant_usage (invitation_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, actions, counted)
             SELECT id, $2, $3, $4, $5, $6, $7, $11 FROM bump`,
            [invitationId, model, usage.input, usage.output, usage.cacheRead, usage.cacheWrite, actions, delta, state.asked, state.freeRun, state.counted],
          );
        },
      },
      { id: req.params.id, userId: user.id, body: req.body, lang: req.cookies.lang === "en" ? "en" : "it" },
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
    await recordSave(inv.id, user.id, changedSections(inv.config as InviteConfig, config)).catch((e) => req.log.warn({ err: e }, "attività dell'editor non registrata"));
    return { ok: true };
  });

  // Cambio di template dal builder: una sola volta per invito. Contenuto e blocchi della bozza restano, tornano al
  // template solo i colori personalizzati dei blocchi (withTheme). Gli ospiti lo vedono alla prossima pubblicazione.
  app.post<{ Params: { id: string } }>("/api/invitations/:id/theme", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.theme_changed_at) return reply.code(409).send({ error: "Il template di questo invito è già stato cambiato una volta" });
    const c = await loadCatalog();
    const themeId = String((req.body as { themeId?: unknown } | undefined)?.themeId ?? "");
    const theme = getTheme(c, themeId);
    if (!theme) return reply.code(400).send({ error: "Template non disponibile" });
    const current = inv.config as InviteConfig;
    if (theme.id === current.themeId) return reply.code(400).send({ error: "È già il template dell'invito" });
    if ((await lockedThemesFor(inv.id, c)).includes(theme.id)) return reply.code(403).send({ error: "Questo template è Premium: non è incluso nell'invito base" });
    const config = withTheme(current, theme.id);
    // Una sola volta anche con due richieste insieme: vince solo l'aggiornamento che trova theme_changed_at ancora vuoto.
    const { rowCount } = await pool.query("UPDATE invitations SET config = $1, theme_changed_at = now() WHERE id = $2 AND theme_changed_at IS NULL", [JSON.stringify(config), inv.id]);
    if (!rowCount) return reply.code(409).send({ error: "Il template di questo invito è già stato cambiato una volta" });
    await recordSave(inv.id, user.id, changedSections(current, config)).catch((e) => req.log.warn({ err: e }, "attività dell'editor non registrata"));
    return { ok: true, config };
  });

  // Presenza nell'editor: l'editor aperto lo segnala ogni 30 secondi; la console mostra chi sta modificando adesso.
  app.post<{ Params: { id: string } }>("/api/invitations/:id/presence", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    await pool.query("UPDATE invitations SET editor_seen_at = now() WHERE id = $1", [inv.id]);
    return { ok: true };
  });

  // Pubblicazione: la bozza diventa la versione che vedono gli ospiti. Si può ripubblicare quante volte si vuole;
  // il link si sceglie alla prima pubblicazione e poi resta quello (gli ospiti lo hanno già ricevuto).
  app.post<{ Params: { id: string } }>("/api/invitations/:id/confirm-edit", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status !== "paid") return reply.code(409).send({ error: "L'invito non è ancora pagato" });
    // Funzioni nuove in bozza: prima va pagata la differenza, altrimenti la pubblicazione non le includerebbe.
    const pending = pendingOf(inv);
    if (pending.length) {
      const c = await loadCatalog();
      return reply.code(409).send({ error: "Per le funzioni nuove serve il pagamento", code: "payment_required", amountCents: addonsCents(c, inv.config.model, pending) });
    }
    // Alla prima pubblicazione il cliente sceglie il link: finché non è pubblicato, l'invito non ha un indirizzo pubblico.
    let slug = inv.slug;
    if (inv.edit_count === 0) {
      const chosen = normalizeSlug((req.body as { slug?: unknown } | undefined)?.slug);
      if (!chosen) return reply.code(400).send({ error: "Scegli un link: lettere minuscole, numeri e trattini (3–60 caratteri)." });
      slug = chosen;
    }
    // edit_count conta le pubblicazioni (da 1 in su l'invito è online).
    try {
      await pool.query("UPDATE invitations SET edit_count = edit_count + 1, published_config = config, slug = $2 WHERE id = $1", [inv.id, slug]);
      await recordPublish(inv.id, user.id).catch((e) => req.log.warn({ err: e }, "pubblicazione non registrata"));
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return reply.code(409).send({ error: "Questo link è già in uso: scegline un altro." });
      throw e;
    }
    return { ok: true, editCount: inv.edit_count + 1, slug };
  });

  // Il planner è un servizio a sé, con le sue rotte (/api/planners/…): plannerRoutes.ts.
  registerPlannerRoutes(app, { requireUser, loadCatalog, requireAdmin });
  registerProRoutes(app, { requireUser, requireAdmin, loadCatalog });

  // Note del pianificatore: testo libero per l'organizzatore (promemoria, nota del conto alla rovescia). Non va nella pagina invito.
  // Dati primari dell'invito (nomi o titolo, data, luogo): si chiedono la prima volta che si apre il builder o il planner.
  app.put<{ Params: { id: string } }>("/api/invitations/:id/setup", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (editRules({ status: inv.status, edit_count: inv.edit_count }).readOnly) return reply.code(409).send({ error: "Modifica già confermata: l'invito non si modifica più" });
    // Wizard a passi: dati dell'evento, ringraziamento, conferma di presenza e domande. Dalle risposte
    // si aggiungono o tolgono Location, Mappa, Firma e Conferma (shared/src/setup.ts).
    const b = (req.body ?? {}) as Record<string, unknown>;
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const title = text(b.title, 80);
    const eventDate = typeof b.eventDate === "string" ? b.eventDate : "";
    if (!title) return reply.code(400).send({ error: "Scrivete i nomi o il titolo dell'evento" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate + "T00:00:00"))) return reply.code(400).send({ error: "Inserite una data valida" });
    const venue = text(b.venue, 120);
    const applied = applySetup(inv.config as InviteConfig, {
      title,
      eventDate,
      venue,
      address: text(b.address, 200),
      signature: text(b.signature, 80),
      rsvp: b.rsvp === true,
      questions: Array.isArray(b.questions) ? (b.questions as RsvpQuestion[]) : [],
    });
    const clean = sanitizeConfig(await loadCatalog(), applied);
    if (!clean) return reply.code(400).send({ error: "Configurazione non valida" });
    // Il luogo resta anche tra i dati dell'evento: il planner lo legge da lì.
    const config = { ...clean, event: { ...clean.event, venue } };
    const planner = { ...(inv.planner ?? {}), setupDone: true };
    await pool.query("UPDATE invitations SET config = $2, published_config = $2, planner = $3 WHERE id = $1", [inv.id, JSON.stringify(config), JSON.stringify(planner)]);
    await recordSave(inv.id, user.id, ["Wizard iniziale"]).catch(() => undefined);
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>("/api/invitations/:id/planner", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const inv = await ownedInvitation(req.params.id, user.id);
    if (!inv) return reply.code(404).send({ error: "Invito non trovato" });
    if (inv.status !== "paid") return reply.code(409).send({ error: "Il pannello è disponibile dopo il pagamento" });
    const b = (req.body ?? {}) as { notes?: unknown; countdownNote?: unknown; docs?: unknown; budgetCents?: unknown; guestQuota?: unknown };
    const docs = sanitizeDocs(b.docs) ?? (inv.planner?.docs ?? {});
    // Si tengono gli altri dati dell'invito salvati qui (wizard completato, brano del template).
    const planner = {
      ...(inv.planner ?? {}),
      notes: typeof b.notes === "string" ? b.notes.slice(0, 4000) : (inv.planner?.notes ?? ""),
      countdownNote: typeof b.countdownNote === "string" ? b.countdownNote.slice(0, 200) : (inv.planner?.countdownNote ?? ""),
      docs,
      budgetCents: typeof b.budgetCents === "number" && b.budgetCents >= 0 ? Math.min(1_000_000_000, Math.round(b.budgetCents)) : (inv.planner?.budgetCents ?? 0),
      guestQuota: typeof b.guestQuota === "number" && b.guestQuota >= 0 ? Math.min(5000, Math.round(b.guestQuota)) : (inv.planner?.guestQuota ?? 0),
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
      // Le risposte le scrivono gli ospiti: csvCell evita che diventino formule nel foglio di calcolo.
      const esc = csvCell;
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

    const qs = questions as unknown as RsvpQuestion[];
    const yes = rows.filter((r) => attendanceOf(qs, r.answers) === true);
    return {
      total: rows.length,
      attending: yes.length,
      declined: rows.filter((r) => attendanceOf(qs, r.answers) === false).length,
      guests: yes.reduce((s, r) => s + partySizeOf(qs, r.answers), 0),
      questions,
      rsvps: rows.map((r) => ({ id: r.id, createdAt: r.created_at, answers: r.answers })),
    };
  });

  // ───────────── Pubblico: pagina dell'invito, conferme ─────────────
  app.get<{ Params: { slug: string } }>("/api/public/invitations/:slug/page", async (req, reply) => {
    const { rows } = await pool.query("SELECT * FROM invitations WHERE slug = $1 AND status = 'paid' AND edit_count >= 1", [req.params.slug]);
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
    // Prima Photon (OpenStreetMap, completa anche le parole a metà mentre si scrive), poi Nominatim come riserva.
    const UA = { "User-Agent": "InviteMe/1.0 (https://app.thebespokeinvite.com)" };
    let results: string[] = [];
    try {
      const res = await fetch(`https://photon.komoot.io/api/?limit=6&q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(4000) });
      const data = (await res.json()) as { features?: { properties?: Record<string, string> }[] };
      const label = (p: Record<string, string>) => {
        const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "";
        const place = [p.postcode, p.city ?? p.town ?? p.village ?? p.locality].filter(Boolean).join(" ");
        return [p.name !== street ? p.name : "", street, place, p.state, p.country].filter(Boolean).join(", ");
      };
      results = [...new Set((data.features ?? []).map((f) => label(f.properties ?? {})).filter(Boolean))].slice(0, 5);
    } catch {
      results = [];
    }
    if (!results.length) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=it&q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(4000) });
        const list = (await res.json()) as { display_name?: string }[];
        results = list.map((x) => x.display_name ?? "").filter(Boolean);
      } catch {
        results = [];
      }
    }
    geoCache.set(q, { at: Date.now(), results });
    return { results };
  });

  // Anteprima dedicata di uno stile: telefono o desktop contenuto; a schermo intero da telefono.
  app.get<{ Params: { id: string } }>("/api/themes/:id/anteprima", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    if (!theme) return reply.code(404).type("text/plain; charset=utf-8").send("Tema non trovato");
    const q = req.query as { lang?: string; s?: string };
    // Lingua: ?lang= se c'è, altrimenti quella del sito (cookie).
    const lang = (q.lang ?? req.cookies.lang) === "en" ? "en" : "it";
    const seed = /^[a-z0-9]{1,12}$/i.test(q.s ?? "") ? (q.s as string) : "x";
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(quietScroll(previewShell(theme.manifest.id, lang === "en" ? theme.manifest.nameEn || theme.manifest.name : theme.manifest.name, lang, seed)));
  });

  // Copertina statica di un tema per il carosello di scelta: la busta chiusa (poster del filmato), ridotta a 480 px.
  // Si genera alla prima richiesta e resta su disco finché il container vive (i temi cambiano solo con un rilascio).
  const coverDir = path.join(os.tmpdir(), "theme-covers");
  const coverJobs = new Map<string, Promise<string>>();
  app.get<{ Params: { id: string } }>("/api/themes/:id/cover.jpg", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    const poster = theme?.manifest.envelope?.poster;
    if (!theme || !poster) return reply.code(404).type("text/plain; charset=utf-8").send("Copertina non disponibile");
    // La chiave include la data del file: un tema sostituito dalla console ha subito la copertina nuova.
    const src = path.join(theme.dir, poster);
    const mtime = fs.existsSync(src) ? Math.round(fs.statSync(src).mtimeMs) : 0;
    const id = `${theme.manifest.id}-${mtime}`;
    let job = coverJobs.get(id);
    if (!job) {
      const out = path.join(coverDir, `${id}.jpg`);
      job = fs.existsSync(out)
        ? Promise.resolve(out)
        : (fs.mkdirSync(coverDir, { recursive: true }), makeThumbnail(src, out, 480).then(() => out));
      coverJobs.set(id, job);
      job.catch(() => coverJobs.delete(id));
    }
    try {
      const file = await job;
      return reply.type("image/jpeg").header("Cache-Control", "public, max-age=604800").send(fs.createReadStream(file));
    } catch (e) {
      req.log.error(e, "copertina del tema non generata");
      return reply.code(500).type("text/plain; charset=utf-8").send("Copertina non disponibile");
    }
  });

  app.get<{ Params: { id: string } }>("/api/themes/:id/demo", async (req, reply) => {
    const theme = themes().find((t) => t.manifest.id === req.params.id);
    if (!theme) return reply.code(404).type("text/plain; charset=utf-8").send("Tema non trovato");
    const lang = ((req.query as { lang?: string }).lang ?? req.cookies.lang) === "en" ? "en" : "it";
    // Le miniature usano la pagina senza busta; l'anteprima la chiede con cover=1.
    const cover = (req.query as { cover?: string }).cover === "1";
    const html = quietScroll(renderInvitePage({ theme, config: sampleConfig(theme.manifest, lang), slug: "demo", features: new Set(ADDON_KEYS), runtime: RUNTIME, preview: !cover }));
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
    // ?readonly=1: la pagina come la vedono gli ospiti (si scorre normalmente, niente evidenziazione né selezione dei
    // blocchi). Serve all'anteprima del cambio di template.
    const readonly = (req.query as { readonly?: string }).readonly === "1";
    const html = renderFor(c, inv.slug, config, !showCover, !readonly);
    if (!html) return reply.code(400).send({ error: "Tema non disponibile" });
    // anteprima del builder: senza barra di scorrimento
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(quietScroll(html));
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

  // Risposte anonime: al massimo RSVP_MAX ogni 10 minuti per invito (molto sopra il ritmo di ospiti veri), e al
  // proprietario al massimo RSVP_MAILS email di notifica all'ora per invito (le risposte oltre restano salvate).
  const RSVP_WINDOW = 10 * 60_000;
  const RSVP_MAX = 60;
  const RSVP_MAILS = 20;
  const rsvpHits = new Map<string, { n: number; at: number }>();
  const rsvpMails = new Map<string, { n: number; at: number }>();
  const bump = (map: Map<string, { n: number; at: number }>, key: string, windowMs: number): number => {
    if (map.size > 5000) pruneExpired(map, windowMs);
    const now = Date.now();
    const a = map.get(key);
    if (!a || now - a.at > windowMs) { map.set(key, { n: 1, at: now }); return 1; }
    a.n += 1;
    return a.n;
  };
  app.post("/api/rsvp", async (req, reply) => {
    const b = (req.body ?? {}) as { slug?: string; answers?: Record<string, unknown>; website?: unknown };
    // Campo trappola: un ospite vero non lo compila mai. Se arriva pieno è un bot: risposta ok, nulla salvato.
    if (typeof b.website === "string" && b.website.trim()) return reply.code(201).send({ ok: true });
    if (!b.slug || !b.answers || typeof b.answers !== "object") return reply.code(400).send({ error: "Dati mancanti" });
    if (bump(rsvpHits, String(b.slug).slice(0, 100), RSVP_WINDOW) > RSVP_MAX) return reply.code(429).send({ error: "Troppe risposte in questo momento: riprova tra qualche minuto" });
    const { rows } = await pool.query(
      `SELECT i.id, i.config, i.published_config, u.email AS owner_email FROM invitations i JOIN users u ON u.id = i.user_id
       WHERE i.slug = $1 AND i.status = 'paid' AND i.edit_count >= 1`,
      [b.slug],
    );
    const found = rows[0];
    if (!found) return reply.code(404).send({ error: "Invito non trovato" });
    // Le domande sono quelle della pagina che vedono gli ospiti (versione pubblicata), non della bozza.
    const inv = { ...found, config: found.published_config ?? found.config };
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
    // Notifica al proprietario: un errore di posta non blocca la risposta dell'ospite. Oltre il tetto orario, niente email.
    if (bump(rsvpMails, inv.id, 3_600_000) <= RSVP_MAILS) await sendMail(
      rsvpNoticeEmail({ to: inv.owner_email, title: titleOf(inv.config), attending: attendanceOf(questions, answers), invitationId: inv.id, lang: inv.config?.locale === "en" ? "en" : "it" }),
      "rsvp",
    ).catch((e) => req.log.warn({ err: e }, "notifica RSVP non inviata"));
    return reply.code(201).send({ ok: true });
  });

  // ───────────── Pagamento ─────────────
  app.post("/api/checkout", async (_req, reply) => {
    // Tutte le sezioni sono incluse: non si acquistano funzioni a parte.
    return reply.code(410).send({ error: "Tutte le sezioni sono incluse: non c'è nulla da acquistare" });
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
      const invitationId = await createInvitationFromOrder(rows[0], "local", `TEST-${Date.now()}`, false, { sql: "AND user_id = $2 AND status = 'pending'", params: [user.id] });
      if (!invitationId) return reply.code(404).send({ error: "Ordine non trovato" });
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
  // Foto e video dello stile diventano file dell'invito, come quelli caricati dal cliente: galleria e immagini
  // li gestiscono dalle proprie proprietà. Un file che non si riesce a importare resta com'è.
  // Brano del template, già copiato tra i file dell'invito: si salva a parte (planner.templateMusic) perché il builder
  // possa mostrarlo come «Musica del template» e farlo riscegliere dopo che il cliente ha provato altri brani.
  const templateMusicOf = (config: InviteConfig): string | null => {
    const v = config.blocks.find((b) => b.type === "music")?.props.music;
    return typeof v === "string" && v.startsWith("/api/media/") ? v : null;
  };

  async function importStyleMedia(config: InviteConfig, themeId: string): Promise<InviteConfig> {
    const dir = themes().find((t) => t.manifest.id === themeId)?.dir;
    if (!dir) return config;
    const importOne = async (kind: MediaKind, value: string): Promise<string> => {
      if (!value || /^(https?:|\/)/.test(value)) return value;
      // I valori dello stile sono relativi alla cartella del tema (assets/…), o alla sua cartella assets.
      const direct = path.join(dir, value);
      const file = fs.existsSync(direct) ? direct : path.join(dir, "assets", value);
      if (!fs.existsSync(file)) return value;
      try {
        const saved = await convertMedia(kind, fs.readFileSync(file), path.extname(file).slice(1).toLowerCase());
        return saved.url;
      } catch (e) {
        app.log.warn({ err: e, file }, "media dello stile non importata");
        return value;
      }
    };
    const blocks = [];
    for (const block of config.blocks) {
      const props: Record<string, unknown> = { ...block.props };
      for (const field of blockDef(block.type)?.fields ?? []) {
        const v = props[field.key];
        if ((field.type === "photo" || field.type === "video" || field.type === "audio") && typeof v === "string") props[field.key] = await importOne(field.type, v);
        if (field.type === "photos" && Array.isArray(v)) props[field.key] = await Promise.all(v.map((x) => importOne("photo", String(x))));
      }
      blocks.push({ ...block, props });
    }
    return { ...config, blocks };
  }

  // Un ordine dà al massimo un invito: l'ordine si blocca (SELECT … FOR UPDATE) e si ricontrolla che sia ancora libero
  // nella stessa transazione che inserisce l'invito. guard: condizioni in più sull'ordine (proprietario, stato), con i
  // parametri da $2 in poi. Restituisce null se l'ordine non è più disponibile (già attivato da un'altra richiesta).
  async function createInvitationFromOrder(order: { id: string; user_id: string; draft: { model: string; themeId: string; eventType: string; addons: string[]; tier?: string }; amount_cents: number }, source: "shopify" | "local", orderRef: string, sample = false, guard: { sql: string; params: unknown[] } = { sql: "", params: [] }): Promise<string | null> {
    const c = await loadCatalog();
    const d = order.draft;
    const theme = getTheme(c, d.themeId, d.model) ?? enabledThemes(c, d.model)[0];
    if (!theme) throw new Error("Nessun tema disponibile");
    const eventType = (EVENT_TYPES.find((e) => e.id === d.eventType)?.id ?? "wedding") as EventType;
    const addons = d.addons as AddonKey[];
    // Prova: stessi blocchi e stesse immagini dello stile (la pagina demo), con modello e funzioni scelti.
    // Prova: tutte le funzioni del modello, altrimenti il motore nasconde i blocchi che le richiedono (galleria, video, mappa).
    const sampleAddons = [...ADDON_KEYS] as AddonKey[];
    // Stesso contenuto dell'anteprima: la configurazione di esempio del template, senza cambiare modello.
    const config = sample
      ? await importStyleMedia({ ...sampleConfig(theme, "it"), addons: sampleAddons }, theme.id)
      : await importStyleMedia({ ...defaultConfig(theme, d.model, eventType, activeFeatures(c, d.model, addons)), addons: [...ADDON_KEYS] }, theme.id);
    const id = randomUUID();
    // Slug provvisorio: l'ID. Il cliente sceglie il link al momento di pubblicare.
    const slug = id;
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const locked = await db.query(`SELECT id FROM orders WHERE id = $1 AND invitation_id IS NULL ${guard.sql} FOR UPDATE`, [order.id, ...guard.params]);
      if (!locked.rows[0]) {
        await db.query("ROLLBACK");
        return null;
      }
      await db.query(
        "INSERT INTO invitations (id, slug, user_id, config, status, purchased_addons, published_config, order_ref, tier, planner) VALUES ($1, $2, $3, $4, 'paid', $5, $4, $6, $7, $8)",
        [id, slug, order.user_id, JSON.stringify(config), JSON.stringify(config.addons), orderRef, "rsvp", JSON.stringify({ templateMusic: templateMusicOf(config) })],
      );
      await db.query("UPDATE orders SET status = 'paid', invitation_id = $2, source = $3 WHERE id = $1", [order.id, id, source]);
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      db.release();
    }
    await track("order_paid", id);
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [order.user_id]);
    if (rows[0]) {
      await sendMail(orderEmail({ to: rows[0].email, title: titleOf(config), amount: formatPrice(order.amount_cents), slug, link: `${appUrl()}/account`, lang: config.locale === "en" ? "en" : "it" }), "order").catch((e) => app.log.warn({ err: e }, "conferma d'ordine non inviata"));
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
    const b = (req.body ?? {}) as { model?: string; themeId?: string; eventType?: string; addons?: unknown; tier?: unknown };
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
    const invitationId = await createInvitationFromOrder({ id: orderId, user_id: user!.id, draft, amount_cents: amount }, "local", `DEMO-${Date.now()}`, true);
    if (!invitationId) return reply.code(500).send({ error: "Invito di prova non creato" });
    return { invitationId };
  });

  // Acquisto prima dell'invito: si crea il pagamento con la scelta; l'invito nasce al pagamento riuscito.
  app.post("/api/checkout/new", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!shopifyConfigured() && !localCheckoutAllowed()) return reply.code(503).send({ error: "I pagamenti non sono ancora attivi su questo server" });
    const c = await loadCatalog();
    const b = (req.body ?? {}) as { model?: string; themeId?: string; eventType?: string; addons?: unknown; tier?: unknown };
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
    const tier = isInviteTier(b.tier) ? b.tier : "rsvp";
    const draft = { model: model.id, themeId: theme.id, eventType, addons, tier };
    try {
      const checkout = await createCheckout({ orderId, addons, totalCents: amount, origin: appUrl(), kind: "initial", tier });
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
        orderEmail({ to: rows[0].email, title: titleOf(rows[0].config), amount: formatPrice(amountCents), slug: rows[0].slug, link: `${appUrl()}/account`, lang: rows[0].config?.locale === "en" ? "en" : "it" }),
        "order",
      ).catch((e) => app.log.warn({ err: e }, "conferma d'ordine non inviata"));
    }
  }

  // Registra un acquisto di Shopify: crea o riusa l'account dal cliente, salva l'ordine come pagato senza invito
  // e manda il link personale. Restituisce false se l'ordine non riguarda i nostri prodotti.
  type ShopifyOrderLite = {
    id: number;
    email?: string;
    total_price: string;
    currency: string;
    customer?: { first_name?: string | null; last_name?: string | null; email?: string | null };
    line_items?: { variant_id?: number | string | null; product_id?: number | string | null; quantity?: number }[];
    customer_locale?: string | null;
    order_status_url?: string | null;
  };
  // Acquisto dal negozio: ogni riga con una variante nostra diventa un acquisto da attivare.
  // Variante dell'invito → invito; variante «invito base» → invito con i soli template non Premium (draft.plan = "base");
  // prodotto planner (qualunque variante) → planner; variante «pacchetto» (ex premium) → invito e planner.
  // Crediti di BeSpoke AI comprati su Shopify. Ogni riga lascia un ordine «-ai…» collegato all'invito: se Shopify
  // ripete il webhook, l'ordine esiste già e le richieste non si sommano due volte.
  type AiCreditsOrder = { id: number | string; currency?: string; note_attributes?: { name: string; value: string }[]; line_items?: { variant_id?: number | string | null; quantity?: number; properties?: { name: string; value: string }[] }[] };
  async function applyAiCredits(order: AiCreditsOrder): Promise<number> {
    const ids = getShopifyIds();
    if (!ids.variantAiCreditsId) return 0;
    // In console c'è una variante o un prodotto: con il prodotto valgono tutte le sue varianti.
    const savedNum = ids.variantAiCreditsId.split("/").pop();
    const isProduct = ids.variantAiCreditsId.includes("/Product/");
    const variant = isProduct ? null : `gid://shopify/ProductVariant/${savedNum}`;
    const productNum = isProduct ? savedNum : undefined;
    const perPack = Number(ids.aiCreditsPerPack) || 20;
    const cartFor = order.note_attributes?.find((a) => a.name === "aiCreditsFor")?.value;
    let added = 0;
    for (const [i, l] of (order.line_items ?? []).entries()) {
      const v = l.variant_id == null ? null : normalizeVariant(String(l.variant_id));
      const prod = (l as { product_id?: number | string | null }).product_id;
      if (v !== variant && String(prod ?? "") !== productNum) continue;
      const invitationId = l.properties?.find((p) => p.name === "_aiCreditsFor")?.value ?? cartFor ?? "";
      if (!UUID.test(invitationId)) { app.log.warn({ order: order.id }, "crediti BeSpoke AI senza invito collegato"); continue; }
      const credits = Math.max(1, Math.min(20, Math.round(Number(l.quantity) || 1))) * perPack;
      const ins = await pool.query(
        `INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, kind, draft)
         SELECT $1, i.user_id, i.id, 0, $3, 'shopify', 'paid', 'upgrade', $4 FROM invitations i WHERE i.id = $2
         ON CONFLICT (id) DO NOTHING`,
        [`${order.id}-ai${i ? `-${i + 1}` : ""}`, invitationId, order.currency ?? "EUR", JSON.stringify({ product: "ai_credits", credits })],
      );
      if (!ins.rowCount) continue;
      await pool.query("UPDATE invitations SET assistant_bonus = assistant_bonus + $2 WHERE id = $1", [invitationId, credits]);
      added += credits;
    }
    return added;
  }

  // L'ordine contiene una variante dell'invito (completo, pacchetto o base)?
  function hasInvitationLine(order: { line_items?: { variant_id?: number | string | null }[] }): boolean {
    const ids = getShopifyIds();
    const ours = new Set([ids.variantId, ids.variantPremiumId, ids.variantBasicId].map((v) => normalizeVariant(v ?? "")).filter((v): v is string => Boolean(v)));
    return (order.line_items ?? []).some((l) => l.variant_id != null && ours.has(normalizeVariant(String(l.variant_id)) ?? ""));
  }

  async function registerShopifyPurchase(order: ShopifyOrderLite): Promise<boolean> {
    const ids = getShopifyIds();
    const base = normalizeVariant(ids.variantId);
    const bundle = normalizeVariant(ids.variantPremiumId);
    const plannerProduct = normalizeProduct(ids.plannerProductId);
    const basic = normalizeVariant(ids.variantBasicId);
    let invitations = 0;
    let basics = 0;
    let planners = 0;
    for (const l of order.line_items ?? []) {
      const v = l.variant_id == null ? null : normalizeVariant(String(l.variant_id));
      const prod = l.product_id == null ? null : normalizeProduct(String(l.product_id));
      const q = Math.max(1, Math.min(20, Math.round(Number(l.quantity) || 1)));
      if (plannerProduct && prod === plannerProduct) planners += q;
      else if (v && basic && v === basic) basics += q;
      // L'invito completo include il planner (l'invito base no).
      else if (v && v === base) { invitations += q; planners += q; }
      else if (v && bundle && v === bundle) { invitations += q; planners += q; }
    }
    if (invitations === 0 && basics === 0 && planners === 0) return false;
    const email = (order.email ?? order.customer?.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) {
      app.log.warn({ order: order.id }, "acquisto Shopify senza email valida");
      return true;
    }
    const name = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0];
    const { rows: userRows } = await pool.query(
      "INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, '') ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
      [randomUUID(), email, name],
    );
    const userId = userRows[0].id as string;
    const c = await loadCatalog();
    // Link di stato dell'ordine su Shopify: serve al cliente per tornare alla sua pagina d'acquisto. Solo https.
    const statusUrl = typeof order.order_status_url === "string" && /^https:\/\//.test(order.order_status_url) ? order.order_status_url : null;
    // Una riga per acquisto: il primo invito ha l'id dell'ordine (come prima), gli altri un suffisso. L'importo va sulla prima riga.
    const rowsToAdd: { id: string; draft: Record<string, unknown> }[] = [];
    for (let n = 0; n < invitations; n++) rowsToAdd.push({ id: n === 0 ? String(order.id) : `${order.id}-${n + 1}`, draft: { model: c.models[0]?.id ?? "", themeId: "", eventType: "wedding", addons: [], tier: "rsvp" } });
    for (let n = 0; n < basics; n++) rowsToAdd.push({ id: `${order.id}-base${n === 0 ? "" : `-${n + 1}`}`, draft: { model: c.models[0]?.id ?? "", themeId: "", eventType: "wedding", addons: [], tier: "rsvp", plan: "base" } });
    for (let n = 0; n < planners; n++) rowsToAdd.push({ id: `${order.id}-planner${n === 0 ? "" : `-${n + 1}`}`, draft: { product: "planner" } });
    let added = 0;
    for (const [k, r] of rowsToAdd.entries()) {
      const inserted = await pool.query(
        "INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, kind, draft, status_url) VALUES ($1, $2, NULL, $3, $4, 'shopify', 'paid', 'initial', $5, $6) ON CONFLICT (id) DO NOTHING",
        [r.id, userId, k === 0 ? Math.round(Number(order.total_price) * 100) : 0, order.currency, JSON.stringify(r.draft), statusUrl],
      );
      added += inserted.rowCount ?? 0;
    }
    if (added === 0) return true; // ripetizione del webhook: già registrato, niente email doppia
    const token = await createAccessToken(userId);
    const link = `${appUrl()}/accesso/${token}`;
    // Lingua dell'email: quella del cliente nel negozio (customer_locale), italiano di base.
    const lang = String(order.customer_locale ?? "").toLowerCase().startsWith("en") ? "en" : "it";
    const mail = invitations + basics > 0 ? purchaseEmail({ to: email, link, lang }) : accessEmail({ to: email, link, lang });
    await sendMail(mail, "order").catch((e) => app.log.warn({ err: e }, "email d'acquisto non inviata"));
    return true;
  }


  // Acquisti da attivare: pagati su Shopify, senza ancora un invito. Il cliente sceglie il template qui.
  app.get("/api/account/pending", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { rows } = await pool.query(
      "SELECT id, draft, created_at, status_url, pro_client_id FROM orders WHERE user_id = $1 AND source = 'shopify' AND status = 'paid' AND invitation_id IS NULL AND planner_id IS NULL ORDER BY created_at",
      [user.id],
    );
    // Due prodotti: l'invito (si sceglie il template) e il planner (si dà un nome all'evento).
    // pro: invito di un cliente dello studio (si attiva dall'area Pro, non compare tra gli acquisti personali).
    return rows.map((r) => ({ id: r.id, product: r.draft?.product === "planner" ? "planner" : "invitation", plan: r.draft?.plan === "base" ? "base" : "full", createdAt: r.created_at, statusUrl: r.status_url ?? null, pro: Boolean(r.pro_client_id), eventType: r.draft?.eventType ?? "wedding" }));
  });

  // Il cliente sceglie il template in galleria: si crea l'invito con quel tema.
  app.post("/api/account/claim", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const b = (req.body ?? {}) as { orderId?: unknown; themeId?: unknown; eventType?: unknown };
    const orderId = typeof b.orderId === "string" ? b.orderId : "";
    const themeId = typeof b.themeId === "string" ? b.themeId : "";
    if (b.eventType !== undefined && !isEventType(b.eventType)) return reply.code(400).send({ error: "Tipo di evento non valido" });
    const { rows } = await pool.query(
      "SELECT id, user_id, draft, amount_cents, pro_client_id FROM orders WHERE id = $1 AND user_id = $2 AND source = 'shopify' AND status = 'paid' AND invitation_id IS NULL AND COALESCE(draft->>'product', '') <> 'planner'",
      [orderId, user.id],
    );
    if (!rows[0] || !rows[0].draft) return reply.code(404).send({ error: "Acquisto non trovato o già attivato" });
    const c = await loadCatalog();
    const model = c.models[0]?.id ?? "";
    if (!enabledThemes(c, model).some((t) => t.id === themeId)) return reply.code(400).send({ error: "Template non disponibile" });
    const row = rows[0];
    // Invito base: i template Premium si vedono ma non si scelgono.
    if (row.draft.plan === "base" && c.themes.some((t) => t.manifest.id === themeId && t.premium)) return reply.code(403).send({ error: "Questo template è Premium: non è incluso nell'invito base" });
    const id = await createInvitationFromOrder(
      // Il tipo di evento scelto qui vale più di quello dell'ordine (gli ordini manuali e Shopify partono da matrimonio).
      { id: row.id, user_id: row.user_id, draft: { ...row.draft, model, themeId, ...(isEventType(b.eventType) ? { eventType: b.eventType } : {}) }, amount_cents: row.amount_cents },
      "shopify",
      row.id,
      false,
      { sql: "AND user_id = $2 AND source = 'shopify' AND status = 'paid' AND COALESCE(draft->>'product', '') <> 'planner'", params: [user.id] },
    );
    // Un'altra richiesta ha già attivato questo acquisto.
    if (!id) return reply.code(404).send({ error: "Acquisto non trovato o già attivato" });
    // Invito di un cliente dello studio Pro: parte con i dati del cliente e si collega al suo planner, se c'è.
    if (row.pro_client_id) {
      const { rows: cl } = await pool.query("SELECT name, to_char(event_date, 'YYYY-MM-DD') AS event_date, venue, address FROM pro_clients WHERE id = $1", [row.pro_client_id]);
      const pc = cl[0];
      if (pc) {
        const event = { title: pc.name, ...(pc.event_date ? { eventDate: pc.event_date } : {}), ...(pc.venue ? { venue: pc.venue } : {}), ...(pc.address ? { address: pc.address } : {}) };
        await pool.query(
          "UPDATE invitations SET pro_client_id = $2, config = jsonb_set(config, '{event}', (config->'event') || $3::jsonb), published_config = jsonb_set(published_config, '{event}', (published_config->'event') || $3::jsonb) WHERE id = $1",
          [id, row.pro_client_id, JSON.stringify(event)],
        );
        await pool.query("UPDATE planners SET invitation_id = $1 WHERE id = (SELECT id FROM planners WHERE pro_client_id = $2 AND invitation_id IS NULL ORDER BY created_at LIMIT 1)", [id, row.pro_client_id]);
      }
    }
    return { ok: true, invitationId: id };
  });

  // Webhook Shopify orders/paid  // Webhook Shopify orders/paid: firma verificata sul corpo grezzo, poi attivazione dell'invito.
  app.post("/api/webhooks/shopify", async (req, reply) => {
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? "";
    if (!verifyShopifyWebhook(raw, req.headers["x-shopify-hmac-sha256"] as string | undefined)) {
      return reply.code(401).send({ error: "Firma non valida" });
    }
    if (req.headers["x-shopify-topic"] !== "orders/paid") return { ok: true, ignored: true };
    // Ricarica dei crediti di BeSpoke AI: le righe con la variante dei crediti aggiungono richieste all'invito indicato.
    await applyAiCredits(req.body as AiCreditsOrder);
    const order = req.body as {
      id: number;
      name: string;
      email?: string;
      total_price: string;
      currency: string;
      customer?: { first_name?: string | null; last_name?: string | null; email?: string | null };
      order_status_url?: string | null;
      note_attributes?: { name: string; value: string }[];
      line_items?: { variant_id?: number | string | null; properties?: { name: string; value: string }[] }[];
    };
    // Gli attributi orderId / invitationId li può scrivere chi compra (attributi del carrello): da soli non bastano.
    // Valgono solo se l'ordine contiene davvero una variante dell'invito e paga almeno l'importo dell'ordine creato
    // dal server; altrimenti l'acquisto si registra come uno normale (solo ciò che è stato comprato davvero).
    const orderId = orderIdFromOrder(order);
    const invitationId = invitationIdFromOrder(order);
    if ((!orderId && !invitationId) || !hasInvitationLine(order)) {
      // Acquisto del nostro prodotto senza invito collegato: il cliente sceglie il template al primo accesso.
      return { ok: true, purchase: await registerShopifyPurchase(order) };
    }
    // Webhook ripetuto: l'ordine Shopify è già registrato, non si concede nulla una seconda volta.
    const seen = await pool.query("SELECT 1 FROM orders WHERE id = $1", [String(order.id)]);
    if (seen.rows.length) return { ok: true, duplicate: true };
    const amountCents = Math.round(Number(order.total_price) * 100);
    const covers = (row: { amount_cents: number; currency?: string | null }) =>
      Number.isFinite(amountCents) && amountCents >= Number(row.amount_cents) && String(order.currency ?? "").toUpperCase() === String(row.currency ?? "EUR").toUpperCase();
    let fulfilled = false;
    if (orderId) {
      const { rows } = await pool.query("SELECT id, user_id, draft, amount_cents, currency, invitation_id FROM orders WHERE id = $1 AND status = 'pending' AND draft IS NOT NULL", [orderId]);
      if (rows[0] && !rows[0].invitation_id && covers(rows[0])) {
        // null: un'altra consegna dello stesso webhook l'ha già attivato.
        await createInvitationFromOrder(rows[0], "shopify", order.name, false, { sql: "AND status = 'pending'", params: [] });
        fulfilled = true;
      }
    } else if (invitationId && UUID.test(invitationId)) {
      // Solo un pagamento in attesa creato dal server per quell'invito, con importo coerente.
      const { rows } = await pool.query(
        "SELECT o.id, o.kind, o.addons, o.amount_cents, o.currency, i.status FROM orders o JOIN invitations i ON i.id = o.invitation_id WHERE o.invitation_id = $1 AND o.status = 'pending' ORDER BY o.created_at DESC LIMIT 1",
        [invitationId],
      );
      const pending = rows[0];
      if (pending && covers(pending)) {
        if (pending.status === "paid") {
          if (pending.kind === "upgrade") await applyUpgrade(invitationId, (pending.addons as string[] | null) ?? [], amountCents, "shopify", String(order.id));
        } else await markPaid(invitationId, order.name, amountCents, "shopify");
        fulfilled = true;
      }
    }
    // Attributi che non corrispondono a un pagamento in attesa: vale quello che è stato comprato, come un acquisto normale.
    if (!fulfilled) return { ok: true, purchase: await registerShopifyPurchase(order), ignored: "no matching pending order" };
    await pool.query(
      `INSERT INTO orders (id, invitation_id, amount_cents, currency, source, status) VALUES ($1, $2, $3, $4, 'shopify', 'paid')
       ON CONFLICT (id) DO NOTHING`,
      [String(order.id), invitationId && UUID.test(invitationId) ? invitationId : null, amountCents, order.currency],
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
    const b = (req.body ?? {}) as { models?: Row[]; addons?: Row[]; themes?: { id?: unknown; enabled?: unknown; premium?: unknown }[] };
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
    // Premium: se la richiesta non lo dice, resta quello salvato.
    const premiumNow = new Map((await loadFullCatalog()).themes.map((t) => [t.manifest.id, t.premium]));
    const themeList = (Array.isArray(b.themes) ? b.themes : [])
      .filter((t) => known.has(String(t.id)))
      .map((t) => ({ id: String(t.id), enabled: t.enabled !== false, premium: typeof t.premium === "boolean" ? t.premium : premiumNow.get(String(t.id)) === true }));
    if (models.length === 0 || !themeList.some((t) => t.enabled)) return reply.code(400).send({ error: "Serve almeno un modello e un tema attivo" });
    await saveCatalog({ models, addons, themes: themeList });
    return { ok: true };
  });

  // Attiva o disattiva un tema.
  // Caricamento di un tema da ZIP (console, scheda Template). Il tema nuovo nasce disattivato:
  // l'admin lo controlla con l'anteprima e poi lo attiva. Con ?replace=1 sostituisce quello con lo stesso id.
  app.post<{ Querystring: { replace?: string } }>("/api/admin/themes/upload", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const part = await req.file();
    if (!part) return reply.code(400).send({ error: "Nessun file ricevuto" });
    const buffer = await part.toBuffer();
    if (part.file.truncated) return reply.code(413).send({ error: "File troppo grande" });
    if (!/\.zip$/i.test(part.filename) && buffer.readUInt32LE(0) !== 0x04034b50) return reply.code(400).send({ error: "Carica un file .zip" });
    try {
      const result = installThemeZip(buffer, { replace: req.query.replace === "1" });
      reloadThemes();
      const c = await loadFullCatalog();
      const stored = c.themes.map((t) => ({ id: t.manifest.id, enabled: t.manifest.id === result.id && !result.replaced ? false : t.enabled, premium: t.premium }));
      await saveCatalog({ models: c.models, addons: c.addons, themes: stored });
      req.log.info({ theme: result.id, replaced: result.replaced }, "tema caricato dalla console");
      return reply.code(201).send(result);
    } catch (e) {
      if (e instanceof ThemeUploadError) return reply.code(e.status).send({ error: e.message, details: e.details, code: e.code });
      throw e;
    }
  });

  // Elimina un tema dalla cartella themes/. Solo se nessun invito lo usa: altrimenti va disattivato.
  app.delete<{ Params: { id: string } }>("/api/admin/themes/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const c = await loadFullCatalog();
    if (!c.themes.some((t) => t.manifest.id === req.params.id)) return reply.code(404).send({ error: "Tema non trovato" });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM invitations WHERE config->>'themeId' = $1", [req.params.id]);
    if (rows[0].n > 0) return reply.code(409).send({ error: `Il tema è usato da ${rows[0].n} ${rows[0].n === 1 ? "invito" : "inviti"}: disattivalo invece di eliminarlo` });
    if (!c.themes.some((t) => t.enabled && t.manifest.id !== req.params.id)) return reply.code(400).send({ error: "Serve almeno un tema attivo" });
    try {
      removeThemeDir(req.params.id);
    } catch (e) {
      if (e instanceof ThemeUploadError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    reloadThemes();
    const after = await loadFullCatalog();
    await saveCatalog({ models: after.models, addons: after.addons, themes: after.themes.map((t) => ({ id: t.manifest.id, enabled: t.enabled, premium: t.premium })) });
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>("/api/admin/themes/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const c = await loadFullCatalog();
    if (!c.themes.some((t) => t.manifest.id === req.params.id)) return reply.code(404).send({ error: "Tema non trovato" });
    // Si cambia l'attivazione, il segno Premium, le categorie: ciò che non è nella richiesta resta com'è.
    const b = (req.body ?? {}) as { enabled?: unknown; premium?: unknown; categories?: unknown };
    const knownCats = new Set(c.categories.map((x) => x.id));
    const cats = Array.isArray(b.categories) ? [...new Set(b.categories.map(String).filter((x) => knownCats.has(x)))] : null;
    const next = c.themes.map((t) => t.manifest.id === req.params.id
      ? { id: t.manifest.id, enabled: typeof b.enabled === "boolean" ? b.enabled : t.enabled, premium: typeof b.premium === "boolean" ? b.premium : t.premium, categories: cats ?? t.categories }
      : { id: t.manifest.id, enabled: t.enabled, premium: t.premium, categories: t.categories });
    if (!next.some((t) => t.enabled)) return reply.code(400).send({ error: "Serve almeno un tema attivo" });
    await saveCatalog({ models: c.models, addons: c.addons, themes: next });
    return { ok: true };
  });

  // Categorie dei template: la console manda l'elenco completo, nell'ordine voluto. Una categoria senza id è nuova
  // (l'id nasce dal nome); quelle tolte dall'elenco spariscono anche dai temi.
  app.put("/api/admin/categories", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const b = (req.body ?? {}) as { categories?: unknown };
    if (!Array.isArray(b.categories)) return reply.code(400).send({ error: "Elenco categorie mancante" });
    const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const slug = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const seen = new Set<string>();
    const categories: TemplateCategory[] = [];
    for (const raw of b.categories.slice(0, 40) as Record<string, unknown>[]) {
      const name = text(raw?.name, 40);
      if (!name) return reply.code(400).send({ error: "Ogni categoria ha bisogno di un nome" });
      let id = slug(text(raw?.id, 40)) || slug(name) || "categoria";
      for (let n = 2; seen.has(id); n++) id = `${slug(name)}-${n}`;
      seen.add(id);
      categories.push({ id, name, nameEn: text(raw?.nameEn, 40) || name, icon: isLibraryIcon(raw?.icon) ? (raw.icon as string) : "sparkles" });
    }
    const c = await loadFullCatalog();
    const themesNext = c.themes.map((t) => ({ id: t.manifest.id, enabled: t.enabled, premium: t.premium, categories: t.categories.filter((x) => seen.has(x)) }));
    await saveCatalog({ models: c.models, addons: c.addons, themes: themesNext, categories });
    return { ok: true, categories };
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
    // Il brano esce dalla libreria; il file resta se un invito (bozza, pagina online, brano del template) lo usa ancora.
    if (rows[0]?.url?.startsWith("/api/media/")) {
      const name = path.basename(rows[0].url);
      const like = `%${name.replace(/[\\%_]/g, (c: string) => `\\${c}`)}%`;
      const used = await pool.query(
        "SELECT 1 FROM invitations WHERE config::text LIKE $1 OR COALESCE(published_config::text, '') LIKE $1 OR planner::text LIKE $1 LIMIT 1",
        [like],
      );
      if (!used.rowCount) fs.rmSync(path.join(MEDIA_DIR, name), { force: true });
    }
    return { ok: true };
  });

  // Anteprima dell'invito per l'amministratore: la bozza attuale (v=draft) o la versione pubblicata (v=published),
  // anche se l'invito non è mai stato pubblicato. Sola visualizzazione: il modulo di conferma non invia nulla.
  app.get<{ Params: { id: string }; Querystring: { v?: string } }>("/api/admin/invitations/:id/view", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    // Per id o per slug: la pagina pubblica /i/<slug> ripiega qui quando l'invito non è pubblicato e chi guarda è admin.
    const key = String(req.params.id).slice(0, 80);
    const { rows } = await pool.query("SELECT slug, edit_count, config, published_config FROM invitations WHERE slug = $1 OR id::text = $1 LIMIT 1", [key]);
    const inv = rows[0];
    if (!inv) return reply.code(404).type("text/plain; charset=utf-8").send("Invito non trovato");
    const published = req.query.v === "published" && inv.edit_count >= 1;
    const c = await loadFullCatalog();
    const html = renderFor(c, inv.slug, (published ? inv.published_config : inv.config) as InviteConfig);
    if (!html) return reply.code(410).type("text/plain; charset=utf-8").send("Il tema dell'invito non esiste più");
    const label = published ? "Anteprima amministratore · versione pubblicata" : inv.edit_count >= 1 ? "Anteprima amministratore · bozza attuale (non ancora pubblicata)" : "Anteprima amministratore · invito mai pubblicato";
    const banner = `<div style="position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483647;padding:8px 16px;border-radius:999px;background:#2a2119;color:#fff;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap;max-width:calc(100vw - 20px);overflow:hidden;text-overflow:ellipsis">${escapeHtml(label)}</div>`;
    const viewOnly = html.replace(/data-rsvp-form(?=[\s>])/g, 'data-rsvp-form data-endpoint="about:blank"').replace("</body>", `${banner}</body>`);
    return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").header("X-Robots-Tag", "noindex").send(viewOnly);
  });

  app.get("/api/admin/orders", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const aiLimit = (await loadAssistantSettings()).settings.callLimit;
    const { rows } = await pool.query(
      `SELECT o.id, o.source, o.status, o.kind, o.created_at, o.status_url, o.draft->>'tier' AS tier, o.draft->>'model' AS model,
              COALESCE(o.draft->>'product', 'invitation') AS product, COALESCE(o.draft->>'plan', 'full') AS plan, o.planner_id,
              o.draft->'manual'->>'at' AS manual_at, o.user_id AS owner_id,
              o.invitation_id, i.slug, i.status AS invitation_status, i.order_ref, i.config->>'title' AS title,
              i.edit_count, i.assistant_calls, i.assistant_bonus,
              u.id AS user_id, u.email, u.name AS user_name
       FROM orders o
       LEFT JOIN invitations i ON i.id = o.invitation_id
       LEFT JOIN users u ON u.id = COALESCE(i.user_id, o.user_id)
       ORDER BY o.created_at DESC LIMIT 300`,
    );
    return rows.map((r) => ({ ...r, assistant_limit: r.invitation_id ? aiLimit + (r.assistant_bonus ?? 0) : null }));
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

  // Collegamento Shopify: stato, ID non segreti salvabili dalla console, verifica reale. I segreti non escono mai da qui.
  const shopifyPayload = () => {
    const ids = getShopifyIds();
    return {
      items: shopifyStatus(),
      ids,
      configured: shopifyConfigured(),
      demo: demoMode(),
      webhookUrl: `${appUrl()}/api/webhooks/shopify`,
      webhookTopic: "orders/paid",
      appUrl: appUrl(),
    };
  };
  app.get("/api/admin/shopify", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return shopifyPayload();
  });

  app.put("/api/admin/shopify", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const checked = validateShopifyIds((req.body ?? {}) as Record<string, unknown>);
    if (!checked.ok) return reply.code(400).send({ error: checked.error });
    // Crediti: un numero da solo diventa variante o prodotto secondo quello che risponde Shopify.
    if (checked.value.variantAiCreditsId) checked.value.variantAiCreditsId = await resolveCreditsId(checked.value.variantAiCreditsId);
    await saveShopifyIds(checked.value);
    return shopifyPayload();
  });

  app.post("/api/admin/shopify/test", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return testShopify();
  });

  // Posta: impostazioni dalla console, chiave Resend nel .env. Mostra cosa è attivo e l'ultimo invio.
  const mailPayload = () => ({
    settings: getMailSettings(),
    provider: mailProvider(),
    keyPresent: resendKey().length > 0,
    fromPreview: fromAddress(),
    lastResult: getLastMailResult(),
    templates: getAllMailTemplates(),
  });
  app.get("/api/admin/mail", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return mailPayload();
  });

  app.put("/api/admin/mail", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const checked = validateMailSettings((req.body ?? {}) as Record<string, unknown>);
    if (!checked.ok) return reply.code(400).send({ error: checked.error });
    await saveMailSettings(checked.value);
    return mailPayload();
  });

  // Modelli delle email: salvataggio di un testo, ripristino del predefinito, anteprima con dati di esempio.
  app.put("/api/admin/mail/template", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const b = (req.body ?? {}) as { kind?: unknown; template?: unknown; reset?: unknown; lang?: unknown };
    if (!isMailKind(b.kind)) return reply.code(400).send({ error: "Tipo di email non valido" });
    const lang = b.lang === "en" ? "en" : "it";
    if (b.reset === true) {
      await saveMailTemplate(b.kind, null, lang);
      return mailPayload();
    }
    const checked = validateMailTemplate(b.template);
    if (!checked.ok) return reply.code(400).send({ error: checked.error });
    await saveMailTemplate(b.kind, checked.value, lang);
    return mailPayload();
  });

  app.post("/api/admin/mail/preview", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const b = (req.body ?? {}) as { kind?: unknown; template?: unknown; lang?: unknown };
    if (!isMailKind(b.kind)) return reply.code(400).send({ error: "Tipo di email non valido" });
    const checked = validateMailTemplate(b.template);
    if (!checked.ok) return reply.code(400).send({ error: checked.error });
    const lang = b.lang === "en" ? "en" : "it";
    const sample = lang === "en"
      ? { link: `${appUrl()}/i/esempio-anna-luca`, title: "Anna and Luca", amount: "€99.00", verdict: rsvpVerdict(true, "en") }
      : { link: `${appUrl()}/i/esempio-anna-luca`, title: "Anna e Luca", amount: "99,00 €", verdict: rsvpVerdict(true, "it") };
    const m = renderMail(b.kind, checked.value, sample, lang);
    return { subject: m.subject, html: m.html, variables: MAIL_VARIABLES[b.kind] };
  });

  app.post("/api/admin/mail/test", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const to = String((req.body as { to?: unknown })?.to ?? "").trim().toLowerCase();
    if (!EMAIL.test(to)) return reply.code(400).send({ error: "Indirizzo di prova non valido" });
    const msg = {
      to,
      subject: "Prova di posta: Bespoke Invites",
      html: "<p>Questa è una prova. Se la ricevi, la posta di Bespoke Invites funziona.</p>",
      text: "Questa è una prova. Se la ricevi, la posta di Bespoke Invites funziona.",
    };
    try {
      await sendMail(msg, "test");
      return { ok: true, provider: mailProvider() };
    } catch (e) {
      return { ok: false, provider: mailProvider(), error: (e as Error).message };
    }
  });

  registerAdminInvitations(app, requireAdmin);
  registerAdminConsole(app, {
    requireAdmin,
    enabledThemeIds: async () => (await loadCatalog()).themes.map((t) => ({ id: t.manifest.id, name: t.manifest.name, enabled: t.enabled })),
  });
  registerAdminMedia(app, requireAdmin);
  return app;
}

export async function startApi() {
  await migrate();
  await loadShopifySettings();
  await loadMailSettings();
  await loadMailTemplates();
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
