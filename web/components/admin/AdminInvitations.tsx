"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useT } from "@/lib/lang";

// Inviti dei clienti: ricerca, filtri, dettaglio e azioni (riapri la modifica, elimina con conferma dello slug).
type Row = {
  id: string; slug: string; status: "draft" | "paid"; created_at: string; views: number; edit_count: number;
  model: string | null; theme: string | null; title: string | null; user_id: string; email: string; name: string;
  rsvps: number; guests: number;
};
type Detail = Row & {
  config: { event?: Record<string, unknown>; blocks?: { type: string }[]; addons?: string[] };
  guests: unknown[];
  rsvps: { id: string; answers: Record<string, unknown>; created_at: string }[];
  orders: { id: string; amount_cents: number; currency: string; source: string; status: string; created_at: string }[];
};

const loc = () => (typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-GB" : "it-IT");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
const fmtEur = (cents: number, currency = "EUR") => new Intl.NumberFormat(loc(), { style: "currency", currency }).format(cents / 100);

export function AdminInvitations({ initialUser, onClearUser }: { initialUser?: string; onClearUser?: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "paid" | "draft">("");
  const [user, setUser] = useState(initialUser ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => setUser(initialUser ?? ""), [initialUser]);

  const load = useCallback(async (offset: number, append: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ offset: String(offset) });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (user) p.set("user", user);
    const res = await fetch(`/api/admin/invitations?${p}`);
    setLoading(false);
    if (!res.ok) return toast.error(t("Elenco non disponibile", "List not available"));
    const data = (await res.json()) as { rows: Row[]; hasMore: boolean };
    setRows((r) => (append ? [...r, ...data.rows] : data.rows));
    setHasMore(data.hasMore);
  }, [q, status, user]);

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
        {user && (
          <button type="button" className="adm-chip" onClick={() => { setUser(""); onClearUser?.(); }}>
            {t("Solo di un cliente", "One customer only")} <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>{t("Invito", "Invitation")}</th><th>{t("Cliente", "Customer")}</th><th>{t("Stato", "Status")}</th><th>{t("Modello", "Model")}</th><th>{t("Creato", "Created")}</th><th className="num">{t("Visite", "Visits")}</th><th className="num">{t("Risposte", "Replies")}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={openId === r.id ? "is-on" : ""} onClick={() => setOpenId(r.id)}>
                <td>
                  <strong>{r.title || t("Senza titolo", "Untitled")}</strong>
                  <small>{r.slug}</small>
                </td>
                <td><span className="adm-mail">{r.email}</span></td>
                <td><span className={`adm-pill ${r.status === "paid" ? "is-paid" : "is-draft"}`}>{r.status === "paid" ? t("Pagato", "Paid") : t("Bozza", "Draft")}</span></td>
                <td>{r.model ?? "—"}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td className="num">{r.views}</td>
                <td className="num">{r.rsvps}</td>
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

  async function reopen() {
    setBusy(true);
    const res = await fetch(`/api/admin/invitations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reopenEdit: true }) });
    setBusy(false);
    if (!res.ok) return toast.error(t("Operazione non riuscita", "Something went wrong"));
    toast.success(t("Modifica riaperta: il cliente può di nuovo cambiare l'invito.", "Editing reopened: the customer can change the invitation again."));
    fetchDetail();
    onChanged();
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
            <div><dt>{t("Modifiche", "Edits")}</dt><dd>{d.edit_count >= 1 ? t("Confermata", "Confirmed") : t("Aperta", "Open")}</dd></div>
          </dl>

          <div className="adm-actions">
            <a className="btn outline small" href={`/i/${d.slug}`} target="_blank" rel="noopener"><ExternalLink size={15} aria-hidden="true" /> {t("Apri la pagina", "Open the page")}</a>
            {d.status === "paid" && d.edit_count >= 1 && (
              <button type="button" className="btn outline small" disabled={busy} onClick={reopen}><RotateCcw size={15} aria-hidden="true" /> {t("Riapri la modifica", "Reopen editing")}</button>
            )}
          </div>

          <section className="adm-section">
            <h3>{t("Pagamenti", "Payments")}</h3>
            {d.orders.length === 0 && <p className="hint">{t("Nessun ordine collegato.", "No linked orders.")}</p>}
            {d.orders.map((o) => (
              <p key={o.id} className="adm-line"><span>{fmtDate(o.created_at)}</span><b>{fmtEur(o.amount_cents, o.currency)}</b><small>{o.source} · {o.status}</small></p>
            ))}
          </section>

          <section className="adm-section">
            <h3>{t("Risposte", "Replies")} ({d.rsvps.length})</h3>
            {d.rsvps.length === 0 && <p className="hint">{t("Nessuna risposta.", "No replies.")}</p>}
            {d.rsvps.slice(0, 50).map((r) => (
              <p key={r.id} className="adm-line"><span>{fmtDate(r.created_at)}</span><small>{Object.entries(r.answers).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</small></p>
            ))}
          </section>

          <section className="adm-section adm-danger">
            <h3>{t("Elimina invito", "Delete invitation")}</h3>
            <p className="hint">{t("Rimuove l'invito, le risposte e le foto che nessun altro invito usa. Gli ordini restano nel registro. Non si annulla.", "Removes the invitation, the replies and photos no other invitation uses. Orders stay in the log. This can't be undone.")}</p>
            <label className="adm-confirm">
              {t("Scrivi", "Type")} <code>{d.slug}</code> {t("per confermare", "to confirm")}
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <button type="button" className="btn adm-btn-danger small" disabled={busy || confirm !== d.slug} onClick={remove}>
              <Trash2 size={15} aria-hidden="true" /> {t("Elimina definitivamente", "Delete permanently")}
            </button>
          </section>
        </div>
      )}
    </aside>
  );
}
