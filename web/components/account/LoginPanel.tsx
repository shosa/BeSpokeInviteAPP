"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { RequestLoginLink } from "@/components/RequestLoginLink";
import { useT } from "@/lib/lang";

// Accesso all'area cliente: con email e password, oppure con il link personale via email (come sempre).
export function LoginPanel() {
  const t = useT();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) { setBusy(false); return setError(out.error ?? t("Accesso non riuscito", "Sign-in failed")); }
    window.location.assign("/account");
  }

  return (
    <section className="lg">
      <div className="lg-tabs" role="tablist" aria-label={t("Modo di accesso", "Sign-in method")}>
        <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "is-on" : ""} onClick={() => setMode("password")}>{t("Email e password", "Email and password")}</button>
        <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "is-on" : ""} onClick={() => setMode("link")}>{t("Link via email", "Email link")}</button>
      </div>
      {mode === "password" ? (
        <form className="lg-form" onSubmit={login}>
          <label className="pw-field">
            <span>Email</span>
            <span className="pw-input"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={200} placeholder={t("la-tua@email.it", "you@email.com")} /></span>
          </label>
          <label className="pw-field">
            <span>Password</span>
            <span className="pw-input">
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required maxLength={200} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("Nascondi password", "Hide password") : t("Mostra password", "Show password")}>{show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn solid" disabled={busy || !email.includes("@") || !pw}>{busy ? t("Entro…", "Signing in…") : t("Entra", "Sign in")}</button>
          <button type="button" className="lg-switch" onClick={() => setMode("link")}>{t("Password dimenticata, o non l'hai ancora impostata? Ricevi il link via email", "Forgot the password, or haven't set one yet? Get the link by email")}</button>
        </form>
      ) : (
        <RequestLoginLink />
      )}
    </section>
  );
}
