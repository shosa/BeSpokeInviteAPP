"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BACKGROUND_KINDS, EVENT_TYPES, blockDef, newBlockId, presetQuestions, type Action, type BackgroundKind, type BlockInstance, type BlockType, type Catalog, type EventType, type InviteConfig, type RsvpQuestion, type RsvpQuestionType } from "@inviteme/shared";
import {
  ArrowDown, ArrowLeft, ArrowUp, X, Baby, Briefcase, CalendarDays, Cake, Check, ClipboardCheck, Eye, EyeOff, GraduationCap, Heart, ImagePlus, LayoutList, Loader2, MapPin, Music, Pause,
  PenLine, Play, Plus, Search, Shirt, Sparkles, Trash2, Wand2, type LucideIcon,
} from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { importStock, searchStock, type StockPhoto } from "@/lib/stock";
import { PlaceSearch } from "./PlaceSearch";
import "./assistant-tools.css";

// Comandi visivi di BeSpoke AI: ogni comando apre nella chat un controllo che modifica l'invito subito,
// con le stesse azioni validate dell'assistente (un passo di cronologia, Ctrl+Z le ritira) e senza consumare richieste.
// Solo «Scrivi i testi» chiede al modello: compone la richiesta dai pulsanti, nessun testo da digitare.

type Lang = "it" | "en";
export type ApplyFn = (actions: Action[], allowed?: { mediaAllowed?: string[]; placesAllowed?: string[] }) => number;
export type ToolCtx = { lang: Lang; config: InviteConfig; catalog: Catalog; invitationId: string; apply: ApplyFn; ask: (prompt: string) => void; disabled: boolean; close?: () => void };

export type CommandId = "date" | "place" | "background" | "dress" | "questions" | "music" | "photo" | "blocks" | "event" | "write";
export const COMMANDS: { id: CommandId; icon: LucideIcon; it: string; en: string; itHint: string; enHint: string; keys: string; ai?: boolean }[] = [
  { id: "date", icon: CalendarDays, it: "Data e ora", en: "Date & time", itHint: "Calendario e orario", enHint: "Calendar and time", keys: "data ora giorno date time" },
  { id: "place", icon: MapPin, it: "Luogo", en: "Venue", itHint: "Nome e indirizzo reale", enHint: "Name and real address", keys: "luogo indirizzo mappa venue address map" },
  { id: "background", icon: Sparkles, it: "Sfondo animato", en: "Animated background", itHint: "Petali, scintille, neve…", enHint: "Petals, sparkles, snow…", keys: "sfondo animato petali background" },
  { id: "dress", icon: Shirt, it: "Dress code", en: "Dress code", itHint: "Stile e palette", enHint: "Style and palette", keys: "dress code colori palette" },
  { id: "questions", icon: ClipboardCheck, it: "Domande RSVP", en: "RSVP questions", itHint: "Cosa chiedere agli ospiti", enHint: "What to ask guests", keys: "domande conferma rsvp questions" },
  { id: "music", icon: Music, it: "Musica", en: "Music", itHint: "Ascolta e scegli", enHint: "Listen and pick", keys: "musica brano canzone music song" },
  { id: "photo", icon: ImagePlus, it: "Foto di copertina", en: "Cover photo", itHint: "Cerca tra milioni di foto", enHint: "Search millions of photos", keys: "foto immagine copertina photo cover" },
  { id: "blocks", icon: LayoutList, it: "Struttura", en: "Structure", itHint: "Mostra, nascondi, ordina", enHint: "Show, hide, reorder", keys: "blocchi sezioni struttura ordine blocks" },
  { id: "event", icon: Wand2, it: "Tipo di evento", en: "Event type", itHint: "Matrimonio, compleanno…", enHint: "Wedding, birthday…", keys: "tipo evento matrimonio compleanno event" },
  { id: "write", icon: PenLine, it: "Scrivi i testi", en: "Write the texts", itHint: "L'AI scrive per te", enHint: "AI writes for you", keys: "scrivi testo messaggio firma write text", ai: true },
];

const T = (lang: Lang, it: string, en: string) => (lang === "en" ? en : it);
const findBlock = (c: InviteConfig, type: BlockType) => c.blocks.find((b) => b.type === type);
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Azioni per avere un blocco: se manca lo si aggiunge prima della Firma (o in fondo), con un id scelto qui.
function ensureBlock(c: InviteConfig, type: BlockType): { id: string; actions: Action[] } {
  const found = findBlock(c, type);
  if (found) return { id: found.id, actions: found.hidden ? [{ tool: "setBlockHidden", blockId: found.id, hidden: false }] : [] };
  const id = newBlockId();
  const footer = c.blocks.findIndex((b) => b.type === "footer");
  const actions: Action[] = [{ tool: "addBlock", type, blockId: id }];
  if (footer >= 0) actions.push({ tool: "moveBlock", blockId: id, to: footer });
  return { id, actions };
}

