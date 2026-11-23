"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Sezione espandibile della console: al telefono parte chiusa (titolo e riassunto in una riga), al computer aperta.
// mobileOpen: aperta anche al telefono (per la sezione principale di una pagina).
export function Fold({ title, summary, children, mobileOpen = false, className = "", tone }: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  mobileOpen?: boolean;
  className?: string;
  tone?: "danger";
}) {
  const id = useId();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setOpen(mobileOpen);
  }, [mobileOpen]);
  return (
    <section className={`fold${open ? " is-open" : ""}${tone ? ` is-${tone}` : ""} ${className}`}>
      <h3 className="fold-h">
        <button type="button" className="fold-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span className="fold-title">{title}</span>
          {summary != null && summary !== "" && <span className="fold-sum">{summary}</span>}
          <ChevronDown size={18} className="fold-chev" aria-hidden="true" />
        </button>
      </h3>
      <div id={id} className="fold-body" hidden={!open}>{children}</div>
    </section>
  );
}
