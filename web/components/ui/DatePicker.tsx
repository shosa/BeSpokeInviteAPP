"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import "./datepicker.css";

// Data con un componente nostro, non il selettore di sistema: campo gg/mm/aaaa (le barre si mettono da sole)
// e calendario con lo stile del sito. Valore in formato ISO (aaaa-mm-gg), vuoto se non scelto.
// inline: il calendario resta aperto sotto il campo (wizard); altrimenti si apre al tocco dell'icona.

const COPY = {
  it: { months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"], days: ["L", "M", "M", "G", "V", "S", "D"], prevM: "Mese precedente", nextM: "Mese successivo", prevY: "Anno precedente", nextY: "Anno successivo", open: "Apri il calendario", today: "Oggi", locale: "it-IT", placeholder: "gg/mm/aaaa", invalid: "Data non valida" },
  en: { months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], days: ["M", "T", "W", "T", "F", "S", "S"], prevM: "Previous month", nextM: "Next month", prevY: "Previous year", nextY: "Next year", open: "Open calendar", today: "Today", locale: "en-GB", placeholder: "dd/mm/yyyy", invalid: "Invalid date" },
};

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function parseIso(v: string): { y: number; m: number; d: number } | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!r) return null;
  const y = +r[1], m = +r[2] - 1, d = +r[3];
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d ? { y, m, d } : null;
}
const isoToText = (v: string) => { const p = parseIso(v); return p ? `${pad(p.d)}/${pad(p.m + 1)}/${p.y}` : ""; };
function textToIso(t: string): string | null {
  const r = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!r) return null;
  const iso = `${r[3]}-${r[2]}-${r[1]}`;
  return parseIso(iso) ? iso : null;
}
// Mentre si scrive: solo cifre, barre dopo giorno e mese.
function mask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join("/");
}

export function DatePicker({ value, onChange, label, lang = "it", inline = false, autoFocus, id }: { value: string; onChange: (iso: string) => void; label: string; lang?: "it" | "en"; inline?: boolean; autoFocus?: boolean; id?: string }) {
  const T = COPY[lang];
  const [text, setText] = useState(isoToText(value));
  const [open, setOpen] = useState(inline);
  const today = useMemo(() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }, []);
  const sel = parseIso(value);
  const [view, setView] = useState(() => (sel ? { y: sel.y, m: sel.m } : { y: today.y, m: today.m }));
  const [focusDay, setFocusDay] = useState<number>(sel?.d ?? today.d);
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  // Valore cambiato da fuori: aggiorna il testo e il mese mostrato.
  useEffect(() => {
    setText(isoToText(value));
    const p = parseIso(value);
    if (p) { setView({ y: p.y, m: p.m }); setFocusDay(p.d); }
  }, [value]);

  // Chiusura del calendario a comparsa: clic fuori o Esc.
  useEffect(() => {
    if (inline || !open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [inline, open]);

  // Dopo un tasto freccia il fuoco segue il giorno.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, view]);

  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // lunedì per primo
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  function shift(months: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + months, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    setFocusDay((d) => Math.min(d, 28));
  }

  function pick(d: number) {
    onChange(toIso(view.y, view.m, d));
    setFocusDay(d);
    if (!inline) setOpen(false);
  }

  function onGridKey(e: React.KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      const dt = new Date(view.y, view.m, focusDay + step[e.key]);
      moveFocus.current = true;
      setView({ y: dt.getFullYear(), m: dt.getMonth() });
      setFocusDay(dt.getDate());
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      moveFocus.current = true;
      shift(e.key === "PageUp" ? -1 : 1);
    } else if (e.key === "Escape" && !inline) {
      setOpen(false);
    }
  }

  const invalid = text.length === 10 && !textToIso(text);
  const long = sel ? new Date(sel.y, sel.m, sel.d, 12).toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className={`dp${inline ? " is-inline" : ""}`} ref={box}>
      <label className="demo-field dp-field" htmlFor={id}>
        <span>{label}</span>
        <span className="dp-input">
          <input
            id={id}
            value={text}
            inputMode="numeric"
            placeholder={T.placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              const t = mask(e.target.value);
              setText(t);
              const iso = textToIso(t);
              if (iso) onChange(iso);
              else if (!t) onChange("");
            }}
          />
          {!inline && (
            <button type="button" className="dp-open" aria-label={T.open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <CalendarDays size={18} aria-hidden="true" />
            </button>
          )}
        </span>
      </label>
      <p className={`dp-long${invalid ? " is-error" : ""}`} aria-live="polite">{invalid ? T.invalid : long}</p>

      {open && (
        <div className="dp-cal" role="dialog" aria-label={label}>
          <div className="dp-head">
            <button type="button" className="dp-nav" aria-label={T.prevY} onClick={() => shift(-12)}><ChevronsLeft size={16} aria-hidden="true" /></button>
            <button type="button" className="dp-nav" aria-label={T.prevM} onClick={() => shift(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
            <strong className="dp-title" aria-live="polite">{T.months[view.m]} {view.y}</strong>
            <button type="button" className="dp-nav" aria-label={T.nextM} onClick={() => shift(1)}><ChevronRight size={16} aria-hidden="true" /></button>
            <button type="button" className="dp-nav" aria-label={T.nextY} onClick={() => shift(12)}><ChevronsRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="dp-week" aria-hidden="true">{T.days.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="dp-grid" role="grid" ref={grid} onKeyDown={onGridKey}>
            {cells.map((d, i) => {
              if (d === null) return <span key={`x${i}`} className="dp-empty" />;
              const isSel = !!sel && sel.y === view.y && sel.m === view.m && sel.d === d;
              const isToday = today.y === view.y && today.m === view.m && today.d === d;
              const full = new Date(view.y, view.m, d, 12).toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  data-day={d}
                  tabIndex={d === focusDay ? 0 : -1}
                  aria-selected={isSel}
                  aria-label={`${full}${isToday ? ` (${T.today})` : ""}`}
                  className={`dp-day${isSel ? " is-sel" : ""}${isToday ? " is-today" : ""}`}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
