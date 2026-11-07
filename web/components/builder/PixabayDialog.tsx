"use client";

import { createContext, useContext, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { importStock, searchStock, type StockFilters, type StockPhoto } from "@/lib/stock";
import { Checkbox } from "@/components/ui/Checkbox";

// L'invito aperto nel builder: serve alla ricerca e all'importazione delle foto.
export const StockContext = createContext<string | null>(null);
export function useStockInvitation(): string | null {
  return useContext(StockContext);
}

type Props = { invitationId: string; onClose: () => void; onPick: (url: string) => void };

const DEFAULT_FILTERS: StockFilters = { type: "all", orientation: "all", order: "popular", editorsChoice: false, minWidth: 0 };

// Le scelte sono quelle dell'API Pixabay; «Sfondo trasparente» è il filtro «transparent».
const COLORS: [string, string][] = [
  ["transparent", "Sfondo trasparente"], ["grayscale", "Bianco e nero"], ["white", "Bianco"], ["black", "Nero"], ["gray", "Grigio"],
  ["red", "Rosso"], ["orange", "Arancio"], ["yellow", "Giallo"], ["green", "Verde"], ["turquoise", "Turchese"],
  ["blue", "Blu"], ["lilac", "Lilla"], ["pink", "Rosa"], ["brown", "Marrone"],
];
const CATEGORIES: [string, string][] = [
  ["backgrounds", "Sfondi"], ["nature", "Natura"], ["places", "Luoghi"], ["buildings", "Edifici"], ["travel", "Viaggi"],
  ["food", "Cibo"], ["people", "Persone"], ["feelings", "Emozioni"], ["business", "Lavoro"], ["animals", "Animali"], ["music", "Musica"],
  ["religion", "Religione"], ["sports", "Sport"], ["fashion", "Moda"], ["education", "Istruzione"], ["science", "Scienza"],
  ["health", "Salute"], ["industry", "Industria"], ["computer", "Tecnologia"], ["transportation", "Trasporti"],
];

// Ricerca di foto su Pixabay dentro l'editor: la foto scelta viene salvata nell'invito, come un upload.
export function PixabayDialog({ invitationId, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<"search" | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(q: string, p: number, f: StockFilters) {
    setBusy("search");
    setError(null);
    try {
      const found = await searchStock(invitationId, q, p, f);
      setPhotos((prev) => (p === 1 ? found : [...prev, ...found]));
      setActive(q);
      setPage(p);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ricerca non riuscita");
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return setError("Scrivi almeno 2 lettere");
    run(q, 1, filters);
  }

  // Cambiare un filtro rifà la ricerca in corso (se c'è), dalla prima pagina.
  function change(next: Partial<StockFilters>) {
    const f = { ...filters, ...next };
    setFilters(f);
    if (active) run(active, 1, f);
  }

  async function pick(photo: StockPhoto) {
    setBusy(photo.id);
    setError(null);
    try {
      onPick(await importStock(invitationId, photo.id));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Importazione non riuscita");
      setBusy(null);
    }
  }

  const filtersOn = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  // Nel portale (body): il pannello del builder ha animazioni con trasformazioni che sposterebbero il modale.
  return createPortal(
    <div className="bl-app bl-layer">
    <div className="bl-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bl-modal stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-title">
        <header className="bl-modal-head">
          <div>
            <h2 id="stock-title">Foto da Pixabay</h2>
            <p className="hint">La foto scelta viene salvata nel tuo invito.</p>
          </div>
          <button type="button" className="bl-icon" aria-label="Chiudi" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <form className="stock-search" onSubmit={onSubmit} role="search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Es. fiori, mare, lanterne" aria-label="Cerca una foto" autoFocus />
          <button className="btn solid" type="submit" disabled={busy !== null}>{busy === "search" ? "Cerco…" : "Cerca"}</button>
        </form>

        <fieldset className="stock-filters" disabled={busy !== null}>
          <legend>Filtri</legend>
          <div className="stock-seg" role="group" aria-label="Tipo di immagine">
            {([["all", "Tutte"], ["photo", "Foto"], ["illustration", "Illustrazioni"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={filters.type === v} onClick={() => change({ type: v })}>{label}</button>
            ))}
          </div>
          <div className="stock-seg" role="group" aria-label="Orientamento">
            {([["all", "Qualsiasi"], ["horizontal", "Orizzontale"], ["vertical", "Verticale"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={filters.orientation === v} onClick={() => change({ orientation: v })}>{label}</button>
            ))}
          </div>
          <div className="stock-grid-filters">
            <label>Colore
              <select value={filters.color ?? ""} onChange={(e) => change({ color: e.target.value || undefined })}>
                <option value="">Qualsiasi colore</option>
                {COLORS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <label>Categoria
              <select value={filters.category ?? ""} onChange={(e) => change({ category: e.target.value || undefined })}>
                <option value="">Tutte le categorie</option>
                {CATEGORIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <label>Dimensione minima
              <select value={filters.minWidth} onChange={(e) => change({ minWidth: Number(e.target.value) })}>
                <option value={0}>Qualsiasi</option>
                <option value={1280}>Almeno 1280 px di larghezza</option>
                <option value={1920}>Almeno 1920 px di larghezza</option>
                <option value={3000}>Almeno 3000 px di larghezza</option>
              </select>
            </label>
            <label>Ordina per
              <select value={filters.order} onChange={(e) => change({ order: e.target.value as StockFilters["order"] })}>
                <option value="popular">Più popolari</option>
                <option value="latest">Più recenti</option>
              </select>
            </label>
          </div>
          <div className="stock-filter-foot">
            <Checkbox className="stock-check" checked={filters.editorsChoice} onChange={(v) => change({ editorsChoice: v })} label="Solo scelte della redazione" />
            {filtersOn && <button type="button" className="link" onClick={() => change(DEFAULT_FILTERS)}>Azzera i filtri</button>}
          </div>
        </fieldset>

        {error && <p className="hint stock-error" role="alert">{error}</p>}
        <div className="stock-results" aria-live="polite">
          {photos.map((p) => (
            <button key={p.id} type="button" className="stock-item" onClick={() => pick(p)} disabled={busy !== null} aria-label={`Usa la foto: ${p.tags}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={p.tags} loading="lazy" />
              {busy === p.id && <span className="stock-wait">Salvo…</span>}
            </button>
          ))}
        </div>
        {searched && photos.length === 0 && busy === null && <p className="hint">Nessuna foto trovata: prova con un'altra parola o meno filtri.</p>}
        {photos.length > 0 && (
          <div className="stock-foot">
            <button type="button" className="link" disabled={busy !== null} onClick={() => run(active, page + 1, filters)}>Altre foto</button>
            <p className="hint">Foto di Pixabay, con licenza Pixabay.</p>
          </div>
        )}
      </div>
    </div>
    </div>,
    document.body
  );
}
