"use client";

import { createContext, useContext, useState, type FormEvent } from "react";
import { useT } from "@/lib/lang";
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
const COLORS: [string, string, string][] = [
  ["transparent", "Sfondo trasparente", "Transparent background"], ["grayscale", "Bianco e nero", "Black and white"], ["white", "Bianco", "White"], ["black", "Nero", "Black"], ["gray", "Grigio", "Grey"],
  ["red", "Rosso", "Red"], ["orange", "Arancio", "Orange"], ["yellow", "Giallo", "Yellow"], ["green", "Verde", "Green"], ["turquoise", "Turchese", "Turquoise"],
  ["blue", "Blu", "Blue"], ["lilac", "Lilla", "Lilac"], ["pink", "Rosa", "Pink"], ["brown", "Marrone", "Brown"],
];
const CATEGORIES: [string, string, string][] = [
  ["backgrounds", "Sfondi", "Backgrounds"], ["nature", "Natura", "Nature"], ["places", "Luoghi", "Places"], ["buildings", "Edifici", "Buildings"], ["travel", "Viaggi", "Travel"],
  ["food", "Cibo", "Food"], ["people", "Persone", "People"], ["feelings", "Emozioni", "Feelings"], ["business", "Lavoro", "Business"], ["animals", "Animali", "Animals"], ["music", "Musica", "Music"],
  ["religion", "Religione", "Religion"], ["sports", "Sport", "Sports"], ["fashion", "Moda", "Fashion"], ["education", "Istruzione", "Education"], ["science", "Scienza", "Science"],
  ["health", "Salute", "Health"], ["industry", "Industria", "Industry"], ["computer", "Tecnologia", "Technology"], ["transportation", "Trasporti", "Transport"],
];

// Ricerca di foto su Pixabay dentro l'editor: la foto scelta viene salvata nell'invito, come un upload.
export function PixabayDialog({ invitationId, onClose, onPick }: Props) {
  const t = useT();
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
      setError(e instanceof Error ? e.message : t("Ricerca non riuscita", "Search failed"));
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return setError(t("Scrivi almeno 2 lettere", "Type at least 2 letters"));
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
      setError(e instanceof Error ? e.message : t("Importazione non riuscita", "Import failed"));
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
            <h2 id="stock-title">{t("Foto da Pixabay", "Photos from Pixabay")}</h2>
            <p className="hint">{t("La foto scelta viene salvata nel tuo invito.", "The chosen photo is saved in your invitation.")}</p>
          </div>
          <button type="button" className="bl-icon" aria-label={t("Chiudi", "Close")} onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <form className="stock-search" onSubmit={onSubmit} role="search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Es. fiori, mare, lanterne", "E.g. flowers, sea, lanterns")} aria-label={t("Cerca una foto", "Search for a photo")} autoFocus />
          <button className="btn solid" type="submit" disabled={busy !== null}>{busy === "search" ? t("Cerco…", "Searching…") : t("Cerca", "Search")}</button>
        </form>

        <fieldset className="stock-filters" disabled={busy !== null}>
          <legend>{t("Filtri", "Filters")}</legend>
          <div className="stock-seg" role="group" aria-label={t("Tipo di immagine", "Image type")}>
            {([["all", "Tutte", "All"], ["photo", "Foto", "Photos"], ["illustration", "Illustrazioni", "Illustrations"]] as const).map(([v, label, en]) => (
              <button key={v} type="button" aria-pressed={filters.type === v} onClick={() => change({ type: v })}>{t(label, en)}</button>
            ))}
          </div>
          <div className="stock-seg" role="group" aria-label={t("Orientamento", "Orientation")}>
            {([["all", "Qualsiasi", "Any"], ["horizontal", "Orizzontale", "Horizontal"], ["vertical", "Verticale", "Vertical"]] as const).map(([v, label, en]) => (
              <button key={v} type="button" aria-pressed={filters.orientation === v} onClick={() => change({ orientation: v })}>{t(label, en)}</button>
            ))}
          </div>
          <div className="stock-grid-filters">
            <label>{t("Colore", "Colour")}
              <select value={filters.color ?? ""} onChange={(e) => change({ color: e.target.value || undefined })}>
                <option value="">{t("Qualsiasi colore", "Any colour")}</option>
                {COLORS.map(([v, label, en]) => <option key={v} value={v}>{t(label, en)}</option>)}
              </select>
            </label>
            <label>{t("Categoria", "Category")}
              <select value={filters.category ?? ""} onChange={(e) => change({ category: e.target.value || undefined })}>
                <option value="">{t("Tutte le categorie", "All categories")}</option>
                {CATEGORIES.map(([v, label, en]) => <option key={v} value={v}>{t(label, en)}</option>)}
              </select>
            </label>
            <label>{t("Dimensione minima", "Minimum size")}
              <select value={filters.minWidth} onChange={(e) => change({ minWidth: Number(e.target.value) })}>
                <option value={0}>{t("Qualsiasi", "Any")}</option>
                <option value={1280}>{t("Almeno 1280 px di larghezza", "At least 1280 px wide")}</option>
                <option value={1920}>{t("Almeno 1920 px di larghezza", "At least 1920 px wide")}</option>
                <option value={3000}>{t("Almeno 3000 px di larghezza", "At least 3000 px wide")}</option>
              </select>
            </label>
            <label>{t("Ordina per", "Sort by")}
              <select value={filters.order} onChange={(e) => change({ order: e.target.value as StockFilters["order"] })}>
                <option value="popular">{t("Più popolari", "Most popular")}</option>
                <option value="latest">{t("Più recenti", "Most recent")}</option>
              </select>
            </label>
          </div>
          <div className="stock-filter-foot">
            <Checkbox className="stock-check" checked={filters.editorsChoice} onChange={(v) => change({ editorsChoice: v })} label={t("Solo scelte della redazione", "Editor's choice only")} />
            {filtersOn && <button type="button" className="link" onClick={() => change(DEFAULT_FILTERS)}>{t("Azzera i filtri", "Reset filters")}</button>}
          </div>
        </fieldset>

        {error && <p className="hint stock-error" role="alert">{error}</p>}
        <div className="stock-results" aria-live="polite">
          {photos.map((p) => (
            <button key={p.id} type="button" className="stock-item" onClick={() => pick(p)} disabled={busy !== null} aria-label={`${t("Usa la foto", "Use the photo")}: ${p.tags}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={p.tags} loading="lazy" />
              {busy === p.id && <span className="stock-wait">{t("Salvo…", "Saving…")}</span>}
            </button>
          ))}
        </div>
        {searched && photos.length === 0 && busy === null && <p className="hint">{t("Nessuna foto trovata: prova con un'altra parola o meno filtri.", "No photos found: try another word or fewer filters.")}</p>}
        {photos.length > 0 && (
          <div className="stock-foot">
            <button type="button" className="link" disabled={busy !== null} onClick={() => run(active, page + 1, filters)}>{t("Altre foto", "More photos")}</button>
            <p className="hint">{t("Foto di Pixabay, con licenza Pixabay.", "Photos from Pixabay, under the Pixabay licence.")}</p>
          </div>
        )}
      </div>
    </div>
    </div>,
    document.body
  );
}
