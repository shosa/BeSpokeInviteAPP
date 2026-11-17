"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/lang";

// Finestra di attesa mentre si crea un invito: busta animata, passi e barra di avanzamento.
// La barra avanza a tempo fino al 92% (la creazione non dà avanzamenti reali) e si chiude a 100% quando arriva la risposta.
export function CreatingOverlay({ done = false, title }: { done?: boolean; title?: string }) {
  const t = useT();
  const steps = [
    t("Preparo il template", "Preparing the template"),
    t("Copio foto, video e decorazioni", "Copying photos, videos and decorations"),
    t("Compongo le sezioni dell'invito", "Building the invitation sections"),
    t("Apro l'editor", "Opening the editor"),
  ];
  const [pct, setPct] = useState(4);
  useEffect(() => {
    if (done) { setPct(100); return; }
    const id = setInterval(() => setPct((p) => (p < 92 ? p + Math.max(0.6, (92 - p) * 0.06) : p)), 200);
    return () => clearInterval(id);
  }, [done]);
  const step = Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length));

  return (
    <div className="cr-backdrop" role="dialog" aria-modal="true" aria-labelledby="cr-title" aria-describedby="cr-step">
      <div className="cr-card">
        <div className="cr-env" aria-hidden="true">
          <span className="cr-env-back" />
          <span className="cr-env-letter"><i /><i /><i /></span>
          <span className="cr-env-front" />
          <span className="cr-env-flap" />
          <span className="cr-env-seal">B</span>
        </div>
        <h2 id="cr-title">{title ?? t("Stiamo creando il tuo invito", "We're creating your invitation")}</h2>
        <p id="cr-step" className="cr-step" aria-live="polite">{steps[step]}…</p>
        <div className="cr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t("Avanzamento", "Progress")}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol className="cr-steps" aria-hidden="true">
          {steps.map((s, i) => <li key={s} className={i < step ? "is-done" : i === step ? "is-on" : ""}>{s}</li>)}
        </ol>
        <small className="cr-hint">{t("Ci vuole qualche secondo: non chiudere la pagina.", "It takes a few seconds: don't close the page.")}</small>
      </div>
    </div>
  );
}
