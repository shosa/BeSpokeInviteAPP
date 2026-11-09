import { pool } from "./db";

// Testi e aspetto delle email, modificabili dalla console. Ogni tipo di email ha un modello predefinito;
// la console salva solo le modifiche (tabella settings, chiave 'mail_templates'). Nei testi si usano le variabili {{nome}}.

export const MAIL_KINDS = ["access", "purchase", "order", "rsvp", "invite"] as const;
export type MailTemplateKind = (typeof MAIL_KINDS)[number];
export type MailTemplate = { subject: string; title: string; body: string; button: string; footer: string };
export type MailVars = Partial<Record<"link" | "title" | "hosts" | "amount" | "verdict", string>>;

export const MAIL_VARIABLES: Record<MailTemplateKind, string[]> = {
  access: ["link"],
  purchase: ["link"],
  order: ["title", "amount", "link"],
  rsvp: ["title", "verdict", "link"],
  invite: ["title", "hosts", "link"],
};

export const MAIL_LABELS: Record<MailTemplateKind, string> = {
  access: "Link di accesso",
  purchase: "Acquisto confermato (Shopify)",
  order: "Pagamento ricevuto",
  rsvp: "Avviso di risposta",
  invite: "Invito agli ospiti",
};

export const MAIL_TEMPLATE_DEFAULTS: Record<MailTemplateKind, MailTemplate> = {
  access: {
    subject: "Il tuo link per entrare in Bespoke Invites",
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
  invite: {
    subject: "Invito: {{title}}",
    title: "{{hosts}} vi invitano",
    body: "Trovate qui tutti i dettagli di {{title}}, il programma e il modulo per confermare la presenza.",
    button: "Apri l'invito",
    footer: "",
  },
};

const LIMITS: Record<keyof MailTemplate, number> = { subject: 150, title: 120, body: 1000, button: 40, footer: 300 };
const isKind = (k: unknown): k is MailTemplateKind => typeof k === "string" && (MAIL_KINDS as readonly string[]).includes(k);

let stored: Partial<Record<MailTemplateKind, Partial<MailTemplate>>> = {};

export function getMailTemplate(kind: MailTemplateKind): MailTemplate {
  return { ...MAIL_TEMPLATE_DEFAULTS[kind], ...(stored[kind] ?? {}) };
}

export function getAllMailTemplates() {
  return MAIL_KINDS.map((kind) => ({
    kind,
    label: MAIL_LABELS[kind],
    variables: MAIL_VARIABLES[kind],
    current: getMailTemplate(kind),
    defaults: MAIL_TEMPLATE_DEFAULTS[kind],
  }));
}

// Sostituisce le variabili {{nome}}. Quelle senza valore diventano vuote, così non esce mai una parentesi graffa.
export function fillTemplate(text: string, vars: MailVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k as keyof MailVars] ?? "");
}

export type MailTemplateValidation = { ok: true; value: MailTemplate } | { ok: false; error: string };

export function validateMailTemplate(input: unknown): MailTemplateValidation {
  const src = (input ?? {}) as Record<string, unknown>;
  const value = { ...MAIL_TEMPLATE_DEFAULTS.invite } as MailTemplate;
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
    const v = raw[kind];
    if (v && typeof v === "object") {
      const checked = validateMailTemplate({ ...MAIL_TEMPLATE_DEFAULTS[kind], ...(v as object) });
      if (checked.ok) stored[kind] = checked.value;
    }
  }
}

// Salva un modello, oppure lo riporta al predefinito con reset.
export async function saveMailTemplate(kind: MailTemplateKind, template: MailTemplate | null): Promise<void> {
  const next = { ...stored };
  if (template) next[kind] = template;
  else delete next[kind];
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('mail_templates', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(next)],
  );
  stored = next;
}

export const isMailKind = isKind;
