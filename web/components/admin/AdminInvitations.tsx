"use client";

import { useCallback, useEffect, useState } from "react";
import { Fold } from "./Fold";
import { toast } from "sonner";
import { ExternalLink, Globe, PenLine, Search, Trash2, X } from "lucide-react";
import { useT } from "@/lib/lang";

// Inviti dei clienti: ricerca, filtri (anche per attività nell'editor), dettaglio con la cronologia delle modifiche,
// azioni (richieste AI, elimina con conferma dello slug).
type Row = {
  id: string; slug: string; status: "draft" | "paid"; created_at: string; views: number; edit_count: number;
  model: string | null; theme: string | null; title: string | null; user_id: string; email: string; name: string;
  rsvps: number; guests: number;
  last_edit_at: string | null; last_published_at: string | null; live: boolean; dirty: boolean;
  assistant_calls: number; assistant_limit: number;
};
type Session = { start: string; end: string; saves: number; sections: string[]; published: boolean };
type Detail = Row & {
  assistant_calls: number;
  assistant_bonus: number;
  assistant_limit: number;
  config: { event?: Record<string, unknown>; blocks?: { type: string }[]; addons?: string[] };
  guests: unknown[];
  rsvps: { id: string; answers: Record<string, unknown>; created_at: string }[];
  orders: { id: string; amount_cents: number; currency: string; source: string; status: string; created_at: string }[];
  sessions: Session[];
  planner: { setupDone?: boolean } | null;
};

