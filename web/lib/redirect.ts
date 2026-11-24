import { NextResponse } from "next/server";

// Redirect relativo (Location: /percorso): il browser resta sull'host pubblico da cui è arrivato, senza fidarsi
// di Host o X-Forwarded-Host. Solo percorsi dello stesso sito: niente «//altro-sito» o «/\altro-sito».
export function safePath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

export function localRedirect(path: string, status = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: safePath(path) } });
}
