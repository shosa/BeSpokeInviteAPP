"use client";

import { useEffect, useState } from "react";

// Pubblicazione: il cliente sceglie il link che manderà agli ospiti. Il server propone alcuni nomi liberi, costruiti dai nomi e dalla data.
export function PublishDialog({
  id,
  origin,
  lang,
  onPayment,
  onDone,
  onClose,
}: {
  id: string;
  origin: string;
  lang: "it" | "en";
  onPayment: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const en = lang === "en";
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invitations/${id}/slug-suggestions`)
      .then((r) => r.json())
      .then((d: { suggestions?: string[] }) => {
        setSuggestions(d.suggestions ?? []);
        setValue((d.suggestions ?? [])[0] ?? "");
      })
      .catch(() => setError(en ? "Suggestions not available." : "Suggerimenti non disponibili."));
  }, [id, en]);

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invitations/${id}/confirm-edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: value }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    setBusy(false);
    if (res.ok) return onDone();
    if (res.status === 409 && data.code === "payment_required") return onPayment();
    setError(data.error ?? (en ? "Publishing failed." : "Pubblicazione non riuscita."));
  }

  return (
    <div className="bl-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bl-modal publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title">
        <header className="bl-modal-head">
          <div>
            <h2 id="publish-title">{en ? "Publish your invitation" : "Pubblica il tuo invito"}</h2>
          </div>
        </header>
        <p>{en ? "Choose the link you will send to your guests. After publishing it does not change." : "Scegli il link che manderai agli ospiti. Dopo la pubblicazione non cambia."}</p>
        <label className="publish-field">
          <span>{en ? "Link" : "Link"}</span>
          <div className="publish-input">
            <code>{origin}/i/</code>
            <input value={value} onChange={(e) => setValue(e.target.value.toLowerCase())} maxLength={60} aria-label={en ? "Link name" : "Nome del link"} />
          </div>
        </label>
        {suggestions.length > 0 && (
          <div className="publish-suggest" role="group" aria-label={en ? "Suggestions" : "Suggerimenti"}>
            <span className="hint">{en ? "Suggestions" : "Suggerimenti"}</span>
            {suggestions.map((s) => (
              <button key={s} type="button" className={`publish-chip${s === value ? " is-on" : ""}`} onClick={() => setValue(s)}>{s}</button>
            ))}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="bl-modal-actions">
          <button type="button" className="btn outline" onClick={onClose}>{en ? "Not now" : "Non ora"}</button>
          <button type="button" className="btn solid" onClick={publish} disabled={busy || value.length < 3}>{busy ? (en ? "Publishing…" : "Pubblico…") : (en ? "Publish with this link" : "Pubblica con questo link")}</button>
        </div>
      </div>
    </div>
  );
}
