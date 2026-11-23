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
  manual_at?: string | null;
  owner_id?: string | null;
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

// Righe dello stesso acquisto: un ordine Shopify con le sue righe («…-planner», «…-2», «…-base»), oppure gli
// acquisti assegnati a mano nello stesso momento allo stesso cliente (es. invito + planner).
type Group = { key: string; items: OrderDetail[]; first: OrderDetail };
function groupKey(o: OrderDetail): string {
  const shop = o.id.match(/^(\d+)(?:-|$)/);
  if (shop) return `s:${shop[1]}`;
  if (isManual(o) && o.manual_at) return `m:${o.owner_id ?? o.user_id}:${o.manual_at}`;
  return `o:${o.id}`;
}
function groupOrders(list: OrderDetail[]): Group[] {
  const map = new Map<string, OrderDetail[]>();
  for (const o of list) { const k = groupKey(o); map.set(k, [...(map.get(k) ?? []), o]); }
  return [...map.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => (a.product === "planner" ? 1 : 0) - (b.product === "planner" ? 1 : 0) || a.id.length - b.id.length);
    return { key, items: sorted, first: sorted[0]! };
  });
}
const productOf = (o: OrderDetail, t: (it: string, en: string) => string) => (o.product === "planner" ? "Planner" : o.plan === "base" ? t("Invito base", "Basic invitation") : t("Invito", "Invitation"));
function statusOf(g: Group, t: (it: string, en: string) => string): { label: string; cls: string } {
  const pending = g.items.filter(isPending).length;
  if (!g.items.every((o) => o.status === "paid")) return { label: t("In attesa", "Pending"), cls: "draft" };
  if (pending === 0) return { label: t("Attivato", "Activated"), cls: "yes" };
  if (pending === g.items.length) return { label: t("Da attivare", "To activate"), cls: "draft" };
  return { label: t(`${pending} di ${g.items.length} da attivare`, `${pending} of ${g.items.length} to activate`), cls: "draft" };
}

