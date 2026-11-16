"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLang, useT } from "@/lib/lang";

// Stato di una voce di configurazione, come la restituisce l'API. I segreti non hanno valore: solo la presenza.
type Item = { key: string; label: string; required: boolean; source: "console" | "ambiente" | "assente"; value: string | null; secret: boolean };
type Ids = { storeDomain: string; variantId: string; variantPremiumId: string; plannerProductId: string };
type Payload = { items: Item[]; ids: Ids; configured: boolean; demo: boolean; webhookUrl: string; webhookTopic: string; appUrl: string };
type TestResult = { ok: boolean; shopName?: string; variantTitle?: string; productTitle?: string; price?: string; premiumTitle?: string; plannerTitle?: string; error?: string };

const SOURCE_LABEL: Record<"it" | "en", Record<Item["source"], string>> = {
  it: { console: "dalla console", ambiente: "dal file .env", assente: "mancante" },
  en: { console: "from the console", ambiente: "from the .env file", assente: "missing" },
};
// Nomi inglesi delle voci (l'API le manda in italiano).
const ITEM_EN: Record<string, string> = {
  storeDomain: "Shop domain",
  variantId: "Invitation variant",
  plannerProductId: "Planner product (sold separately)",
  variantPremiumId: "Invitation + planner bundle variant",
  storefrontToken: "Storefront API token",
  webhookSecret: "orders/paid webhook secret",
};

