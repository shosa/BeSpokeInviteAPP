"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// Stato di una voce di configurazione, come la restituisce l'API. I segreti non hanno valore: solo la presenza.
type Item = { key: string; label: string; required: boolean; source: "console" | "ambiente" | "assente"; value: string | null; secret: boolean };
type Ids = { storeDomain: string; variantId: string; variantPremiumId: string };
type Payload = { items: Item[]; ids: Ids; configured: boolean; demo: boolean; webhookUrl: string; webhookTopic: string; appUrl: string };
type TestResult = { ok: boolean; shopName?: string; variantTitle?: string; productTitle?: string; price?: string; premiumTitle?: string; error?: string };

const SOURCE_LABEL: Record<Item["source"], string> = { console: "dalla console", ambiente: "dal file .env", assente: "mancante" };

// Shopify: il sito di vendita. Qui si collegano il negozio e le varianti dei prodotti; i segreti stanno nel .env del server.
export function AdminShopify() {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Ids>({ storeDomain: "", variantId: "", variantPremiumId: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/shopify");
    if (!res.ok) return toast.error("Impossibile leggere il collegamento Shopify");
    const body = (await res.json()) as Payload;
    setData(body);
    setDraft(body.ids);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/admin/shopify", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = (await res.json().catch(() => ({}))) as Payload | { error?: string };
    setSaving(false);
    if (!res.ok || !("items" in body)) return setError((body as { error?: string }).error ?? "Salvataggio non riuscito");
    setData(body);
    setDraft(body.ids);
    setTest(null);
    toast.success("Collegamento salvato. Verifica la connessione per confermare.");
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/admin/shopify/test", { method: "POST" });
    const body = (await res.json().catch(() => ({ ok: false, error: "Risposta non valida" }))) as TestResult;
    setTesting(false);
    setTest(body);
  }

  if (!data) return <p className="hint">Caricamento…</p>;

  const missing = data.items.filter((i) => i.required && i.source === "assente");
  const ready = missing.length === 0 && !data.demo;
  const dirty = draft.storeDomain !== data.ids.storeDomain || draft.variantId !== data.ids.variantId || draft.variantPremiumId !== data.ids.variantPremiumId;

  return (
    <div className="ac-stack">
      <section className={`ac-card ac-status ${ready ? "is-ready" : "is-todo"}`}>
        <div>
          <span className="ac-kicker">Stato</span>
          <h2>{ready ? "Pronto a vendere" : data.demo ? "Modalità demo attiva" : "Collegamento da completare"}</h2>
          <p className="hint">
            {ready
              ? "Il checkout porta al pagamento su Shopify e l'invito si attiva quando Shopify conferma l'ordine."
              : missing.length > 0
                ? `Mancano: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`
                : "Con Shopify non collegato il sito usa la modalità demo: nessun pagamento reale."}
          </p>
        </div>
        <button type="button" className="btn solid small" onClick={runTest} disabled={testing}>{testing ? "Verifico…" : "Verifica collegamento"}</button>
      </section>

      {test && (
        <section className={`ac-card ac-test ${test.ok ? "is-ok" : "is-err"}`} role="status">
          {test.ok ? (
            <>
              <strong>Collegamento funzionante</strong>
              <ul className="ac-kv">
                {test.shopName && <li><span>Negozio</span><b>{test.shopName}</b></li>}
                {test.productTitle && <li><span>Prodotto base</span><b>{test.productTitle}{test.variantTitle && test.variantTitle !== "Default Title" ? ` · ${test.variantTitle}` : ""}</b></li>}
                {test.price && <li><span>Prezzo base</span><b>{test.price}</b></li>}
                {test.premiumTitle && <li><span>Prodotto premium</span><b>{test.premiumTitle}</b></li>}
              </ul>
            </>
          ) : (
            <><strong>Non funziona ancora</strong><p>{test.error}</p></>
          )}
        </section>
      )}

      <div className="ac-two">
        <form className="ac-card ac-form" onSubmit={save}>
          <span className="ac-kicker">Negozio e prodotti</span>
          <label className="ac-field">
            <span>Dominio del negozio</span>
            <input value={draft.storeDomain} onChange={(e) => setDraft({ ...draft, storeDomain: e.target.value })} placeholder="nome-negozio.myshopify.com" maxLength={120} />
            <small>Lo trovi in Shopify, Impostazioni, Dominio: finisce con myshopify.com.</small>
          </label>
          <label className="ac-field">
            <span>ID variante del pacchetto base</span>
            <input value={draft.variantId} onChange={(e) => setDraft({ ...draft, variantId: e.target.value })} placeholder="es. 44123456789" maxLength={40} inputMode="numeric" />
            <small>Prodotti, scegli il prodotto, poi la variante: l&apos;ID numerico è nell&apos;indirizzo della pagina.</small>
          </label>
          <label className="ac-field">
            <span>ID variante del planner premium</span>
            <input value={draft.variantPremiumId} onChange={(e) => setDraft({ ...draft, variantPremiumId: e.target.value })} placeholder="facoltativo" maxLength={40} inputMode="numeric" />
            <small>Se è vuoto, il planner premium si vende con il pacchetto base.</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="ac-form-actions">
            <button type="submit" className="btn solid small" disabled={saving || !dirty}>{saving ? "Salvo…" : "Salva collegamento"}</button>
            {dirty && <button type="button" className="link" onClick={() => { setDraft(data.ids); setError(null); }}>Annulla</button>}
          </div>
        </form>

        <section className="ac-card">
          <span className="ac-kicker">Webhook ordini</span>
          <p className="hint">Shopify avvisa il sito quando un ordine è pagato, così l&apos;invito si attiva da solo.</p>
          <ol className="ac-steps">
            <li>In Shopify apri Impostazioni, Notifiche, poi Webhook, e crea un webhook.</li>
            <li>Evento: <b>Ordine pagato</b> (orders/paid). Formato: JSON.</li>
            <li>Incolla questo indirizzo:</li>
          </ol>
          <CopyField value={data.webhookUrl} />
          <p className="hint">Shopify mostra un segreto per il webhook. Va nel file .env del server come <code>SHOPIFY_WEBHOOK_SECRET</code>: non si incolla qui.</p>
        </section>
      </div>

      <section className="ac-card">
        <span className="ac-kicker">Chiavi e segreti</span>
        <p className="hint">Questi valori restano sul server. La console mostra solo se sono presenti.</p>
        <ul className="ac-checks">
          {data.items.map((i) => (
            <li key={i.key} className={i.source === "assente" ? (i.required ? "is-missing" : "is-optional") : "is-ok"}>
              <span className="ac-check-mark" aria-hidden="true">{i.source === "assente" ? (i.required ? "!" : "–") : "✓"}</span>
              <span className="ac-check-label">{i.label}{i.secret && <small>nel file .env: SHOPIFY_{i.key === "storefrontToken" ? "STOREFRONT_TOKEN" : "WEBHOOK_SECRET"}</small>}</span>
              <span className="ac-check-value">{i.secret ? (i.source === "assente" ? "mancante" : "impostato") : i.value ?? "non impostato"}</span>
              <span className="ac-tag">{SOURCE_LABEL[i.source]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copia non riuscita: seleziona l'indirizzo a mano");
    }
  }
  return (
    <div className="ac-copy">
      <code>{value}</code>
      <button type="button" className="btn outline small" onClick={copy}>{copied ? "Copiato" : "Copia"}</button>
    </div>
  );
}
