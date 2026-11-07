"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtEuro } from "./format";
import type { OrderRow } from "./types";

type Filter = "tutti" | "pagati" | "attesa" | "shopify" | "prova";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "pagati", label: "Pagati" },
  { id: "attesa", label: "In attesa" },
  { id: "shopify", label: "Shopify" },
  { id: "prova", label: "Prova" },
];

// Ordini: filtri per stato e fonte, ricerca per cliente o invito, totale e esportazione in CSV.
export function AdminOrders() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("tutti");
  const [query, setQuery] = useState("");

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
      if (q && !`${o.title ?? ""} ${o.email ?? ""} ${o.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const paidTotal = shown.filter((o) => o.status === "paid").reduce((n, o) => n + o.amount_cents, 0);

  function exportCsv() {
    const head = ["data", "invito", "cliente", "importo_eur", "fonte", "stato", "riferimento"];
    const lines = shown.map((o) => [o.created_at, o.title ?? "", o.email ?? "", (o.amount_cents / 100).toFixed(2), o.source, o.status, o.id]
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
        <input className="ac-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per cliente, invito o riferimento" aria-label="Cerca ordini" />
        <button type="button" className="btn outline small" onClick={exportCsv} disabled={shown.length === 0}>Esporta CSV</button>
      </div>

      <p className="hint">{shown.length} {shown.length === 1 ? "ordine" : "ordini"} · incassato nella selezione: <b>{fmtEuro(paidTotal)}</b></p>

      {shown.length === 0 ? (
        <div className="ac-card"><p className="hint">{rows.length === 0 ? "Nessun ordine ancora." : "Nessun ordine con questi filtri."}</p></div>
      ) : (
        <div className="ac-card ac-table-wrap">
          <table className="ac-table">
            <thead><tr><th>Data</th><th>Invito</th><th>Cliente</th><th className="num">Importo</th><th>Fonte</th><th>Stato</th></tr></thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <td>{fmtDate(o.created_at)}</td>
                  <td>{o.title ?? "–"}</td>
                  <td>{o.email ?? "–"}</td>
                  <td className="num">{fmtEuro(o.amount_cents)}</td>
                  <td><span className="ac-tag">{o.source === "shopify" ? "Shopify" : "Prova"}</span></td>
                  <td><span className={`pill ${o.status === "paid" ? "yes" : "draft"}`}>{o.status === "paid" ? "Pagato" : "In attesa"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
