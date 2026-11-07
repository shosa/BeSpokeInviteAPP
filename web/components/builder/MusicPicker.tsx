"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Music2, Pause, Play, Upload, VolumeX } from "lucide-react";
import type { MusicTrack } from "@inviteme/shared";

// Scelta della musica di sottofondo, come nel riferimento: elenco a schede, anteprima ascoltabile, brano proprio.
export function MusicPicker({
  lang,
  library,
  value,
  onChange,
  onUpload,
  busy,
}: {
  lang: "it" | "en";
  library: MusicTrack[];
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<string | null>;
  busy: boolean;
}) {
  const en = lang === "en";
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tracks = library.filter((t) => t.enabled);

  useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  // Un solo brano alla volta: la prova di un brano ferma quella precedente.
  function preview(url: string) {
    if (playing === url) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const el = new Audio(url);
    el.onended = () => setPlaying(null);
    el.onerror = () => { setPlaying(null); setError(en ? "The preview could not be played." : "Non è possibile ascoltare l'anteprima."); };
    audio.current = el;
    setError(null);
    el.play().then(() => setPlaying(url)).catch(() => { setPlaying(null); setError(en ? "The preview could not be played." : "Non è possibile ascoltare l'anteprima."); });
  }

  const row = (key: string, selected: boolean, icon: React.ReactNode, title: string, sub: string, action?: React.ReactNode) => (
    <div key={key} className={`mp-row${selected ? " is-on" : ""}`}>
      <span className="mp-ico" aria-hidden="true">{icon}</span>
      <span className="mp-text"><strong>{title}</strong><small>{sub}</small></span>
      {action}
      {selected && <span className="mp-check" aria-hidden="true"><Check size={14} /></span>}
    </div>
  );

  return (
    <div className="mp">
      <h3 className="mp-title">{en ? "Background music" : "Musica di sottofondo"}</h3>
      <p className="mp-lede">{en ? "Choose the music that plays when guests open the invitation. They can mute it at any time." : "Scegli la musica che parte quando gli ospiti aprono l'invito. Possono silenziarla quando vogliono."}</p>

      <button type="button" className={`mp-pick${!value ? " is-on" : ""}`} aria-pressed={!value} onClick={() => { audio.current?.pause(); setPlaying(null); onChange(""); }}>
        <span className="mp-ico" aria-hidden="true"><VolumeX size={16} /></span>
        <span className="mp-text"><strong>{en ? "No audio" : "Nessun audio"}</strong><small>{en ? "Silent invitation" : "Invito silenzioso"}</small></span>
        {!value && <span className="mp-check" aria-hidden="true"><Check size={14} /></span>}
      </button>

      {tracks.map((t) => {
        const on = value === t.url;
        const isPlaying = playing === t.url;
        return (
          <div key={t.id} className={`mp-pick${on ? " is-on" : ""}`} role="radio" aria-checked={on} tabIndex={0}
            onClick={() => onChange(t.url)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(t.url); } }}>
            <span className="mp-ico" aria-hidden="true"><Music2 size={16} /></span>
            <span className="mp-text"><strong>{t.title}</strong><small>{t.artist || (en ? "Bespoke Invites library" : "Libreria Bespoke Invites")}</small></span>
            <button type="button" className={`mp-preview${isPlaying ? " is-playing" : ""}`} aria-label={`${isPlaying ? (en ? "Pause" : "Pausa") : "Preview"} ${t.title}`}
              onClick={(e) => { e.stopPropagation(); preview(t.url); }}>
              {isPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              <span>{isPlaying ? (en ? "Pause" : "Pausa") : "Preview"}</span>
            </button>
            {on && <span className="mp-check" aria-hidden="true"><Check size={14} /></span>}
          </div>
        );
      })}
      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="mp-upload">
        <strong>{en ? "Your own track" : "Un brano tuo"}</strong>
        <small>{en ? "MP3, up to 6 MB" : "MP3, fino a 6 MB"}</small>
        <label className="btn outline small mp-upload-btn">
          <Upload size={14} aria-hidden="true" />{busy ? (en ? "Uploading…" : "Caricamento…") : (en ? "Upload MP3" : "Carica MP3")}
          <input type="file" accept="audio/mpeg,audio/mp3" hidden disabled={busy} onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const url = await onUpload(file);
            if (url) onChange(url);
          }} />
        </label>
      </div>
    </div>
  );
}
