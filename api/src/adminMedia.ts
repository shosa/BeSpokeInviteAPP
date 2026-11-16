import fs from "fs";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db";
import { MEDIA_DIR } from "./media";
import { mediaNames } from "./adminInvitations";

// File caricati dai clienti (foto, video, audio): elenco con gli usi, eliminazione degli orfani.
// Orfano = nessun invito e nessun brano della libreria lo usa più. Gli orfani recenti (meno di 24 ore) restano:
// un caricamento può essere ancora in corso prima di essere salvato nell'invito.

type Guard = (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;

const GRACE_MS = 24 * 60 * 60 * 1000;
const NAME = /^[0-9a-f-]{36}\.(jpg|png|mp4|mp3)$/i;

type MediaRow = { name: string; kind: "foto" | "video" | "audio"; bytes: number; createdAt: string; invitations: number; music: number; orphan: boolean; ageHours: number };

async function usage(): Promise<{ byName: Map<string, number>; music: Set<string> }> {
  const byName = new Map<string, number>();
  const inv = await pool.query("SELECT config FROM invitations");
  for (const r of inv.rows) for (const n of mediaNames(r.config)) byName.set(n, (byName.get(n) ?? 0) + 1);
  // Anche le foto della testata dei planner (sfondo e arco) sono in uso.
  const pl = await pool.query("SELECT data FROM planners WHERE data ? 'bannerImage' OR data ? 'archImage'");
  for (const r of pl.rows) for (const n of mediaNames({ b: r.data?.bannerImage, a: r.data?.archImage })) byName.set(n, (byName.get(n) ?? 0) + 1);
  const mt = await pool.query("SELECT url FROM music_tracks WHERE url LIKE '/api/media/%'");
  const music = new Set<string>(mt.rows.map((r) => path.basename(r.url)));
  return { byName, music };
}

function kindOf(name: string): MediaRow["kind"] {
  if (name.endsWith(".mp4")) return "video";
  if (name.endsWith(".mp3")) return "audio";
  return "foto";
}

export function registerAdminMedia(app: FastifyInstance, requireAdmin: Guard) {
  app.get("/api/admin/media", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { byName, music } = await usage();
    const now = Date.now();
    const files = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR).filter((n) => NAME.test(n)) : [];
    const rows: MediaRow[] = files.map((name) => {
      const st = fs.statSync(path.join(MEDIA_DIR, name));
      const invitations = byName.get(name) ?? 0;
      const musicUses = music.has(name) ? 1 : 0;
      return {
        name,
        kind: kindOf(name),
        bytes: st.size,
        createdAt: st.mtime.toISOString(),
        invitations,
        music: musicUses,
        orphan: invitations === 0 && musicUses === 0,
        ageHours: Math.round((now - st.mtime.getTime()) / 3600000),
      };
    });
    rows.sort((a, b) => Number(b.orphan) - Number(a.orphan) || b.bytes - a.bytes);
    const orphans = rows.filter((r) => r.orphan);
    return {
      files: rows,
      totals: {
        count: rows.length,
        bytes: rows.reduce((s, r) => s + r.bytes, 0),
        orphans: orphans.length,
        orphanBytes: orphans.reduce((s, r) => s + r.bytes, 0),
        orphansOlderThanGrace: orphans.filter((r) => now - new Date(r.createdAt).getTime() >= GRACE_MS).length,
      },
    };
  });

  // Elimina un file, ma solo se è orfano.
  app.delete<{ Params: { name: string } }>("/api/admin/media/:name", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const name = req.params.name;
    if (!NAME.test(name)) return reply.code(404).send({ error: "File non trovato" });
    const { byName, music } = await usage();
    if (byName.get(name) || music.has(name)) return reply.code(409).send({ error: "Il file è ancora in uso: non si elimina" });
    fs.rmSync(path.join(MEDIA_DIR, name), { force: true });
    return { ok: true };
  });

  // Elimina tutti gli orfani più vecchi di 24 ore.
  app.post("/api/admin/media/cleanup", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { byName, music } = await usage();
    const now = Date.now();
    let removed = 0;
    let bytes = 0;
    for (const name of fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR) : []) {
      if (!NAME.test(name) || byName.get(name) || music.has(name)) continue;
      const full = path.join(MEDIA_DIR, name);
      const st = fs.statSync(full);
      if (now - st.mtime.getTime() < GRACE_MS) continue;
      bytes += st.size;
      fs.rmSync(full, { force: true });
      removed++;
    }
    await pool.query("INSERT INTO events (type, invitation_id) VALUES ('admin_media_cleanup', NULL)");
    return { ok: true, removed, bytes };
  });
}
