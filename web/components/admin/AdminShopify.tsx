"use client";

import { useEffect, useState } from "react";
import { Fold } from "./Fold";
import { toast } from "sonner";
import { Check, Copy, Info, Loader2 } from "lucide-react";
import { useT } from "@/lib/lang";

// Shopify: stato del collegamento, ID dei prodotti (salvati dalla console), webhook e segreti (solo presenza: stanno nel .env).
type Item = { key: string; label: string; required: boolean; source: "console" | "ambiente" | "assente"; value: string | null; secret: boolean };
type Ids = { storeDomain: string; variantId: string; variantPremiumId: string; plannerProductId: string; variantBasicId: string; variantAiCreditsId: string; aiCreditsPerPack: string };
type Payload = { items: Item[]; ids: Ids; configured: boolean; demo: boolean; webhookUrl: string; webhookTopic: string; appUrl: string };
type TestResult = { ok: boolean; shopName?: string; variantTitle?: string; productTitle?: string; price?: string; premiumTitle?: string; plannerTitle?: string; basicTitle?: string; creditsTitle?: string; error?: string };
const EMPTY: Ids = { storeDomain: "", variantId: "", variantPremiumId: "", plannerProductId: "", variantBasicId: "", variantAiCreditsId: "", aiCreditsPerPack: "20" };

