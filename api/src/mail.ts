import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db";
import { fromAddress, getMailSettings, recordMailResult, resendKey, type MailKind } from "./mailSettings";
import { fillTemplate, getMailTemplate, type MailTemplate, type MailTemplateKind, type MailVars } from "./mailTemplates";

// Posta transazionale. Con RESEND_API_KEY invia davvero; senza, salva nella tabella outbox
// (visibile in sviluppo su /api/dev/outbox), così il flusso è verificabile senza credenziali.
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type MailMessage = { to: string; subject: string; html: string; text: string };

// Logo incorporato nell'email (allegato inline, src="cid:…"): molti client non scaricano le immagini remote,
// e il logo da URL compariva come immagine mancante. Il file è lo stesso servito dal frontend.
const LOGO_CID = "bespoke-logo";
let logoBase64: string | null | undefined;
function inlineLogo(): string | null {
  if (logoBase64 !== undefined) return logoBase64;
  const rel = path.join("web", "public", "brand", "logo-email.png");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(process.cwd(), rel), path.join(process.cwd(), "..", rel), path.join(here, "..", "..", rel)];
  const file = candidates.find((f) => fs.existsSync(f));
  logoBase64 = file ? fs.readFileSync(file).toString("base64") : null;
  return logoBase64;
}

