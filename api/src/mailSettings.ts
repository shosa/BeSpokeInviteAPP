import { pool } from "./db";

// Impostazioni della posta modificabili dalla console (tabella settings, chiave 'mail').
// La chiave Resend (RESEND_API_KEY) è un segreto: resta nel .env e la console ne mostra solo la presenza.
// Senza chiave, le email finiscono nella tabella outbox (sviluppo e prova).

export type MailSettings = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  sendInvites: boolean; // invio degli inviti agli ospiti
  notifyRsvp: boolean; // avviso al cliente quando un ospite risponde
  orderConfirm: boolean; // conferma al cliente dopo il pagamento
};
export type MailKind = "invite" | "rsvp" | "order" | "test" | "other";
export type MailResult = { at: string; ok: boolean; error?: string; kind: MailKind } | null;

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const MAIL_DEFAULTS: MailSettings = { fromName: "Bespoke Invites", fromEmail: "", replyTo: "", sendInvites: true, notifyRsvp: true, orderConfirm: true };

let stored: Partial<MailSettings> = {};
let lastResult: MailResult = null;

export const resendKey = (): string => (process.env.RESEND_API_KEY ?? "").trim();
export const mailProvider = (): "resend" | "outbox" => (resendKey() ? "resend" : "outbox");

export function getMailSettings(): MailSettings {
  return { ...MAIL_DEFAULTS, ...stored };
}

export const getLastMailResult = (): MailResult => lastResult;

// Indirizzo del mittente: quello della console, altrimenti MAIL_FROM dell'ambiente, altrimenti il mittente di prova di Resend.
export function fromAddress(): string {
  const s = getMailSettings();
  if (s.fromEmail) return `${s.fromName.replace(/[<>"]/g, "")} <${s.fromEmail}>`;
  return process.env.MAIL_FROM ?? "Bespoke Invites <onboarding@resend.dev>";
}

export async function loadMailSettings(): Promise<void> {
  const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('mail', 'mail_status')");
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const v = (byKey.mail ?? {}) as Partial<Record<keyof MailSettings, unknown>>;
  stored = {};
  if (typeof v.fromName === "string") stored.fromName = v.fromName.slice(0, 80);
  if (typeof v.fromEmail === "string" && (v.fromEmail === "" || EMAIL_RE.test(v.fromEmail))) stored.fromEmail = v.fromEmail;
  if (typeof v.replyTo === "string" && (v.replyTo === "" || EMAIL_RE.test(v.replyTo))) stored.replyTo = v.replyTo;
  for (const k of ["sendInvites", "notifyRsvp", "orderConfirm"] as const) if (typeof v[k] === "boolean") stored[k] = v[k] as boolean;
  const st = byKey.mail_status as NonNullable<MailResult> | undefined;
  lastResult = st && typeof st.at === "string" ? st : null;
}

export type MailValidation = { ok: true; value: MailSettings } | { ok: false; error: string };

export function validateMailSettings(input: Partial<Record<keyof MailSettings, unknown>>): MailValidation {
  const fromName = typeof input.fromName === "string" ? input.fromName.trim() : "";
  const fromEmail = typeof input.fromEmail === "string" ? input.fromEmail.trim().toLowerCase() : "";
  const replyTo = typeof input.replyTo === "string" ? input.replyTo.trim().toLowerCase() : "";
  if (!fromName || fromName.length > 80) return { ok: false, error: "Il nome del mittente è obbligatorio (massimo 80 caratteri)" };
  if (/[<>"\r\n]/.test(fromName)) return { ok: false, error: "Il nome del mittente non può contenere <, >, virgolette o a capo" };
  if (fromEmail && !EMAIL_RE.test(fromEmail)) return { ok: false, error: "L'indirizzo del mittente non è valido" };
  if (replyTo && !EMAIL_RE.test(replyTo)) return { ok: false, error: "L'indirizzo per le risposte non è valido" };
  const flag = (k: keyof MailSettings) => input[k] === true;
  return {
    ok: true,
    value: { fromName, fromEmail, replyTo, sendInvites: flag("sendInvites"), notifyRsvp: flag("notifyRsvp"), orderConfirm: flag("orderConfirm") },
  };
}

export async function saveMailSettings(s: MailSettings): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('mail', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(s)],
  );
  stored = { ...s };
}

// Ricorda l'ultimo invio, così la console mostra se la posta funziona davvero.
export async function recordMailResult(result: NonNullable<MailResult>): Promise<void> {
  lastResult = result;
  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('mail_status', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(result)],
  );
}
