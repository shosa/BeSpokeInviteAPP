"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "../ui/Switch";

// Impostazioni della posta: mittente, risposte e interruttori per tipo di email. La chiave Resend resta nel .env.
type Settings = { fromName: string; fromEmail: string; replyTo: string; notifyRsvp: boolean; orderConfirm: boolean; accent: string };
type Result = { at: string; ok: boolean; error?: string; kind: string } | null;
type Text = { subject: string; title: string; body: string; button: string; footer: string };
type TemplateInfo = { kind: TemplateKind; label: string; variables: string[]; current: Text; defaults: Text };
type TemplateKind = "access" | "purchase" | "order" | "rsvp";
type Payload = { settings: Settings; provider: "resend" | "outbox"; keyPresent: boolean; fromPreview: string; lastResult: Result; templates: TemplateInfo[] };
const FIELDS: { key: keyof Text; label: string; multi?: boolean }[] = [
  { key: "subject", label: "Oggetto" },
  { key: "title", label: "Titolo nell'email" },
  { key: "body", label: "Testo (una riga vuota separa i paragrafi)", multi: true },
  { key: "button", label: "Testo del pulsante" },
  { key: "footer", label: "Nota in fondo (facoltativa)" },
];

const KIND_LABEL: Record<string, string> = { invite: "invito agli ospiti", rsvp: "avviso di risposta", order: "conferma di pagamento", test: "prova", other: "email" };

