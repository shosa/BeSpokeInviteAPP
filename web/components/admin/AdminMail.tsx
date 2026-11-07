"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "../ui/Switch";

// Impostazioni della posta: mittente, risposte e interruttori per tipo di email. La chiave Resend resta nel .env.
type Settings = { fromName: string; fromEmail: string; replyTo: string; sendInvites: boolean; notifyRsvp: boolean; orderConfirm: boolean };
type Result = { at: string; ok: boolean; error?: string; kind: string } | null;
type Payload = { settings: Settings; provider: "resend" | "outbox"; keyPresent: boolean; fromPreview: string; lastResult: Result };

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
          <Toggle label="Inviti agli ospiti" hint="Il pulsante Invia nel pannello ospiti manda l'invito via email." checked={draft.sendInvites} onChange={(v) => set({ sendInvites: v })} />
          <Toggle label="Avviso al cliente per ogni risposta" hint="Il cliente riceve un'email quando un ospite risponde." checked={draft.notifyRsvp} onChange={(v) => set({ notifyRsvp: v })} />
          <Toggle label="Conferma al cliente dopo il pagamento" hint="Mail di ringraziamento con il link dell'invito attivo." checked={draft.orderConfirm} onChange={(v) => set({ orderConfirm: v })} />
          <p className="hint">Le modifiche agli interruttori valgono dopo il salvataggio. Gli inviti spenti non partono: il pulsante nel pannello ospiti lo segnala.</p>
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
