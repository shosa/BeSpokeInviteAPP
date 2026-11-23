"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Fold } from "./Fold";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Mail, Send, Ticket, Trash2 } from "lucide-react";
import { fmtDate } from "./format";
import { useLang } from "@/lib/lang";
import { CopyId } from "./CopyId";

type UserRow = { id: string; email: string; name: string; role: string; invitations: number; created_at: string };
type Detail = {
  user: { id: string; email: string; name: string; role: string; created_at: string };
  invitations: { id: string; slug: string; status: string; edit_count: number; views: number; created_at: string; theme: string | null; title: string | null; event_date: string | null; rsvps: number; assistant_calls: number; assistant_limit: number; live: boolean }[];
  planners: { id: string; title: string; event_date: string | null; invitation_id: string | null; created_at: string; tasks: number; tasks_done: number }[];
  pending: { id: string; created_at: string; product: string; plan?: string; manual: { reason: string } | null }[];
  orders: { id: string; created_at: string; status: string; kind: string; product: string; plan?: string; manual: { reason: string } | null; invitation_id: string | null; planner_id: string | null }[];
};
type Product = "invitation" | "basic" | "planner" | "bundle";
const REASONS: { id: string; it: string; en: string }[] = [
  { id: "omaggio", it: "Omaggio", en: "Gift" },
  { id: "sostituzione", it: "Sostituzione", en: "Replacement" },
  { id: "prova", it: "Prova interna", en: "Internal test" },
  { id: "fuori-shopify", it: "Pagato fuori da Shopify", en: "Paid outside Shopify" },
];

