"use client";

import { useEffect, useRef, useState } from "react";

// Indirizzo con suggerimenti mentre si scrive: i luoghi arrivano dal server (/api/geocode, OpenStreetMap),
// dopo una breve pausa di digitazione. Usato nel builder e nel wizard iniziale.
export function AddressField({ label, value, onChange, className = "field wide", placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value);
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const typing = useRef(false);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (!typing.current) return;
    if (text.trim().length < 3) {
      setItems([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, { signal: ctl.signal });
        const data = (await res.json()) as { results?: string[] };
        setItems(data.results ?? []);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text]);

  return (
    <label className={`${className} address-field`}>
      <span>{label}</span>
      <input
        value={text}
        maxLength={200}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-autocomplete="list"
        onChange={(e) => {
          typing.current = true;
          setText(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <ul className="addr-list" role="listbox">
          {items.map((it) => (
            <li key={it}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typing.current = false;
                  setText(it);
                  onChange(it);
                  setOpen(false);
                  setItems([]);
                }}
              >
                {it}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
