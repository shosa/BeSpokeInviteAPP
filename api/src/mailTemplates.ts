import { pool } from "./db";

// Testi e aspetto delle email, modificabili dalla console. Ogni tipo di email ha un modello predefinito;
// la console salva solo le modifiche (tabella settings, chiave 'mail_templates'). Nei testi si usano le variabili {{nome}}.
// Ogni email esiste in italiano e in inglese: si manda nella lingua di chi la riceve. Le modifiche inglesi
// stanno sotto la chiave «tipo:en» (es. "access:en").

export const MAIL_KINDS = ["access", "purchase", "order", "rsvp"] as const;
export type MailTemplateKind = (typeof MAIL_KINDS)[number];
export type MailTemplate = { subject: string; title: string; body: string; button: string; footer: string };
export type MailVars = Partial<Record<"link" | "title" | "amount" | "verdict", string>>;
export type MailLang = "it" | "en";

export const MAIL_VARIABLES: Record<MailTemplateKind, string[]> = {
  access: ["link"],
  purchase: ["link"],
  order: ["title", "amount", "link"],
  rsvp: ["title", "verdict", "link"],
};

export const MAIL_LABELS: Record<MailTemplateKind, string> = {
  access: "Link di accesso",
  purchase: "Acquisto confermato (Shopify)",
  order: "Pagamento ricevuto",
  rsvp: "Avviso di risposta",
};

export const MAIL_TEMPLATE_DEFAULTS: Record<MailTemplateKind, MailTemplate> = {
  access: {
    subject: "Il tuo link per entrare in Bespoke Invite",
    title: "Entra nel tuo account",
    body: "Hai chiesto il link per entrare. Qui trovi i tuoi inviti e la galleria dei template.",
    button: "Entra",
    footer: "Il link è personale: non condividerlo. Se non sei stato tu, ignora questa email.",
  },
  purchase: {
    subject: "Il tuo acquisto è confermato: scegli il template",
    title: "Grazie, il tuo invito è pronto",
    body: "Il pagamento è andato a buon fine. Entra con il link personale: troverai la galleria dei template, scegli quello che ti piace e comincia a personalizzarlo.",
    button: "Entra e scegli il template",
    footer: "Il link è personale: non condividerlo con altri.",
  },
  order: {
    subject: "Pagamento ricevuto: {{title}}",
    title: "Grazie, il tuo invito è attivo",
    body: "Abbiamo ricevuto il pagamento di {{amount}}. Il tuo link è pronto da condividere con gli ospiti.",
    button: "Apri l'invito",
    footer: "",
  },
  rsvp: {
    subject: "Nuova risposta per {{title}}",
    title: "Nuova conferma",
    body: "Un ospite {{verdict}} a {{title}}.",
    button: "Vedi le risposte",
    footer: "",
  },
};

export const MAIL_TEMPLATE_DEFAULTS_EN: Record<MailTemplateKind, MailTemplate> = {
  access: {
    subject: "Your link to sign in to Bespoke Invite",
    title: "Sign in to your account",
    body: "You asked for a sign-in link. Here you'll find your invitations and the template gallery.",
    button: "Sign in",
    footer: "This link is personal: don't share it. If it wasn't you, ignore this email.",
  },
  purchase: {
    subject: "Your purchase is confirmed: choose the template",
    title: "Thank you, your invitation is ready",
    body: "Your payment went through. Sign in with your personal link: you'll find the template gallery, pick the one you like and start customising it.",
    button: "Sign in and choose the template",
    footer: "This link is personal: don't share it with others.",
  },
  order: {
    subject: "Payment received: {{title}}",
    title: "Thank you, your invitation is live",
    body: "We've received your payment of {{amount}}. Your link is ready to share with your guests.",
    button: "Open the invitation",
    footer: "",
  },
  rsvp: {
    subject: "New reply for {{title}}",
    title: "New reply",
    body: "A guest {{verdict}} for {{title}}.",
    button: "See the replies",
    footer: "",
  },
};

