export const dynamic = "force-dynamic";
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

// Pagina dell'invito della demo, generata dal motore dell'API. ?cover=0 senza busta, ?lang=it|en.
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const notFound = () => new Response("Pagina non trovata", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
  if (!/^[a-z]{1,20}$/.test(key)) return notFound();
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") === "en" ? "en" : "it";
  const cover = q.get("cover") === "0" ? "0" : "1";
  const res = await fetch(`${API}/api/showcase/${key}/page?lang=${lang}&cover=${cover}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return notFound();
  return new Response(await res.text(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
