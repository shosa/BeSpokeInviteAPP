"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { fmtDate } from "./format";
import { useT } from "@/lib/lang";
import { toast } from "sonner";
import type { Go } from "./types";
import { CopyId } from "./CopyId";

// Ordini senza importi: identificatori, cliente, invito e metadati utili per capire cosa è successo.
export type OrderDetail = {
  id: string;
  source: string;
  status: string;
  kind: string;
  created_at: string;
  status_url: string | null;
  tier: string | null;
  product?: "invitation" | "planner";
  plan?: "base" | "full";
  model: string | null;
  invitation_id: string | null;
  slug: string | null;
  invitation_status: string | null;
  order_ref: string | null;
  title: string | null;
  user_id: string | null;
  email: string | null;
  user_name: string | null;
  planner_id?: string | null;
  edit_count?: number | null;
  assistant_calls?: number | null;
  assistant_limit?: number | null;
};

type Filter = "tutti" | "attivare" | "inviti" | "planner" | "manuali" | "prova";
const FILTERS: { id: Filter; label: string; en: string }[] = [
  { id: "tutti", label: "Tutti", en: "All" },
  { id: "attivare", label: "Da attivare", en: "To activate" },
  { id: "inviti", label: "Inviti", en: "Invitations" },
  { id: "planner", label: "Planner", en: "Planners" },
  { id: "manuali", label: "Assegnati a mano", en: "Assigned by hand" },
  { id: "prova", label: "Prova", en: "Test" },
];

// Acquisto assegnato dalla console (o a mano in passato): id «manuale-…».
const isManual = (o: OrderDetail) => o.id.startsWith("manuale-");
// Da attivare: pagato, ma il cliente non ha ancora creato l'invito o il planner.
const isPending = (o: OrderDetail) => o.status === "paid" && !o.invitation_id && !o.planner_id;

