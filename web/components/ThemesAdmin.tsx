"use client";

import { toast } from "sonner";
import type { Catalog } from "@inviteme/shared";
import { Switch } from "./ui/Switch";

// Template: sono cartelle del repository (themes/<id>/), quindi qui si attivano o disattivano, non si caricano.
// Ogni template è mostrato come lo vede il cliente nel carosello: la sua pagina demo dentro un telefono.
export function ThemesAdmin({ catalog, onChanged }: { catalog: Catalog; onChanged: () => void }) {
  async function setEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/admin/themes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast.error(data.error ?? "Modifica non riuscita");
    onChanged();
  }

  return (
    <div className="tpl-admin-grid">
      {catalog.themes.map((t) => {
        const m = t.manifest;
        return (
          <article key={m.id} className={`tpl-admin-card${t.enabled ? "" : " is-off"}`}>
            <div className="tpl-phone">
              <div className="tpl-screen">
                <iframe title={m.name} src={`/api/themes/${m.id}/demo`} scrolling="no" sandbox="allow-scripts" tabIndex={-1} aria-hidden="true" />
              </div>
            </div>
            <h3>{m.name}</h3>
            <a className="btn outline small" href={`/api/themes/${m.id}/anteprima`} target="_blank" rel="noreferrer">Apri anteprima</a>
            <Switch checked={t.enabled} onChange={(v) => setEnabled(m.id, v)} label={t.enabled ? "Attivo" : "Disattivato"} />
          </article>
        );
      })}
    </div>
  );
}
