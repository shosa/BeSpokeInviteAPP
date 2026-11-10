"use client";

import { useEffect } from "react";

// Onda al clic sui pulsanti principali (.btn.solid), come sul sito di vendita. Un solo ascoltatore per tutta la pagina.
export function ButtonRipple() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      const b = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".btn.solid");
      if (!b || b.matches(":disabled")) return;
      const r = b.getBoundingClientRect();
      const d = document.createElement("span");
      d.className = "btn-ripple";
      d.style.left = `${e.clientX - r.left}px`;
      d.style.top = `${e.clientY - r.top}px`;
      b.appendChild(d);
      setTimeout(() => d.remove(), 700);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
