"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Modalità demo (DEMO_MODE=true senza Shopify): crea un invito di prova senza pagamento e apre il builder.
export function DemoCreate({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = (await res.json().catch(() => ({}))) as { invitationId?: string; error?: string };
      if (!res.ok || !data.invitationId) throw new Error(data.error ?? "Non è stato possibile creare l'invito di prova");
      router.push(`/editor/${data.invitationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn solid" disabled={busy} onClick={create}>{busy ? "…" : label}</button>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