// Invio di una email. Con RESEND_API_KEY parte davvero; senza, va nella tabella outbox.
// Gli interruttori della console decidono quali tipi partono: un tipo spento viene saltato senza errore.
export async function sendMail(msg: MailMessage, kind: MailKind = "other"): Promise<void> {
  const s = getMailSettings();
  if (kind === "rsvp" && !s.notifyRsvp) return;
  if (kind === "order" && !s.orderConfirm) return;
  const key = resendKey();
  try {
    if (key) {
      // Il logo viaggia dentro l'email; senza il file resta l'URL remoto come riserva.
      const logo = msg.html.includes(LOGO_URL()) ? inlineLogo() : null;
      const html = logo ? msg.html.split(LOGO_URL()).join(`cid:${LOGO_CID}`) : msg.html;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress(),
          to: [msg.to],
          subject: msg.subject,
          html,
          text: msg.text,
          ...(logo ? { attachments: [{ content: logo, filename: "logo.png", content_type: "image/png", content_id: LOGO_CID }] } : {}),
          ...(s.replyTo ? { reply_to: s.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Invio email non riuscito (${res.status})`);
    } else {
      await pool.query("INSERT INTO outbox (to_address, subject, html, text) VALUES ($1, $2, $3, $4)", [msg.to, msg.subject, msg.html, msg.text]);
    }
    await recordMailResult({ at: new Date().toISOString(), ok: true, kind });
  } catch (e) {
    const error = (e as Error).message;
    await recordMailResult({ at: new Date().toISOString(), ok: false, error, kind }).catch(() => undefined);
    throw e;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

// Logo delle email: PNG trasparente ritagliato (440 px, mostrato a 220), servito dal frontend.
// L'originale è in web/public/brand/logo.png.
const LOGO_URL = () => `${appUrl()}/brand/logo-email.png`;

function shell(title: string, body: string, footer?: string): string {
  const accent = getMailSettings().accent;
  return `<!doctype html><html lang="it"><body style="margin:0;padding:0;background:#fdfbf7;font-family:Georgia,'Times New Roman',serif;color:#2a2119">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7;padding:36px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e9dcc6;border-radius:22px;overflow:hidden;border-collapse:separate">
<tr><td align="center" style="padding:36px 40px 0">
<a href="${esc(appUrl())}" style="text-decoration:none"><img src="${esc(LOGO_URL())}" width="220" height="181" alt="The Bespoke Invite" style="display:block;width:220px;height:181px;border:0;outline:none;color:${accent};font:400 20px Georgia,'Times New Roman',serif"></a>
<div style="height:1px;background:#e9dcc6;margin:28px 0 0"></div>
</td></tr>
<tr><td style="padding:28px 40px 34px">
<h1 style="margin:0 0 16px;font:400 28px/1.2 Georgia,'Times New Roman',serif;letter-spacing:-.01em;color:#2a2119">${title}</h1>${body}${footer ? `<p style="margin:26px 0 0;font:13px/1.6 Arial,Helvetica,sans-serif;color:#7b6a57">${esc(footer)}</p>` : ""}
</td></tr></table>
<p style="margin:18px 0 0;font:12px Arial,Helvetica,sans-serif;color:#7b6a57">Ricevi questa email perché usi Bespoke Invites.</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:30px 0 8px"><a href="${esc(href)}" style="display:inline-block;background:${getMailSettings().accent};color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font:600 15px Arial,Helvetica,sans-serif;letter-spacing:.01em">${esc(label)}</a></p>`;

const paragraphs = (text: string) =>
  text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font:16px/1.7 Georgia,'Times New Roman',serif;color:#4a3f33">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

// Compone un'email da un modello: stessa funzione per l'invio e per l'anteprima della console.
export function renderMail(kind: MailTemplateKind, t: MailTemplate, vars: MailVars): { subject: string; html: string; text: string } {
  const title = fillTemplate(t.title, vars);
  const body = fillTemplate(t.body, vars);
  const button_ = fillTemplate(t.button, vars);
  const footer = fillTemplate(t.footer, vars);
  const link = vars.link ?? "";
  const html = shell(esc(title), paragraphs(body) + (link ? button(link, button_) : ""), footer || undefined);
  return { subject: fillTemplate(t.subject, vars), html, text: [title, body, link].filter(Boolean).join(". ").replace(/\.\s\./g, ".") };
}

// attending: null quando l'invito non chiede la presenza (allora l'avviso dice solo che l'ospite ha risposto).
export function rsvpNoticeEmail(p: { to: string; title: string; attending: boolean | null; invitationId: string }): MailMessage {
  const link = `${appUrl()}/planner/${p.invitationId}`;
  const m = renderMail("rsvp", getMailTemplate("rsvp"), { link, title: p.title, verdict: p.attending === true ? "parteciperà" : p.attending === false ? "non potrà partecipare" : "ha risposto" });
  return { to: p.to, subject: m.subject, html: m.html, text: m.text };
}

export function orderEmail(p: { to: string; title: string; amount: string; slug: string; link?: string }): MailMessage {
  const link = p.link ?? `${appUrl()}/i/${p.slug}`;
  const m = renderMail("order", getMailTemplate("order"), { link, title: p.title, amount: p.amount });
  return { to: p.to, subject: m.subject, html: m.html, text: m.text };
}

export function resetEmail(p: { to: string; token: string }): MailMessage {
  const link = `${appUrl()}/reset?token=${p.token}`;
  return {
    to: p.to,
    subject: "Reimposta la password di Bespoke Invites",
    html: shell(
      "Reimposta la password",
      `<p style="font:16px/1.6 Arial,sans-serif;color:#4a4640">Hai chiesto di reimpostare la password. Il link vale 60 minuti.</p>${button(link, "Scegli una nuova password")}<p style="font:13px Arial,sans-serif;color:#8a8478">Se non sei stato tu, ignora questa email.</p>`,
    ),
    text: `Reimposta la password: ${link} (valido 60 minuti)`,
  };
}

// Accesso richiesto dal sito: il link personale per entrare.
export function accessEmail(p: { to: string; link: string }): MailMessage {
  const m = renderMail("access", getMailTemplate("access"), { link: p.link });
  return { to: p.to, subject: m.subject, html: m.html, text: m.text };
}

// Email dopo l'acquisto su Shopify: il cliente entra con il link personale e sceglie il template in galleria.
export function purchaseEmail(p: { to: string; link: string }): MailMessage {
  const m = renderMail("purchase", getMailTemplate("purchase"), { link: p.link });
  return { to: p.to, subject: m.subject, html: m.html, text: m.text };
}
