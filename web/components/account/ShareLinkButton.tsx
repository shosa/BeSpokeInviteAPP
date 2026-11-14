"use client";

import { useState } from "react";

// «Condividi» di un invito nell'area cliente: pannello di condivisione del sistema, altrimenti copia il link.
export function ShareLinkButton({ path, title, label, copiedLabel, className }: { path: string; title: string; label: string; copiedLabel: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function go() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(label, url);
    }
  }
  return (
    <button type="button" className={className} onClick={go}>
      {copied ? copiedLabel : label}
      <span className="visually-hidden" role="status">{copied ? copiedLabel : ""}</span>
    </button>
  );
}
