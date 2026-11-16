"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/lib/lang";

// Un identificativo lungo: se ne mostra solo l'inizio (il resto al passaggio del mouse) e si copia con un tocco.
export function CopyId({ value, keep = 12 }: { value: string; keep?: number }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const short = value.length > keep + 1 ? `${value.slice(0, keep)}…` : value;
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* appunti non disponibili: l'ID resta leggibile nel titolo */
    }
  }
  return (
    <span className="ac-copyid" title={value}>
      <code>{short}</code>
      <button type="button" onClick={copy} aria-label={copied ? t("Copiato", "Copied") : t(`Copia ${value}`, `Copy ${value}`)}>
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </span>
  );
}
