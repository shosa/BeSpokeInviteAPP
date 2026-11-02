import { NextResponse } from "next/server";
import { apiPublicPost } from "@/lib/api";

export const dynamic = "force-dynamic";

// Il redirect va all'indirizzo pubblico (dietro nginx l'host della richiesta è quello interno).
function publicUrl(req: Request, path: string) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return new URL(path, `${proto}://${host}`);
}

// Link personale ricevuto dopo l'acquisto: l'API apre la sessione, poi si va ai propri inviti.
// Link non valido o scaduto: si torna all'area cliente con il messaggio.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await apiPublicPost("/api/auth/token", { token });
  if (!res.ok) return NextResponse.redirect(publicUrl(req, "/account?accesso=scaduto"));
  const out = NextResponse.redirect(publicUrl(req, "/account"));
  const cookie = res.headers.get("set-cookie");
  if (cookie) out.headers.set("set-cookie", cookie);
  return out;
}