// Clienti: elenco con ricerca; un clic apre la scheda (inviti, planner, acquisti da attivare, azioni).
export function AdminUsers({ openId, onOpen, onOpenInvitations }: { openId?: string; onOpen: (id: string | undefined) => void; onOpenInvitations: (userId: string) => void }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = () => fetch("/api/admin/users").then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [rows, query]);

  if (openId) return <CustomerCard id={openId} onBack={() => { onOpen(undefined); load(); }} onOpenInvitations={onOpenInvitations} />;
  if (rows === null) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;
  const admins = rows.filter((u) => u.role === "admin").length;

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <p className="hint">{rows.length} {rows.length === 1 ? t("cliente", "customer") : t("clienti", "customers")} · {admins} {admins === 1 ? t("amministratore", "administrator") : t("amministratori", "administrators")}</p>
        <input className="ac-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cerca per nome o email", "Search by name or email")} aria-label={t("Cerca clienti", "Search customers")} />
      </div>
      {shown.length === 0 ? (
        <div className="ac-card"><p className="hint">{t("Nessun cliente trovato.", "No customers found.")}</p></div>
      ) : (
        <div className="cu-list">
          {shown.map((u) => (
            <button key={u.id} type="button" className="cu-row" onClick={() => onOpen(u.id)}>
              <span className="cu-av" aria-hidden="true">{initials(u.name || u.email)}</span>
              <span className="cu-main"><b>{u.name || u.email}</b><small>{u.email}</small></span>
              <span className="cu-meta">{u.invitations} {u.invitations === 1 ? t("invito", "invitation") : t("inviti", "invitations")}</span>
              {u.role === "admin" && <span className="cu-tag">Admin</span>}
              <span className="cu-meta">{fmtDate(u.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function CustomerCard({ id, onBack, onOpenInvitations }: { id: string; onBack: () => void; onOpenInvitations: (userId: string) => void }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<Product>("invitation");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("omaggio");
  const [notify, setNotify] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${id}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setErr((body as { error?: string }).error ?? t("Cliente non trovato", "Customer not found"));
    setD(body as Detail);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [load]);

  async function post(url: string, body?: unknown, method = "POST") {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { error?: string; added?: number; mailed?: boolean };
    setBusy(false);
    if (!res.ok) { toast.error(out.error ?? t("Operazione non riuscita", "Something went wrong")); return null; }
    return out;
  }

  async function grant() {
    const out = await post(`/api/admin/users/${id}/grant`, { product, qty, reason, notify });
    if (!out) return;
    toast.success(t(`Assegnati ${out.added} acquisti da attivare${out.mailed ? ", email inviata" : ""}.`, `${out.added} purchases assigned${out.mailed ? ", email sent" : ""}.`));
    void load();
  }
  async function sendLink() {
    if (await post(`/api/admin/users/${id}/access-link`)) toast.success(t("Link di accesso inviato.", "Sign-in link sent."));
  }
  async function removePending(orderId: string) {
    if (!window.confirm(t("Togliere questo acquisto da attivare?", "Remove this purchase to activate?"))) return;
    if (await post(`/api/admin/pending/${encodeURIComponent(orderId)}`, undefined, "DELETE")) { toast.success(t("Acquisto tolto.", "Purchase removed.")); void load(); }
  }
  async function setRole(role: string) {
    if (await post(`/api/admin/users/${id}`, { role }, "PATCH")) { toast.success(t("Ruolo aggiornato.", "Role updated.")); void load(); }
  }

  if (err) return <div className="ac-stack"><button type="button" className="cu-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t("Clienti", "Customers")}</button><p className="form-error">{err}</p></div>;
  if (!d) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;
  const u = d.user;
  const productName = (p: string, plan?: string) => (p === "planner" ? "Planner" : plan === "base" ? t("Invito base", "Basic invitation") : t("Invito", "Invitation"));
  const reasonName = (r?: string) => { const x = REASONS.find((y) => y.id === r); return x ? t(x.it, x.en) : ""; };

  return (
    <div className="cu">
      <button type="button" className="cu-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t("Tutti i clienti", "All customers")}</button>

      <header className="ac-card cu-head">
        <span className="cu-av is-big" aria-hidden="true">{initials(u.name || u.email)}</span>
        <div className="cu-id">
          <span className="ac-kicker">{t(`Cliente dal ${fmtDate(u.created_at)}`, `Customer since ${fmtDate(u.created_at)}`)}</span>
          <h2>{u.name || u.email}</h2>
          <p className="hint">{u.email}</p>
        </div>
        <div className="cu-actions">
          <button type="button" className="btn outline small" disabled={busy} onClick={sendLink}><Send size={15} aria-hidden="true" />{t("Manda link di accesso", "Send sign-in link")}</button>
          <select value={u.role} onChange={(e) => setRole(e.target.value)} aria-label={t("Ruolo", "Role")} disabled={busy}>
            <option value="user">{t("Cliente", "Customer")}</option>
            <option value="admin">{t("Amministratore", "Administrator")}</option>
          </select>
        </div>
        <dl className="cu-stats">
          <div><dt>{t("Inviti", "Invitations")}</dt><dd>{d.invitations.length}</dd></div>
          <div><dt>Planner</dt><dd>{d.planners.length}</dd></div>
          <div><dt>{t("Da attivare", "To activate")}</dt><dd>{d.pending.length}</dd></div>
          <div><dt>{t("Ordini", "Orders")}</dt><dd>{d.orders.length}</dd></div>
        </dl>
      </header>

      <div className="cu-grid">
        {d.pending.map((p) => (
          <article key={p.id} className="cu-item is-pending">
            <div className="cu-item-top"><span className="chip-warn"><Ticket size={13} aria-hidden="true" />{t("Da attivare", "To activate")}</span><small>{fmtDate(p.created_at)}</small></div>
            <strong>{productName(p.product, p.plan)}</strong>
            <small>{p.manual ? t(`Assegnato a mano · ${reasonName(p.manual.reason)}`, `Assigned by hand · ${reasonName(p.manual.reason)}`) : t("Dal negozio", "From the shop")}</small>
            <div className="cu-links"><button type="button" onClick={sendLink} disabled={busy}>{t("Ricorda via email", "Remind by email")}</button><button type="button" className="is-danger" onClick={() => removePending(p.id)} disabled={busy}><Trash2 size={13} aria-hidden="true" />{t("Togli", "Remove")}</button></div>
          </article>
        ))}
        {d.invitations.map((i) => (
          <article key={i.id} className="cu-item">
            <div className="cu-item-top"><span className="chip-inv"><Mail size={13} aria-hidden="true" />{t("Invito", "Invitation")}</span><span className={i.edit_count >= 1 ? "chip-ok" : "chip-soft"}>{i.edit_count >= 1 ? t("Online", "Live") : i.status === "paid" ? t("In preparazione", "In progress") : t("Bozza", "Draft")}</span>{i.live && <span className="adm-pill is-live"><i aria-hidden="true" />{t("In modifica ora", "Editing now")}</span>}</div>
            <strong>{i.title || t("Senza titolo", "Untitled")}</strong>
            <small>{[i.event_date, `${i.views} ${t("visite", "visits")}`, `${i.rsvps} ${t("risposte", "replies")}`, t(`BeSpoke AI ${Math.max(0, i.assistant_limit - i.assistant_calls)} su ${i.assistant_limit} rimaste`, `BeSpoke AI ${Math.max(0, i.assistant_limit - i.assistant_calls)} of ${i.assistant_limit} left`)].filter(Boolean).join(" · ")}</small>
            <div className="cu-links"><a href={`/api/admin/invitations/${i.id}/view`} target="_blank" rel="noopener">{i.edit_count >= 1 ? t("Anteprima bozza", "Draft preview") : t("Anteprima", "Preview")}</a>{i.edit_count >= 1 && <a href={`/i/${i.slug}`} target="_blank" rel="noopener">{t("Pagina pubblica", "Public page")}</a>}<a href={`/inviti/${i.id}/risposte`} target="_blank" rel="noopener">{t("Risposte", "Replies")}</a><button type="button" onClick={() => onOpenInvitations(u.id)}>{t("Nella lista inviti", "In the invitations list")}</button></div>
          </article>
        ))}
        {d.planners.map((p) => (
          <article key={p.id} className="cu-item">
            <div className="cu-item-top"><span className="chip-pl"><BookOpen size={13} aria-hidden="true" />Planner</span><small>{p.invitation_id ? t("collegato", "linked") : t("da solo", "standalone")}</small></div>
            <strong>{p.title || t("Senza titolo", "Untitled")}</strong>
            <small>{[p.event_date, t(`${p.tasks_done}/${p.tasks} attività`, `${p.tasks_done}/${p.tasks} tasks`)].filter(Boolean).join(" · ")}</small>
            <div className="cu-links"><a href={`/admin/planner/${p.id}`} target="_blank" rel="noopener">{t("Apri il planner", "Open the planner")}</a></div>
          </article>
        ))}
        {d.pending.length + d.invitations.length + d.planners.length === 0 && <p className="hint">{t("Nessun invito, planner o acquisto.", "No invitations, planners or purchases.")}</p>}
      </div>

      <div className="cu-two">
        <Fold className="ac-card cu-grant" title={t("Assegna un acquisto", "Assign a purchase")}>
          <p className="hint">{t("Compare nella sua area come «da attivare», come un acquisto dal negozio. Non entra negli ordini di Shopify.", "It appears in their account as «to activate», like a shop purchase. It doesn't go into Shopify orders.")}</p>
          <div className="cu-seg" role="radiogroup" aria-label={t("Prodotto", "Product")}>
            {([["invitation", t("Invito", "Invitation"), t("tutti i template + planner", "all templates + planner")], ["basic", t("Invito base", "Basic invitation"), t("solo non Premium", "non-Premium only")], ["planner", "Planner", t("organizza l'evento", "plans the event")], ["bundle", t("Pacchetto", "Bundle"), t("invito + planner", "invitation + planner")]] as const).map(([v, label, hint]) => (
              <button key={v} type="button" role="radio" aria-checked={product === v} className={product === v ? "is-on" : ""} onClick={() => setProduct(v)}><b>{label}</b><small>{hint}</small></button>
            ))}
          </div>
          <div className="cu-fields">
            <label>{t("Quantità", "Quantity")}<input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></label>
            <label>{t("Motivo", "Reason")}<select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r.id} value={r.id}>{t(r.it, r.en)}</option>)}</select></label>
          </div>
          <label className="cu-check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t("Manda l'email con il link per attivarlo", "Send the email with the link to activate it")}</label>
          <button type="button" className="btn solid" disabled={busy} onClick={grant}>{t("Assegna", "Assign")}</button>
        </Fold>

        <Fold className="ac-card cu-history" title={t("Ordini", "Orders")} summary={String(d.orders.length)}>
          {d.orders.length === 0 ? <p className="hint">{t("Nessun ordine.", "No orders.")}</p> : (
            <ul>
              {d.orders.map((o) => (
                <li key={o.id}>
                  <time>{fmtDate(o.created_at)}</time>
                  <span className="cu-order"><b>{productName(o.product, o.plan)}</b>{o.manual ? <small>{t(`a mano, ${reasonName(o.manual.reason)}`, `by hand, ${reasonName(o.manual.reason)}`)}</small> : null}<CopyId value={o.id} /></span>
                  <small>{o.invitation_id || o.planner_id ? t("attivato", "activated") : o.status === "paid" ? t("da attivare", "to activate") : t("in attesa", "pending")}</small>
                </li>
              ))}
            </ul>
          )}
        </Fold>
      </div>
    </div>
  );
}
