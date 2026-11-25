import { SHOWCASE_TOKEN } from "@inviteme/shared";

export const dynamic = "force-dynamic";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

// Invito della vetrina generato dal motore dell'API. ?cover=0 senza busta (anteprima nel telefono), ?lang=it|en.
export async function GET(req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const notFound = () => new Response("Pagina non trovata", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
  if (token !== SHOWCASE_TOKEN || !/^[a-z]{1,20}$/.test(key)) return notFound();
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") === "en" ? "en" : "it";
  const cover = q.get("cover") === "0" ? "0" : "1";
  const res = await fetch(`${API}/api/showcase/${token}/${key}/page?lang=${lang}&cover=${cover}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return notFound();
  return new Response(await res.text(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
