"use client";

import { useState } from "react";
import { useT } from "@/lib/lang";

// Dal sito o dallo shop: chi ha già acquistato inserisce la sua email e riceve il link per entrare.
export function RequestLoginLink() {
  const t = useT();
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
    if (!res.ok) return setError(body.error ?? t("Richiesta non riuscita", "Request failed"));
    setMessage(body.message ?? t("Controlla la tua email.", "Check your email."));
  }

  return (
    <section className="claim" aria-label={t("Richiedi il link di accesso", "Request a sign-in link")}>
      <span className="claim-kicker">{t("Entra con la tua email", "Sign in with your email")}</span>
      <h2>{t("Hai già acquistato?", "Already purchased?")}</h2>
      <p className="hint">{t("Inserisci l'email dell'acquisto: ti mandiamo il link per entrare nel tuo account.", "Enter the email you purchased with: we'll send you a link to sign in to your account.")}</p>
      {message ? (
        <p className="form-notice" role="status">{message}</p>
      ) : (
        <form className="claim-form" onSubmit={send}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("la-tua@email.it", "you@email.com")} aria-label={t("Email dell'acquisto", "Purchase email")} maxLength={200} />
          <button type="submit" className="btn solid small" disabled={busy || !email.includes("@")}>{busy ? t("Invio…", "Sending…") : t("Mandami il link", "Send me the link")}</button>
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
