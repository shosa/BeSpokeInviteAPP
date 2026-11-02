import { cookies } from "next/headers";

// Chiamate lato server (Server Components): raggiungono l'API nella rete interna e inoltrano la sessione.
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiServer<T>(path: string): Promise<T> {
  const jar = await cookies();
  const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await fetch(`${API}${path}`, { headers: cookie ? { cookie } : {}, cache: "no-store" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? `Errore ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiPublic<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, `Errore ${res.status}`);
  return (await res.json()) as T;
}

// Risposta HTML dell'API (pagina invito): null se non esiste.
export async function apiPublicHtml(path: string): Promise<string | null> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, `Errore ${res.status}`);
  return res.text();
}

// Chiamata POST lato server senza sessione: restituisce la risposta intera, con gli eventuali cookie da inoltrare.
export async function apiPublicPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
}
