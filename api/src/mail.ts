import { pool } from "./db";
import { fromAddress, getMailSettings, recordMailResult, resendKey, type MailKind } from "./mailSettings";
import { fillTemplate, getMailTemplate, type MailTemplate, type MailTemplateKind, type MailVars } from "./mailTemplates";

// Posta transazionale. Con RESEND_API_KEY invia davvero; senza, salva nella tabella outbox
// (visibile in sviluppo su /api/dev/outbox), così il flusso è verificabile senza credenziali.
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type MailMessage = { to: string; subject: string; html: string; text: string };

// Invio di una email. Con RESEND_API_KEY parte davvero; senza, va nella tabella outbox.
// Gli interruttori della console decidono quali tipi partono: un tipo spento viene saltato senza errore,
// tranne gli inviti agli ospiti, che l'API rifiuta prima di cominciare.
export class MailDisabledError extends Error {}

export async function sendMail(msg: MailMessage, kind: MailKind = "other"): Promise<void> {
  const s = getMailSettings();
  if (kind === "invite" && !s.sendInvites) throw new MailDisabledError("L'invio degli inviti via email è disattivato nella console");
  if (kind === "rsvp" && !s.notifyRsvp) return;
  if (kind === "order" && !s.orderConfirm) return;
  const key = resendKey();
  try {
    if (key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress(),
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
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

function shell(title: string, body: string, footer?: string): string {
  const accent = getMailSettings().accent;
  return `<!doctype html><html lang="it"><body style="margin:0;padding:0;background:#fdfbf7;font-family:Georgia,'Times New Roman',serif;color:#2a2119">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7;padding:36px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e9dcc6;border-radius:22px;padding:40px 40px 34px">
<tr><td>
<p style="margin:0 0 6px;font:600 11px Arial,Helvetica,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:${accent}">Bespoke Invites</p>
<div style="height:1px;background:#e9dcc6;margin:14px 0 26px"></div>
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
  const copy = kind === "invite" && link ? `<p style="margin:18px 0 0;font:13px/1.6 Arial,Helvetica,sans-serif;color:#7b6a57;word-break:break-all">Oppure copia questo link: <a href="${esc(link)}" style="color:#8a6427">${esc(link)}</a></p>` : "";
  const html = shell(esc(title), paragraphs(body) + (link ? button(link, button_) : "") + copy, footer || undefined);
  return { subject: fillTemplate(t.subject, vars), html, text: [title, body, link].filter(Boolean).join(". ").replace(/\.\s\./g, ".") };
}

export function inviteEmail(p: { to: string; hosts: string; title: string; slug: string; personal?: string }): MailMessage {
  const link = `${appUrl()}/i/${p.slug}`;
  const t = getMailTemplate("invite");
  // Il messaggio personale scritto per l'invito sostituisce il corpo del modello.
  const m = renderMail("invite", p.personal ? { ...t, body: p.personal } : t, { link, title: p.title, hosts: p.hosts });
  return { to: p.to, subject: m.subject, html: m.html, text: m.text };
}

export function rsvpNoticeEmail(p: { to: string; title: string; attending: boolean; invitationId: string }): MailMessage {
  const link = `${appUrl()}/invito/${p.invitationId}`;
  const m = renderMail("rsvp", getMailTemplate("rsvp"), { link, title: p.title, verdict: p.attending ? "parteciperà" : "non potrà partecipare" });
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