export function AdminOrders({ go }: { go?: Go }) {
  const t = useT();
  const [rows, setRows] = useState<OrderDetail[] | null>(null);
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Group | null>(null);

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

  const groups = useMemo(() => groupOrders(shown), [shown]);

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

      <p className="hint">{groups.length} {groups.length === 1 ? t("ordine", "order") : t("ordini", "orders")}</p>

      {/* Telefono: una riga per ordine (cliente, prodotto, data, stato); il dettaglio si apre in un pannello dal basso. */}
      {groups.length > 0 && (
        <ul className="ord-list" aria-label={t("Ordini", "Orders")}>
          {groups.map((g) => {
            const st = statusOf(g, t);
            const o = g.first;
            return (
              <li key={g.key}>
                <button type="button" className="ord-item" onClick={() => setSheet(g)}>
                  <span className="ord-main">
                    <b>{o.user_name || o.email || "–"}</b>
                    <small>{g.items.map((x) => productOf(x, t)).join(" + ")} · {isManual(o) ? t("a mano", "by hand") : o.source === "shopify" ? "Shopify" : t("prova", "test")} · {fmtDate(o.created_at)}</small>
                  </span>
                  <span className={`pill ${st.cls}`}>{st.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sheet && (
        <div className="ord-sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="ord-sheet" role="dialog" aria-modal="true" aria-label={t("Dettaglio ordine", "Order details")}>
            <div className="ord-sheet-head">
              <div><b>{sheet.first.user_name || sheet.first.email || "–"}</b><small>{fmtDate(sheet.first.created_at)}</small></div>
              <button type="button" className="ord-x" aria-label={t("Chiudi", "Close")} onClick={() => setSheet(null)}>×</button>
            </div>
            <GroupDetail g={sheet} go={go} t={t} />
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
              {groups.map((g) => {
                const o = g.first;
                const st = statusOf(g, t);
                const inv = g.items.find((x) => x.invitation_id);
                return (
                <Fragment key={g.key}>
                  <tr className={open === g.key ? "is-open" : ""} onClick={() => setOpen(open === g.key ? null : g.key)} aria-expanded={open === g.key}>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><CopyId value={o.id.replace(/-.*$/, "") || o.id} /></td>
                    <td>
                      <b>{o.user_name || "–"}</b>
                      <small className="ac-sub">{o.email ?? t("email sconosciuta", "unknown email")}</small>
                    </td>
                    <td>{inv?.title ?? <span className="hint">{t("nessun invito", "no invitation")}</span>}</td>
                    <td><span className="ac-tag">{isManual(o) ? t("A mano", "By hand") : o.source === "shopify" ? "Shopify" : t("Prova", "Test")}</span></td>
                    <td><span className={`pill ${st.cls}`}>{st.label}</span></td>
                    <td>{g.items.map((x) => productOf(x, t)).join(" + ")}</td>
                  </tr>
                  {open === g.key && (
                    <tr className="ac-detail-row">
                      <td colSpan={7}>
                        <GroupDetail g={g} go={go} t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Dettaglio di un acquisto: dati comuni (cliente, Shopify), poi una scheda per ogni prodotto (invito, planner) con il
// suo stato e le sue azioni. In tabella (computer) si apre sotto la riga, al telefono in un pannello.
function GroupDetail({ g, go, t }: { g: Group; go?: Go; t: (it: string, en: string) => string }) {
  const o = g.first;
  const pending = g.items.some(isPending);
  return (
    <>
      <dl className="ac-meta">
        <div><dt>{t("Cliente", "Customer")}</dt><dd>{o.user_name || "–"} · {o.email ?? "–"}</dd></div>
        <div><dt>{t("ID cliente", "Customer ID")}</dt><dd>{o.user_id ? <CopyId value={o.user_id} /> : "–"}</dd></div>
        <div><dt>{t("Creato", "Created")}</dt><dd>{fmtDate(o.created_at)}</dd></div>
        <div><dt>{t("Ordine su Shopify", "Order on Shopify")}</dt><dd>{o.status_url ? <a href={o.status_url} target="_blank" rel="noopener noreferrer">{t("Apri la pagina dell'ordine", "Open the order page")}</a> : "–"}</dd></div>
      </dl>
      <div className="ord-items">
        {g.items.map((x) => (
          <div key={x.id} className="ord-part">
            <div className="ord-part-head">
              <b>{productOf(x, t)}</b>
              <span className={`pill ${isPending(x) ? "draft" : "yes"}`}>{isPending(x) ? t("Da attivare", "To activate") : t("Attivato", "Activated")}</span>
            </div>
            <dl className="ac-meta">
              <div><dt>{t("ID riga", "Line ID")}</dt><dd><CopyId value={x.id} keep={24} /></dd></div>
              {x.product !== "planner" && <div><dt>{t("Invito", "Invitation")}</dt><dd>{x.invitation_id ? `${x.title ?? t("senza titolo", "untitled")} · ${(x.edit_count ?? 0) >= 1 ? t("online", "live") : t("mai pubblicato", "never published")}` : t("non creato", "not created")}</dd></div>}
              {x.invitation_id && x.assistant_limit != null && <div><dt>BeSpoke AI</dt><dd>{t(`${Math.max(0, x.assistant_limit - (x.assistant_calls ?? 0))} rimaste su ${x.assistant_limit}`, `${Math.max(0, x.assistant_limit - (x.assistant_calls ?? 0))} left of ${x.assistant_limit}`)}</dd></div>}
              {x.product === "planner" && <div><dt>Planner</dt><dd>{x.planner_id ? t("creato", "created") : t("non creato", "not created")}</dd></div>}
            </dl>
            {(x.invitation_id || x.planner_id) && (
              <div className="ac-order-acts">
                {x.invitation_id && <a className="btn outline small" href={`/api/admin/invitations/${x.invitation_id}/view`} target="_blank" rel="noopener">{t("Anteprima invito", "Invitation preview")}</a>}
                {x.invitation_id && go && <button type="button" className="btn outline small" onClick={() => go("inviti", { invitationId: x.invitation_id! })}>{t("Dettaglio invito", "Invitation details")}</button>}
                {x.planner_id && <a className="btn outline small" href={`/admin/planner/${x.planner_id}`} target="_blank" rel="noopener">{t("Apri planner", "Open planner")}</a>}
              </div>
            )}
          </div>
        ))}
      </div>
      {o.user_id && (
        <div className="ac-order-acts">
          {go && <button type="button" className="btn outline small" onClick={() => go("clienti", { userId: o.user_id! })}>{t("Scheda cliente", "Customer profile")}</button>}
          {pending && <button type="button" className="btn solid small" onClick={async () => { const r = await fetch(`/api/admin/users/${o.user_id}/access-link`, { method: "POST" }); if (r.ok) toast.success(t("Link di accesso rimandato.", "Sign-in link sent again.")); else toast.error(t("Email non inviata", "Email not sent")); }}>{t("Rimanda il link", "Resend the link")}</button>}
        </div>
      )}
    </>
  );
}
