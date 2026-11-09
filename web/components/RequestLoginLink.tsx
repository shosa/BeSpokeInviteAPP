"use client";

import { useState } from "react";

// Dal sito o dallo shop: chi ha già acquistato inserisce la sua email e riceve il link per entrare.
export function RequestLoginLink() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Richiesta non riuscita");
    setMessage(body.message ?? "Controlla la tua email.");
  }

  return (
    <section className="claim" aria-label="Richiedi il link di accesso">
      <span className="claim-kicker">Entra con la tua email</span>
      <h2>Hai già acquistato?</h2>
      <p className="hint">Inserisci l&apos;email dell&apos;acquisto: ti mandiamo il link per entrare nel tuo account.</p>
      {message ? (
        <p className="form-notice" role="status">{message}</p>
      ) : (
        <form className="claim-form" onSubmit={send}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="la-tua@email.it" aria-label="Email dell'acquisto" maxLength={200} />
          <button type="submit" className="btn solid small" disabled={busy || !email.includes("@")}>{busy ? "Invio…" : "Mandami il link"}</button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
