"use client";

import { useState, type SyntheticEvent } from "react";
import { Switch } from "@/components/ui/Switch";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/lang";

// Anteprima del template dentro un telefono, in un modale. La busta è attiva di default, come nel builder.
// Nasconde la scrollbar dentro l'anteprima: la pagina resta scorrevole con la rotella e il dito, senza la barra.
// L'anteprima è sullo stesso sito, quindi il suo documento è accessibile.
function hideScrollbar(e: SyntheticEvent<HTMLIFrameElement>) {
  try {
    const doc = e.currentTarget.contentDocument;
    if (!doc || doc.getElementById("hide-scrollbar")) return;
    const style = doc.createElement("style");
    style.id = "hide-scrollbar";
    style.textContent = "html,body{scrollbar-width:none;-ms-overflow-style:none}::-webkit-scrollbar{display:none}";
    doc.head.appendChild(style);
  } catch {
    /* documento non accessibile: la barra resta */
  }
}

export function ThemePreview({ themeId, themeName, onClose, onChoose }: { themeId: string; themeName: string; onClose: () => void; onChoose: () => void }) {
  const t = useT();
  const [cover, setCover] = useState(true);
  const src = `/api/themes/${encodeURIComponent(themeId)}/anteprima?cover=${cover ? 1 : 0}`;

  return (
    <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="demo-modal tp-modal" role="dialog" aria-modal="true" aria-label={`${t("Anteprima", "Preview")} ${themeName}`}>
        {/* Telefono: l'anteprima è a tutto schermo, con «indietro» galleggiante in alto a sinistra. */}
        <button type="button" className="tp-back" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" /><span>{t("Indietro", "Back")}</span></button>
        <header className="tp-head">
          <div>
            <span className="claim-kicker">{t("Anteprima", "Preview")}</span>
            <h2>{themeName}</h2>
          </div>
          <button type="button" className="link" onClick={onClose}>{t("Chiudi", "Close")}</button>
        </header>
        <div className="tp-body">
          <div className="tp-phone">
            <iframe title={`${t("Anteprima di", "Preview of")} ${themeName}`} src={src} onLoad={hideScrollbar} />
          </div>
          <div className="tp-side">
            <label className="tp-toggle">
              <span>{t("Busta", "Envelope")}</span>
              <Switch checked={cover} onChange={setCover} ariaLabel={t("Mostra la busta", "Show the envelope")} />
            </label>
            <p className="hint">{t("Con la busta l'invito si apre come una lettera. Premi l'interruttore per vederlo senza busta.", "With the envelope the invitation opens like a letter. Use the switch to see it without the envelope.")}</p>
            <button type="button" className="btn solid" onClick={onChoose}>{t("Scegli questo template", "Choose this template")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