// Valore di {{verdict}} nell'avviso di risposta, per lingua.
export function rsvpVerdict(attending: boolean | null, lang: MailLang): string {
  if (lang === "en") return attending === true ? "will attend" : attending === false ? "can't attend" : "has replied";
  return attending === true ? "parteciperà" : attending === false ? "non potrà partecipare" : "ha risposto";
}

const defaultsFor = (lang: MailLang) => (lang === "en" ? MAIL_TEMPLATE_DEFAULTS_EN : MAIL_TEMPLATE_DEFAULTS);
const storeKey = (kind: MailTemplateKind, lang: MailLang) => (lang === "en" ? `${kind}:en` : kind);

const LIMITS: Record<keyof MailTemplate, number> = { subject: 150, title: 120, body: 1000, button: 40, footer: 300 };
const isKind = (k: unknown): k is MailTemplateKind => typeof k === "string" && (MAIL_KINDS as readonly string[]).includes(k);

let stored: Record<string, MailTemplate> = {};

export function getMailTemplate(kind: MailTemplateKind, lang: MailLang = "it"): MailTemplate {
  return { ...defaultsFor(lang)[kind], ...(stored[storeKey(kind, lang)] ?? {}) };
}

export function getAllMailTemplates() {
  return MAIL_KINDS.map((kind) => ({
    kind,
    label: MAIL_LABELS[kind],
    variables: MAIL_VARIABLES[kind],
    current: getMailTemplate(kind),
    defaults: MAIL_TEMPLATE_DEFAULTS[kind],
    currentEn: getMailTemplate(kind, "en"),
    defaultsEn: MAIL_TEMPLATE_DEFAULTS_EN[kind],
  }));
}

// Sostituisce le variabili {{nome}}. Quelle senza valore diventano vuote, così non esce mai una parentesi graffa.
export function fillTemplate(text: string, vars: MailVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k as keyof MailVars] ?? "");
}

export type MailTemplateValidation = { ok: true; value: MailTemplate } | { ok: false; error: string };

export function validateMailTemplate(input: unknown): MailTemplateValidation {
  const src = (input ?? {}) as Record<string, unknown>;
  const value = { ...MAIL_TEMPLATE_DEFAULTS.access } as MailTemplate;
  for (const key of Object.keys(LIMITS) as (keyof MailTemplate)[]) {
    const v = src[key];
    if (typeof v !== "string") return { ok: false, error: `Il campo ${key} non è valido` };
    if (v.length > LIMITS[key]) return { ok: false, error: `Il campo ${key} è troppo lungo (massimo ${LIMITS[key]} caratteri)` };
    value[key] = v.trim();
  }
  if (!value.subject || !value.title || !value.button) return { ok: false, error: "Oggetto, titolo e testo del pulsante sono obbligatori" };
  if (/<\s*script|javascript:/i.test(JSON.stringify(value))) return { ok: false, error: "Il testo non può contenere script o link javascript" };
  return { ok: true, value };
}

export async function loadMailTemplates(): Promise<void> {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'mail_templates'");
  const raw = (rows[0]?.value ?? {}) as Record<string, unknown>;
  stored = {};
  for (const kind of MAIL_KINDS) {
    for (const lang of ["it", "en"] as const) {
      const v = raw[storeKey(kind, lang)];
      if (v && typeof v === "object") {
        const checked = validateMailTemplate({ ...defaultsFor(lang)[kind], ...(v as object) });
        if (checked.ok) stored[storeKey(kind, lang)] = checked.value;
      }
    }
  }
}

// Salva un modello, oppure lo riporta al predefinito con reset.
export async function saveMailTemplate(kind: MailTemplateKind, template: MailTemplate | null, lang: MailLang = "it"): Promise<void> {
  const next = { ...stored };
  if (template) next[storeKey(kind, lang)] = template;
  else delete next[storeKey(kind, lang)];
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('mail_templates', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  stored = next;
}

export const isMailKind = isKind;
