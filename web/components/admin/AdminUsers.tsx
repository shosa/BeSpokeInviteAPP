"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate } from "./format";

type UserRow = { id: string; email: string; name: string; role: string; invitations: number; created_at: string };

// Clienti: ricerca, conteggio degli inviti (apre la lista filtrata) e ruolo.
export function AdminUsers({ onOpenInvitations }: { onOpenInvitations: (userId: string) => void }) {
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

  async function setRole(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    load();
  }

  if (rows === null) return <p className="hint">Caricamento…</p>;
  const admins = rows.filter((u) => u.role === "admin").length;

  return (
    <div className="ac-stack">
      <div className="ac-toolbar">
        <p className="hint">{rows.length} {rows.length === 1 ? "cliente" : "clienti"} · {admins} {admins === 1 ? "amministratore" : "amministratori"}</p>
        <input className="ac-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome o email" aria-label="Cerca clienti" />
      </div>
      {shown.length === 0 ? (
        <div className="ac-card"><p className="hint">Nessun cliente trovato.</p></div>
      ) : (
        <div className="ac-card ac-table-wrap">
          <table className="ac-table">
            <thead><tr><th>Nome</th><th>Email</th><th>Iscritto</th><th className="num">Inviti</th><th>Ruolo</th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "–"}</td>
                  <td>{u.email}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td className="num">{u.invitations > 0 ? <button type="button" className="link" onClick={() => onOpenInvitations(u.id)}>{u.invitations}</button> : 0}</td>
                  <td>
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} aria-label={`Ruolo di ${u.email}`}>
                      <option value="user">Cliente</option>
                      <option value="admin">Amministratore</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