const loc = () => (typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-GB" : "it-IT");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" });
// «3 minuti fa», «ieri», «12 nov»: quando è stato modificato l'ultima volta.
function ago(iso: string | null, en: boolean): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return en ? "just now" : "adesso";
  if (m < 60) return en ? `${m} min ago` : `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return en ? `${h} h ago` : `${h} ore fa`;
  const d = Math.round(h / 24);
  if (d === 1) return en ? "yesterday" : "ieri";
  if (d < 7) return en ? `${d} days ago` : `${d} giorni fa`;
  return fmtDate(iso);
}
const fmtEur = (cents: number, currency = "EUR") => new Intl.NumberFormat(loc(), { style: "currency", currency }).format(cents / 100);

export function AdminInvitations({ initialUser, onClearUser, initialOpen }: { initialUser?: string; onClearUser?: () => void; initialOpen?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "paid" | "draft">("");
  const [user, setUser] = useState(initialUser ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [activity, setActivity] = useState<"" | "live" | "dirty" | "never" | "stale">("");
  const en = t("it", "en") === "en";

  useEffect(() => setUser(initialUser ?? ""), [initialUser]);
  useEffect(() => { if (initialOpen) setOpenId(initialOpen); }, [initialOpen]);

  const load = useCallback(async (offset: number, append: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ offset: String(offset) });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (user) p.set("user", user);
    if (activity) p.set("activity", activity);
    const res = await fetch(`/api/admin/invitations?${p}`);
    setLoading(false);
    if (!res.ok) return toast.error(t("Elenco non disponibile", "List not available"));
    const data = (await res.json()) as { rows: Row[]; hasMore: boolean };
    setRows((r) => (append ? [...r, ...data.rows] : data.rows));
    setHasMore(data.hasMore);
  }, [q, status, user, activity]);

  useEffect(() => {
    const timer = setTimeout(() => load(0, false), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <label className="adm-search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca per titolo, slug, email o id", "Search by title, slug, email or id")} aria-label={t("Cerca inviti", "Search invitations")} />
        </label>
        <div className="adm-seg" role="group" aria-label={t("Stato", "Status")}>
          {([["", "Tutti", "All"], ["paid", "Pagati", "Paid"], ["draft", "Bozze", "Drafts"]] as const).map(([v, label, en]) => (
            <button key={v} type="button" className={status === v ? "is-on" : ""} aria-pressed={status === v} onClick={() => setStatus(v)}>{t(label, en)}</button>
          ))}
        </div>
        <div className="adm-seg" role="group" aria-label={t("Attività nell'editor", "Editor activity")}>
          {([["", "Ogni attività", "Any activity"], ["live", "In modifica ora", "Editing now"], ["dirty", "Modifiche non pubblicate", "Unpublished changes"], ["never", "Non online", "Not live"], ["stale", "Fermi da 7 giorni", "Idle 7 days"]] as const).map(([v, label, enl]) => (
            <button key={v} type="button" className={activity === v ? "is-on" : ""} aria-pressed={activity === v} onClick={() => setActivity(v)}>{t(label, enl)}</button>
          ))}
        </div>
        {user && (
          <button type="button" className="adm-chip" onClick={() => { setUser(""); onClearUser?.(); }}>
            {t("Solo di un cliente", "One customer only")} <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>{t("Invito", "Invitation")}</th><th>{t("Cliente", "Customer")}</th><th>{t("Stato", "Status")}</th><th>{t("Ultima modifica", "Last edit")}</th><th>{t("Creato", "Created")}</th><th className="num">{t("Visite", "Visits")}</th><th className="num">{t("Risposte", "Replies")}</th><th className="num">BeSpoke AI</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={openId === r.id ? "is-on" : ""} onClick={() => setOpenId(r.id)}>
                <td>
                  <strong>{r.title || t("Senza titolo", "Untitled")}</strong>
                  <small>{r.slug}</small>
                  {/* Anteprima riservata all'admin: si apre anche se l'invito non è pubblicato. */}
                  <a className="adm-open" href={`/api/admin/invitations/${r.id}/view`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><ExternalLink size={13} aria-hidden="true" />{t("Apri", "Open")}</a>
                </td>
                <td><span className="adm-mail">{r.email}</span></td>
                <td>
                  {r.live ? <span className="adm-pill is-live"><i aria-hidden="true" />{t("In modifica ora", "Editing now")}</span>
                    : r.dirty ? <span className="adm-pill is-dirty">{t("Da pubblicare", "To publish")}</span>
                    : r.edit_count >= 1 ? <span className="adm-pill is-paid">{t("Online", "Live")}</span>
                    : <span className="adm-pill is-draft">{r.status === "paid" ? t("Non online", "Not live") : t("Bozza", "Draft")}</span>}
                </td>
                <td><span className="adm-ago">{ago(r.last_edit_at, en)}</span>{r.last_published_at && <small>{t("pubbl.", "publ.")} {ago(r.last_published_at, en)}</small>}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td className="num">{r.views}</td>
                <td className="num">{r.rsvps}</td>
                <td className="num" title={t("Richieste rimaste su disponibili", "Requests left of available")}>{Math.max(0, r.assistant_limit - r.assistant_calls)}/{r.assistant_limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className="adm-empty">{t("Nessun invito con questi filtri.", "No invitations match these filters.")}</p>}
        {loading && <p className="adm-empty">{t("Caricamento…", "Loading…")}</p>}
      </div>
      {hasMore && (
        <button type="button" className="btn outline small adm-more" onClick={() => load(rows.length, true)}>{t("Carica altri", "Load more")}</button>
      )}

      {openId && <InvitationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => load(0, false)} />}
    </div>
  );
}

function InvitationDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchDetail = useCallback(async () => {
    setD(null);
    setErr(null);
    const res = await fetch(`/api/admin/invitations/${id}`);
    if (!res.ok) return setErr(t("Invito non trovato", "Invitation not found"));
    setD((await res.json()) as Detail);
  }, [id]);

  useEffect(() => {
    fetchDetail();
    setConfirm("");
  }, [fetchDetail]);

  // Richieste di BeSpoke AI usate: azzera (tutte di nuovo disponibili) o esaurisce (per provare la ricarica).
  async function setCalls(n: number) {
    setBusy(true);
    const res = await fetch(`/api/admin/invitations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistantCalls: n }) });
    setBusy(false);
    if (!res.ok) return toast.error(t("Operazione non riuscita", "Something went wrong"));
    toast.success(n === 0 ? t("Richieste AI azzerate.", "AI requests reset.") : t("Richieste AI esaurite.", "AI requests used up."));
    fetchDetail();
  }

  async function remove() {
    if (!d) return;
    setBusy(true);
    const res = await fetch(`/api/admin/invitations/${id}?confirm=${encodeURIComponent(d.slug)}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; removedFiles?: number };
    setBusy(false);
    if (!res.ok) return toast.error(data.error ?? t("Eliminazione non riuscita", "Delete failed"));
    toast.success(t(`Invito eliminato${data.removedFiles ? `, con ${data.removedFiles} foto non più usate` : ""}.`, `Invitation deleted${data.removedFiles ? `, with ${data.removedFiles} unused photos` : ""}.`));
    onChanged();
    onClose();
  }

  return (
    <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={t("Dettaglio invito", "Invitation detail")}>
      <div className="adm-drawer-head">
        <h2>{d?.config.event?.title ? String(d.config.event.title) : d?.slug ?? t("Invito", "Invitation")}</h2>
        <button type="button" className="bl-icon" aria-label={t("Chiudi", "Close")} onClick={onClose}><X size={18} /></button>
      </div>
      {err && <p className="form-error">{err}</p>}
      {!d && !err && <p className="hint">{t("Caricamento…", "Loading…")}</p>}
      {d && (
        <div className="adm-drawer-body">
          <dl className="adm-facts">
            <div><dt>{t("Stato", "Status")}</dt><dd><span className={`adm-pill ${d.status === "paid" ? "is-paid" : "is-draft"}`}>{d.status === "paid" ? t("Pagato", "Paid") : t("Bozza", "Draft")}</span></dd></div>
            <div><dt>{t("Cliente", "Customer")}</dt><dd>{d.name || "—"} · {d.email}</dd></div>
            <div><dt>{t("Modello", "Model")}</dt><dd>{d.model ?? "—"}</dd></div>
            <div><dt>{t("Tema", "Style")}</dt><dd>{d.theme ?? "—"}</dd></div>
            <div><dt>{t("Creato", "Created")}</dt><dd>{fmtDate(d.created_at)}</dd></div>
            <div><dt>{t("Visite", "Visits")}</dt><dd>{d.views}</dd></div>
            <div><dt>{t("Editor", "Editor")}</dt><dd>{d.live ? <span className="adm-pill is-live"><i aria-hidden="true" />{t("In modifica ora", "Editing now")}</span> : t(`Ultima modifica ${ago(d.last_edit_at, t("it", "en") === "en")}`, `Last edit ${ago(d.last_edit_at, true)}`)}</dd></div>
            <div><dt>{t("Pubblicazione", "Publishing")}</dt><dd>{d.edit_count >= 1 ? `${d.dirty ? t("Modifiche da pubblicare · ", "Changes to publish · ") : ""}${t(`${d.edit_count} ${d.edit_count === 1 ? "volta" : "volte"}`, `${d.edit_count} ${d.edit_count === 1 ? "time" : "times"}`)}${d.last_published_at ? ` · ${ago(d.last_published_at, t("it", "en") === "en")}` : ""}` : t("Non online", "Not live")}</dd></div>
            <div><dt>{t("Wizard iniziale", "Setup wizard")}</dt><dd>{d.planner?.setupDone ? t("Completato", "Done") : t("Non completato", "Not done")}</dd></div>
            <div><dt>BeSpoke AI</dt><dd>{t(`${Math.max(0, d.assistant_limit - d.assistant_calls)} rimaste · ${Math.min(d.assistant_calls, d.assistant_limit)} usate su ${d.assistant_limit}`, `${Math.max(0, d.assistant_limit - d.assistant_calls)} left · ${Math.min(d.assistant_calls, d.assistant_limit)} used of ${d.assistant_limit}`)}{d.assistant_bonus ? t(` (di cui ${d.assistant_bonus} ricaricate)`, ` (${d.assistant_bonus} topped up)`) : ""}</dd></div>
          </dl>

          <div className="adm-actions">
            <a className="btn outline small" href={`/api/admin/invitations/${d.id}/view`} target="_blank" rel="noopener"><ExternalLink size={15} aria-hidden="true" /> {d.edit_count >= 1 ? t("Anteprima bozza", "Draft preview") : t("Anteprima", "Preview")}</a>
            {d.edit_count >= 1 && <a className="btn outline small" href={`/i/${d.slug}`} target="_blank" rel="noopener"><Globe size={15} aria-hidden="true" /> {t("Pagina pubblica", "Public page")}</a>}
            <button type="button" className="btn outline small" disabled={busy} onClick={() => setCalls(0)}>{t("Azzera richieste AI", "Reset AI requests")}</button>
            <button type="button" className="btn outline small" disabled={busy} onClick={() => setCalls(d.assistant_limit)}>{t("Esaurisci richieste AI", "Use up AI requests")}</button>
          </div>

          <Fold className="adm-section" title={t("Cronologia delle modifiche", "Edit history")} summary={d.sessions.length ? t(`${d.sessions.length} sessioni`, `${d.sessions.length} sessions`) : "—"} mobileOpen>
            {d.sessions.length === 0 && <p className="hint">{t("Nessuna modifica registrata (la cronologia parte dal 23 novembre 2026).", "No edits recorded (history starts on 23 November 2026).")}</p>}
            <ol className="adm-sessions">
              {d.sessions.map((s, i) => (
                <li key={i}>
                  <span className={`adm-sess-ico${s.published ? " is-pub" : ""}`} aria-hidden="true">{s.published ? <Globe size={14} /> : <PenLine size={14} />}</span>
                  <div>
                    <b>{fmtDate(s.start)}, {fmtTime(s.start)}{s.end !== s.start ? `–${fmtTime(s.end)}` : ""}</b>
                    <small>
                      {[s.saves ? t(`${s.saves} ${s.saves === 1 ? "salvataggio" : "salvataggi"}`, `${s.saves} ${s.saves === 1 ? "save" : "saves"}`) : null, s.published ? t("pubblicato", "published") : null].filter(Boolean).join(" · ")}
                    </small>
                    {s.sections.length > 0 && <span className="adm-sess-tags">{s.sections.map((x) => <em key={x}>{x}</em>)}</span>}
                  </div>
                </li>
              ))}
            </ol>
          </Fold>

          <Fold className="adm-section" title={t("Pagamenti", "Payments")} summary={String(d.orders.length)}>
            {d.orders.length === 0 && <p className="hint">{t("Nessun ordine collegato.", "No linked orders.")}</p>}
            {d.orders.map((o) => (
              <p key={o.id} className="adm-line"><span>{fmtDate(o.created_at)}</span><b>{fmtEur(o.amount_cents, o.currency)}</b><small>{o.source} · {o.status}</small></p>
            ))}
          </Fold>

          <Fold className="adm-section" title={t("Risposte", "Replies")} summary={String(d.rsvps.length)}>
            {d.rsvps.length === 0 && <p className="hint">{t("Nessuna risposta.", "No replies.")}</p>}
            {d.rsvps.slice(0, 50).map((r) => (
              <p key={r.id} className="adm-line"><span>{fmtDate(r.created_at)}</span><small>{Object.entries(r.answers).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</small></p>
            ))}
          </Fold>

          <Fold className="adm-section adm-danger" title={t("Elimina invito", "Delete invitation")} tone="danger">
            <p className="hint">{t("Rimuove l'invito, le risposte e le foto che nessun altro invito usa. Gli ordini restano nel registro. Non si annulla.", "Removes the invitation, the replies and photos no other invitation uses. Orders stay in the log. This can't be undone.")}</p>
            <label className="adm-confirm">
              {t("Scrivi", "Type")} <code>{d.slug}</code> {t("per confermare", "to confirm")}
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <button type="button" className="btn adm-btn-danger small" disabled={busy || confirm !== d.slug} onClick={remove}>
              <Trash2 size={15} aria-hidden="true" /> {t("Elimina definitivamente", "Delete permanently")}
            </button>
          </Fold>
        </div>
      )}
    </aside>
  );
}
