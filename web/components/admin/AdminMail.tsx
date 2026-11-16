"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "../ui/Switch";
import { useLang, useT } from "@/lib/lang";

// Impostazioni della posta: mittente, risposte e interruttori per tipo di email. La chiave Resend resta nel .env.
type Settings = { fromName: string; fromEmail: string; replyTo: string; notifyRsvp: boolean; orderConfirm: boolean; accent: string };
type Result = { at: string; ok: boolean; error?: string; kind: string } | null;
type Text = { subject: string; title: string; body: string; button: string; footer: string };
type TemplateInfo = { kind: TemplateKind; label: string; variables: string[]; current: Text; defaults: Text; currentEn: Text; defaultsEn: Text };
type TemplateKind = "access" | "purchase" | "order" | "rsvp";
type Payload = { settings: Settings; provider: "resend" | "outbox"; keyPresent: boolean; fromPreview: string; lastResult: Result; templates: TemplateInfo[] };
const FIELDS: { key: keyof Text; label: string; en: string; multi?: boolean }[] = [
  { key: "subject", label: "Oggetto", en: "Subject" },
  { key: "title", label: "Titolo nell'email", en: "Title in the email" },
  { key: "body", label: "Testo (una riga vuota separa i paragrafi)", en: "Text (a blank line separates paragraphs)", multi: true },
  { key: "button", label: "Testo del pulsante", en: "Button text" },
  { key: "footer", label: "Nota in fondo (facoltativa)", en: "Footer note (optional)" },
];

const KIND_LABEL: Record<"it" | "en", Record<string, string>> = {
  it: { invite: "invito agli ospiti", rsvp: "avviso di risposta", order: "conferma di pagamento", test: "prova", other: "email" },
  en: { invite: "guest invitation", rsvp: "reply notice", order: "payment confirmation", test: "test", other: "email" },
};
const TEMPLATE_LABEL: Record<"it" | "en", Record<TemplateKind, string>> = {
  it: { access: "Link di accesso", purchase: "Acquisto confermato (Shopify)", order: "Pagamento ricevuto", rsvp: "Avviso di risposta" },
  en: { access: "Sign-in link", purchase: "Purchase confirmed (Shopify)", order: "Payment received", rsvp: "Reply notice" },
};