// Esito visibile di un comando: «Applicato», con un piccolo bagliore.
function Done({ lang, n }: { lang: Lang; n: number }) {
  if (n <= 0) return <p className="ax-done is-fail" role="status">{T(lang, "Nessuna modifica applicata.", "No change applied.")}</p>;
  return (
    <p className="ax-done" role="status">
      <span className="ax-done-ico"><Check size={14} aria-hidden="true" /></span>
      {T(lang, "Applicato all'invito · Ctrl+Z per annullare", "Applied to the invitation · Ctrl+Z to undo")}
    </p>
  );
}

function Shell({ icon: Icon, title, sub, children, onClose, lang = "it" }: { icon: LucideIcon; title: string; sub: string; children: ReactNode; onClose?: () => void; lang?: Lang }) {
  return (
    <section className="ax-card">
      {onClose && (
        <button type="button" className="ax-back" onClick={onClose}>
          <ArrowLeft size={14} aria-hidden="true" />{T(lang, "Indietro", "Back")}
        </button>
      )}
      <header className="ax-head">
        <span className="ax-head-ico"><Icon size={18} aria-hidden="true" /></span>
        <span className="ax-head-text"><strong>{title}</strong><small>{sub}</small></span>
      </header>
      {children}
    </section>
  );
}

// ───────────── Data e ora ─────────────
const HOURS = [10, 11, 12, 15, 16, 17, 18, 19, 20];
const MINUTES = ["00", "15", "30", "45"];
function DateTool({ ctx }: { ctx: ToolCtx }) {
  const ev = ctx.config.event as Record<string, unknown>;
  const [date, setDate] = useState(str(ev.eventDate));
  const [hour, setHour] = useState(() => Number(str(ev.eventTime).slice(0, 2)) || 16);
  const [min, setMin] = useState(() => str(ev.eventTime).slice(3, 5) || "00");
  const [done, setDone] = useState<number | null>(null);
  const time = `${String(hour).padStart(2, "0")}:${min}`;
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={CalendarDays} title={T(ctx.lang, "Data e ora", "Date & time")} sub={T(ctx.lang, "Scegli il giorno e l'orario d'inizio", "Pick the day and start time")}>
      <DatePicker label={T(ctx.lang, "Giorno", "Day")} value={date} onChange={setDate} lang={ctx.lang} inline />
      <div className="ax-label">{T(ctx.lang, "Ora", "Time")} <b className="ax-time">{time}</b></div>
      <div className="ax-chips" role="group" aria-label={T(ctx.lang, "Ora", "Hour")}>
        {HOURS.map((h) => <button key={h} type="button" className={`ax-chip${h === hour ? " is-on" : ""}`} aria-pressed={h === hour} onClick={() => setHour(h)}>{h}</button>)}
      </div>
      <div className="ax-chips" role="group" aria-label={T(ctx.lang, "Minuti", "Minutes")}>
        {MINUTES.map((m) => <button key={m} type="button" className={`ax-chip${m === min ? " is-on" : ""}`} aria-pressed={m === min} onClick={() => setMin(m)}>:{m}</button>)}
      </div>
      <button type="button" className="ax-go" disabled={ctx.disabled || !/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={() => setDone(ctx.apply([{ tool: "setEvent", key: "eventDate", value: date }, { tool: "setEvent", key: "eventTime", value: time }]))}>
        <Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Applica", "Apply")}
      </button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Luogo ─────────────
function PlaceTool({ ctx }: { ctx: ToolCtx }) {
  const venueBlock = findBlock(ctx.config, "venue");
  const [name, setName] = useState(str(venueBlock?.props.venue) || str((ctx.config.event as Record<string, unknown>).venue));
  const [address, setAddress] = useState(str((ctx.config.event as Record<string, unknown>).address));
  const [picked, setPicked] = useState(Boolean(address));
  const [done, setDone] = useState<number | null>(null);
  function go() {
    const actions: Action[] = [];
    if (name.trim()) {
      const v = ensureBlock(ctx.config, "venue");
      actions.push(...v.actions, { tool: "setBlockProp", blockId: v.id, key: "venue", value: name.trim() });
    }
    if (address && picked) {
      const m = ensureBlock(ctx.config, "map");
      actions.push({ tool: "setEvent", key: "address", value: address }, ...m.actions);
    }
    setDone(ctx.apply(actions, { placesAllowed: picked && address ? [address] : [] }));
  }
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={MapPin} title={T(ctx.lang, "Luogo", "Venue")} sub={T(ctx.lang, "Il nome per la Location, l'indirizzo per la mappa", "Name for the Location, address for the map")}>
      <label className="ax-field"><span>{T(ctx.lang, "Nome del luogo", "Venue name")}</span><input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Villa Aurelia" /></label>
      <div className="ax-label">{T(ctx.lang, "Indirizzo reale", "Real address")}{picked && address ? <b className="ax-ok"><Check size={13} aria-hidden="true" />{T(ctx.lang, "agganciato", "linked")}</b> : null}</div>
      <PlaceSearch lang={ctx.lang} initial={address} onType={(t) => { setAddress(t); setPicked(false); }} onPick={(a) => { setAddress(a); setPicked(true); }} />
      <button type="button" className="ax-go" disabled={ctx.disabled || (!name.trim() && !picked)} onClick={go}><Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Applica", "Apply")}</button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Sfondo animato ─────────────
const BG_LABEL: Record<BackgroundKind, [string, string]> = { none: ["Nessuno", "None"], confetti: ["Coriandoli", "Confetti"], bubbles: ["Bolle", "Bubbles"], petals: ["Petali", "Petals"], sparkles: ["Scintille", "Sparkles"], waves: ["Onde", "Waves"], snow: ["Neve", "Snow"] };
const BG_COLORS = ["", "#b8893f", "#e2b7b0", "#ffffff", "#a9b29b", "#7a1f2b", "#1f2a44"];
function BackgroundTool({ ctx }: { ctx: ToolCtx }) {
  const [kind, setKind] = useState<BackgroundKind>(ctx.config.background?.kind ?? "petals");
  const [color, setColor] = useState(ctx.config.background?.color ?? "");
  const [done, setDone] = useState<number | null>(null);
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={Sparkles} title={T(ctx.lang, "Sfondo animato", "Animated background")} sub={T(ctx.lang, "Si muove dietro tutto l'invito", "It moves behind the whole invitation")}>
      <div className="ax-bg-grid" role="radiogroup" aria-label={T(ctx.lang, "Sfondo", "Background")}>
        {BACKGROUND_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={k === kind} className={`ax-bg${k === kind ? " is-on" : ""}`} onClick={() => setKind(k)} style={{ ["--fx" as string]: color || "#b8893f" }}>
            <span className={`ax-bg-fx fx-${k}`} aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
            <span className="ax-bg-name">{T(ctx.lang, BG_LABEL[k][0], BG_LABEL[k][1])}</span>
          </button>
        ))}
      </div>
      {kind !== "none" && (
        <>
          <div className="ax-label">{T(ctx.lang, "Colore del movimento", "Motion colour")}</div>
          <div className="ax-swatches">
            {BG_COLORS.map((c) => (
              <button key={c || "theme"} type="button" className={`ax-swatch${c === color ? " is-on" : ""}${c ? "" : " is-auto"}`} style={c ? { background: c } : undefined} aria-pressed={c === color} aria-label={c || T(ctx.lang, "Colori del tema", "Theme colours")} onClick={() => setColor(c)}>
                {!c && "A"}
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className="ax-go" disabled={ctx.disabled} onClick={() => setDone(ctx.apply([{ tool: "setBackground", kind, ...(color && kind !== "none" ? { color } : {}) }]))}><Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Applica", "Apply")}</button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Dress code ─────────────
const PALETTE: { hex: string; it: string; en: string }[] = [
  { hex: "#a9b29b", it: "Salvia", en: "Sage" }, { hex: "#7a1f2b", it: "Borgogna", en: "Burgundy" }, { hex: "#b8924a", it: "Oro", en: "Gold" },
  { hex: "#f3ebdd", it: "Avorio", en: "Ivory" }, { hex: "#1d1b19", it: "Nero", en: "Black" }, { hex: "#1f2a44", it: "Blu notte", en: "Midnight blue" },
  { hex: "#b5654a", it: "Terracotta", en: "Terracotta" }, { hex: "#e2b7b0", it: "Rosa cipria", en: "Dusty pink" }, { hex: "#2f4f3a", it: "Verde bosco", en: "Forest green" },
  { hex: "#b9a8d4", it: "Lavanda", en: "Lavender" }, { hex: "#e9dcc0", it: "Champagne", en: "Champagne" }, { hex: "#8c8c8c", it: "Grigio perla", en: "Pearl grey" },
];
const DRESS_STYLES = [["Elegante", "Elegant"], ["Black tie", "Black tie"], ["Cocktail", "Cocktail"], ["Casual chic", "Casual chic"], ["Total white", "All white"], ["Boho", "Boho"]];
function DressTool({ ctx }: { ctx: ToolCtx }) {
  const block = findBlock(ctx.config, "dresscode");
  const current = Array.isArray(block?.props.colors) ? (block!.props.colors as { hex?: string; name?: string }[]) : [];
  const [dress, setDress] = useState(str(block?.props.dress));
  const [colors, setColors] = useState<{ hex: string; name: string }[]>(current.filter((c) => c.hex).map((c) => ({ hex: String(c.hex).toLowerCase(), name: str(c.name) })));
  const [done, setDone] = useState<number | null>(null);
  const toggle = (p: (typeof PALETTE)[number]) => setColors((l) => (l.some((c) => c.hex === p.hex) ? l.filter((c) => c.hex !== p.hex) : l.length >= 6 ? l : [...l, { hex: p.hex, name: T(ctx.lang, p.it, p.en) }]));
  function go() {
    const b = ensureBlock(ctx.config, "dresscode");
    setDone(ctx.apply([...b.actions, { tool: "setBlockProp", blockId: b.id, key: "dress", value: dress.trim() }, { tool: "setBlockList", blockId: b.id, key: "colors", itemsJson: JSON.stringify(colors) }]));
  }
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={Shirt} title="Dress code" sub={T(ctx.lang, "Stile e fino a 6 colori", "Style and up to 6 colours")}>
      <div className="ax-chips">
        {DRESS_STYLES.map(([itL, enL]) => { const v = T(ctx.lang, itL, enL); return <button key={itL} type="button" className={`ax-chip${dress === v ? " is-on" : ""}`} onClick={() => setDress(v)}>{v}</button>; })}
      </div>
      <label className="ax-field"><span>{T(ctx.lang, "Oppure scrivilo", "Or type it")}</span><input value={dress} maxLength={60} onChange={(e) => setDress(e.target.value)} /></label>
      <div className="ax-label">{T(ctx.lang, "I tuoi colori", "Your colours")} <b>{colors.length}/6</b></div>
      {colors.length === 0 ? (
        <p className="ax-empty">{T(ctx.lang, "Nessun colore: scegline dalla palette.", "No colours yet: pick from the palette.")}</p>
      ) : (
        <div className="ax-picked">
          {colors.map((c) => (
            <button key={c.hex} type="button" className="ax-picked-chip" onClick={() => setColors((l) => l.filter((x) => x.hex !== c.hex))} aria-label={`${T(ctx.lang, "Togli", "Remove")} ${c.name || c.hex}`}>
              <span style={{ background: c.hex }} aria-hidden="true" />{c.name || c.hex}<X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <div className="ax-label">{T(ctx.lang, "Palette", "Palette")}{colors.length >= 6 && <b className="ax-full">{T(ctx.lang, "pieno: togli un colore per cambiarlo", "full: remove one to change")}</b>}</div>
      <div className={`ax-palette${colors.length >= 6 ? " is-full" : ""}`}>
        {PALETTE.map((p) => { const on = colors.some((c) => c.hex === p.hex); return (
          <button key={p.hex} type="button" className={`ax-tone${on ? " is-on" : ""}`} aria-pressed={on} disabled={!on && colors.length >= 6} onClick={() => toggle(p)}>
            <span style={{ background: p.hex }} aria-hidden="true">{on && <Check size={14} />}</span>{T(ctx.lang, p.it, p.en)}
          </button>
        ); })}
      </div>
      {colors.length > 0 && <div className="ax-strip" aria-hidden="true">{colors.map((c) => <i key={c.hex} style={{ background: c.hex }} />)}</div>}
      <button type="button" className="ax-go" disabled={ctx.disabled} onClick={go}><Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Applica", "Apply")}</button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Domande della conferma ─────────────
const TYPE_LABEL: Record<RsvpQuestionType, [string, string]> = { "yes-no": ["Sì/No", "Yes/No"], text: ["Testo", "Text"], number: ["Numero", "Number"], choice: ["Scelta", "Choice"] };
function QuestionsTool({ ctx }: { ctx: ToolCtx }) {
  const presets = useMemo(() => presetQuestions(ctx.lang), [ctx.lang]);
  const existing = ctx.config.rsvpQuestions ?? [];
  const [list, setList] = useState<RsvpQuestion[]>(() => (existing.length ? existing : presets.filter((p) => p.on).map(({ locked: _l, on: _o, ...q }) => q)));
  const [label, setLabel] = useState("");
  const [type, setType] = useState<RsvpQuestionType>("text");
  const [done, setDone] = useState<number | null>(null);
  const has = (q: RsvpQuestion) => list.some((x) => x.label === q.label);
  function go() {
    const r = ensureBlock(ctx.config, "rsvp");
    setDone(ctx.apply([...r.actions, { tool: "setRsvpQuestions", questionsJson: JSON.stringify(list) }]));
  }
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={ClipboardCheck} title={T(ctx.lang, "Domande RSVP", "RSVP questions")} sub={T(ctx.lang, "Tocca per aggiungere o togliere, fino a 8", "Tap to add or remove, up to 8")}>
      <div className="ax-chips">
        {presets.map(({ locked: _l, on: _o, ...q }) => (
          <button key={q.id} type="button" className={`ax-chip${has(q) ? " is-on" : ""}`} aria-pressed={has(q)} onClick={() => setList((l) => (has(q) ? l.filter((x) => x.label !== q.label) : l.length >= 8 ? l : [...l, q]))}>
            {has(q) ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{q.label}
          </button>
        ))}
      </div>
      <ol className="ax-qlist">
        {list.map((q, i) => (
          <li key={`${q.id}-${i}`}>
            <span className="ax-qn">{i + 1}</span>
            <span className="ax-qt">{q.label}<small>{T(ctx.lang, TYPE_LABEL[q.type][0], TYPE_LABEL[q.type][1])}</small></span>
            <button type="button" className="ax-icon" aria-label={T(ctx.lang, "Togli", "Remove")} onClick={() => setList((l) => l.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
      <div className="ax-add">
        <input value={label} maxLength={160} placeholder={T(ctx.lang, "Una tua domanda…", "Your own question…")} onChange={(e) => setLabel(e.target.value)} aria-label={T(ctx.lang, "Nuova domanda", "New question")} />
        <select value={type} onChange={(e) => setType(e.target.value as RsvpQuestionType)} aria-label={T(ctx.lang, "Tipo", "Type")}>
          {(["text", "yes-no", "number"] as RsvpQuestionType[]).map((t) => <option key={t} value={t}>{T(ctx.lang, TYPE_LABEL[t][0], TYPE_LABEL[t][1])}</option>)}
        </select>
        <button type="button" className="ax-icon is-solid" disabled={!label.trim() || list.length >= 8} aria-label={T(ctx.lang, "Aggiungi", "Add")} onClick={() => { setList((l) => [...l, { id: `q${l.length + 1}`, label: label.trim(), type, ...(type === "yes-no" ? { yes: T(ctx.lang, "Sì", "Yes"), no: "No" } : {}) }]); setLabel(""); }}><Plus size={16} aria-hidden="true" /></button>
      </div>
      <button type="button" className="ax-go" disabled={ctx.disabled || list.length === 0} onClick={go}><Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Applica", "Apply")}</button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Musica ─────────────
function MusicTool({ ctx }: { ctx: ToolCtx }) {
  const tracks = ctx.catalog.music.filter((t) => t.enabled);
  const block = findBlock(ctx.config, "music");
  const [sel, setSel] = useState(str(block?.props.music));
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  function toggle(url: string) {
    if (playing === url) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    audio.current = new Audio(url);
    audio.current.onended = () => setPlaying(null);
    void audio.current.play().catch(() => setPlaying(null));
    setPlaying(url);
  }
  function go() {
    const b = ensureBlock(ctx.config, "music");
    audio.current?.pause(); setPlaying(null);
    setDone(ctx.apply([...b.actions, { tool: "setBlockMedia", blockId: b.id, key: "music", url: sel }], { mediaAllowed: [sel] }));
  }
  if (tracks.length === 0) return <Shell onClose={ctx.close} lang={ctx.lang} icon={Music} title={T(ctx.lang, "Musica", "Music")} sub=""><p className="ax-empty">{T(ctx.lang, "La libreria musicale è vuota.", "The music library is empty.")}</p></Shell>;
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={Music} title={T(ctx.lang, "Musica", "Music")} sub={T(ctx.lang, "Ascolta un'anteprima e scegli", "Listen to a preview and pick")}>
      <ul className="ax-tracks">
        {tracks.map((t) => (
          <li key={t.id} className={`${sel === t.url ? "is-on" : ""}${playing === t.url ? " is-playing" : ""}`}>
            <button type="button" className="ax-play" aria-label={playing === t.url ? T(ctx.lang, "Pausa", "Pause") : T(ctx.lang, "Ascolta", "Listen")} onClick={() => toggle(t.url)}>{playing === t.url ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
            <button type="button" className="ax-track" aria-pressed={sel === t.url} onClick={() => setSel(t.url)}>
              <strong>{t.title}</strong><small>{t.artist}</small>
            </button>
            <span className="ax-eq" aria-hidden="true"><i /><i /><i /><i /></span>
          </li>
        ))}
      </ul>
      <button type="button" className="ax-go" disabled={ctx.disabled || !sel} onClick={go}><Sparkles size={16} aria-hidden="true" />{T(ctx.lang, "Metti questa musica", "Use this music")}</button>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Foto di copertina ─────────────
const PHOTO_IDEAS = [["fiori bianchi", "white flowers"], ["villa toscana", "tuscan villa"], ["mare al tramonto", "sea at sunset"], ["anelli", "rings"], ["giardino", "garden"], ["candele", "candles"]];
function PhotoTool({ ctx }: { ctx: ToolCtx }) {
  const [q, setQ] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [busy, setBusy] = useState<"search" | number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  async function search(term: string) {
    if (!term.trim()) return;
    setQ(term); setBusy("search"); setErr(null);
    try { setPhotos(await searchStock(ctx.invitationId, term.trim(), 1, { type: "photo", orientation: "vertical", order: "popular", editorsChoice: false, minWidth: 0 })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(null); }
  }
  async function pick(p: StockPhoto) {
    setBusy(p.id); setErr(null);
    try {
      const url = await importStock(ctx.invitationId, p.id);
      const hero = findBlock(ctx.config, "hero");
      if (!hero) throw new Error(T(ctx.lang, "Manca l'intestazione", "Header missing"));
      setDone(ctx.apply([{ tool: "setBlockMedia", blockId: hero.id, key: "couplePhoto", url }], { mediaAllowed: [url] }));
    } catch (e) { setErr(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(null); }
  }
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={ImagePlus} title={T(ctx.lang, "Foto di copertina", "Cover photo")} sub={T(ctx.lang, "Cerca e tocca una foto: va nell'intestazione", "Search and tap a photo: it goes in the header")}>
      <form className="ax-search" onSubmit={(e) => { e.preventDefault(); void search(q); }}>
        <Search size={16} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T(ctx.lang, "Cosa cerchi?", "What are you looking for?")} aria-label={T(ctx.lang, "Cerca foto", "Search photos")} />
        <button type="submit" className="ax-icon is-solid" disabled={busy !== null || !q.trim()} aria-label={T(ctx.lang, "Cerca", "Search")}>{busy === "search" ? <Loader2 size={16} className="ax-spin" aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" style={{ transform: "rotate(-90deg)" }} />}</button>
      </form>
      {photos.length === 0 && busy !== "search" && (
        <div className="ax-chips">{PHOTO_IDEAS.map(([it, en]) => <button key={it} type="button" className="ax-chip" onClick={() => void search(T(ctx.lang, it, en))}>{T(ctx.lang, it, en)}</button>)}</div>
      )}
      {busy === "search" && <div className="ax-shimmer-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>}
      {photos.length > 0 && busy !== "search" && (
        <div className="ax-photos">
          {photos.slice(0, 12).map((p) => (
            <button key={p.id} type="button" className={`ax-photo${busy === p.id ? " is-busy" : ""}`} disabled={busy !== null || ctx.disabled} onClick={() => void pick(p)} aria-label={p.tags}>
              <img src={p.preview} alt="" loading="lazy" />
              {busy === p.id && <span className="ax-photo-busy"><Loader2 size={20} className="ax-spin" aria-hidden="true" /></span>}
            </button>
          ))}
        </div>
      )}
      {err && <p className="ax-done is-fail" role="alert">{err}</p>}
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Struttura ─────────────
function BlocksTool({ ctx }: { ctx: ToolCtx }) {
  const label = (b: BlockInstance) => blockDef(b.type)?.label ?? b.type;
  const [last, setLast] = useState<number | null>(null);
  const blocks = ctx.config.blocks;
  const addable = (["message", "gallery", "image", "program", "venue", "map", "transfer", "dresscode", "video", "music", "countdown", "rsvp", "footer"] as BlockType[])
    .filter((t) => { const d = blockDef(t); return d && !(d.unique && blocks.some((b) => b.type === t)); });
  const fixed = (b: BlockInstance) => Boolean(blockDef(b.type)?.locked || blockDef(b.type)?.anchored);
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={LayoutList} title={T(ctx.lang, "Struttura dell'invito", "Invitation structure")} sub={T(ctx.lang, "Ogni tocco si vede subito nell'anteprima", "Every tap shows up in the preview")}>
      <ol className="ax-blocks">
        {blocks.map((b, i) => (
          <li key={b.id} className={b.hidden ? "is-hidden" : ""}>
            <span className="ax-qn">{i + 1}</span>
            <span className="ax-qt">{label(b)}</span>
            <button type="button" className="ax-icon" disabled={ctx.disabled || fixed(b) || i === 0 || fixed(blocks[i - 1])} aria-label={T(ctx.lang, "Su", "Up")} onClick={() => setLast(ctx.apply([{ tool: "moveBlock", blockId: b.id, to: i - 1 }]))}><ArrowUp size={14} aria-hidden="true" /></button>
            <button type="button" className="ax-icon" disabled={ctx.disabled || fixed(b) || i === blocks.length - 1} aria-label={T(ctx.lang, "Giù", "Down")} onClick={() => setLast(ctx.apply([{ tool: "moveBlock", blockId: b.id, to: i + 1 }]))}><ArrowDown size={14} aria-hidden="true" /></button>
            <button type="button" className="ax-icon" disabled={ctx.disabled || b.type === "cover" || b.type === "hero"} aria-label={b.hidden ? T(ctx.lang, "Mostra", "Show") : T(ctx.lang, "Nascondi", "Hide")} onClick={() => setLast(ctx.apply([{ tool: "setBlockHidden", blockId: b.id, hidden: !b.hidden }]))}>{b.hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}</button>
          </li>
        ))}
      </ol>
      {addable.length > 0 && (
        <>
          <div className="ax-label">{T(ctx.lang, "Aggiungi una sezione", "Add a section")}</div>
          <div className="ax-chips">{addable.map((t) => <button key={t} type="button" className="ax-chip" disabled={ctx.disabled} onClick={() => { const e = ensureBlock(ctx.config, t); setLast(ctx.apply(e.actions)); }}><Plus size={13} aria-hidden="true" />{blockDef(t)?.label}</button>)}</div>
        </>
      )}
      {last !== null && <Done lang={ctx.lang} n={last} />}
    </Shell>
  );
}

// ───────────── Tipo di evento ─────────────
const EVENT_ICON: Record<EventType, LucideIcon> = { wedding: Heart, birthday: Cake, baby: Baby, corporate: Briefcase, graduation: GraduationCap };
const EVENT_EN: Record<EventType, string> = { wedding: "Wedding", birthday: "Birthday", baby: "Baby shower", corporate: "Corporate event", graduation: "Graduation" };
function EventTool({ ctx }: { ctx: ToolCtx }) {
  const [done, setDone] = useState<number | null>(null);
  const [cur, setCur] = useState<EventType>(ctx.config.eventType);
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={Wand2} title={T(ctx.lang, "Tipo di evento", "Event type")} sub={T(ctx.lang, "Cambia i testi di partenza e le etichette", "Changes the starting texts and labels")}>
      <div className="ax-events">
        {EVENT_TYPES.map((e) => { const Icon = EVENT_ICON[e.id]; return (
          <button key={e.id} type="button" className={`ax-event${cur === e.id ? " is-on" : ""}`} aria-pressed={cur === e.id} disabled={ctx.disabled} onClick={() => { setCur(e.id); setDone(ctx.apply([{ tool: "setEventType", eventType: e.id }])); }}>
            <Icon size={22} aria-hidden="true" /><span>{T(ctx.lang, e.label, EVENT_EN[e.id])}</span>
          </button>
        ); })}
      </div>
      {done !== null && <Done lang={ctx.lang} n={done} />}
    </Shell>
  );
}

// ───────────── Testi con l'AI ─────────────
const TARGETS: { id: string; it: string; en: string; type: BlockType }[] = [
  { id: "message", it: "Messaggio agli ospiti", en: "Message to guests", type: "message" },
  { id: "footer", it: "Ringraziamento finale", en: "Closing thanks", type: "footer" },
  { id: "rsvp", it: "Invito a confermare", en: "RSVP invitation", type: "rsvp" },
  { id: "transfer", it: "Come arrivare", en: "Directions", type: "transfer" },
];
const TONES = [["Romantico", "Romantic"], ["Elegante", "Elegant"], ["Divertente", "Playful"], ["Poetico", "Poetic"], ["Essenziale", "Minimal"], ["Caloroso", "Warm"]];
const LENGTHS = [["Breve", "Short"], ["Medio", "Medium"], ["Ricco", "Rich"]];
function WriteTool({ ctx }: { ctx: ToolCtx }) {
  const [target, setTarget] = useState(TARGETS[0].id);
  const [tone, setTone] = useState(TONES[0][0]);
  const [len, setLen] = useState(LENGTHS[0][0]);
  const [sent, setSent] = useState(false);
  const t = TARGETS.find((x) => x.id === target)!;
  function go() {
    const toneL = TONES.find((x) => x[0] === tone)!;
    const lenL = LENGTHS.find((x) => x[0] === len)!;
    setSent(true);
    ctx.ask(ctx.lang === "en"
      ? `Write the text of the "${t.en}" section (${t.type} block) in a ${toneL[1].toLowerCase()} tone, ${lenL[1].toLowerCase()} length. Use the names, date and venue of the invitation, don't invent facts. If the block is missing, add it. Apply it directly.`
      : `Scrivi il testo della sezione «${t.it}» (blocco ${t.type}) con tono ${toneL[0].toLowerCase()}, lunghezza ${lenL[0].toLowerCase()}. Usa nomi, data e luogo dell'invito, non inventare fatti. Se il blocco manca, aggiungilo. Applicalo direttamente.`);
  }
  return (
    <Shell onClose={ctx.close} lang={ctx.lang} icon={PenLine} title={T(ctx.lang, "Scrivi i testi", "Write the texts")} sub={T(ctx.lang, "Scegli e l'AI scrive per te · usa 1 richiesta", "Pick and the AI writes for you · uses 1 request")}>
      <div className="ax-label">{T(ctx.lang, "Cosa", "What")}</div>
      <div className="ax-chips">{TARGETS.map((x) => <button key={x.id} type="button" className={`ax-chip${target === x.id ? " is-on" : ""}`} onClick={() => setTarget(x.id)}>{T(ctx.lang, x.it, x.en)}</button>)}</div>
      <div className="ax-label">{T(ctx.lang, "Tono", "Tone")}</div>
      <div className="ax-chips">{TONES.map(([itL, enL]) => <button key={itL} type="button" className={`ax-chip${tone === itL ? " is-on" : ""}`} onClick={() => setTone(itL)}>{T(ctx.lang, itL, enL)}</button>)}</div>
      <div className="ax-label">{T(ctx.lang, "Lunghezza", "Length")}</div>
      <div className="ax-seg">{LENGTHS.map(([itL, enL]) => <button key={itL} type="button" className={len === itL ? "is-on" : ""} onClick={() => setLen(itL)}>{T(ctx.lang, itL, enL)}</button>)}</div>
      <button type="button" className="ax-go is-ai" disabled={ctx.disabled || sent} onClick={go}><Wand2 size={16} aria-hidden="true" />{sent ? T(ctx.lang, "Richiesta inviata", "Request sent") : T(ctx.lang, "Scrivi con BeSpoke AI", "Write with BeSpoke AI")}</button>
    </Shell>
  );
}

export function CommandWidget({ id, ctx }: { id: CommandId; ctx: ToolCtx }) {
  switch (id) {
    case "date": return <DateTool ctx={ctx} />;
    case "place": return <PlaceTool ctx={ctx} />;
    case "background": return <BackgroundTool ctx={ctx} />;
    case "dress": return <DressTool ctx={ctx} />;
    case "questions": return <QuestionsTool ctx={ctx} />;
    case "music": return <MusicTool ctx={ctx} />;
    case "photo": return <PhotoTool ctx={ctx} />;
    case "blocks": return <BlocksTool ctx={ctx} />;
    case "event": return <EventTool ctx={ctx} />;
    case "write": return <WriteTool ctx={ctx} />;
  }
}

// Ricerca dei comandi per la palette «/»: nome, descrizione e parole chiave.
export function matchCommands(q: string, lang: Lang) {
  const s = q.trim().toLowerCase();
  if (!s) return COMMANDS;
  return COMMANDS.filter((c) => `${T(lang, c.it, c.en)} ${T(lang, c.itHint, c.enHint)} ${c.keys}`.toLowerCase().includes(s));
}
