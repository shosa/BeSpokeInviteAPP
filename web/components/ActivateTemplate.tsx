"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_TYPES, type EventType, type ThemeManifest } from "@inviteme/shared";
import { TemplateCarousel } from "@/components/TemplateCarousel";
import { ThemePreview } from "@/components/ThemePreview";
import { CreatingOverlay } from "@/components/CreatingOverlay";
import { useLang } from "@/lib/lang";
import { themeCopy } from "@/lib/catalogCopy";

// Attivazione di un acquisto: il cliente sceglie il template e il suo invito nasce con quello.
// locked: template Premium che l'invito base non può scegliere (si vedono con il lucchetto).
export function ActivateTemplate({ orderId, templates, locked = [] }: { orderId: string; templates: ThemeManifest[]; locked?: string[] }) {
  const router = useRouter();
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const lockedSet = new Set(locked);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [themeId, setThemeId] = useState(templates.find((x) => !lockedSet.has(x.id))?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const selected = templates.find((x) => x.id === themeId);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, themeId, eventType }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; invitationId?: string };
    if (!res.ok || !body.invitationId) {
      setBusy(false);
      return setError(body.error ?? t("Non è stato possibile creare l'invito. Riprova.", "The invitation could not be created. Please try again."));
    }
    // La barra arriva in fondo, poi si apre l'editor (l'attesa continua finché la pagina nuova non è pronta).
    setDone(true);
    router.push(`/editor/${body.invitationId}`);
  }

  return (
    <div className="act">
      {/* Tipo di evento: si sceglie prima del template e resta salvato nell'invito (testi di partenza, planner). */}
      <div className="act-type" role="radiogroup" aria-label={t("Tipo di evento", "Event type")}>
        <span className="act-kicker">{t("Che evento è?", "What's the event?")}</span>
        <div className="act-type-list">
          {EVENT_TYPES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={eventType === x.id} className={`act-type-chip${eventType === x.id ? " is-on" : ""}`} onClick={() => setEventType(x.id)}>
              {lang === "en" ? x.labelEn : x.label}
            </button>
          ))}
        </div>
      </div>
      {templates.length > 0 ? (
        <TemplateCarousel templates={templates} selectedId={themeId} onSelect={setThemeId} label="Template" lang={lang} size="lg" autoplay={false} locked={lockedSet} />
      ) : (
        <p className="hint">{t("Nessun template disponibile al momento.", "No templates available right now.")}</p>
      )}
      <div className="act-bar">
        <div>
          <span className="act-kicker">{t("Template scelto", "Chosen template")}</span>
          <strong>{selected ? themeCopy(selected, lang) : "—"}</strong>
        </div>
        <div className="act-actions">
          <button type="button" className="btn outline" disabled={!selected} onClick={() => setPreviewOpen(true)}>{t("Anteprima", "Preview")}</button>
          <button type="button" className="btn solid" disabled={busy || !themeId || !eventType} title={!eventType ? t("Scegli prima il tipo di evento", "Choose the event type first") : undefined} onClick={create}>{busy ? t("Creo il tuo invito…", "Creating your invitation…") : t("Crea il tuo invito", "Create your invitation")}</button>
        </div>
      </div>
      <p className="hint act-hint-foot">{t("Il template è solo il punto di partenza: testi, foto, colori e musica si cambiano nel builder.", "The template is just the starting point: texts, photos, colours and music can all be changed in the builder.")}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {busy && <CreatingOverlay done={done} />}
      {previewOpen && selected && <ThemePreview themeId={selected.id} themeName={themeCopy(selected, lang)} onClose={() => setPreviewOpen(false)} onChoose={() => setPreviewOpen(false)} />}
    </div>
  );
}