export function AdminMail() {
  const lang = useLang();
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [to, setTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/mail");
    if (!res.ok) return toast.error(t("Impossibile leggere le impostazioni della posta", "Couldn't read the mail settings"));
    const body = (await res.json()) as Payload;
    setData(body);
    setDraft(body.settings);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setSaving(true);
    const res = await fetch("/api/admin/mail", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = (await res.json().catch(() => ({}))) as Payload | { error?: string };
    setSaving(false);
    if (!res.ok || !("settings" in body)) return setError((body as { error?: string }).error ?? t("Salvataggio non riuscito", "Saving failed"));
    setData(body);
    setDraft(body.settings);
    toast.success(t("Impostazioni della posta salvate.", "Mail settings saved."));
  }

  async function sendTest() {
    setTesting(true);
    const res = await fetch("/api/admin/mail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
    const body = (await res.json().catch(() => ({ ok: false, error: t("Risposta non valida", "Invalid response") }))) as { ok: boolean; error?: string; provider?: string };
    setTesting(false);
    if (body.ok) toast.success(body.provider === "outbox" ? t("Prova salvata nella coda: Resend non è configurato sul server.", "Test saved in the queue: Resend isn't configured on the server.") : t("Prova inviata. Controlla la casella.", "Test sent. Check the inbox."));
    else toast.error(body.error ?? t("Invio di prova non riuscito", "Test send failed"));
    void load();
  }

  if (!data || !draft) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const accentOk = /^#[0-9a-fA-F]{6}$/.test(draft.accent);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const live = data.provider === "resend";

  return (
    <div className="ac-stack">
      <section className={`ac-card ac-status ${live ? "is-ready" : "is-todo"}`}>
        <div>
          <span className="ac-kicker">{t("Stato", "Status")}</span>
          <h2>{live ? t("Posta attiva con Resend", "Mail active with Resend") : t("Posta in coda: Resend non configurato", "Mail queued: Resend not configured")}</h2>
          <p className="hint">
            {live
              ? t(`Le email partono da ${data.fromPreview}.`, `Emails are sent from ${data.fromPreview}.`)
              : t("Le email vengono solo registrate. Per inviarle davvero, aggiungi RESEND_API_KEY nel file .env del server e ricrea il container api.", "Emails are only recorded. To actually send them, add RESEND_API_KEY to the server's .env file and recreate the api container.")}
          </p>
        </div>
        {data.lastResult && (
          <div className={`ac-pill ${data.lastResult.ok ? "is-ok" : "is-warn"}`} role="status">
            {t("Ultimo invio", "Last send")}: {data.lastResult.ok ? t("riuscito", "succeeded") : t("fallito", "failed")} · {KIND_LABEL[lang][data.lastResult.kind] ?? "email"} · {new Date(data.lastResult.at).toLocaleString(lang === "en" ? "en-GB" : "it-IT", { dateStyle: "short", timeStyle: "short" })}
          </div>
        )}
      </section>

      {data.lastResult && !data.lastResult.ok && data.lastResult.error && (
        <p className="form-error" role="alert">{t("Ultimo errore", "Last error")}: {data.lastResult.error}. {t("Controlla che il mittente appartenga a un dominio verificato in Resend.", "Check that the sender belongs to a domain verified in Resend.")}</p>
      )}

      <div className="ac-two">
        <form className="ac-card ac-form" onSubmit={save}>
          <span className="ac-kicker">{t("Mittente", "Sender")}</span>
          <label className="ac-field">
            <span>{t("Nome del mittente", "Sender name")}</span>
            <input value={draft.fromName} onChange={(e) => set({ fromName: e.target.value })} maxLength={80} />
            <small>{t("Compare come mittente accanto all'indirizzo.", "Shown as the sender next to the address.")}</small>
          </label>
          <label className="ac-field">
            <span>{t("Indirizzo del mittente", "Sender address")}</span>
            <input type="email" value={draft.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} placeholder={t("inviti@tuodominio.it", "invites@yourdomain.com")} maxLength={200} />
            <small>{t("Deve essere di un dominio verificato in Resend. Vuoto significa il mittente di prova di Resend.", "Must be on a domain verified in Resend. Empty means Resend's test sender.")}</small>
          </label>
          <label className="ac-field">
            <span>{t("Risposte a", "Reply to")}</span>
            <input type="email" value={draft.replyTo} onChange={(e) => set({ replyTo: e.target.value })} placeholder={t("facoltativo", "optional")} maxLength={200} />
            <small>{t("Quando un ospite risponde all'email, la risposta arriva qui.", "When someone replies to the email, the reply comes here.")}</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="ac-form-actions">
            <button type="submit" className="btn solid small" disabled={saving || !dirty}>{saving ? t("Salvo…", "Saving…") : t("Salva", "Save")}</button>
            {dirty && <button type="button" className="link" onClick={() => { setDraft(data.settings); setError(null); }}>{t("Annulla", "Cancel")}</button>}
          </div>
        </form>

        <section className="ac-card ac-form">
          <span className="ac-kicker">{t("Cosa si invia", "What gets sent")}</span>
          <label className="ac-field">
            <span>{t("Colore del marchio", "Brand colour")}</span>
            <span className="ac-color">
              <input type="color" value={accentOk ? draft.accent : "#0a4560"} onChange={(e) => set({ accent: e.target.value })} aria-label={t("Colore del marchio", "Brand colour")} />
              <input value={draft.accent} onChange={(e) => set({ accent: e.target.value })} maxLength={7} aria-label={t("Colore in formato esadecimale", "Colour in hex format")} />
            </span>
            <small>{t("Pulsanti e nome del marchio nelle email.", "Buttons and brand name in the emails.")}</small>
          </label>
          <Toggle label={t("Avviso al cliente per ogni risposta", "Notify the customer of every reply")} hint={t("Il cliente riceve un'email quando un ospite risponde.", "The customer gets an email when a guest replies.")} checked={draft.notifyRsvp} onChange={(v) => set({ notifyRsvp: v })} />
          <Toggle label={t("Conferma al cliente dopo il pagamento", "Confirm to the customer after payment")} hint={t("Mail di ringraziamento con il link dell'invito attivo.", "Thank-you email with the live invitation link.")} checked={draft.orderConfirm} onChange={(v) => set({ orderConfirm: v })} />
          <p className="hint">{t("Le modifiche agli interruttori valgono dopo il salvataggio.", "Switch changes take effect after saving.")}</p>
        </section>
      </div>

      <section className="ac-card ac-test-send">
        <div>
          <span className="ac-kicker">{t("Prova", "Test")}</span>
          <p className="hint">{t("Manda una email di prova per verificare mittente e configurazione.", "Send a test email to check the sender and setup.")}</p>
        </div>
        <div className="ac-search-row">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("la-tua@email.it", "you@email.com")} aria-label={t("Indirizzo per la prova", "Test address")} />
          <button type="button" className="btn solid small" disabled={testing || !to.includes("@")} onClick={sendTest}>{testing ? t("Invio…", "Sending…") : t("Invia prova", "Send test")}</button>
        </div>
      </section>

      <TemplateEditor templates={data.templates} accent={draft.accent} onSaved={load} />

      <section className="ac-card">
        <span className="ac-kicker">{t("Chiave del servizio", "Service key")}</span>
        <p className="hint">{t("La chiave Resend è un segreto: si imposta nel file .env del server, mai nella console.", "The Resend key is a secret: it's set in the server's .env file, never in the console.")}</p>
        <ul className="ac-checks">
          <li className={data.keyPresent ? "is-ok" : "is-missing"}>
            <span className="ac-check-mark" aria-hidden="true">{data.keyPresent ? "✓" : "!"}</span>
            <span className="ac-check-label">Resend<small>{t("RESEND_API_KEY nel .env", "RESEND_API_KEY in .env")}</small></span>
            <span className="ac-check-value">{data.keyPresent ? t("impostata", "set") : t("mancante", "missing")}</span>
            <span className="ac-tag">{data.keyPresent ? t("dal file .env", "from the .env file") : t("da impostare", "to set")}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ac-toggle">
      <div>
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

// Editor dei testi: un tipo di email alla volta, con anteprima che si aggiorna mentre si scrive.
// Ogni email ha due versioni: italiano e inglese. Si manda nella lingua di chi la riceve.
function TemplateEditor({ templates, accent, onSaved }: { templates: TemplateInfo[]; accent: string; onSaved: () => void }) {
  const uiLang = useLang();
  const t = useT();
  const [kind, setKind] = useState<TemplateKind>(templates[0]?.kind ?? "access");
  const [mailLang, setMailLang] = useState<"it" | "en">("it");
  const info = templates.find((x) => x.kind === kind) ?? templates[0];
  const saved = info ? (mailLang === "en" ? info.currentEn : info.current) : null;
  const [draft, setDraft] = useState<Text | null>(saved);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Il testo si riparte dal salvato solo quando si cambia tipo di email: così le modifiche non salvate non si perdono.
  useEffect(() => {
    setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, mailLang]);

  useEffect(() => {
    if (!draft || !info) return;
    const timer = setTimeout(() => {
      fetch("/api/admin/mail/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, template: draft, lang: mailLang }) })
        .then((r) => r.json())
        .then((d: { html?: string }) => d.html && setPreview(d.html))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, kind, info, accent, mailLang]);

  if (!info || !draft) return null;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/admin/mail/template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, template: draft, lang: mailLang }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) return toast.error(body.error ?? t("Salvataggio non riuscito", "Saving failed"));
    toast.success(t("Testo salvato: vale per le prossime email.", "Text saved: it applies to the next emails."));
    onSaved();
  }

  async function reset() {
    if (!confirm(t("Riportare questa email al testo predefinito?", "Restore this email to the default text?"))) return;
    const res = await fetch("/api/admin/mail/template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, reset: true, lang: mailLang }) });
    if (!res.ok) return toast.error(t("Ripristino non riuscito", "Restore failed"));
    toast.success(t("Testo ripristinato.", "Text restored."));
    onSaved();
  }

  return (
    <section className="ac-card ac-tpl" aria-label={t("Testi delle email", "Email texts")}>
      <span className="ac-kicker">{t("Testi delle email", "Email texts")}</span>
      <nav className="ac-segment" aria-label={t("Tipo di email", "Email type")}>
        {templates.map((x) => (
          <button key={x.kind} type="button" className={x.kind === kind ? "is-on" : ""} onClick={() => setKind(x.kind)}>{TEMPLATE_LABEL[uiLang][x.kind] ?? x.label}</button>
        ))}
      </nav>
      <nav className="ac-segment" aria-label={t("Lingua dell'email", "Email language")}>
        <button type="button" className={mailLang === "it" ? "is-on" : ""} onClick={() => setMailLang("it")}>{t("Italiano", "Italian")}</button>
        <button type="button" className={mailLang === "en" ? "is-on" : ""} onClick={() => setMailLang("en")}>{t("Inglese", "English")}</button>
      </nav>
      <p className="hint">{t("Ogni email parte nella lingua di chi la riceve: quella del sito, dell'invito o del negozio.", "Each email is sent in the recipient's language: the site's, the invitation's or the shop's.")}</p>
      <div className="ac-tpl-grid">
        <div className="ac-form-grid one">
          {FIELDS.map((f) => (
            <label key={f.key} className="ac-field">
              <span>{t(f.label, f.en)}</span>
              {f.multi ? (
                <textarea rows={5} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={1000} />
              ) : (
                <input value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={f.key === "subject" ? 150 : 120} />
              )}
            </label>
          ))}
          <p className="hint ac-vars">
            {t("Variabili disponibili", "Available variables")}: {info.variables.map((v) => <code key={v}>{`{{${v}}}`}</code>)}
          </p>
          <div className="ac-form-actions">
            <button type="button" className="btn solid small" disabled={!changed || saving} onClick={save}>{saving ? t("Salvo…", "Saving…") : t("Salva testo", "Save text")}</button>
            <button type="button" className="link" onClick={reset}>{t("Ripristina predefinito", "Restore default")}</button>
          </div>
        </div>
        <div className="ac-preview" aria-label={t("Anteprima", "Preview")}>
          <span className="ac-kicker">{t("Anteprima", "Preview")}</span>
          <iframe title={t("Anteprima email", "Email preview")} srcDoc={preview} sandbox="" />
          <small className="hint">{t(`Dati di esempio. Il colore del marchio è ${accent}.`, `Sample data. The brand colour is ${accent}.`)}</small>
        </div>
      </div>
    </section>
  );
}
