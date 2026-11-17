"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useT } from "@/lib/lang";

// Dopo il primo accesso con il link: il cliente sceglie una password, così la prossima volta entra anche con email e password.
// La finestra resta finché la password non è impostata.
export function PasswordSetup({ email }: { email: string }) {
  const t = useT();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const longEnough = pw.length >= 8;
  const same = pw.length > 0 && pw === again;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!longEnough) return setError(t("La password deve avere almeno 8 caratteri", "The password must have at least 8 characters"));
    if (!same) return setError(t("Le due password non coincidono", "The two passwords don't match"));
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(out.error ?? t("Non è stato possibile salvare la password", "The password could not be saved"));
    setDone(true);
    setTimeout(() => router.refresh(), 1200);
  }

  return (
    <div className="pw-backdrop" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <form className="pw-card" onSubmit={submit}>
        <span className="pw-ico" aria-hidden="true"><KeyRound size={26} strokeWidth={1.6} /></span>
        <h2 id="pw-title">{done ? t("Password impostata", "Password set") : t("Scegli una password", "Choose a password")}</h2>
        {done ? (
          <p className="pw-text">{t("Da ora puoi entrare con la tua email e questa password, oppure con il link via email come prima.", "From now on you can sign in with your email and this password, or with the email link as before.")}</p>
        ) : (
          <>
            <p className="pw-text">{t("Così la prossima volta entri con email e password, senza aspettare il link. Il link via email resta sempre disponibile.", "Next time you can sign in with email and password, without waiting for the link. The email link stays available.")}</p>
            <p className="pw-email">{email}</p>
            <label className="pw-field">
              <span>{t("Nuova password", "New password")}</span>
              <span className="pw-input">
                <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} maxLength={200} required autoFocus />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("Nascondi password", "Hide password") : t("Mostra password", "Show password")}>{show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
              </span>
            </label>
            <label className="pw-field">
              <span>{t("Ripeti la password", "Repeat the password")}</span>
              <span className="pw-input"><input type={show ? "text" : "password"} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" maxLength={200} required /></span>
            </label>
            <ul className="pw-rules" aria-live="polite">
              <li className={longEnough ? "is-ok" : ""}>{t("Almeno 8 caratteri", "At least 8 characters")}</li>
              <li className={same ? "is-ok" : ""}>{t("Le due password coincidono", "Both passwords match")}</li>
            </ul>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn solid pw-submit" disabled={busy}>{busy ? t("Salvo…", "Saving…") : t("Imposta la password", "Set the password")}</button>
          </>
        )}
      </form>
    </div>
  );
}
