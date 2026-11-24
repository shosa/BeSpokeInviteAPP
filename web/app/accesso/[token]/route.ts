import { apiPublicPost } from "@/lib/api";
import { localRedirect } from "@/lib/redirect";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "inviteme_session";
const cookieOf = (req: Request, name: string) =>
  (req.headers.get("cookie") ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

// Scambia il token con la sessione dell'API e va ai propri inviti. Link non valido o scaduto: area cliente con il messaggio.
async function exchange(token: string) {
  const res = await apiPublicPost("/api/auth/token", { token });
  if (!res.ok) return localRedirect("/account?accesso=scaduto");
  const out = localRedirect("/account");
  const cookie = res.headers.get("set-cookie");
  if (cookie) out.headers.set("set-cookie", cookie);
  return out;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Chi ha già una sessione aperta conferma prima di entrare con il link: un link aperto da un'altra pagina non
// sostituisce in silenzio la sessione con quella di un altro account.
function confirmPage(token: string, en: boolean) {
  const t = (it: string, eng: string) => (en ? eng : it);
  const html = `<!doctype html><html lang="${en ? "en" : "it"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${t("Accedi con il link", "Sign in with the link")}</title></head>
<body style="font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#17242A;background:#fff">
<p>${t("Sei già entrato in Bespoke Invites. Vuoi entrare con l'account di questo link?", "You're already signed in to Bespoke Invites. Do you want to sign in with this link's account?")}</p>
<form method="post" action="/accesso/${escapeHtml(encodeURIComponent(token))}"><button type="submit" style="font:inherit;padding:10px 22px;border:1px solid #17242A;background:#17242A;color:#fff;border-radius:6px;cursor:pointer">${t("Entra con questo link", "Sign in with this link")}</button></form>
<p><a href="/account" style="color:#17242A">${t("Resta nell'account attuale", "Stay in the current account")}</a></p>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (cookieOf(req, SESSION_COOKIE)) return confirmPage(token, cookieOf(req, "lang") === "en");
  return exchange(token);
}

// Conferma dalla pagina qui sopra: solo da una pagina di questo sito (un modulo di un altro sito non apre la sessione).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let sameOrigin = site === "same-origin";
  if (!site && origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }
  if (!sameOrigin) return localRedirect("/account");
  return exchange(token);
}
