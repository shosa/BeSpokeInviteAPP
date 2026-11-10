// Ricerca di indirizzi reali (OpenStreetMap, Nominatim, senza chiave). Usata dal campo indirizzo del builder
// e dall'assistente, che non può inventare un indirizzo: prende quelli che questa ricerca restituisce.
// I risultati restano in cache per dieci minuti.

const CACHE_MS = 600_000;
const cache = new Map<string, { at: number; results: string[] }>();

export async function searchPlaces(query: string): Promise<string[]> {
  const q = query.trim().slice(0, 200);
  if (q.length < 3) return [];
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;
  let results: string[] = [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=it&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "InviteMe/1.0 (https://app.thebespokeinvite.com)" },
    });
    const list = (await res.json()) as { display_name?: string }[];
    results = list.map((x) => x.display_name ?? "").filter(Boolean);
  } catch {
    results = [];
  }
  cache.set(q, { at: Date.now(), results });
  return results;
}

// Un solo luogo con coordinate, per il meteo. Stessa fonte e stessa cache della ricerca.
export async function geocodeOne(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const q = query.trim().slice(0, 200);
  if (q.length < 3) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=it&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "InviteMe/1.0 (https://app.thebespokeinvite.com)" },
    });
    const list = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
    const hit = list[0];
    if (!hit?.lat || !hit?.lon) return null;
    return { lat: Number(hit.lat), lon: Number(hit.lon), name: hit.display_name ?? q };
  } catch {
    return null;
  }
}