export function AdminMail() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [to, setTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/mail");
    if (!res.ok) return toast.error("Impossibile leggere le impostazioni della posta");
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
    if (!res.ok || !("settings" in body)) return setError((body as { error?: string }).error ?? "Salvataggio non riuscito");
    setData(body);
    setDraft(body.settings);
    toast.success("Impostazioni della posta salvate.");
  }

  async function sendTest() {
    setTesting(true);
    const res = await fetch("/api/admin/mail/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
    const body = (await res.json().catch(() => ({ ok: false, error: "Risposta non valida" }))) as { ok: boolean; error?: string; provider?: string };
    setTesting(false);
    if (body.ok) toast.success(body.provider === "outbox" ? "Prova salvata nella coda: Resend non è configurato sul server." : "Prova inviata. Controlla la casella.");
    else toast.error(body.error ?? "Invio di prova non riuscito");
    void load();
  }

  if (!data || !draft) return <p className="hint">Caricamento…</p>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const accentOk = /^#[0-9a-fA-F]{6}$/.test(draft.accent);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });
  const live = data.provider === "resend";

  return (
    <div className="ac-stack">
      <section className={`ac-card ac-status ${live ? "is-ready" : "is-todo"}`}>
        <div>
          <span className="ac-kicker">Stato</span>
          <h2>{live ? "Posta attiva con Resend" : "Posta in coda: Resend non configurato"}</h2>
          <p className="hint">
            {live
              ? `Le email partono da ${data.fromPreview}.`
              : "Le email vengono solo registrate. Per inviarle davvero, aggiungi RESEND_API_KEY nel file .env del server e ricrea il container api."}
          </p>
        </div>
        {data.lastResult && (
          <div className={`ac-pill ${data.lastResult.ok ? "is-ok" : "is-warn"}`} role="status">
            Ultimo invio: {data.lastResult.ok ? "riuscito" : "fallito"} · {KIND_LABEL[data.lastResult.kind] ?? "email"} · {new Date(data.lastResult.at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
          </div>
        )}
      </section>

      {data.lastResult && !data.lastResult.ok && data.lastResult.error && (
        <p className="form-error" role="alert">Ultimo errore: {data.lastResult.error}. Controlla che il mittente appartenga a un dominio verificato in Resend.</p>
      )}

      <div className="ac-two">
        <form className="ac-card ac-form" onSubmit={save}>
          <span className="ac-kicker">Mittente</span>
          <label className="ac-field">
            <span>Nome del mittente</span>
            <input value={draft.fromName} onChange={(e) => set({ fromName: e.target.value })} maxLength={80} />
            <small>Compare come mittente accanto all&apos;indirizzo.</small>
          </label>
          <label className="ac-field">
            <span>Indirizzo del mittente</span>
            <input type="email" value={draft.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} placeholder="inviti@tuodominio.it" maxLength={200} />
            <small>Deve essere di un dominio verificato in Resend. Vuoto significa il mittente di prova di Resend.</small>
          </label>
          <label className="ac-field">
            <span>Risposte a</span>
            <input type="email" value={draft.replyTo} onChange={(e) => set({ replyTo: e.target.value })} placeholder="facoltativo" maxLength={200} />
            <small>Quando un ospite risponde all&apos;email, la risposta arriva qui.</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="ac-form-actions">
            <button type="submit" className="btn solid small" disabled={saving || !dirty}>{saving ? "Salvo…" : "Salva"}</button>
            {dirty && <button type="button" className="link" onClick={() => { setDraft(data.settings); setError(null); }}>Annulla</button>}
          </div>
        </form>

        <section className="ac-card ac-form">
          <span className="ac-kicker">Cosa si invia</span>
          <label className="ac-field">
            <span>Colore del marchio</span>
            <span className="ac-color">
              <input type="color" value={accentOk ? draft.accent : "#0a4560"} onChange={(e) => set({ accent: e.target.value })} aria-label="Colore del marchio" />
              <input value={draft.accent} onChange={(e) => set({ accent: e.target.value })} maxLength={7} aria-label="Colore in formato esadecimale" />
            </span>
            <small>Pulsanti e nome del marchio nelle email.</small>
          </label>
          <Toggle label="Avviso al cliente per ogni risposta" hint="Il cliente riceve un'email quando un ospite risponde." checked={draft.notifyRsvp} onChange={(v) => set({ notifyRsvp: v })} />
          <Toggle label="Conferma al cliente dopo il pagamento" hint="Mail di ringraziamento con il link dell'invito attivo." checked={draft.orderConfirm} onChange={(v) => set({ orderConfirm: v })} />
          <p className="hint">Le modifiche agli interruttori valgono dopo il salvataggio.</p>
        </section>
      </div>

      <section className="ac-card ac-test-send">
        <div>
          <span className="ac-kicker">Prova</span>
          <p className="hint">Manda una email di prova per verificare mittente e configurazione.</p>
        </div>
        <div className="ac-search-row">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="la-tua@email.it" aria-label="Indirizzo per la prova" />
          <button type="button" className="btn solid small" disabled={testing || !to.includes("@")} onClick={sendTest}>{testing ? "Invio…" : "Invia prova"}</button>
        </div>
      </section>

      <TemplateEditor templates={data.templates} accent={draft.accent} onSaved={load} />

      <section className="ac-card">
        <span className="ac-kicker">Chiave del servizio</span>
        <p className="hint">La chiave Resend è un segreto: si imposta nel file .env del server, mai nella console.</p>
        <ul className="ac-checks">
          <li className={data.keyPresent ? "is-ok" : "is-missing"}>
            <span className="ac-check-mark" aria-hidden="true">{data.keyPresent ? "✓" : "!"}</span>
            <span className="ac-check-label">Resend<small>RESEND_API_KEY nel .env</small></span>
            <span className="ac-check-value">{data.keyPresent ? "impostata" : "mancante"}</span>
            <span className="ac-tag">{data.keyPresent ? "dal file .env" : "da impostare"}</span>
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
function TemplateEditor({ templates, accent, onSaved }: { templates: TemplateInfo[]; accent: string; onSaved: () => void }) {
  const [kind, setKind] = useState<TemplateKind>(templates[0]?.kind ?? "access");
  const info = templates.find((t) => t.kind === kind) ?? templates[0];
  const [draft, setDraft] = useState<Text | null>(info?.current ?? null);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Il testo si riparte dal salvato solo quando si cambia tipo di email: così le modifiche non salvate non si perdono.
  useEffect(() => {
    setDraft(info?.current ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (!draft || !info) return;
    const t = setTimeout(() => {
      fetch("/api/admin/mail/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, template: draft }) })
        .then((r) => r.json())
        .then((d: { html?: string }) => d.html && setPreview(d.html))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, kind, info, accent]);

  if (!info || !draft) return null;
  const changed = JSON.stringify(draft) !== JSON.stringify(info.current);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/admin/mail/template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, template: draft }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) return toast.error(body.error ?? "Salvataggio non riuscito");
    toast.success("Testo salvato: vale per le prossime email.");
    onSaved();
  }

  async function reset() {
    if (!confirm("Riportare questa email al testo predefinito?")) return;
    const res = await fetch("/api/admin/mail/template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, reset: true }) });
    if (!res.ok) return toast.error("Ripristino non riuscito");
    toast.success("Testo ripristinato.");
    onSaved();
  }

  return (
    <section className="ac-card ac-tpl" aria-label="Testi delle email">
      <span className="ac-kicker">Testi delle email</span>
      <nav className="ac-segment" aria-label="Tipo di email">
        {templates.map((t) => (
          <button key={t.kind} type="button" className={t.kind === kind ? "is-on" : ""} onClick={() => setKind(t.kind)}>{t.label}</button>
        ))}
      </nav>
      <div className="ac-tpl-grid">
        <div className="ac-form-grid one">
          {FIELDS.map((f) => (
            <label key={f.key} className="ac-field">
              <span>{f.label}</span>
              {f.multi ? (
                <textarea rows={5} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={1000} />
              ) : (
                <input value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} maxLength={f.key === "subject" ? 150 : 120} />
              )}
            </label>
          ))}
          <p className="hint ac-vars">
            Variabili disponibili: {info.variables.map((v) => <code key={v}>{`{{${v}}}`}</code>)}
          </p>
          <div className="ac-form-actions">
            <button type="button" className="btn solid small" disabled={!changed || saving} onClick={save}>{saving ? "Salvo…" : "Salva testo"}</button>
            <button type="button" className="link" onClick={reset}>Ripristina predefinito</button>
          </div>
        </div>
        <div className="ac-preview" aria-label="Anteprima">
          <span className="ac-kicker">Anteprima</span>
          <iframe title="Anteprima email" srcDoc={preview} sandbox="" />
          <small className="hint">Dati di esempio. Il colore del marchio è {accent}.</small>
        </div>
      </div>
    </section>
  );
}
