"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate } from "./format";
import { useT } from "@/lib/lang";

type UserRow = { id: string; email: string; name: string; role: string; invitations: number; created_at: string };

// Clienti: ricerca, conteggio degli inviti (apre la lista filtrata) e ruolo.
export function AdminUsers({ onOpenInvitations }: { onOpenInvitations: (userId: string) => void }) {
  const t = useT();
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
        <div className="ac-card ac-table-wrap">
          <table className="ac-table">
            <thead><tr><th>{t("Nome", "Name")}</th><th>Email</th><th>{t("Iscritto", "Joined")}</th><th className="num">{t("Inviti", "Invitations")}</th><th>{t("Ruolo", "Role")}</th></tr></thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "–"}</td>
                  <td>{u.email}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td className="num">{u.invitations > 0 ? <button type="button" className="link" onClick={() => onOpenInvitations(u.id)}>{u.invitations}</button> : 0}</td>
                  <td>
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} aria-label={`${t("Ruolo di", "Role of")} ${u.email}`}>
                      <option value="user">{t("Cliente", "Customer")}</option>
                      <option value="admin">{t("Amministratore", "Administrator")}</option>
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
