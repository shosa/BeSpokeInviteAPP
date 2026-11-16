"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { FONT_LIBRARY, fontStack, fontsStylesheetUrl, type FontCategory, type FontId } from "@inviteme/shared";

const CATEGORY_LABEL: Record<"it" | "en", Record<FontCategory, string>> = {
  it: { serif: "Classici", sans: "Moderni", script: "Calligrafici (per poche parole)" },
  en: { serif: "Classic", sans: "Modern", script: "Script (for a few words)" },
};
const CATEGORIES: FontCategory[] = ["serif", "sans", "script"];

// La libreria si carica una volta sola, così ogni nome nel menu si legge nel suo font.
function ensureFontSheet() {
  if (document.getElementById("inviteme-fonts")) return;
  const link = document.createElement("link");
  link.id = "inviteme-fonts";
  link.rel = "stylesheet";
  link.href = fontsStylesheetUrl();
  document.head.appendChild(link);
}

// Pulsante «Aa» accanto a un testo: apre la libreria dei font e sceglie quello del solo campo.
export function FontButton({ label, value, onChange }: { label: string; value?: string; onChange: (id: FontId | null) => void }) {
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ensureFontSheet();
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id: FontId | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="font-pick" ref={wrap}>
      <button type="button" className={`font-btn${value ? " is-set" : ""}`} aria-label={`${t("Font di", "Font for")} ${label}`} aria-expanded={open} title={t("Cambia font", "Change font")} onClick={() => setOpen((o) => !o)}>
        Aa
      </button>
      {open && (
        <div className="font-menu" role="group" aria-label={`${t("Font di", "Font for")} ${label}`}>
          <button type="button" className="font-opt" aria-pressed={!value} onClick={() => choose(null)}>{t("Predefinito del tema", "Theme default")}</button>
          {CATEGORIES.map((cat) => (
            <div key={cat} className="font-cat-group">
              <p className="font-cat">{CATEGORY_LABEL[lang][cat]}</p>
              {FONT_LIBRARY.filter((f) => f.category === cat).map((f) => (
                <button key={f.id} type="button" className="font-opt" aria-pressed={value === f.id} style={{ fontFamily: fontStack(f.id) }} onClick={() => choose(f.id)}>
                  <span>{f.id}</span>
                  <span className="font-sample" aria-hidden="true">Aa Bb 123</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