export function AdminOrders({ go }: { go?: Go }) {
  const t = useT();
  const [rows, setRows] = useState<OrderDetail[] | null>(null);
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OrderDetail | null>(null);

  useEffect(() => {
    fetch("/api/admin/orders").then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((o) => {
      if (filter === "attivare" && !isPending(o)) return false;
      if (filter === "inviti" && o.product === "planner") return false;
      if (filter === "planner" && o.product !== "planner") return false;
      if (filter === "manuali" && !isManual(o)) return false;
      if (filter === "prova" && o.source !== "local") return false;
      if (q && !`${o.id} ${o.email ?? ""} ${o.user_name ?? ""} ${o.title ?? ""} ${o.slug ?? ""} ${o.order_ref ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  function exportCsv() {
    const head = t("id_ordine,data,cliente,email,invito,id_invito,fonte,stato,piano,tipo,riferimento", "order_id,date,customer,email,invitation,invitation_id,source,status,plan,kind,reference").split(",");
    const lines = shown.map((o) => [o.id, o.created_at, o.user_name ?? "", o.email ?? "", o.title ?? "", o.invitation_id ?? "", o.source, o.status, o.tier ?? "", o.kind, o.order_ref ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob([[head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("ordini", "orders")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows === null) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <nav className="ac-segment" aria-label={t("Filtra ordini", "Filter orders")}>
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? "is-on" : ""} onClick={() => setFilter(f.id)}>{t(f.label, f.en)}</button>
          ))}
        </nav>
        <input className="ac-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cerca per ID, email, nome, invito o riferimento", "Search by ID, email, name, invitation or reference")} aria-label={t("Cerca ordini", "Search orders")} />
        <button type="button" className="btn outline small" onClick={exportCsv} disabled={shown.length === 0}>{t("Esporta CSV", "Export CSV")}</button>
      </div>

      <p className="hint">{shown.length} {shown.length === 1 ? t("ordine", "order") : t("ordini", "orders")}{rows.length !== shown.length ? ` ${t("su", "of")} ${rows.length}` : ""}</p>

      {/* Telefono: una riga per ordine (cliente, prodotto, data, stato); il dettaglio si apre in un pannello dal basso. */}
      {shown.length > 0 && (
        <ul className="ord-list" aria-label={t("Ordini", "Orders")}>
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" className="ord-item" onClick={() => setSheet(o)}>
                <span className="ord-main">
                  <b>{o.user_name || o.email || "–"}</b>
                  <small>{o.product === "planner" ? "Planner" : o.plan === "base" ? t("Invito base", "Basic invitation") : t("Invito", "Invitation")} · {isManual(o) ? t("a mano", "by hand") : o.source === "shopify" ? "Shopify" : t("prova", "test")} · {fmtDate(o.created_at)}</small>
                </span>
                <span className={`pill ${isPending(o) ? "draft" : o.status === "paid" ? "yes" : "draft"}`}>{isPending(o) ? t("Da attivare", "To activate") : o.status === "paid" ? t("Attivato", "Activated") : t("In attesa", "Pending")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sheet && (
        <div className="ord-sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="ord-sheet" role="dialog" aria-modal="true" aria-label={t("Dettaglio ordine", "Order details")}>
            <div className="ord-sheet-head">
              <div><b>{sheet.user_name || sheet.email || "–"}</b><small>{fmtDate(sheet.created_at)}</small></div>
              <button type="button" className="ord-x" aria-label={t("Chiudi", "Close")} onClick={() => setSheet(null)}>×</button>
            </div>
            <OrderDetailBody o={sheet} go={go} t={t} />
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="ac-card"><p className="hint">{rows.length === 0 ? t("Nessun ordine ancora.", "No orders yet.") : t("Nessun ordine con questi filtri.", "No orders match these filters.")}</p></div>
      ) : (
        <div className="ac-card ac-table-wrap">
          <table className="ac-table ac-orders">
            <thead>
              <tr><th>{t("Data", "Date")}</th><th>{t("ID ordine", "Order ID")}</th><th>{t("Cliente", "Customer")}</th><th>{t("Invito", "Invitation")}</th><th>{t("Fonte", "Source")}</th><th>{t("Stato", "Status")}</th><th>{t("Prodotto", "Product")}</th></tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <Fragment key={o.id}>
                  <tr className={open === o.id ? "is-open" : ""} onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><CopyId value={o.id} /></td>
                    <td>
                      <b>{o.user_name || "–"}</b>
                      <small className="ac-sub">{o.email ?? t("email sconosciuta", "unknown email")}</small>
                    </td>
                    <td>
                      {o.title ?? <span className="hint">{t("nessun invito", "no invitation")}</span>}
                      {o.slug && <small className="ac-sub">/i/{o.slug}</small>}
                    </td>
                    <td><span className="ac-tag">{isManual(o) ? t("A mano", "By hand") : o.source === "shopify" ? "Shopify" : t("Prova", "Test")}</span></td>
                    <td><span className={`pill ${isPending(o) ? "draft" : o.status === "paid" ? "yes" : "draft"}`}>{isPending(o) ? t("Da attivare", "To activate") : o.status === "paid" ? t("Attivato", "Activated") : t("In attesa di pagamento", "Awaiting payment")}</span></td>
                    <td>{o.product === "planner" ? "Planner" : o.plan === "base" ? t("Invito base", "Basic invitation") : t("Invito", "Invitation")}</td>
                  </tr>
                  {open === o.id && (
                    <tr className="ac-detail-row">
                      <td colSpan={7}>
                        <OrderDetailBody o={o} go={go} t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Dettaglio di un ordine: dati, collegamenti e azioni. In tabella (computer) si apre sotto la riga, al telefono in un pannello.
function OrderDetailBody({ o, go, t }: { o: OrderDetail; go?: Go; t: (it: string, en: string) => string }) {
  return (
    <>
      <dl className="ac-meta">
        <div><dt>{t("ID ordine", "Order ID")}</dt><dd><CopyId value={o.id} keep={24} /></dd></div>
        <div><dt>{t("Riferimento", "Reference")}</dt><dd>{o.order_ref ?? "–"}</dd></div>
        <div><dt>{t("Cliente", "Customer")}</dt><dd>{o.user_name || "–"} · {o.email ?? "–"}</dd></div>
        <div><dt>{t("ID cliente", "Customer ID")}</dt><dd>{o.user_id ? <CopyId value={o.user_id} /> : "–"}</dd></div>
        <div><dt>{t("ID invito", "Invitation ID")}</dt><dd>{o.invitation_id ? <CopyId value={o.invitation_id} /> : "–"}</dd></div>
        <div><dt>{t("Stato invito", "Invitation status")}</dt><dd>{o.invitation_id ? ((o.edit_count ?? 0) >= 1 ? t("Online", "Live") : t("Mai pubblicato", "Never published")) : t("non creato", "not created")}</dd></div>
        {o.invitation_id && o.assistant_limit != null && <div><dt>BeSpoke AI</dt><dd>{t(`${Math.max(0, o.assistant_limit - (o.assistant_calls ?? 0))} richieste rimaste su ${o.assistant_limit}`, `${Math.max(0, o.assistant_limit - (o.assistant_calls ?? 0))} requests left of ${o.assistant_limit}`)}</dd></div>}
        <div><dt>{t("Modello", "Model")}</dt><dd>{o.model ?? "–"}</dd></div>
        <div><dt>{t("Tipo", "Kind")}</dt><dd>{o.kind === "upgrade" ? t("Aggiornamento", "Upgrade") : t("Acquisto", "Purchase")}</dd></div>
        <div><dt>{t("Creato", "Created")}</dt><dd>{fmtDate(o.created_at)}</dd></div>
        <div><dt>{t("Ordine su Shopify", "Order on Shopify")}</dt><dd>{o.status_url ? <a href={o.status_url} target="_blank" rel="noopener noreferrer">{t("Apri la pagina dell'ordine", "Open the order page")}</a> : "–"}</dd></div>
      </dl>
      {o.user_id && (
        <div className="ac-order-acts">
          {go && <button type="button" className="btn outline small" onClick={() => go("clienti", { userId: o.user_id! })}>{t("Scheda cliente", "Customer profile")}</button>}
          {o.invitation_id && <a className="btn outline small" href={`/api/admin/invitations/${o.invitation_id}/view`} target="_blank" rel="noopener">{t("Anteprima invito", "Invitation preview")}</a>}
          {o.invitation_id && go && <button type="button" className="btn outline small" onClick={() => go("inviti", { invitationId: o.invitation_id! })}>{t("Dettaglio invito", "Invitation details")}</button>}
          {isPending(o) && <button type="button" className="btn solid small" onClick={async () => { const r = await fetch(`/api/admin/users/${o.user_id}/access-link`, { method: "POST" }); if (r.ok) toast.success(t("Link di accesso rimandato.", "Sign-in link sent again.")); else toast.error(t("Email non inviata", "Email not sent")); }}>{t("Rimanda il link", "Resend the link")}</button>}
        </div>
      )}
    </>
  );
}