export function AdminShopify() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Ids>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromPayload = (p: Payload): Ids => ({
    storeDomain: p.ids.storeDomain ?? "",
    // Come li salva il server: gid://shopify/ProductVariant/123 (o Product/123). Si può incollare anche il solo numero.
    variantId: p.ids.variantId ?? "",
    variantBasicId: p.ids.variantBasicId ?? "",
    variantPremiumId: p.ids.variantPremiumId ?? "",
    plannerProductId: p.ids.plannerProductId ?? "",
    variantAiCreditsId: p.ids.variantAiCreditsId ?? "",
    aiCreditsPerPack: p.ids.aiCreditsPerPack || "20",
  });

  async function load() {
    const res = await fetch("/api/admin/shopify");
    if (!res.ok) return toast.error(t("Impossibile leggere il collegamento Shopify", "Couldn't read the Shopify connection"));
    const body = (await res.json()) as Payload;
    setData(body);
    setDraft(fromPayload(body));
  }
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/admin/shopify", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = (await res.json().catch(() => ({}))) as Payload | { error?: string };
    setSaving(false);
    if (!res.ok || !("items" in body)) return setError((body as { error?: string }).error ?? t("Salvataggio non riuscito", "Saving failed"));
    setData(body);
    setDraft(fromPayload(body));
    setTest(null);
    toast.success(t("Salvato. Verifica il collegamento per confermare.", "Saved. Test the connection to confirm."));
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/admin/shopify/test", { method: "POST" });
    setTest((await res.json().catch(() => ({ ok: false, error: t("Risposta non valida", "Invalid response") }))) as TestResult);
    setTesting(false);
  }

  if (!data) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;

  const saved = fromPayload(data);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const secrets = data.items.filter((i) => i.secret);
  const missing = data.items.filter((i) => i.required && i.source === "assente");
  const ready = missing.length === 0 && !data.demo;
  const set = (k: keyof Ids) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: e.target.value });

  // Righe dei prodotti: etichetta, campo, nome trovato dalla verifica, aiuto breve al passaggio del mouse.
  const rows: { key: keyof Ids; label: string; kind: string; found?: string; help: string; optional?: boolean }[] = [
    { key: "variantId", label: t("Invito VIP", "VIP invitation"), kind: t("variante", "variant"), found: test?.productTitle && [test.productTitle, test.variantTitle !== "Default Title" ? test.variantTitle : null].filter(Boolean).join(" · "), help: t("Invito VIP: tutti i template e il planner.", "VIP invitation: all templates and the planner.") },
    { key: "variantBasicId", label: t("Invito base", "Basic invitation"), kind: t("variante", "variant"), found: test?.basicTitle, help: t("Solo template non Premium.", "Non-Premium templates only."), optional: true },
    { key: "plannerProductId", label: "Planner", kind: t("prodotto", "product"), found: test?.plannerTitle, help: t("Qualunque variante del prodotto dà un planner.", "Any variant of the product gives a planner."), optional: true },
    { key: "variantAiCreditsId", label: t("Crediti BeSpoke AI", "BeSpoke AI credits"), kind: t("variante", "variant"), found: test?.creditsTitle, help: t("Ricarica delle richieste di BeSpoke AI per un invito.", "Top-up of BeSpoke AI requests for one invitation."), optional: true },
  ];

  return (
    <div className="ac-stack sh">
      <section className={`ac-card sh-status ${ready ? "is-ready" : "is-todo"}`}>
        <span className="sh-dot" aria-hidden="true" />
        <div className="sh-status-text">
          <strong>{ready ? t("Collegato e pronto a vendere", "Connected and ready to sell") : data.demo ? t("Modalità demo: nessun pagamento reale", "Demo mode: no real payments") : t("Collegamento da completare", "Connection to complete")}</strong>
          {!ready && missing.length > 0 && <small>{t("Manca", "Missing")}: {missing.map((m) => m.label.toLowerCase()).join(", ")}</small>}
          {test && (test.ok
            ? <small className="sh-ok"><Check size={13} aria-hidden="true" />{t("Verifica riuscita", "Test passed")}{test.shopName ? ` · ${test.shopName}` : ""}{test.price ? ` · ${test.price}` : ""}</small>
            : <small className="sh-err">{test.error}</small>)}
        </div>
        <button type="button" className="btn outline small" onClick={runTest} disabled={testing}>{testing ? <Loader2 size={14} className="as-spin" aria-hidden="true" /> : null}{t("Verifica", "Test")}</button>
      </section>

      <Fold className="ac-card" title={t("Negozio e prodotti", "Shop and products")} summary={draft.storeDomain || t("da configurare", "to set up")}>
      <form className="sh-form" onSubmit={save}>
        <p className="hint" style={{ margin: 0 }}>{t("ID = il numero nell'indirizzo della pagina in Shopify", "ID = the number in the page address in Shopify")}</p>
        <label className="sh-row">
          <span className="sh-label">{t("Dominio", "Domain")}</span>
          <input value={draft.storeDomain} onChange={set("storeDomain")} placeholder="nome-negozio.myshopify.com" maxLength={120} />
          <span className="sh-found">{test?.shopName ?? ""}</span>
        </label>
        {rows.map((r) => (
          <label key={r.key} className="sh-row">
            <span className="sh-label">{r.label}<small>{r.kind}{r.optional ? ` · ${t("facoltativo", "optional")}` : ""}</small></span>
            <input value={draft[r.key]} onChange={set(r.key)} placeholder={t("ID o numero", "ID or number")} maxLength={80} title={r.help} />
            <span className="sh-found" title={r.help}>{r.found ? <><Check size={13} aria-hidden="true" />{r.found}</> : <Info size={14} aria-label={r.help} />}</span>
          </label>
        ))}
        <label className="sh-row">
          <span className="sh-label">{t("Richieste per ricarica", "Requests per top-up")}<small>{t("crediti BeSpoke AI", "BeSpoke AI credits")}</small></span>
          <input value={draft.aiCreditsPerPack} onChange={set("aiCreditsPerPack")} maxLength={3} inputMode="numeric" className="sh-short" />
          <span className="sh-found" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="ac-form-actions">
          <button type="submit" className="btn solid small" disabled={saving || !dirty}>{saving ? t("Salvo…", "Saving…") : t("Salva", "Save")}</button>
          {dirty && <button type="button" className="link" onClick={() => { setDraft(saved); setError(null); }}>{t("Annulla", "Cancel")}</button>}
        </div>
      </form>
      </Fold>

      <div className="sh-two">
        <Fold className="ac-card sh-hook" title="Webhook">
          <p className="hint">{t("In Shopify: Impostazioni › Notifiche › Webhook › evento «Ordine pagato», formato JSON.", "In Shopify: Settings › Notifications › Webhooks › event «Order payment», JSON format.")}</p>
          <CopyField value={data.webhookUrl} />
        </Fold>
        <Fold className="ac-card sh-secrets" title={t("Segreti", "Secrets")} summary={secrets.every((i) => i.source !== "assente") ? t("tutti impostati", "all set") : t("mancano", "missing")}>
          <p className="hint">{t("Nel file .env del server, mai qui.", "In the server's .env file, never here.")}</p>
          <ul>
            {secrets.map((i) => (
              <li key={i.key} className={i.source === "assente" ? "is-missing" : "is-ok"}>
                <span aria-hidden="true">{i.source === "assente" ? "!" : "✓"}</span>
                <code>{i.key === "storefrontToken" ? "SHOPIFY_STOREFRONT_TOKEN" : "SHOPIFY_WEBHOOK_SECRET"}</code>
                <small>{i.source === "assente" ? t("mancante", "missing") : t("impostato", "set")}</small>
              </li>
            ))}
          </ul>
        </Fold>
      </div>
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
    <div className="sh-copy">
      <code title={value}>{value}</code>
      <button type="button" onClick={copy} aria-label={copied ? t("Copiato", "Copied") : t("Copia", "Copy")}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}</button>
    </div>
  );
}
