"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ThemeManifest } from "@inviteme/shared";
import { themeCopy, themeDescCopy } from "@/lib/catalogCopy";
import { ui, type Lang } from "@/lib/ui";

// Tempo tra una diapositiva e la successiva, e pausa dopo un'interazione dell'utente.
const STEP_MS = 3800;
const RESUME_MS = 6000;

// Carosello dei template pre-fatti: ogni template è un telefono con l'immagine statica della busta chiusa.
// Niente pagine vere qui (troppo pesanti tutte insieme): l'invito completo si vede con «Anteprima».
// Si sceglie toccando il telefono: niente pulsanti con il nome.
export function TemplateCarousel({ templates, selectedId, onSelect, label, lang = "it", size = "md", autoplay = true }: { templates: ThemeManifest[]; selectedId: string; onSelect: (id: string) => void; label: string; lang?: Lang; size?: "md" | "lg"; autoplay?: boolean }) {
  const L = ui(lang).builder;
  const track = useRef<HTMLDivElement>(null);
  // Immagini da caricare: la scelta e le vicine subito, le altre quando entrano nel carosello.
  // Il caricamento nativo (loading="lazy") nel carosello orizzontale non le caricava affatto.
  const [ready, setReady] = useState<Set<string>>(() => new Set());
  // Stato di pausa letto dal timer: tenuto in un ref, così il timer non si riavvia a ogni passaggio del mouse.
  const pause = useRef({ hover: false, focus: false, until: 0 });
  // Template al centro del carosello: il contatore segue lo scorrimento, non solo il tocco.
  const [centerIdx, setCenterIdx] = useState(() => Math.max(0, templates.findIndex((t) => t.id === selectedId)));
  // Scorrimento fatto con il dito: quando si ferma, il template al centro diventa quello scelto.
  const swiping = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let timer = 0;
    const centered = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      el.querySelectorAll<HTMLElement>(".tpl-card").forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    };
    const onScroll = () => {
      setCenterIdx(centered());
      window.clearTimeout(timer);
      // Fine dello scorrimento (anche dopo lo scatto sul template): si sceglie quello al centro.
      timer = window.setTimeout(() => {
        if (!swiping.current) return;
        swiping.current = false;
        const t = templates[centered()];
        if (t && t.id !== selectedRef.current) onSelect(t.id);
      }, 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); window.clearTimeout(timer); };
  }, [templates, onSelect]);

  useEffect(() => {
    const idx = templates.findIndex((t) => t.id === selectedId);
    const near = templates.slice(Math.max(0, idx - 2), idx + 3).map((t) => t.id);
    setReady((prev) => new Set([...prev, ...near]));
  }, [selectedId, templates]);

  useEffect(() => {
    const el = track.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setReady(new Set(templates.map((t) => t.id)));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const ids = entries.filter((e) => e.isIntersecting).map((e) => (e.target as HTMLElement).dataset.id ?? "");
        if (ids.length) setReady((prev) => new Set([...prev, ...ids]));
      },
      { root: el, rootMargin: "0px 400px" },
    );
    el.querySelectorAll<HTMLElement>(".tpl-card").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [templates]);

  // Scorrimento automatico avanti e indietro: va verso destra fino in fondo, poi torna verso sinistra fino all'inizio, senza salti.
  // Si ferma se l'utente lo tocca, lo sfiora o ha il focus.
  const dir = useRef<1 | -1>(1);
  useEffect(() => {
    const el = track.current;
    if (!el || templates.length < 2 || !autoplay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const p = pause.current;
      if (document.hidden || p.hover || p.focus || Date.now() < p.until) return;
      const cards = el.querySelectorAll<HTMLElement>(".tpl-card");
      const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
      if (!step) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      if (dir.current === 1 && el.scrollLeft >= max - 4) dir.current = -1;
      else if (dir.current === -1 && el.scrollLeft <= 4) dir.current = 1;
      el.scrollBy({ left: dir.current * step, behavior: "smooth" });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [templates, autoplay]);

  // Quando cambia il template scelto, il carosello si posiziona su di lui. All'apertura lo centra subito.
  const firstPlace = useRef(true);
  useEffect(() => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(".tpl-card.is-on");
    if (!el || !card) return;
    // Se la scelta è già visibile non si sposta nulla: il carosello resta dove l'utente lo sta guardando.
    const visible = card.offsetLeft >= el.scrollLeft && card.offsetLeft + card.offsetWidth <= el.scrollLeft + el.clientWidth;
    const first = firstPlace.current;
    firstPlace.current = false;
    if (visible && !first) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: first ? "auto" : "smooth" });
  }, [selectedId]);

  function holdAutoplay() {
    pause.current.until = Date.now() + RESUME_MS;
  }

  function scrollBy(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    holdAutoplay();
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollBy(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollBy(-1); }
  }

  return (
    <div
      className={`tpl-carousel${size === "lg" ? " is-lg" : ""}`}
      role="region"
      aria-roledescription="carosello"
      aria-label={label}
      onPointerEnter={() => { pause.current.hover = true; }}
      onPointerLeave={() => { pause.current.hover = false; }}
      onFocus={() => { pause.current.focus = true; }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pause.current.focus = false; }}
    >
      <div
        className="tpl-track"
        ref={track}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={holdAutoplay}
        onTouchStart={() => { holdAutoplay(); swiping.current = true; }}
        onWheel={holdAutoplay}
      >
        {templates.map((t, i) => {
          const on = t.id === selectedId;
          const name = themeCopy(t.id, t.name, lang);
          return (
            <article key={t.id} data-id={t.id} className={`tpl-card${on ? " is-on" : ""}`} aria-roledescription="diapositiva" aria-label={`${i + 1} / ${templates.length}: ${name}`}>
              <div className="tpl-phone">
                <div className="tpl-screen" style={{ background: t.themeColor }}>
                  {t.envelope?.poster && ready.has(t.id) && (
                    <img src={`/api/themes/${encodeURIComponent(t.id)}/cover.jpg`} alt="" width={480} height={853} decoding="async" draggable={false} />
                  )}
                </div>
                <button type="button" className="tpl-hit" aria-pressed={on} aria-label={`${name}: ${L.tplUse}`} title={on ? L.tplChosen : L.tplUse} onClick={() => onSelect(t.id)} />
              </div>
              <div className="tpl-meta">
                <h3>{name}</h3>
                {on && <span className="tpl-chosen">{L.tplChosen}</span>}
                <p>{themeDescCopy(t.id, t.description, lang)}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="tpl-nav">
        <button type="button" className="btn outline small" aria-label={L.tplPrev} onClick={() => scrollBy(-1)}>←</button>
        <span className="tpl-count" aria-live="polite">{centerIdx + 1} / {templates.length}</span>
        <button type="button" className="btn outline small" aria-label={L.tplNext} onClick={() => scrollBy(1)}>→</button>
      </div>
    </div>
  );
}
