"use client";

import { AddressField } from "./AddressField";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { emptyValue, type Catalog, type FieldDef } from "@inviteme/shared";
import { Search, Upload } from "lucide-react";
import { Accordion } from "../ui/Accordion";
import { PixabayDialog, useStockInvitation } from "./PixabayDialog";

export type Values = Record<string, unknown>;
export type MediaKind = "photo" | "video" | "audio";

// Un campo del tema: il tipo decide l'editor. Le liste ripetono gli editor dei campi della singola voce.
// Colori predefiniti come nel riferimento: si sceglie con un tocco, il selettore libero resta sotto.
const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Nero classico", hex: "#1D1B19" },
  { name: "Marrone classico", hex: "#5C4632" },
  { name: "Oro elegante", hex: "#B98D5F" },
  { name: "Bordeaux profondo", hex: "#5A1B23" },
  { name: "Blu navy", hex: "#1F2F4D" },
  { name: "Verde foresta", hex: "#1F3127" },
  { name: "Carbone", hex: "#3A3A3A" },
  { name: "Oro rosa", hex: "#C9988A" },
  { name: "Bianco puro", hex: "#FFFFFF" },
  { name: "Crema morbida", hex: "#F4EDE2" },
];

export function FieldEditor({
  field,
  value,
  disabledByFeature,
  busy,
  library,
  onChange,
  onUpload,
  copy,
  standard,
  addon,
}: {
  field: FieldDef;
  value: unknown;
  disabledByFeature: boolean;
  busy: string | null;
  library: Catalog["music"];
  onChange: (v: unknown) => void;
  onUpload: (kind: "photo" | "video" | "audio", file: File) => Promise<string | null>;
  copy?: (key: string, label: string) => string;
  standard?: string; // etichetta della scelta «predefinito» per colori e opzioni
  addon?: ReactNode; // controllo accanto al testo, dentro lo stesso campo (es. il pulsante del font)
}) {
  const fieldLabel = copy ? copy(field.key, field.label) : field.label;
  if (field.key === "address") return <AddressField label={fieldLabel} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} />;
  const label = field.required ? `${fieldLabel} *` : fieldLabel;
  if (disabledByFeature) {
    return <p className="hint">{label}: disponibile con la funzione «{field.feature}». Attivala nella scheda Funzioni.</p>;
  }
  const max = field.max;
  const text = typeof value === "string" ? value : "";

  switch (field.type) {
    case "text":
      return textField(label, <input aria-label={label} value={text} maxLength={max ?? 200} onChange={(e) => onChange(e.target.value)} />, addon);
    case "longtext":
      return textField(label, <textarea aria-label={label} rows={4} maxLength={max ?? 1500} value={text} onChange={(e) => onChange(e.target.value)} />, addon);
    case "color": {
      const clearLabel = copy ? copy("transparent", "Trasparente") : "Trasparente";
      return (
        <Field label={label}>
          <div className="swatches" role="group" aria-label={label}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`swatch${text.toLowerCase() === c.hex.toLowerCase() ? " is-on" : ""}`}
                style={{ background: c.hex }}
                title={c.name}
                aria-label={c.name}
                aria-pressed={text.toLowerCase() === c.hex.toLowerCase()}
                onClick={() => onChange(c.hex)}
              />
            ))}
            <button
              type="button"
              className={`swatch swatch-clear${text === "transparent" ? " is-on" : ""}`}
              title={clearLabel}
              aria-label={clearLabel}
              aria-pressed={text === "transparent"}
              onClick={() => onChange("transparent")}
            />
          </div>
          <div className="color-row">
            <input type="color" aria-label={label} value={text || "#ffffff"} onChange={(e) => onChange(e.target.value)} />
            <button type="button" className="link" disabled={!text} onClick={() => onChange("")}>{standard ?? "Default"}</button>
          </div>
        </Field>
      );
    }
    case "choice":
      return (
        <Field label={label}>
          <select value={text} onChange={(e) => onChange(e.target.value)}>
            <option value="">{standard ?? "Default"}</option>
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{copy ? copy(`${field.key}.${o.value}`, o.label) : o.label}</option>)}
          </select>
        </Field>
      );
    case "date":
      return <Field label={label}><input type="date" value={text} onChange={(e) => onChange(e.target.value)} /></Field>;
    case "time":
      return <Field label={label}><input type="time" value={text} onChange={(e) => onChange(e.target.value)} /></Field>;
    case "number":
      return <Field label={label}><input type="number" min={0} max={max ?? 1000} value={typeof value === "number" ? value : 0} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
    case "url":
      return <Field label={label} wide><input type="url" value={text} onChange={(e) => onChange(e.target.value.trim())} /></Field>;
    case "toggle":
      return (
        <Field label={label}>
          <label className={`bl-switch${value === true ? " is-on" : ""}`}>
            <input type="checkbox" role="switch" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
            <span className="bl-switch-track" aria-hidden="true"><span className="bl-switch-knob" /></span>
          </label>
        </Field>
      );
    case "photo":
      return <MediaSlot label={label} help={field.help} kind="photo" url={text} busy={busy} onUpload={onUpload} onChange={onChange} />;
    case "video":
      return <MediaSlot label={label} help={field.help} kind="video" url={text} busy={busy} onUpload={onUpload} onChange={onChange} />;
    case "audio":
      return (
        <div className="stack">
          <MediaSlot label={label} help={field.help} kind="audio" url={text} busy={busy} onUpload={onUpload} onChange={onChange} />
          {library.length > 0 && (
            <div className="tracks" role="radiogroup" aria-label="Brano dalla libreria">
              {library.map((t) => (
                <label key={t.id} className={`track${text === t.url ? " is-on" : ""}`}>
                  <input type="radio" name={`lib-${field.key}`} checked={text === t.url} onChange={() => onChange(t.url)} />
                  <span><b>{t.title}</b><small>{t.artist || "Libreria Bespoke Invites"}</small></span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    case "photos": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      const room = (max ?? 6) - list.length;
      return (
        <div className="stack">
          <p className="hint">{label} · fino a {max ?? 6}</p>
          <div className="thumbs">
            {list.map((src, i) => (
              <div key={src} className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Foto ${i + 1}`} />
                <button type="button" aria-label={`Rimuovi foto ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          {room > 0 && (
            <UploadButton kind="photo" busy={busy} multiple onFiles={async (files) => {
              const urls: string[] = [];
              for (const f of files.slice(0, room)) {
                const url = await onUpload("photo", f);
                if (url) urls.push(url);
              }
              if (urls.length) onChange([...list, ...urls]);
            }} />
          )}
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as Values[]) : [];
      return (
        <div className="stack">
          <p className="hint">{label}{max ? ` · fino a ${max} voci` : ""}</p>
          {items.map((item, i) => (
            <Accordion key={i} title={String(item[field.item?.[0]?.key ?? ""] || `Voce ${i + 1}`)} summary="" className="card-edit-acc">
              {(field.item ?? []).map((sub) => (
                <FieldEditor
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  disabledByFeature={false}
                  busy={busy}
                  library={library}
                  onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))}
                  onUpload={onUpload}
                  copy={copy}
                />
              ))}
              <button type="button" className="link" onClick={() => onChange(items.filter((_, j) => j !== i))}>Rimuovi voce</button>
            </Accordion>
          ))}
          <button type="button" className="btn outline" disabled={max !== undefined && items.length >= max} onClick={() => onChange([...items, Object.fromEntries((field.item ?? []).map((s) => [s.key, emptyValue(s)]))])}>
            Aggiungi voce
          </button>
        </div>
      );
    }
  }
}

function MediaSlot({ label, help, kind, url, busy, onUpload, onChange }: {
  label: string;
  help?: string;
  kind: "photo" | "video" | "audio";
  url: string;
  busy: string | null;
  onUpload: (kind: "photo" | "video" | "audio", file: File) => Promise<string | null>;
  onChange: (v: unknown) => void;
}) {
  const invitationId = useStockInvitation();
  const [searching, setSearching] = useState(false);
  return (
    <div className="stack">
      <span className="field-label">{label}</span>
      {help && <p className="hint">{help}</p>}
      {url && kind === "photo" && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className="media-preview" src={url} alt="" />
      )}
      {url && kind === "video" && <video className="media-preview" src={url} muted controls playsInline />}
      {url && kind === "audio" && <audio controls preload="none" src={url} />}
      <div className="media-actions">
        <UploadButton kind={kind} busy={busy} onFiles={async (files) => {
          const next = await onUpload(kind, files[0]);
          if (next) onChange(next);
        }} />
        {kind === "photo" && invitationId && (
          <button type="button" className="upload media-stock" onClick={() => setSearching(true)}>
            <span className="upload-inner"><Search size={18} aria-hidden="true" />Cerca su Pixabay</span>
          </button>
        )}
      </div>
      {url && <button type="button" className="link media-remove" onClick={() => onChange("")}>Rimuovi</button>}
      {searching && invitationId && (
        <PixabayDialog invitationId={invitationId} onClose={() => setSearching(false)} onPick={(u) => onChange(u)} />
      )}
    </div>
  );
}

function UploadButton({ kind, busy, multiple, onFiles }: { kind: "photo" | "video" | "audio"; busy: string | null; multiple?: boolean; onFiles: (files: File[]) => Promise<void> }) {
  const accept = kind === "photo" ? "image/*" : kind === "video" ? "video/*" : "audio/*";
  const working = busy === kind;
  return (
    <label className="upload">
      <input type="file" accept={accept} multiple={multiple} disabled={working} onChange={async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length) await onFiles(files);
      }} />
      <span className="upload-inner"><Upload size={18} aria-hidden="true" />{working ? "Converto il file…" : kind === "photo" ? "Carica foto" : kind === "video" ? "Carica video" : "Carica audio"}</span>
    </label>
  );
}

// Campo di testo: con un controllo accanto (il pulsante del font) l'input e il controllo stanno nella stessa riga.
function textField(label: string, control: ReactNode, addon?: ReactNode) {
  if (!addon) return <Field label={label} wide>{control}</Field>;
  return (
    <div className="field wide">
      <span>{label}</span>
      <div className="field-control">
        {control}
        {addon}
      </div>
    </div>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
