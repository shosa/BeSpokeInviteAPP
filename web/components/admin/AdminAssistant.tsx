"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// Parametri dell'assistente del builder: modello (dall'elenco ufficiale di Anthropic), sforzo e limite per invito.
type Effort = "low" | "medium" | "high";
type Data = {
  configured: boolean;
  settings: { model: string; effort: Effort; callLimit: number };
  source: "console" | "ambiente" | "predefinito";
  models: { id: string; name: string }[];
  modelsError: string | null;
  efforts: Effort[];
};

const EFFORT_LABEL: Record<Effort, string> = { low: "Bassa", medium: "Media", high: "Alta" };
const SOURCE_LABEL: Record<Data["source"], string> = { console: "impostato dalla console", ambiente: "dalla variabile ASSISTANT_MODEL", predefinito: "valore predefinito" };

export function AdminAssistant() {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Data["settings"] | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/assistant");
    const body = (await res.json().catch(() => null)) as Data | { error?: string } | null;
    if (!res.ok || !body || !("settings" in body)) return toast.error((body as { error?: string } | null)?.error ?? "Impossibile leggere le impostazioni");
    setData(body);
    setDraft(body.settings);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/admin/assistant", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) return toast.error(body.error ?? "Salvataggio non riuscito");
    toast.success("Impostazioni salvate. Valgono dalla prossima richiesta.");
    void load();
  }

  if (!data || !draft) return <p className="hint">Caricamento…</p>;

  // Se il modello salvato non è più nell'elenco (ritirato), lo si mostra comunque, così si vede cosa è attivo.
  const options = data.models.some((m) => m.id === draft.model) || !draft.model ? data.models : [{ id: draft.model, name: `${draft.model} (non più elencato)` }, ...data.models];
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  return (
    <section className="ac-card ac-assist">
      <p className="hint">
        {data.configured
          ? `Modello attivo: ${data.settings.model}, ${SOURCE_LABEL[data.source]}.`
          : "Assistente spento: manca la chiave del modello (ANTHROPIC_KEY) sul server. Il pannello non si mostra nell'editor."}
      </p>

      {data.modelsError && <p className="hint">{data.modelsError}</p>}

      <div className="ac-form-grid">
        <label>
          <span>Modello</span>
          <select value={draft.model} disabled={!data.configured || options.length === 0} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sforzo di ragionamento</span>
          <select value={draft.effort} onChange={(e) => setDraft({ ...draft, effort: e.target.value as Effort })}>
            {data.efforts.map((e) => (
              <option key={e} value={e}>
                {EFFORT_LABEL[e]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Richieste per invito</span>
          <input type="number" min={1} max={500} step={1} value={draft.callLimit} onChange={(e) => setDraft({ ...draft, callLimit: Number(e.target.value) })} />
        </label>
      </div>

      <div className="ac-form-actions">
        <button type="button" className="btn solid small" disabled={!dirty || saving || !data.configured} onClick={() => void save()}>
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </section>
  );
}
