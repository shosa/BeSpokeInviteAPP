import { blockDef, type InviteConfig } from "@inviteme/shared";
import { pool } from "./db";

// Attività nell'editor, per la console: quali sezioni cambiano a ogni salvataggio, salvataggi e pubblicazioni.
// I salvataggi ravvicinati (autosalvataggio) dello stesso utente finiscono in una sola riga, con l'unione delle sezioni.

const MERGE_MINUTES = 2;

export function changedSections(before: InviteConfig, after: InviteConfig): string[] {
  const out = new Set<string>();
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (!same(before.event, after.event)) out.add("Dati dell'evento");
  if (before.themeId !== after.themeId) out.add("Template");
  if (before.locale !== after.locale) out.add("Lingua");
  if (!same(before.rsvpQuestions, after.rsvpQuestions)) out.add("Domande della conferma");
  if (!same([...(before.addons ?? [])].sort(), [...(after.addons ?? [])].sort())) out.add("Funzioni");
  const prev = new Map((before.blocks ?? []).map((b) => [b.id, b]));
  const next = new Map((after.blocks ?? []).map((b) => [b.id, b]));
  const label = (type: string) => blockDef(type)?.label ?? type;
  for (const [id, b] of next) {
    const p = prev.get(id);
    if (!p) out.add(`${label(b.type)} (aggiunto)`);
    else if (!same(p.props, b.props) || !!p.hidden !== !!b.hidden) out.add(label(b.type));
  }
  for (const [id, p] of prev) if (!next.has(id)) out.add(`${label(p.type)} (tolto)`);
  const order = (c: InviteConfig) => (c.blocks ?? []).map((b) => b.id).filter((id) => prev.has(id) && next.has(id));
  if (!same(order(before), order(after))) out.add("Ordine dei blocchi");
  return [...out];
}

export async function recordSave(invitationId: string, userId: string, sections: string[]): Promise<void> {
  if (!sections.length) return;
  await pool.query("UPDATE invitations SET last_edit_at = now(), editor_seen_at = now() WHERE id = $1", [invitationId]);
  const { rows } = await pool.query(
    `SELECT id, sections FROM invitation_edits
     WHERE invitation_id = $1 AND user_id = $2 AND kind = 'save' AND created_at > now() - ($3 || ' minutes')::interval
     ORDER BY created_at DESC LIMIT 1`,
    [invitationId, userId, String(MERGE_MINUTES)],
  );
  if (rows[0]) {
    const merged = [...new Set([...(rows[0].sections as string[]), ...sections])].slice(0, 40);
    await pool.query("UPDATE invitation_edits SET sections = $2, created_at = now() WHERE id = $1", [rows[0].id, merged]);
  } else {
    await pool.query("INSERT INTO invitation_edits (invitation_id, user_id, kind, sections) VALUES ($1, $2, 'save', $3)", [invitationId, userId, sections.slice(0, 40)]);
  }
}

export async function recordPublish(invitationId: string, userId: string): Promise<void> {
  await pool.query("UPDATE invitations SET last_published_at = now() WHERE id = $1", [invitationId]);
  await pool.query("INSERT INTO invitation_edits (invitation_id, user_id, kind) VALUES ($1, $2, 'publish')", [invitationId, userId]);
}

// Sessioni di lavoro per la console: righe a meno di 20 minuti l'una dall'altra stanno nella stessa sessione.
export type EditSession = { start: string; end: string; saves: number; sections: string[]; published: boolean };
export function sessionsOf(rows: { kind: string; sections: string[]; created_at: Date }[]): EditSession[] {
  const asc = [...rows].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const out: (EditSession & { _end: number })[] = [];
  for (const r of asc) {
    const t = r.created_at.getTime();
    const cur = out[out.length - 1];
    if (cur && t - cur._end < 20 * 60_000) {
      cur._end = t;
      cur.end = r.created_at.toISOString();
      if (r.kind === "save") { cur.saves++; cur.sections = [...new Set([...cur.sections, ...r.sections])]; }
      else cur.published = true;
    } else {
      out.push({ _end: t, start: r.created_at.toISOString(), end: r.created_at.toISOString(), saves: r.kind === "save" ? 1 : 0, sections: r.kind === "save" ? [...r.sections] : [], published: r.kind === "publish" });
    }
  }
  return out.reverse().map(({ _end, ...s }) => s); // eslint-disable-line @typescript-eslint/no-unused-vars
}