// Shopify: il sito di vendita. Qui si collegano il negozio e le varianti dei prodotti; i segreti stanno nel .env del server.
export function AdminShopify() {
  const lang = useLang();
  const t = useT();
  const itemLabel = (i: Item) => (lang === "en" ? ITEM_EN[i.key] ?? i.label : i.label);
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Ids>({ storeDomain: "", variantId: "", variantPremiumId: "", plannerProductId: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/shopify");
    if (!res.ok) return toast.error(t("Impossibile leggere il collegamento Shopify", "Couldn't read the Shopify connection"));
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
    if (!res.ok || !("items" in body)) return setError((body as { error?: string }).error ?? t("Salvataggio non riuscito", "Saving failed"));
    setData(body);
    setDraft(body.ids);
    setTest(null);
    toast.success(t("Collegamento salvato. Verifica la connessione per confermare.", "Connection saved. Test it to confirm."));
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/admin/shopify/test", { method: "POST" });
    const body = (await res.json().catch(() => ({ ok: false, error: t("Risposta non valida", "Invalid response") }))) as TestResult;
    setTesting(false);
    setTest(body);
  }

  if (!data) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;

  const missing = data.items.filter((i) => i.required && i.source === "assente");
  const ready = missing.length === 0 && !data.demo;
  const dirty = draft.storeDomain !== data.ids.storeDomain || draft.variantId !== data.ids.variantId || draft.variantPremiumId !== data.ids.variantPremiumId || draft.plannerProductId !== (data.ids.plannerProductId ?? "");

  return (
    <div className="ac-stack">
      <section className={`ac-card ac-status ${ready ? "is-ready" : "is-todo"}`}>
        <div>
          <span className="ac-kicker">{t("Stato", "Status")}</span>
          <h2>{ready ? t("Pronto a vendere", "Ready to sell") : data.demo ? t("Modalità demo attiva", "Demo mode active") : t("Collegamento da completare", "Connection to complete")}</h2>
          <p className="hint">
            {ready
              ? t("Il checkout porta al pagamento su Shopify e l'invito si attiva quando Shopify conferma l'ordine.", "Checkout leads to payment on Shopify and the invitation activates when Shopify confirms the order.")
              : missing.length > 0
                ? `${t("Mancano", "Missing")}: ${missing.map((m) => itemLabel(m).toLowerCase()).join(", ")}.`
                : t("Con Shopify non collegato il sito usa la modalità demo: nessun pagamento reale.", "With Shopify not connected the site uses demo mode: no real payments.")}
          </p>
        </div>
        <button type="button" className="btn solid small" onClick={runTest} disabled={testing}>{testing ? t("Verifico…", "Testing…") : t("Verifica collegamento", "Test connection")}</button>
      </section>

      {test && (
        <section className={`ac-card ac-test ${test.ok ? "is-ok" : "is-err"}`} role="status">
          {test.ok ? (
            <>
              <strong>{t("Collegamento funzionante", "Connection working")}</strong>
              <ul className="ac-kv">
                {test.shopName && <li><span>{t("Negozio", "Shop")}</span><b>{test.shopName}</b></li>}
                {test.productTitle && <li><span>{t("Prodotto base", "Base product")}</span><b>{test.productTitle}{test.variantTitle && test.variantTitle !== "Default Title" ? ` · ${test.variantTitle}` : ""}</b></li>}
                {test.price && <li><span>{t("Prezzo base", "Base price")}</span><b>{test.price}</b></li>}
                {test.plannerTitle && <li><span>{t("Prodotto planner", "Planner product")}</span><b>{test.plannerTitle}</b></li>}
                {test.premiumTitle && <li><span>{t("Pacchetto invito + planner", "Invitation + planner bundle")}</span><b>{test.premiumTitle}</b></li>}
              </ul>
            </>
          ) : (
            <><strong>{t("Non funziona ancora", "Not working yet")}</strong><p>{test.error}</p></>
          )}
        </section>
      )}

      <div className="ac-two">
        <form className="ac-card ac-form" onSubmit={save}>
          <span className="ac-kicker">{t("Negozio e prodotti", "Shop and products")}</span>
          <label className="ac-field">
            <span>{t("Dominio del negozio", "Shop domain")}</span>
            <input value={draft.storeDomain} onChange={(e) => setDraft({ ...draft, storeDomain: e.target.value })} placeholder={t("nome-negozio.myshopify.com", "shop-name.myshopify.com")} maxLength={120} />
            <small>{t("Lo trovi in Shopify, Impostazioni, Dominio: finisce con myshopify.com.", "Find it in Shopify, Settings, Domains: it ends in myshopify.com.")}</small>
          </label>
          <label className="ac-field">
            <span>{t("ID variante dell'invito", "Invitation variant ID")}</span>
            <input value={draft.variantId} onChange={(e) => setDraft({ ...draft, variantId: e.target.value })} placeholder={t("es. 44123456789", "e.g. 44123456789")} maxLength={40} inputMode="numeric" />
            <small>{t("Prodotti, scegli il prodotto, poi la variante: l'ID numerico è nell'indirizzo della pagina.", "Products, pick the product, then the variant: the numeric ID is in the page address.")}</small>
          </label>
          <label className="ac-field">
            <span>{t("ID prodotto del planner", "Planner product ID")}</span>
            <input value={draft.plannerProductId} onChange={(e) => setDraft({ ...draft, plannerProductId: e.target.value })} placeholder={t("facoltativo", "optional")} maxLength={40} inputMode="numeric" />
            <small>{t("Il planner è un prodotto a sé nel negozio: Prodotti, scegli il planner, l'ID numerico è nell'indirizzo della pagina. Qualunque sua variante dà un planner da attivare, che il cliente può collegare a un suo invito.", "The planner is its own product in the shop: Products, pick the planner, the numeric ID is in the page address. Any of its variants gives a planner to activate, which the customer can link to one of their invitations.")}</small>
          </label>
          <label className="ac-field">
            <span>{t("ID variante del pacchetto invito + planner", "Invitation + planner bundle variant ID")}</span>
            <input value={draft.variantPremiumId} onChange={(e) => setDraft({ ...draft, variantPremiumId: e.target.value })} placeholder={t("facoltativo", "optional")} maxLength={40} inputMode="numeric" />
            <small>{t("Facoltativa: un acquisto di questa variante dà un invito e un planner da attivare.", "Optional: buying this variant gives an invitation and a planner to activate.")}</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="ac-form-actions">
            <button type="submit" className="btn solid small" disabled={saving || !dirty}>{saving ? t("Salvo…", "Saving…") : t("Salva collegamento", "Save connection")}</button>
            {dirty && <button type="button" className="link" onClick={() => { setDraft(data.ids); setError(null); }}>{t("Annulla", "Cancel")}</button>}
          </div>
        </form>

        <section className="ac-card">
          <span className="ac-kicker">{t("Webhook ordini", "Order webhook")}</span>
          <p className="hint">{t("Shopify avvisa il sito quando un ordine è pagato, così l'invito si attiva da solo.", "Shopify notifies the site when an order is paid, so the invitation activates by itself.")}</p>
          <ol className="ac-steps">
            <li>{t("In Shopify apri Impostazioni, Notifiche, poi Webhook, e crea un webhook.", "In Shopify open Settings, Notifications, then Webhooks, and create a webhook.")}</li>
            <li>{t("Evento", "Event")}: <b>{t("Ordine pagato", "Order payment")}</b> (orders/paid). {t("Formato", "Format")}: JSON.</li>
            <li>{t("Incolla questo indirizzo:", "Paste this address:")}</li>
          </ol>
          <CopyField value={data.webhookUrl} />
          <p className="hint">{t("Shopify mostra un segreto per il webhook. Va nel file .env del server come", "Shopify shows a secret for the webhook. It goes in the server's .env file as")} <code>SHOPIFY_WEBHOOK_SECRET</code>{t(": non si incolla qui.", ": don't paste it here.")}</p>
        </section>
      </div>

      <section className="ac-card">
        <span className="ac-kicker">{t("Chiavi e segreti", "Keys and secrets")}</span>
        <p className="hint">{t("Questi valori restano sul server. La console mostra solo se sono presenti.", "These values stay on the server. The console only shows whether they're present.")}</p>
        <ul className="ac-checks">
          {data.items.map((i) => (
            <li key={i.key} className={i.source === "assente" ? (i.required ? "is-missing" : "is-optional") : "is-ok"}>
              <span className="ac-check-mark" aria-hidden="true">{i.source === "assente" ? (i.required ? "!" : "–") : "✓"}</span>
              <span className="ac-check-label">{itemLabel(i)}{i.secret && <small>{t("nel file .env", "in the .env file")}: SHOPIFY_{i.key === "storefrontToken" ? "STOREFRONT_TOKEN" : "WEBHOOK_SECRET"}</small>}</span>
              <span className="ac-check-value">{i.secret ? (i.source === "assente" ? t("mancante", "missing") : t("impostato", "set")) : i.value ?? t("non impostato", "not set")}</span>
              <span className="ac-tag">{SOURCE_LABEL[lang][i.source]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("Copia non riuscita: seleziona l'indirizzo a mano", "Copy failed: select the address by hand"));
    }
  }
  return (
    <div className="ac-copy">
      <code>{value}</code>
      <button type="button" className="btn outline small" onClick={copy}>{copied ? t("Copiato", "Copied") : t("Copia", "Copy")}</button>
    </div>
  );
}
