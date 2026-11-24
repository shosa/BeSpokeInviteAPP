import { localRedirect, safePath } from "@/lib/redirect";

// Imposta la lingua del sito nel cookie e torna alla pagina di provenienza (solo pagine di questo sito).
export async function GET(req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const value = lang === "en" ? "en" : "it";
  let back = "/";
  try {
    const ref = new URL(req.headers.get("referer") ?? "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host && ref.host === host) back = safePath(ref.pathname + ref.search);
  } catch {
    back = "/";
  }
  const res = localRedirect(back, 307);
  res.cookies.set("lang", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
