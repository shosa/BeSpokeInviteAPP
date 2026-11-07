"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeManifest } from "@inviteme/shared";
import { TemplateCarousel } from "@/components/TemplateCarousel";

export type PendingPurchase = { id: string; tier: "rsvp" | "premium"; createdAt: string };

// Acquisti pagati su Shopify che non hanno ancora un invito: il cliente sceglie il template in galleria e l'invito nasce da lì.
export function ClaimPurchases({ pending, templates }: { pending: PendingPurchase[]; templates: ThemeManifest[] }) {
  const router = useRouter();
  const [themeId, setThemeId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function claim(orderId: string) {
    setBusy(orderId);
    setError(null);
    const res = await fetch("/api/account/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, themeId }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) return setError(body.error ?? "Attivazione non riuscita");
    router.refresh();
  }

  return (
    <section className="claim" aria-label="Acquisti da attivare">
      <span className="claim-kicker">Acquisti da attivare</span>
      <h2>Scegli il template per il tuo invito</h2>
      <p className="hint">Il pagamento è già andato a buon fine. Scegli il template in galleria: il tuo invito nasce con quello.</p>
      {templates.length > 0 && <TemplateCarousel templates={templates} selectedId={themeId} onSelect={setThemeId} label="Template" lang="it" size="md" />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <ul className="claim-list">
        {pending.map((p) => (
          <li key={p.id}>
            <span>{p.tier === "premium" ? "Invito con planner" : "Invito"} · acquisto del {new Date(p.createdAt).toLocaleDateString("it-IT")}</span>
            <button type="button" className="btn solid small" disabled={busy !== null || !themeId} onClick={() => claim(p.id)}>
              {busy === p.id ? "Attivo…" : "Crea il mio invito con questo template"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
