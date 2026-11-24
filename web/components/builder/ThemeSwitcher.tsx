"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Lock, Monitor, Smartphone, X } from "lucide-react";
import { enabledThemes, withTheme, type Catalog, type InviteConfig, type ThemeManifest } from "@inviteme/shared";
import { themeCopy } from "@/lib/catalogCopy";
import type { Lang } from "@/lib/ui";

// Cambio di template dal builder, a tutto schermo: galleria a griglia dei template, poi l'anteprima dell'invito
// così com'è adesso (testi, foto, blocchi) ma con il template scelto, e la conferma. Si può fare una sola volta.
// L'anteprima usa la stessa trasformazione del server (withTheme): quello che si vede è quello che si ottiene.
export function ThemeSwitcher({ invitationId, config, catalog, locked, lang, onClose, onConfirm }: {
  invitationId: string;
  config: InviteConfig;
  catalog: Catalog;
  locked: ReadonlySet<string>;
  lang: Lang;
  onClose: () => void;
  onConfirm: (themeId: string) => Promise<string | null>; // null = fatto, altrimenti il messaggio d'errore
}) {
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const themes = useMemo(() => enabledThemes(catalog), [catalog]);
  const [category, setCategory] = useState("");
  const categories = useMemo(() => catalog.categories.filter((c) => catalog.themes.some((x) => x.enabled && x.categories?.includes(c.id))), [catalog]);
  const visible = useMemo(() => {
    const list = category ? themes.filter((m) => catalog.themes.find((x) => x.manifest.id === m.id)?.categories?.includes(category)) : themes;
    // I template Premium esclusi dall'invito base restano visibili, in fondo e con il lucchetto.
    return [...list.filter((m) => !locked.has(m.id)), ...list.filter((m) => locked.has(m.id))];
  }, [themes, category, catalog, locked]);

  const [picked, setPicked] = useState<ThemeManifest | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [html, setHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc: dall'anteprima si torna alla galleria, dalla galleria si chiude.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      if (picked) setPicked(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [picked, busy, onClose]);

  // Anteprima: la pagina vera del motore con la bozza attuale e il nuovo template. Non salva nulla.
  useEffect(() => {
    if (!picked) return;
    let alive = true;
    setHtml(null);
    setPreviewError(false);
    setError(null);
    fetch(`/api/invitations/${invitationId}/preview?cover=0&readonly=1`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(withTheme(config, picked.id)) })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setPreviewError(true);
        setHtml(await res.text());
      })
      .catch(() => alive && setPreviewError(true));
    return () => {
      alive = false;
    };
  }, [picked, config, invitationId]);

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const err = await onConfirm(picked.id);
    setBusy(false);
    if (err) setError(err);
  }

  const onceNote = t(
    "Puoi cambiare template una sola volta per questo invito: testi, foto e blocchi restano, tornano al nuovo template solo i colori delle sezioni.",
    "You can change the template only once for this invitation: texts, photos and blocks stay, only section colours go back to the new template.",
  );

  return (
    <div className="tsw" role="dialog" aria-modal="true" aria-label={t("Cambia template", "Change template")}>
      <header className="tsw-head">
        {picked ? (
          <button type="button" className="btn ghost small" onClick={() => setPicked(null)} disabled={busy}><ArrowLeft size={16} aria-hidden="true" /> {t("Tutti i template", "All templates")}</button>
        ) : (
          <span className="tsw-kicker">{t("Cambia template", "Change template")}</span>
        )}
        <h2>{picked ? themeCopy(picked, lang) : t("Scegli il nuovo template", "Choose the new template")}</h2>
        <button type="button" className="bl-icon" aria-label={t("Chiudi", "Close")} onClick={onClose} disabled={busy}><X size={18} aria-hidden="true" /></button>
      </header>

      {!picked ? (
        <div className="tsw-body">
          <p className="tsw-note">{onceNote}</p>
          {categories.length > 0 && (
            <div className="tsw-cats" role="tablist" aria-label={t("Categorie di template", "Template categories")}>
              {[{ id: "", name: "Tutti", nameEn: "All" }, ...categories].map((c) => (
                <button key={c.id || "all"} type="button" role="tab" aria-selected={category === c.id} className={`tsw-cat${category === c.id ? " is-on" : ""}`} onClick={() => setCategory(c.id)}>
                  {lang === "en" ? c.nameEn : c.name}
                </button>
              ))}
            </div>
          )}
          <ul className="tsw-grid">
            {visible.map((m) => {
              const current = m.id === config.themeId;
              const isLocked = locked.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`tsw-card${current ? " is-current" : ""}${isLocked ? " is-locked" : ""}`}
                    disabled={current || isLocked}
                    title={isLocked ? t("Template Premium: non incluso nell'invito base", "Premium template: not included in the basic invitation") : undefined}
                    onClick={() => setPicked(m)}
                  >
                    <span className="tsw-thumb" style={{ background: m.themeColor }}>
                      {m.envelope?.poster && <img src={`/api/themes/${encodeURIComponent(m.id)}/cover.jpg`} alt="" loading="lazy" decoding="async" />}
                      {current && <span className="tsw-badge"><Check size={13} aria-hidden="true" /> {t("Attuale", "Current")}</span>}
                      {isLocked && <span className="tsw-badge is-lock"><Lock size={13} aria-hidden="true" /> Premium</span>}
                    </span>
                    <span className="tsw-name">{themeCopy(m, lang)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p className="hint">{t("Nessun template in questa categoria.", "No templates in this category.")}</p>}
        </div>
      ) : (
        <div className="tsw-body tsw-preview">
          <div className="tsw-devices" role="group" aria-label={t("Anteprima", "Preview")}>
            <button type="button" className="bl-icon" aria-pressed={device === "mobile"} aria-label={t("Telefono", "Phone")} onClick={() => setDevice("mobile")}><Smartphone size={16} /></button>
            <button type="button" className="bl-icon" aria-pressed={device === "desktop"} aria-label={t("Computer", "Desktop")} onClick={() => setDevice("desktop")}><Monitor size={16} /></button>
          </div>
          <div className={`tsw-frame is-${device}`}>
            {html ? (
              <iframe title={`${t("Anteprima con", "Preview with")} ${themeCopy(picked, lang)}`} srcDoc={html} sandbox="allow-scripts" />
            ) : previewError ? (
              <p className="form-error">{t("Anteprima non disponibile, riprova.", "Preview unavailable, please try again.")}</p>
            ) : (
              <span className="bl-spin" role="status" aria-label={t("Carico l'anteprima…", "Loading preview…")} />
            )}
          </div>
          <footer className="tsw-foot">
            <p className="tsw-note">{onceNote} {t("Gli ospiti vedranno il nuovo template dopo la prossima pubblicazione.", "Guests will see the new template after your next publication.")}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="tsw-actions">
              <button type="button" className="btn outline" onClick={() => setPicked(null)} disabled={busy}>{t("Scegli un altro", "Pick another")}</button>
              <button type="button" className="btn solid" onClick={confirm} disabled={busy || !html}>{busy ? t("Cambio il template…", "Changing the template…") : t("Conferma questo template", "Confirm this template")}</button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
