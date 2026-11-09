"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { fmtDate } from "./format";

// Ordini senza importi: identificatori, cliente, invito e metadati utili per capire cosa è successo.
export type OrderDetail = {
  id: string;
  source: string;
  status: string;
  kind: string;
  created_at: string;
  status_url: string | null;
  tier: string | null;
  model: string | null;
  invitation_id: string | null;
  slug: string | null;
  invitation_status: string | null;
  order_ref: string | null;
  title: string | null;
  user_id: string | null;
  email: string | null;
  user_name: string | null;
};

type Filter = "tutti" | "pagati" | "attesa" | "shopify" | "prova" | "senza-invito";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "pagati", label: "Pagati" },
  { id: "attesa", label: "In attesa" },
  { id: "shopify", label: "Shopify" },
  { id: "prova", label: "Prova" },
  { id: "senza-invito", label: "Senza invito" },
];

export function AdminOrders() {
  const [rows, setRows] = useState<OrderDetail[] | null>(null);
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/orders").then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((o) => {
      if (filter === "pagati" && o.status !== "paid") return false;
      if (filter === "attesa" && o.status === "paid") return false;
      if (filter === "shopify" && o.source !== "shopify") return false;
      if (filter === "prova" && o.source !== "local") return false;
      if (filter === "senza-invito" && o.invitation_id) return false;
      if (q && !`${o.id} ${o.email ?? ""} ${o.user_name ?? ""} ${o.title ?? ""} ${o.slug ?? ""} ${o.order_ref ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  function exportCsv() {
    const head = ["id_ordine", "data", "cliente", "email", "invito", "id_invito", "fonte", "stato", "piano", "tipo", "riferimento"];
    const lines = shown.map((o) => [o.id, o.created_at, o.user_name ?? "", o.email ?? "", o.title ?? "", o.invitation_id ?? "", o.source, o.status, o.tier ?? "", o.kind, o.order_ref ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob([[head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordini-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows === null) return <p className="hint">Caricamento…</p>;

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <nav className="ac-segment" aria-label="Filtra ordini">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? "is-on" : ""} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </nav>
        <input className="ac-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per ID, email, nome, invito o riferimento" aria-label="Cerca ordini" />
        <button type="button" className="btn outline small" onClick={exportCsv} disabled={shown.length === 0}>Esporta CSV</button>
      </div>

      <p className="hint">{shown.length} {shown.length === 1 ? "ordine" : "ordini"}{rows.length !== shown.length ? ` su ${rows.length}` : ""}</p>

      {shown.length === 0 ? (
        <div className="ac-card"><p className="hint">{rows.length === 0 ? "Nessun ordine ancora." : "Nessun ordine con questi filtri."}</p></div>
      ) : (
        <div className="ac-card ac-table-wrap">
          <table className="ac-table ac-orders">
            <thead>
              <tr><th>Data</th><th>ID ordine</th><th>Cliente</th><th>Invito</th><th>Fonte</th><th>Stato</th><th>Piano</th></tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <Fragment key={o.id}>
                  <tr className={open === o.id ? "is-open" : ""} onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><code className="ac-id">{o.id}</code></td>
                    <td>
                      <b>{o.user_name || "–"}</b>
                      <small className="ac-sub">{o.email ?? "email sconosciuta"}</small>
                    </td>
                    <td>
                      {o.title ?? <span className="hint">nessun invito</span>}
                      {o.slug && <small className="ac-sub">/i/{o.slug}</small>}
                    </td>
                    <td><span className="ac-tag">{o.source === "shopify" ? "Shopify" : "Prova"}</span></td>
                    <td><span className={`pill ${o.status === "paid" ? "yes" : "draft"}`}>{o.status === "paid" ? "Pagato" : "In attesa"}</span></td>
                    <td>{o.tier === "premium" ? "Premium" : o.tier ? "Base" : "–"}</td>
                  </tr>
                  {open === o.id && (
                    <tr className="ac-detail-row">
                      <td colSpan={7}>
                        <dl className="ac-meta">
                          <div><dt>ID ordine</dt><dd><code>{o.id}</code></dd></div>
                          <div><dt>Riferimento</dt><dd>{o.order_ref ?? "–"}</dd></div>
                          <div><dt>Cliente</dt><dd>{o.user_name || "–"} · {o.email ?? "–"}</dd></div>
                          <div><dt>ID cliente</dt><dd><code>{o.user_id ?? "–"}</code></dd></div>
                          <div><dt>ID invito</dt><dd><code>{o.invitation_id ?? "–"}</code></dd></div>
                          <div><dt>Stato invito</dt><dd>{o.invitation_status ?? "non creato"}</dd></div>
                          <div><dt>Modello</dt><dd>{o.model ?? "–"}</dd></div>
                          <div><dt>Tipo</dt><dd>{o.kind === "upgrade" ? "Aggiornamento" : "Acquisto"}</dd></div>
                          <div><dt>Creato</dt><dd>{fmtDate(o.created_at)}</dd></div>
                          <div><dt>Ordine su Shopify</dt><dd>{o.status_url ? <a href={o.status_url} target="_blank" rel="noopener noreferrer">Apri la pagina dell&apos;ordine</a> : "–"}</dd></div>
                        </dl>
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
