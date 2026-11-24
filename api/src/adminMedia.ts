import fs from "fs";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db";
import { MEDIA_DIR } from "./media";
import { mediaNames } from "./adminInvitations";

// File caricati dai clienti (foto, video, audio): elenco con dove sono usati, eliminazione degli orfani.
// In uso = lo cita la bozza o la versione pubblicata di un invito, i dati dell'invito (brano del template), un planner
// o la libreria musicale. Orfano = nessuno di questi. Gli orfani recenti (meno di 24 ore) restano: un caricamento
// può essere ancora in corso prima di essere salvato nell'invito.

type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;

const GRACE_MS = 24 * 60 * 60 * 1000;
const NAME = /^[0-9a-f-]{36}\.(jpg|png|mp4|mp3)$/i;
const MAX_LISTED_USES = 5;

// Dove è usato un file: invito (bozza, online o entrambe), planner, libreria musicale.
type Use =
  | { kind: "invito"; id: string; title: string; slug: string; draft: boolean; live: boolean }
  | { kind: "planner"; id: string; title: string }
  | { kind: "musica"; id: string; title: string };
type MediaRow = { name: string; kind: "foto" | "video" | "audio"; bytes: number; createdAt: string; uses: Use[]; useCount: number; orphan: boolean; deletable: boolean; ageHours: number };

async function usage(): Promise<Map<string, Use[]>> {
  const out = new Map<string, Use[]>();
  const add = (names: Set<string>, use: Use) => {
    for (const n of names) {
      const list = out.get(n) ?? [];
      list.push(use);
      out.set(n, list);
    }
  };
  const inv = await pool.query("SELECT id, slug, config, published_config, planner FROM invitations");
  for (const r of inv.rows) {
    const draft = mediaNames(r.config);
    const live = mediaNames(r.published_config);
    const extra = mediaNames(r.planner);
    const title = String(r.config?.event?.title ?? r.published_config?.event?.title ?? "") || "Senza titolo";
    for (const n of new Set([...draft, ...live, ...extra])) add(new Set([n]), { kind: "invito", id: r.id, title, slug: r.slug, draft: draft.has(n) || extra.has(n), live: live.has(n) });
  }
  // Planner: testata (sfondo e arco) e qualunque altra immagine salvata nei suoi dati.
  const pl = await pool.query("SELECT id, title, data FROM planners");
  for (const r of pl.rows) add(mediaNames(r.data), { kind: "planner", id: r.id, title: String(r.title ?? "") || "Planner" });
  const mt = await pool.query("SELECT id, title, url FROM music_tracks WHERE url LIKE '/api/media/%'");
  for (const r of mt.rows) add(new Set([path.basename(r.url)]), { kind: "musica", id: String(r.id), title: String(r.title ?? "") });
  return out;
}

function kindOf(name: string): MediaRow["kind"] {
  if (name.endsWith(".mp4")) return "video";
  if (name.endsWith(".mp3")) return "audio";
  return "foto";
}

export function registerAdminMedia(app: FastifyInstance, requireAdmin: Guard) {
  app.get("/api/admin/media", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const uses = await usage();
    const now = Date.now();
    const files = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).filter((n) => NAME.test(n)) : [];
    const rows: MediaRow[] = files.map((name) => {
      const st = fs.statSync(path.join(MEDIA_DIR, name));
      const list = uses.get(name) ?? [];
      const age = now - st.mtime.getTime();
      return {
        name,
        kind: kindOf(name),
        bytes: st.size,
        createdAt: st.mtime.toISOString(),
        uses: list.slice(0, MAX_LISTED_USES),
        useCount: list.length,
        orphan: list.length === 0,
        deletable: list.length === 0 && age >= GRACE_MS,
        ageHours: Math.round(age / 3600000),
      };
    });
    rows.sort((a, b) => Number(b.deletable) - Number(a.deletable) || Number(b.orphan) - Number(a.orphan) || b.bytes - a.bytes);
    const orphans = rows.filter((r) => r.orphan);
    const deletable = rows.filter((r) => r.deletable);
    return {
      files: rows,
      totals: {
        count: rows.length,
        bytes: rows.reduce((s, r) => s + r.bytes, 0),
        live: rows.filter((r) => r.uses.some((u) => u.kind === "invito" && u.live)).length,
        orphans: orphans.length,
        orphanBytes: orphans.reduce((s, r) => s + r.bytes, 0),
        orphansOlderThanGrace: deletable.length,
        deletableBytes: deletable.reduce((s, r) => s + r.bytes, 0),
      },
    };
  });

  // Elimina i file indicati, ma solo quelli orfani da più di 24 ore: l'uso si ricontrolla qui, non si fida dell'elenco.
  async function removeOrphans(names: string[]): Promise<{ removed: string[]; skipped: string[]; bytes: number }> {
    const uses = await usage();
    const now = Date.now();
    const removed: string[] = [];
    const skipped: string[] = [];
    let bytes = 0;
    for (const name of names) {
      const full = path.join(MEDIA_DIR, name);
      if (!NAME.test(name) || uses.has(name) || !fs.existsSync(full)) { skipped.push(name); continue; }
      const st = fs.statSync(full);
      if (now - st.mtime.getTime() < GRACE_MS) { skipped.push(name); continue; }
      bytes += st.size;
      fs.rmSync(full, { force: true });
      removed.push(name);
    }
    return { removed, skipped, bytes };
  }

  // Elimina un file, ma solo se è orfano.
  app.delete<{ Params: { name: string } }>("/api/admin/media/:name", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const name = req.params.name;
    if (!NAME.test(name)) return reply.code(404).send({ error: "File non trovato" });
    const uses = await usage();
    if (uses.has(name)) return reply.code(409).send({ error: "Il file è ancora in uso: non si elimina" });
    fs.rmSync(path.join(MEDIA_DIR, name), { force: true });
    return { ok: true };
  });

  // Eliminazione multipla: i file scelti nella console. Quelli in uso o troppo recenti si saltano.
  app.post("/api/admin/media/delete", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const raw = (req.body as { names?: unknown } | undefined)?.names;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 2000) return reply.code(400).send({ error: "Nessun file indicato" });
    const names = [...new Set(raw.filter((n): n is string => typeof n === "string"))];
    const out = await removeOrphans(names);
    await pool.query("INSERT INTO events (type, invitation_id) VALUES ('admin_media_cleanup', NULL)");
    return { ok: true, removed: out.removed.length, skipped: out.skipped.length, bytes: out.bytes };
  });

  // Elimina tutti gli orfani più vecchi di 24 ore.
  app.post("/api/admin/media/cleanup", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const all = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).filter((n) => NAME.test(n)) : [];
    const out = await removeOrphans(all);
    await pool.query("INSERT INTO events (type, invitation_id) VALUES ('admin_media_cleanup', NULL)");
    return { ok: true, removed: out.removed.length, bytes: out.bytes };
  });
}
