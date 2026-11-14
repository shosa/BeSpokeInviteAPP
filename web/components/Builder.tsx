"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./builder/builder.css";
import {
  activeFeatures,
  enabledThemes,
  formatPrice,
  getAddon,
  getModel,
  makeBlock,
  newBlockId,
  totalCents,
  validateActions,
  type Action,
  type AddonKey,
  type BlockInstance,
  type BlockType,
  type Catalog,
  type EventType,
  type InviteConfig,
  type RsvpQuestion,
  blockDef,
  isFixedPosition,
} from "@inviteme/shared";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CalendarDays, ClipboardCheck, Copy, Eye, ExternalLink, LayoutList, Languages, Link2, Mail, Maximize2, Menu, Minimize2, Monitor, Music, Palette, Redo2, RotateCw, Smartphone, Sparkles, Undo2, Users, X } from "lucide-react";
import { Canvas } from "./builder/Canvas";
import { Inspector } from "./builder/Inspector";
import { AssistantPanel } from "./builder/AssistantPanel";
import { GuestsPanel } from "./builder/guests";
import { useHistory } from "./builder/history";
import { parseFragments } from "@/lib/blockFragments";
import { ui, type Lang } from "@/lib/ui";
import { blockCopy, modelCopy, themeCopy } from "@/lib/catalogCopy";
import { StockContext } from "./builder/PixabayDialog";
import { PublishDialog } from "@/components/PublishDialog";

export type Manage = {
  id: string;
  slug: string;
  status: "draft" | "paid";
  config: InviteConfig;
  guests: { email: string; sentAt: string }[];
  editCount: number;
  editSession: string | null;
  purchasedAddons: AddonKey[];
  catalog: Catalog;
  assistant: boolean; // assistente attivo sul server (chiave del modello presente)
  assistantLimit: number; // richieste per invito
  assistantUsed: number; // richieste già usate
};

type MobileTab = "blocchi" | "anteprima" | "proprieta";
type Device = "desktop" | "mobile";
type Save = "saved" | "saving" | "error";

// Editor dell'invito: palette e struttura a sinistra, anteprima reale al centro, proprietà a destra.
// Blocchi che si aggiornano da soli nell'anteprima: tutti tranne la busta e la musica, che hanno stato globale della pagina.
const PATCHABLE = new Set(["hero", "message", "program", "venue", "map", "transfer", "dresscode", "footer", "date", "gallery", "countdown", "scratchdate", "video", "rsvp"]);

// Tutto ciò che, cambiando, rende la pagina diversa nel suo insieme: se cambia uno di questi, l'anteprima si ricarica.
function pageKey(c: InviteConfig, envelopeOn: boolean): string {
  return JSON.stringify({
    t: c.themeId, m: c.model, a: [...c.addons].sort(), l: c.locale, e: c.eventType, q: c.rsvpQuestions, env: envelopeOn, bg: c.background ?? null,
    ids: c.blocks.map((b) => `${b.id}:${b.type}:${b.hidden ? 1 : 0}`),
  });
}

// L'invito aperto è disponibile a tutto l'editor (ricerca foto Pixabay nei campi).
// Schede che mostrano il pannello generale (senza blocco selezionato).
const GENERAL_TABS = ["tema", "dettagli", "lingua", "link"];

// Schede del pannello dei controlli: ciascuna apre una funzione già presente nel builder.
const BUILDER_TABS: { id: string; it: string; en: string; type?: string; guests?: boolean; blocks?: boolean; icon: LucideIcon }[] = [
  { id: "blocchi", it: "Blocchi", en: "Blocks", blocks: true, icon: LayoutList },
  { id: "tema", it: "Tema", en: "Theme", icon: Palette },
  { id: "busta", it: "Busta", en: "Envelope", type: "cover", icon: Mail },
  { id: "dettagli", it: "Dettagli", en: "Details", icon: CalendarDays },
  { id: "audio", it: "Audio", en: "Audio", type: "music", icon: Music },
  { id: "lingua", it: "Lingue", en: "Languages", icon: Languages },
  { id: "rsvp", it: "RSVP", en: "RSVP", type: "rsvp", icon: ClipboardCheck },
  { id: "ospiti", it: "Ospiti", en: "Guests", guests: true, icon: Users },
  { id: "link", it: "Link", en: "Custom URL", icon: Link2 },
];

// Larghezza della pagina nell'anteprima desktop: uno schermo di computer, ridotto per stare nel riquadro.
const DESK_W = 1280;

export function Builder({ initial, lang = "it" }: { initial: Manage; lang?: Lang }) {
  return (
    <StockContext.Provider value={initial.id}>
      <BuilderEditor initial={initial} lang={lang} />
    </StockContext.Provider>
  );
}

