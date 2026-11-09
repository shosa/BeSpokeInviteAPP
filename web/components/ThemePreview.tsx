"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";

// Anteprima del template dentro un telefono, in un modale. La busta è attiva di default, come nel builder.
export function ThemePreview({ themeId, themeName, onClose, onChoose }: { themeId: string; themeName: string; onClose: () => void; onChoose: () => void }) {
  const [cover, setCover] = useState(true);
  const src = `/api/themes/${encodeURIComponent(themeId)}/anteprima?cover=${cover ? 1 : 0}`;

  return (
    <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="demo-modal tp-modal" role="dialog" aria-modal="true" aria-label={`Anteprima ${themeName}`}>
        <header className="tp-head">
          <div>
            <span className="claim-kicker">Anteprima</span>
            <h2>{themeName}</h2>
          </div>
          <button type="button" className="link" onClick={onClose}>Chiudi</button>
        </header>
        <div className="tp-body">
          <div className="tp-phone">
            <iframe title={`Anteprima di ${themeName}`} src={src} />
          </div>
          <div className="tp-side">
            <label className="tp-toggle">
              <span>Busta</span>
              <Switch checked={cover} onChange={setCover} ariaLabel="Mostra la busta" />
            </label>
            <p className="hint">Con la busta l&apos;invito si apre come una lettera. Premi l&apos;interruttore per vederlo senza busta.</p>
            <button type="button" className="btn solid" onClick={onChoose}>Scegli questo template</button>
          </div>
        </div>
      </div>
    </div>
  );
}
