"use client";

import type { ReactNode } from "react";
import "./checkbox.css";

// Casella di spunta dell'interfaccia: sostituisce la checkbox nativa del browser.
// È un pulsante con ruolo checkbox, così funziona con mouse, tastiera e lettori di schermo, e non annida etichette.
export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      className={`ck${checked ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ck-box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
      </span>
      {label !== undefined && <span className="ck-text">{label}</span>}
    </button>
  );
}
