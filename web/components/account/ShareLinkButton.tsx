"use client";

import { useState, type ReactNode } from "react";
import { ShareSheet } from "@/components/share/ShareSheet";
import { useLang } from "@/lib/lang";

// «Condividi» di un invito nell'area cliente: il nostro pannello con il QR code, che porta anche a quello del sistema.
export function ShareLinkButton({ path, title, label, className, icon }: { path: string; title: string; label: string; copiedLabel?: string; className?: string; icon?: ReactNode }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{icon}{label}</button>
      {open && <ShareSheet url={`${window.location.origin}${path}`} title={title} lang={lang === "en" ? "en" : "it"} onClose={() => setOpen(false)} />}
    </>
  );
}