function BuilderEditor({ initial, lang }: { initial: Manage; lang: Lang }) {
  const L = ui(lang).builder;
  const catalog = initial.catalog;
  const history = useHistory<InviteConfig>(initial.config);
  const config = history.present;
  // Dopo l'acquisto l'invito si modifica finché non si conferma la modifica: poi è chiuso.
  const locked = initial.status === "paid" && initial.editCount >= 1;
  // Pubblicato = prima conferma: solo allora l'invito ha il suo link pubblico.
  const published = initial.editCount >= 1;
  const [publishOpen, setPublishOpen] = useState(false);
  const editable = !locked;
  // Conferma = pubblicazione. Prima si salva la bozza (così la conferma vede l'ultima versione); se ci sono funzioni
  // nuove da pagare, il server lo dice e si va al checkout della differenza, senza perdere la bozza.
  async function confirmEdit() {
    setError(null);
    if (!(await persist(config))) return;
    // Prima pubblicazione: il cliente sceglie il link nella finestra dedicata.
    if (!published) {
      setSummary(false);
      setPublishOpen(true);
      return;
    }
    const res = await fetch(`/api/invitations/${initial.id}/confirm-edit`, { method: "POST" });
    if (res.ok) return (window.location.href = `/planner/${initial.id}`);
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (res.status === 409 && data.code === "payment_required") {
      setSummary(false);
      return checkout();
    }
    setError(data.error ?? "Conferma non riuscita, riprova.");
  }

  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<"proprieta" | "ospiti">("proprieta");
  // Schede in alto nel pannello dei controlli, come nel riferimento: ciascuna apre una funzione del builder.
  const [tab, setTab] = useState<string>("dettagli");
  const [device, setDevice] = useState<Device>("mobile");
  // Telefono: si parte dai blocchi; l'anteprima è l'invito a tutto schermo con «indietro».
  const [mobileTab, setMobileTab] = useState<MobileTab>("blocchi");
  const [save, setSave] = useState<Save>("saved");
  const [preview, setPreview] = useState("");
  const [previewState, setPreviewState] = useState<"ready" | "loading" | "error">("loading");
  // Ricaricamento completo dell'anteprima: la pagina vecchia resta sfocata con lo spinner finché la nuova non è caricata.
  const [refreshing, setRefreshing] = useState(false);
  function swapPreview(html: string) {
    setRefreshing(true);
    setPreview(html);
    // Sicurezza: se il documento non cambia (stesso HTML) l'evento di caricamento non arriva, quindi si rimette a fuoco comunque.
    window.setTimeout(() => setRefreshing(false), 3000);
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(false);
  // Su telefono: il menu degli strumenti dall'hamburger, e il modale di Salva con totale e pagamento al posto del footer.
  const [topMenu, setTopMenu] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [assistantSheet, setAssistantSheet] = useState(false);
  // Anteprima in una card con barra: ingrandisci a tutto schermo, ricarica, copia il link, apri in una nuova scheda.
  const [previewFull, setPreviewFull] = useState(false);
  // Su desktop l'elenco dei blocchi è una scheda del centro; su telefono resta nella sua colonna.
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [origin, setOrigin] = useState("");
  const [firstSave, setFirstSave] = useState(true);
  const [showCover, setShowCover] = useState(false);
  // La busta si vede in anteprima quando è selezionata, oppure con l'interruttore «Mostra la busta».
  const hasCover = config.blocks.some((b) => b.type === "cover");
  const envelopeOn = hasCover && (showCover || selected !== null && config.blocks.some((b) => b.id === selected && b.type === "cover"));
  const [hover, setHover] = useState<string | null>(null);
  const [scroll, setScroll] = useState({ y: 0, max: 0 });
  const frame = useRef<HTMLIFrameElement>(null);
  // Contenitore dell'anteprima: in modalità desktop la pagina si disegna larga 1280 px e si riduce per stare nel riquadro.
  const frameBox = useRef<HTMLDivElement>(null);
  const [deskScale, setDeskScale] = useState<{ s: number; h: number } | null>(null);
  // Anteprima a tutto schermo su telefono: i tocchi non selezionano i blocchi, si scorre l'invito e basta.
  const viewOnly = useRef(false);
  const scrollY = useRef(0);

  const model = getModel(catalog, config.model);
  const theme = catalog.themes.find((t) => t.manifest.id === config.themeId)?.manifest;
  const features = useMemo(() => new Set(activeFeatures(catalog, config.model, config.addons) as Set<AddonKey>), [catalog, config.model, config.addons]);
  const total = useMemo(() => totalCents(catalog, config.model, config.addons), [catalog, config.model, config.addons]);
  // Quanto è già stato pagato: il prezzo compare dopo l'acquisto solo per le funzioni aggiunte e non ancora pagate.
  const paidAlready = initial.status === "paid";
  // Il pagato sono le funzioni acquistate: quelle tolte in bozza restano pagate e si riattivano gratis.
  const paidTotal = useMemo(() => totalCents(catalog, initial.config.model, initial.purchasedAddons), [catalog, initial.config.model, initial.purchasedAddons]);
  const extra = paidAlready ? total - paidTotal : 0;
  const block = config.blocks.find((b) => b.id === selected) ?? null;
  const tabDef = BUILDER_TABS.find((t) => t.id === tab);
  const missingType = tabDef?.type ?? "";
  const tabMissingBlock = !block && !!tabDef?.type && !tabDef.guests && !config.blocks.some((b) => b.type === tabDef.type);
  const title = String(config.event.title ?? "") || L.unnamed;
  const hasRsvp = config.blocks.some((b) => b.type === "rsvp");

  useEffect(() => setOrigin(window.location.origin), []);

  // Salva la configurazione sul server: dal salvataggio automatico e dal pulsante «Salva».
  async function persist(c: InviteConfig): Promise<boolean> {
    setSave("saving");
    try {
      const res = await fetch(`/api/invitations/${initial.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      if (res.ok) {
        setSave("saved");
        setError(null);
        return true;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSave("error");
      setError(data.error ?? "Salvataggio non riuscito");
      return false;
    } catch {
      setSave("error");
      setError("Connessione assente: le modifiche non sono state salvate.");
      return false;
    }
  }

  // Salvataggio automatico: il database riceve sempre l'ultima versione.
  useEffect(() => {
    if (firstSave) {
      setFirstSave(false);
      return;
    }
    if (locked) return;
    setSave("saving");
    const t = setTimeout(() => persist(config), 650);
    return () => clearTimeout(t);
  }, [config, initial.id, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selezionare un blocco (dalla lista o dall'anteprima) porta l'anteprima su quel blocco.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "focus", id: selected }, "*");
  }, [selected]);

  // Anteprima: la pagina reale del motore, rigenerata dal server con la configurazione in corso.
  // Se è cambiato solo il contenuto di qualche blocco, si aggiornano solo quei blocchi nell'anteprima, senza ricaricarla.
  const lastRender = useRef<{ key: string; frags: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    setPreviewState("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/invitations/${initial.id}/preview?cover=${envelopeOn ? 1 : 0}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
        if (!alive) return;
        if (!res.ok) {
          setRefreshing(false);
          return setPreviewState("error");
        }
        const html = await res.text();
        const frags = parseFragments(html);
        const key = pageKey(config, envelopeOn);
        const prev = lastRender.current;
        const sameSkeleton = !!prev && prev.key === key && Object.keys(frags).length === Object.keys(prev.frags).length;
        if (sameSkeleton) {
          const changed = Object.keys(frags).filter((id) => frags[id] !== prev.frags[id]);
          const patchable = changed.every((id) => PATCHABLE.has(config.blocks.find((b) => b.id === id)?.type ?? ""));
          if (patchable) {
            for (const id of changed) frame.current?.contentWindow?.postMessage({ type: "patch", id, html: frags[id] }, "*");
          } else {
            swapPreview(html);
          }
        } else {
          swapPreview(html);
        }
        lastRender.current = { key, frags };
        setPreviewState("ready");
      } catch {
        if (alive) {
          setRefreshing(false);
          setPreviewState("error");
        }
      }
    }, 420);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [config, initial.id, envelopeOn]);

  // Lista e anteprima si scambiano l'evidenziazione: l'hover sull'una accende l'altra, e un click nell'anteprima seleziona il blocco.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "highlight", id: hover }, "*");
  }, [hover, preview]);
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; id?: unknown; y?: unknown; max?: unknown } | null;
      if (d?.type === "hover") setHover(typeof d.id === "string" ? d.id : null);
      if (d?.type === "scroll" && typeof d.y === "number") {
        const y: number = d.y;
        scrollY.current = y;
        setScroll((s) => ({ ...s, y }));
      }
      if (d?.type === "max" && typeof d.max === "number") {
        const max: number = d.max;
        setScroll((s) => ({ ...s, max }));
      }
      if (d?.type === "select" && typeof d.id === "string") {
        if (viewOnly.current) return;
        setSelected(d.id);
        setPanel("proprieta");
        setMobileTab("proprieta");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Anteprima a tutto schermo su telefono: la pagina si comporta come l'invito vero. Lo si dice anche all'anteprima,
  // che smette di evidenziare e selezionare i blocchi al tocco.
  const previewOnly = !isDesktop && mobileTab === "anteprima";
  useEffect(() => {
    viewOnly.current = previewOnly;
    frame.current?.contentWindow?.postMessage({ type: "viewonly", on: previewOnly }, "*");
  }, [previewOnly]);

  // Anteprima desktop: la pagina è larga come uno schermo vero (1280 px) e scalata per entrare nel riquadro.
  useEffect(() => {
    const el = frameBox.current;
    if (!el || device !== "desktop" || !isDesktop || typeof ResizeObserver === "undefined") { setDeskScale(null); return; }
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.min(1, r.width / DESK_W);
      setDeskScale({ s, h: Math.round(r.height / s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device, isDesktop, previewFull]);

  // Annulla e ripristina dalla tastiera (Ctrl/⌘+Z e Ctrl/⌘+Shift+Z) quando non si scrive in un campo.
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, locked]);

  // Modifiche alla configurazione: ogni azione passa dalla cronologia.
  const edit = useCallback((next: (c: InviteConfig) => InviteConfig, group?: string) => history.set(next(config), group), [config, history]);
  // Le risposte dell'assistente arrivano dopo: leggono sempre la configurazione attuale, non quella di quando hanno scritto.
  const latest = useRef(config);
  latest.current = config;
  // Modifiche dell'assistente: una sola voce di cronologia per risposta, così Annulla (Ctrl+Z) le ritira tutte insieme.
  function applyAssistant(actions: Action[], allowed: { mediaAllowed: string[]; placesAllowed: string[] }): number {
    const result = validateActions(latest.current, actions, {
      catalog,
      paid: initial.status === "paid",
      purchased: new Set(initial.purchasedAddons),
      mediaAllowed: new Set(allowed.mediaAllowed),
      placesAllowed: new Set(allowed.placesAllowed),
    });
    if (result.actions.length === 0) return 0;
    history.set(result.config, `assistant-${Date.now()}`);
    return result.actions.length;
  }

  // Con una funzione a pagamento da attivare, la attiva e aggiunge il blocco in un solo passo.
  function addBlock(type: BlockType, feature?: AddonKey) {
    const b = makeBlock(type, config.locale);
    const top = !!blockDef(type)?.anchored;
    edit((c) => ({ ...c, blocks: top ? [b, ...c.blocks] : [...c.blocks, b], addons: feature && !c.addons.includes(feature) ? [...c.addons, feature] : c.addons }));
    setSelected(b.id);
  }
  // Senza la funzione, i blocchi che la richiedono escono dalla struttura (annullabile con Annulla).
  function withActiveFeatures(c: InviteConfig): InviteConfig {
    const active = activeFeatures(catalog, c.model, c.addons);
    return { ...c, blocks: c.blocks.filter((b) => { const f = blockDef(b.type)?.feature; return !f || active.has(f); }) };
  }
  // Funzioni a pagamento: si attivano dalla finestra dei blocchi. Le funzioni del modello sono sempre attive.
  function toggleAddon(key: AddonKey) {
    edit((c) => withActiveFeatures({ ...c, addons: c.addons.includes(key) ? c.addons.filter((a) => a !== key) : [...c.addons, key] }));
  }
  // Cambio di modello: si tengono solo le funzioni che il nuovo modello offre, e il tema resta se è compatibile.
  function setModel(id: string) {
    edit((c) => {
      const m = getModel(catalog, id);
      const themes = enabledThemes(catalog, id);
      const themeId = themes.some((t) => t.id === c.themeId) ? c.themeId : (themes[0]?.id ?? c.themeId);
      return withActiveFeatures({ ...c, model: id, addons: c.addons.filter((a) => m?.options.includes(a)), themeId });
    });
  }
  function moveBlock(from: number, to: number) {
    edit((c) => {
      const list = [...c.blocks];
      const [moved] = list.splice(from, 1);
      list.splice(Math.max(0, Math.min(list.length, to)), 0, moved);
      // Un blocco bloccato non cambia posizione: se lo spostamento la cambierebbe, non si fa nulla.
      const fixed = (blocks: BlockInstance[]) => blocks.map((b, i) => (isFixedPosition(b.type) ? i : -1)).filter((i) => i >= 0);
      if (fixed(c.blocks).join() !== fixed(list).join()) return c;
      return { ...c, blocks: list };
    });
  }
  function duplicateBlock(id: string) {
    const src = config.blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: BlockInstance = { ...src, id: newBlockId(), props: JSON.parse(JSON.stringify(src.props)) };
    const at = config.blocks.findIndex((b) => b.id === id);
    edit((c) => ({ ...c, blocks: [...c.blocks.slice(0, at + 1), copy, ...c.blocks.slice(at + 1)] }));
    setSelected(copy.id);
  }
  function toggleBlock(id: string) {
    edit((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)) }));
  }
  function removeBlock(id: string) {
    const target = config.blocks.find((b) => b.id === id);
    if (target && blockDef(target.type)?.locked) return;
    // Un blocco a pagamento tolto porta via anche la sua funzione, se nessun altro blocco la usa: il prezzo scende.
    const feature = target ? blockDef(target.type)?.feature : undefined;
    edit((c) => {
      const blocks = c.blocks.filter((b) => b.id !== id);
      const stillUsed = !!feature && blocks.some((b) => blockDef(b.type)?.feature === feature);
      return { ...c, blocks, addons: feature && !stillUsed ? c.addons.filter((a) => a !== feature) : c.addons };
    });
    if (selected === id) setSelected(null);
  }
  function setProp(id: string, key: string, value: unknown, group?: string) {
    edit((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)) }), group);
  }
  function setEvent(key: string, value: unknown, group?: string) {
    edit((c) => ({ ...c, event: { ...c.event, [key]: value } }), group);
  }
  // Cambio di template: contenuto e blocchi restano; tornano al template solo i colori personalizzati.
  async function upload(kind: "photo" | "video" | "audio", file: File): Promise<string | null> {
    setBusy(kind);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/invitations/${initial.id}/media?kind=${kind}`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Caricamento non riuscito");
      return data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caricamento non riuscito");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkout() {
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId: initial.id }) });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "Pagamento non disponibile");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto");
      setCheckingOut(false);
    }
  }

  const [slug, setSlug] = useState(initial.slug);
  const shareUrl = `${origin}/i/${slug}`;
  // Link dell'invito: cambiabile solo in bozza; il server controlla formato e unicità.
  async function saveSlug(value: string): Promise<string | null> {
    const res = await fetch(`/api/invitations/${initial.id}/slug`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: value }),
    });
    const data = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
    if (!res.ok || !data.slug) return data.error ?? (lang === "en" ? "Could not save the link." : "Impossibile salvare il link.");
    setSlug(data.slug);
    return null;
  }
  const saveLabel = locked ? L.paid : save === "saving" ? L.saving : save === "error" ? L.notSaved : L.saved;

  const blocksPanel = (
          <div className={locked ? "bl-zone is-locked" : "bl-zone"} inert={locked || undefined}>
          <Canvas
            blocks={config.blocks}
            config={config}
            catalog={catalog}
            selected={selected}
            hover={hover}
            features={features}
            theme={theme}
            paidAlready={paidAlready}
            onSelect={(id) => { setSelected(id); setPanel("proprieta"); setMobileTab("proprieta"); }}
            onHover={setHover}
            lang={lang}
            onAdd={addBlock}
            onToggleAddon={toggleAddon}
            onSetModel={setModel}
            onMove={moveBlock}
            onDuplicate={duplicateBlock}
            onToggle={toggleBlock}
            onRemove={removeBlock}
          />
          </div>
  );

  return (
    <div className={`bl-app is-${device} is-tab-${mobileTab}`}>
      <header className="bl-top">
        <a href="/account" className="back-link" aria-label={L.back}><ArrowLeft size={16} aria-hidden="true" /><span className="bl-back-text">{L.back}</span></a>
        <h1 className="bl-title">{title}</h1>
        <button type="button" className="bl-burger" aria-expanded={topMenu} aria-label={lang === "en" ? (topMenu ? "Close menu" : "Open menu") : (topMenu ? "Chiudi il menu" : "Apri il menu")} onClick={() => setTopMenu((o) => !o)}>{topMenu ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>
        <div className={`bl-top-tools${topMenu ? " is-menu-open" : ""}`}>
          <button type="button" className="bl-icon" aria-label={L.undo} data-label={L.undo} title={`${L.undo} (Ctrl+Z)`} disabled={locked || !history.canUndo} onClick={history.undo}><Undo2 size={17} /></button>
          <button type="button" className="bl-icon" aria-label={L.redo} data-label={L.redo} title={`${L.redo} (Ctrl+Shift+Z)`} disabled={locked || !history.canRedo} onClick={history.redo}><Redo2 size={17} /></button>
          <span className="bl-sep" aria-hidden="true" />
          <div className="bl-device" role="group" aria-label="Anteprima">
            <button type="button" aria-pressed={device === "desktop"} className="bl-icon" aria-label={L.desktopPreview} data-label={L.desktopPreview} onClick={() => setDevice("desktop")}><Monitor size={17} /></button>
            <button type="button" aria-pressed={device === "mobile"} className="bl-icon" aria-label={L.phonePreview} data-label={L.phonePreview} onClick={() => setDevice("mobile")}><Smartphone size={17} /></button>
          </div>
          {locked && <button type="button" className="bl-icon" aria-label={L.guests} data-label={L.guests} onClick={() => setPanel(panel === "ospiti" ? "proprieta" : "ospiti")}><Users size={17} /></button>}
          {!locked && (
            <button type="button" className="btn solid small bl-desktop-save" disabled={save === "saving"} onClick={() => persist(config)}>{L.saveNow}</button>
          )}
          <span className={`bl-save save-${save}`} aria-live="polite">{saveLabel}</span>
        </div>
      </header>

      <nav className="bl-mobile-tabs" role="tablist" aria-label="Sezioni">
        <button role="tab" aria-selected={mobileTab === "blocchi"} onClick={() => setMobileTab("blocchi")}>{L.tabBlocks}</button>
        <button role="tab" aria-selected={mobileTab === "anteprima"} onClick={() => setMobileTab("anteprima")}><Eye size={15} aria-hidden="true" /> {L.tabPreview}</button>
        <button role="tab" aria-selected={mobileTab === "proprieta"} onClick={() => setMobileTab("proprieta")}>{L.tabProps}</button>
      </nav>

      <aside className={`bl-left${locked ? " is-locked" : ""}`} inert={locked || undefined} aria-label={initial.assistant && isDesktop ? (lang === "en" ? "Assistant" : "Assistente") : "Blocchi"}>
        {!isDesktop && blocksPanel}
        {/* Desktop: l'assistente sta nella colonna a destra dell'anteprima. Su telefono la colonna è nascosta. */}
        {isDesktop && initial.assistant && <AssistantPanel lang={lang} invitationId={initial.id} readOnly={locked} limit={initial.assistantLimit} used={initial.assistantUsed} onApply={applyAssistant} />}
      </aside>

      <main className="bl-center" aria-label={L.previewAria}>
        {!isDesktop && (
          <button type="button" className="bl-preview-back" onClick={() => setMobileTab("blocchi")}>
            <ArrowLeft size={18} aria-hidden="true" />
            <span>{lang === "en" ? "Back" : "Indietro"}</span>
          </button>
        )}
        <section className={`bl-preview-card${previewFull ? " is-expanded" : ""}`} aria-label={lang === "en" ? "Live preview" : "Anteprima dal vivo"}>
        <header className="bl-preview-head">
          <span className="bl-preview-title"><Eye size={16} aria-hidden="true" />{lang === "en" ? "Live preview" : "Anteprima dal vivo"}</span>
          <span className="bl-preview-tools-row">
            <button type="button" aria-label={lang === "en" ? "Reload preview" : "Ricarica l'anteprima"} title={lang === "en" ? "Reload preview" : "Ricarica l'anteprima"} onClick={() => frame.current?.contentWindow?.location.reload()}><RotateCw size={16} aria-hidden="true" /></button>
            {isDesktop && <button type="button" aria-pressed={previewFull} aria-label={previewFull ? (lang === "en" ? "Exit full screen" : "Esci da schermo intero") : (lang === "en" ? "Full screen" : "Schermo intero")} title={previewFull ? (lang === "en" ? "Exit full screen" : "Esci da schermo intero") : (lang === "en" ? "Full screen" : "Schermo intero")} onClick={() => setPreviewFull((v) => !v)}>{previewFull ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}</button>}
          </span>
        </header>
        <div className="bl-preview-bar">
          <div className="bl-preview-tools">
            <div className="bl-history">
              <button type="button" className="bl-icon" aria-label={L.undo} title={`${L.undo} (Ctrl+Z)`} disabled={locked || !history.canUndo} onClick={history.undo}><Undo2 size={16} /></button>
              <button type="button" className="bl-icon" aria-label={L.redo} title={`${L.redo} (Ctrl+Shift+Z)`} disabled={locked || !history.canRedo} onClick={history.redo}><Redo2 size={16} /></button>
            </div>
            {hasCover && (
              <label className={`bl-switch${showCover ? " is-on" : ""}`}>
                <input type="checkbox" role="switch" checked={showCover} onChange={(e) => setShowCover(e.target.checked)} />
                <span className="bl-switch-track" aria-hidden="true"><span className="bl-switch-knob" /></span>
                <span>{L.showEnvelope}</span>
              </label>
            )}
            <span className="bl-preview-state">{previewState === "error" ? "—" : ""}</span>
          </div>
        </div>
        <div ref={frameBox} className={`bl-frame is-${device}${refreshing ? " is-refreshing" : ""}`}>
          {preview ? (
            <iframe
              ref={frame}
              title={L.previewTitle}
              srcDoc={preview}
              sandbox="allow-scripts"
              style={device === "desktop" && isDesktop && deskScale ? { width: DESK_W, height: deskScale.h, transform: `scale(${deskScale.s})`, transformOrigin: "0 0" } : undefined}
              onLoad={() => {
                frame.current?.contentWindow?.postMessage({ type: "viewonly", on: viewOnly.current }, "*");
                frame.current?.contentWindow?.postMessage({ type: "restore", id: selected, y: scrollY.current }, "*");
                frame.current?.contentWindow?.postMessage({ type: "highlight", id: hover }, "*");
                setRefreshing(false);
              }}
            />
          ) : (
            <p className="hint">{L.loadingPreview}</p>
          )}
          {refreshing && <div className="bl-veil" role="status" aria-label={L.updating}><span className="bl-spin" /></div>}
          {device === "mobile" && scroll.max > 0 && (
            <input
              type="range"
              className="bl-scroll"
              aria-label={L.scrollPreview}
              min={0}
              max={scroll.max}
              value={scroll.y}
              onChange={(e) => frame.current?.contentWindow?.postMessage({ type: "scrollTo", y: Number(e.target.value) }, "*")}
            />
          )}
        </div>
        </section>
      </main>

      <aside className="bl-right" aria-label="Proprietà">
        <div className="bl-tabs-head">
          <span className="bl-kicker">{lang === "en" ? "Invitation sections" : "Sezioni dell'invito"}</span>
          <h2>{(() => { const t = BUILDER_TABS.find((x) => x.id === tab); return t ? (lang === "en" ? t.en : t.it) : ""; })()}</h2>
        </div>
        <nav className="bl-switcher" role="tablist" aria-label={lang === "en" ? "Sections" : "Sezioni"}>
          {BUILDER_TABS.map((t) => {
            const it = lang !== "en";
            const label = it ? t.it : t.en;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`bl-switcher-tab${on ? " is-on" : ""}`}
                onClick={() => {
                  setTab(t.id);
                  if (t.blocks) { setSelected(null); setPanel("proprieta"); setMobileTab("blocchi"); return; }
                  if (t.guests) { setPanel("ospiti"); setSelected(null); return; }
                  setPanel("proprieta");
                  const target = t.type ? config.blocks.find((b) => b.type === t.type) : undefined;
                  setSelected(target ? target.id : null);
                }}
              >
                <span className="sw-ico"><t.icon size={16} aria-hidden="true" /></span>
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className={locked && panel !== "ospiti" ? "bl-zone is-locked" : "bl-zone"} inert={(locked && panel !== "ospiti") || undefined}>
        {isDesktop && tab === "blocchi" && !block ? blocksPanel : panel === "ospiti" ? (
          <GuestsPanel lang={lang} invitationId={initial.id} paid={locked} hasRsvp={hasRsvp} />
        ) : tabMissingBlock && tabDef?.type ? (
          <div className="bl-inspector bl-missing-block">
            <p className="bl-kicker">{lang === "en" ? "Not in the invitation" : "Non presente nell'invito"}</p>
            <h2>{blockCopy(tabDef.type, blockDef(tabDef.type)?.label ?? tabDef.type, lang)}</h2>
            <p className="hint">{blockDef(tabDef.type)?.description ?? ""}</p>
            <button type="button" className="btn solid" disabled={locked} onClick={() => addBlock(missingType as BlockType, blockDef(missingType)?.feature)}>
              {lang === "en" ? "Add to invitation" : "Aggiungila all'invito"}
            </button>
            {locked && <p className="hint">{L.lockedNote}</p>}
          </div>
        ) : (
          <Inspector
            lang={lang}
            section={GENERAL_TABS.includes(tab) && !block ? (tab as "dettagli" | "tema" | "lingua" | "link") : undefined}
            shareUrl={published ? shareUrl : undefined}
            slug={slug}
            onSaveSlug={editable && initial.status !== "paid" ? saveSlug : undefined}
            config={config}
            catalog={catalog}
            block={block}
            videoEnvelope={!!theme?.envelope}
            busy={busy}
            onSetProp={setProp}
            onSetEvent={setEvent}
            locked={locked}
            onSetLocale={(locale) => edit((c) => ({ ...c, locale }))}
            onSetEventType={(eventType: EventType) => edit((c) => ({ ...c, eventType }))}
            onSetBackground={(background) => edit((c) => {
              const { background: _previous, ...rest } = c;
              return background ? { ...rest, background } : rest;
            })}
            onSetQuestions={(rsvpQuestions: RsvpQuestion[]) => edit((c) => ({ ...c, rsvpQuestions }), "questions")}
            onToggle={toggleBlock}
            onRemove={removeBlock}
            onBack={() => { setSelected(null); setTab("blocchi"); setPanel("proprieta"); }}
            onUpload={upload}
          />
        )}
        </div>
        {locked && panel === "proprieta" && (
          <p className="hint bl-locked">{L.lockedNote}</p>
        )}
      </aside>

      {error && <p role="alert" className="form-error bl-error">{error}</p>}

      {!isDesktop && (
        <div className="bl-fab-row">
          {initial.assistant && !assistantSheet && (
            <button type="button" className="bl-assist-fab" onClick={() => setAssistantSheet(true)}>
              <Sparkles size={16} aria-hidden="true" />{lang === "en" ? "Assistant" : "Assistente"}
            </button>
          )}
          {paidAlready && editable ? (
            <button type="button" className="btn solid bl-fab-primary" onClick={() => setSummary(true)}>{lang === "en" ? "Confirm edit" : "Conferma modifica"}</button>
          ) : !paidAlready || extra > 0 ? (
            <button type="button" className="btn solid bl-fab-primary" onClick={() => setMobileSheet(true)}>{paidAlready ? (lang === "en" ? "Buy the new features" : "Acquista le funzioni nuove") : L.pay}</button>
          ) : null}
        </div>
      )}
      {!isDesktop && initial.assistant && assistantSheet && (
        <div className="bl-modal-backdrop bl-assist-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAssistantSheet(false); }}>
          <div className="bl-modal bl-assist-sheet" role="dialog" aria-modal="true" aria-labelledby="bl-assist-title">
            <header className="bl-modal-head">
              <h2 id="bl-assist-title">{lang === "en" ? "Assistant" : "Assistente"}</h2>
              <button type="button" className="bl-icon" aria-label={lang === "en" ? "Close" : "Chiudi"} onClick={() => setAssistantSheet(false)}><X size={18} aria-hidden="true" /></button>
            </header>
            <AssistantPanel lang={lang} invitationId={initial.id} readOnly={locked} limit={initial.assistantLimit} used={initial.assistantUsed} onApply={applyAssistant} />
          </div>
        </div>
      )}
      {mobileSheet && (
        <div className="bl-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setMobileSheet(false); }} onKeyDown={(e) => { if (e.key === "Escape") setMobileSheet(false); }}>
          <div className="bl-modal sheet-save" role="dialog" aria-modal="true" aria-labelledby="sheet-save-title">
            <header className="bl-modal-head">
              <h2 id="sheet-save-title">{lang === "en" ? "Save" : "Salva"}</h2>
              <button type="button" className="bl-icon" aria-label={lang === "en" ? "Close" : "Chiudi"} onClick={() => setMobileSheet(false)}><X size={18} aria-hidden="true" /></button>
            </header>
            {paidAlready && extra <= 0 ? null : (
              <>
                <div className="total">
                  <span>{paidAlready ? (lang === "en" ? "New feature to buy" : "Funzione da acquistare") : L.total}</span>
                  <strong>{formatPrice(paidAlready ? extra : total)}</strong>
                  <small>{model ? modelCopy(model, lang).name : ""}</small>
                </div>
                <button type="button" className="btn solid" disabled={checkingOut} onClick={checkout}>{checkingOut ? L.paying : L.pay}</button>
              </>
            )}
          </div>
        </div>
      )}

      {publishOpen && (
        <PublishDialog
          id={initial.id}
          origin={origin}
          lang={lang}
          onClose={() => setPublishOpen(false)}
          onPayment={() => { setPublishOpen(false); setSummary(false); checkout(); }}
          onDone={() => { window.location.href = `/planner/${initial.id}`; }}
        />
      )}
      {summary && paidAlready && editable && (
        <div className="bl-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummary(false); }} onKeyDown={(e) => { if (e.key === "Escape") setSummary(false); }}>
          <div className="bl-modal confirm-summary" role="dialog" aria-modal="true" aria-labelledby="confirm-summary-title">
            <header className="bl-modal-head">
              <div>
                <h2 id="confirm-summary-title">{lang === "en" ? "Summary before confirming" : "Riepilogo prima della conferma"}</h2>
              </div>
            </header>
            <p><strong>{lang === "en" ? "Purchased" : "Acquistato"}:</strong> {getModel(catalog, initial.config.model)?.name ?? initial.config.model}{initial.purchasedAddons.length ? ` · ${initial.purchasedAddons.map((k) => getAddon(catalog, k)?.label ?? k).join(", ")}` : ""}</p>
            <p><strong>{lang === "en" ? "In the draft" : "Nella bozza"}:</strong> {config.addons.length ? config.addons.map((k) => getAddon(catalog, k)?.label ?? k).join(", ") : lang === "en" ? "no extra functions" : "nessuna funzione extra"}</p>
            {extra > 0 && <p><strong>{lang === "en" ? "To pay now" : "Da pagare ora"}:</strong> {formatPrice(extra)} {lang === "en" ? "for the new functions" : "per le funzioni nuove"}</p>}
            <p className="confirm-warning">{lang === "en"
              ? "After confirming, the invitation can no longer be edited. Until then it stays a draft: you can edit it as many times as you want, and guests keep seeing the previous version."
              : "Dopo la conferma l'invito non si potrà più modificare. Fino ad allora resta una bozza: puoi modificarla quante volte vuoi, e gli ospiti vedono ancora la versione precedente."}</p>
            <div className="bl-modal-actions">
              <button type="button" className="btn outline" onClick={() => setSummary(false)}>{lang === "en" ? "Back to draft" : "Torna alla bozza"}</button>
              <button type="button" className="btn solid" onClick={confirmEdit} disabled={checkingOut}>{extra > 0
                ? (lang === "en" ? "Pay the difference and confirm" : "Paga la differenza e conferma")
                : (lang === "en" ? "Confirm and close the edit" : "Conferma e chiudi la modifica")}</button>
            </div>
          </div>
        </div>
      )}

      <footer className="bl-footer">
        {paidAlready && editable ? (
          <div className="confirm-edit">
            <p>{lang === "en" ? "You can edit the invitation once. When you are done, confirm the edit to close it." : "Puoi modificare l'invito una sola volta. Quando hai finito, conferma la modifica per chiuderla."}</p>
            <button type="button" className="confirm-edit-btn" onClick={() => setSummary(true)}>{lang === "en" ? "Confirm edit" : "Conferma modifica"}</button>
            <button type="button" className="link confirm-edit-summary" onClick={() => setSummary(true)}>{lang === "en" ? "Summary" : "Riepilogo"}</button>
            {extra > 0 && <span className="confirm-edit-extra">{formatPrice(extra)}</span>}
          </div>
        ) : paidAlready && extra <= 0 ? null : (
          <>
            <div className="total">
              <span>{paidAlready ? (lang === "en" ? "New feature to buy" : "Funzione da acquistare") : L.total}</span>
              <strong>{formatPrice(paidAlready ? extra : total)}</strong>
              <small>{model ? modelCopy(model, lang).name : ""}</small>
            </div>
            <button type="button" className="btn solid" disabled={checkingOut} onClick={checkout}>
              {checkingOut ? L.paying : L.pay}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

