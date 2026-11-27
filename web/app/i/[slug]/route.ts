import { cookies } from "next/headers";
import { ApiError, apiPublicHtml } from "@/lib/api";

export const dynamic = "force-dynamic";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

// La pagina invito è generata dal motore dell'API: qui solo la si inoltra, con le stesse intestazioni.
// Invito non (ancora) pubblicato: per un amministratore collegato si mostra l'anteprima admin (sola visualizzazione)
// invece di «Invito non trovato»; per tutti gli altri resta non trovato.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    // Lingua dell'invito: quella scelta dal selettore (?lang=) o, se manca, quella del browser dell'ospite.
    const lang = new URL(req.url).searchParams.get("lang");
    const q = lang && /^[a-z]{2}$/.test(lang) ? `?lang=${lang}` : "";
    const html = await apiPublicHtml(`/api/public/invitations/${encodeURIComponent(slug)}/page${q}`, { "accept-language": req.headers.get("accept-language") ?? "" });
    if (html !== null) return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    const admin = await adminPreview(slug);
    if (admin) return new Response(admin, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
    return new Response("Invito non trovato", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    if (e instanceof ApiError) return new Response("Invito non disponibile", { status: e.status, headers: { "content-type": "text/plain; charset=utf-8" } });
    throw e;
  }
}

async function adminPreview(slug: string): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  if (!cookie) return null;
  const res = await fetch(`${API}/api/admin/invitations/${encodeURIComponent(slug)}/view`, { headers: { cookie }, cache: "no-store" }).catch(() => null);
  return res && res.ok ? res.text() : null;
}
