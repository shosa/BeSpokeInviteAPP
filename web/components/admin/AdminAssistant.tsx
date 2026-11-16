"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";

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

const EFFORT_LABEL: Record<"it" | "en", Record<Effort, string>> = { it: { low: "Bassa", medium: "Media", high: "Alta" }, en: { low: "Low", medium: "Medium", high: "High" } };
const SOURCE_LABEL: Record<"it" | "en", Record<Data["source"], string>> = {
  it: { console: "impostato dalla console", ambiente: "dalla variabile ASSISTANT_MODEL", predefinito: "valore predefinito" },
  en: { console: "set from the console", ambiente: "from the ASSISTANT_MODEL variable", predefinito: "default value" },
};

export function AdminAssistant() {
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Data["settings"] | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/assistant");
    const body = (await res.json().catch(() => null)) as Data | { error?: string } | null;
    if (!res.ok || !body || !("settings" in body)) return toast.error((body as { error?: string } | null)?.error ?? t("Impossibile leggere le impostazioni", "Couldn't read the settings"));
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
    if (!res.ok) return toast.error(body.error ?? t("Salvataggio non riuscito", "Saving failed"));
    toast.success(t("Impostazioni salvate. Valgono dalla prossima richiesta.", "Settings saved. They apply from the next request."));
    void load();
  }

  if (!data || !draft) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;

  // Se il modello salvato non è più nell'elenco (ritirato), lo si mostra comunque, così si vede cosa è attivo.
  const options = data.models.some((m) => m.id === draft.model) || !draft.model ? data.models : [{ id: draft.model, name: `${draft.model} (${t("non più elencato", "no longer listed")})` }, ...data.models];
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  return (
    <section className="ac-card ac-assist">
      <p className="hint">
        {data.configured
          ? `${t("Modello attivo", "Active model")}: ${data.settings.model}, ${SOURCE_LABEL[lang][data.source]}.`
          : t("Assistente spento: manca la chiave del modello (ANTHROPIC_KEY) sul server. Il pannello non si mostra nell'editor.", "Assistant off: the model key (ANTHROPIC_KEY) is missing on the server. The panel isn't shown in the editor.")}
      </p>

      {data.modelsError && <p className="hint">{data.modelsError}</p>}

      <div className="ac-form-grid">
        <label>
          <span>{t("Modello", "Model")}</span>
          <select value={draft.model} disabled={!data.configured || options.length === 0} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t("Sforzo di ragionamento", "Reasoning effort")}</span>
          <select value={draft.effort} onChange={(e) => setDraft({ ...draft, effort: e.target.value as Effort })}>
            {data.efforts.map((e) => (
              <option key={e} value={e}>
                {EFFORT_LABEL[lang][e]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{t("Richieste per invito", "Requests per invitation")}</span>
          <input type="number" min={1} max={500} step={1} value={draft.callLimit} onChange={(e) => setDraft({ ...draft, callLimit: Number(e.target.value) })} />
        </label>
      </div>

      <div className="ac-form-actions">
        <button type="button" className="btn solid small" disabled={!dirty || saving || !data.configured} onClick={() => void save()}>
          {saving ? t("Salvataggio…", "Saving…") : t("Salva", "Save")}
        </button>
      </div>
    </section>
  );
}
