"use client";

import { useEffect, useRef, useState } from "react";
import { FOLDER, FOLDER_GROUPS, FOLDER_GROUPS_EN, type FolderSection } from "@inviteme/shared";
import { ArrowLeft, ChevronLeft, ChevronRight, Armchair, Car, Building2, Cake, Camera, Church, Clock, FileText, Flower2, Gift, Heart, Hotel, Images, ListChecks, Luggage, MapPin, Mic, Music, Package, Palette, PartyPopper, Phone, Shield, Shirt, Sparkles, Store, Tent, Users, Utensils, Wallet, Wine, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { useLang } from "@/lib/lang";

// Icona di ogni sezione della cartella.
const ICON: Record<string, LucideIcon> = {
  "programma-generale": Clock,
  "programma-cerimonia": Church,
  "programma-ricevimento": PartyPopper,
  "programma-sposa": Flower2,
  "programma-sposo": Shirt,
  "programma-invitati": Users,
  trasporti: Car,
  "ordine-cerimonia": ListChecks,
  discorsi: Mic,
  musica: Music,
  intrattenimento: Sparkles,
  "piano-b": Shield,
  "chi-chiamare": Phone,
  corteo: Heart,
  famiglia: Users,
  fornitori: Store,
  ringraziamenti: Gift,
  luoghi: MapPin,
  alloggio: Hotel,
  noleggi: Tent,
  consegne: Package,
  allestimento: Armchair,
  palette: Palette,
  menu: Utensils,
  bevande: Wine,
  "lista-foto": Camera,
  "programma-foto": Images,
  "valigia-sposa": Luggage,
  "valigia-sposo": Luggage,
  "kit-emergenza": Building2,
  "altre-cose": Sparkles,
  prenotare: Wallet,
  "ultima-settimana": Cake,
  "dopo-matrimonio": FileText,
};
const iconFor = (key: string): LucideIcon => ICON[key] ?? FileText;

// Cartella del matrimonio: sezioni raggruppate, con righe tipizzate, ricerca, «Utile adesso» e stampa come documento.
export type FolderRow = Record<string, string | boolean>;
export type FolderValue = string | { items: FolderRow[] };
export type FolderVendor = { id: string; name: string; role: string; contact: string; contract_status: string };

const LABEL_BY_KIND: Record<FolderSection["kind"], string[]> = {
  timeline: ["momento", "momenti"],
  contacts: ["contatto", "contatti"],
  checklist: ["voce", "voci"],
  text: ["", ""],
};
const LABEL_BY_KIND_EN: Record<FolderSection["kind"], string[]> = {
  timeline: ["moment", "moments"],
  contacts: ["contact", "contacts"],
  checklist: ["item", "items"],
  text: ["", ""],
};
// Titolo, gruppo e suggerimento di una sezione nella lingua del sito.
const titleOf = (s: FolderSection, en: boolean) => (en ? s.titleEn : s.title);
const groupOf = (g: string, en: boolean) => (en ? FOLDER_GROUPS_EN[g as keyof typeof FOLDER_GROUPS_EN] ?? g : g);

const itemsOf = (v: FolderValue | undefined): FolderRow[] => (v && typeof v === "object" ? v.items : []);
const textOf = (v: FolderValue | undefined): string => (typeof v === "string" ? v : "");
const filled = (section: FolderSection, v: FolderValue | undefined): boolean => {
  if (section.kind === "text") return textOf(v).trim().length > 0;
  return itemsOf(v).length > 0;
};

// Riepilogo di una sezione: quanti elementi e, per le spunte, quante fatte.
function summary(section: FolderSection, v: FolderValue | undefined, vendors: FolderVendor[], en: boolean): string {
  if (section.key === "fornitori") return en ? `${vendors.length} ${vendors.length === 1 ? "vendor" : "vendors"}` : `${vendors.length} ${vendors.length === 1 ? "fornitore" : "fornitori"}`;
  if (section.kind === "text") return textOf(v).trim() ? (en ? "written" : "scritto") : (en ? "empty" : "vuoto");
  const items = itemsOf(v);
  if (section.kind === "checklist") return `${items.filter((i) => i.done).length} ${en ? "of" : "di"} ${items.length}`;
  const [one, many] = (en ? LABEL_BY_KIND_EN : LABEL_BY_KIND)[section.kind];
  return items.length === 1 ? `1 ${one}` : `${items.length} ${many}`;
}

export function Folder({
  docs,
  vendors,
  tables,
  guests,
  eventTitle,
  eventDate,
  onSave,
  onPdf,
  request,
}: {
  // Apertura di una sezione chiesta da fuori (le schede «Utili adesso» del planner): n cambia a ogni richiesta.
  request?: { key: string; n: number } | null;
  docs: Record<string, FolderValue>;
  onPdf: () => void;
  vendors: FolderVendor[];
  tables: { id: string; name: string; seats: number }[];
  guests: { name: string; party_size: number; table_id: string | null; response: string }[];
  eventTitle: string;
  eventDate: string;
  onSave: (next: Record<string, FolderValue>) => Promise<void>;
}) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [local, setLocal] = useState<Record<string, FolderValue>>(docs);
  const [open, setOpenState] = useState<string | null>(null);
  // Direzione dell'animazione: avanti (la sezione entra da destra) o indietro (torna l'elenco da sinistra).
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  // Bozza della sezione aperta non ancora salvata: si salva da sola quando si torna indietro.
  const draft = useRef<{ key: string; value: FolderValue } | null>(null);
  const localRef = useRef(local);
  localRef.current = local;

  const written = FOLDER.filter((s) => s.key === "fornitori" ? vendors.length > 0 : filled(s, local[s.key])).length;
  const readyItems = FOLDER.reduce((n, s) => n + (s.kind === "text" ? (textOf(local[s.key]).trim() ? 1 : 0) : itemsOf(local[s.key]).length), 0);
  const checked = FOLDER.reduce((n, s) => n + (s.kind === "checklist" ? itemsOf(local[s.key]).filter((i) => i.done).length : 0), 0);
  const checkable = FOLDER.reduce((n, s) => n + (s.kind === "checklist" ? itemsOf(local[s.key]).length : 0), 0);
  const urgent = FOLDER.filter((s) => s.priority && !filled(s, local[s.key]));

  const q = query.trim().toLowerCase();
  const matches = (s: FolderSection) => !q || [titleOf(s, en), groupOf(s.group, en), en ? s.hintEn : s.hint].some((x) => x.toLowerCase().includes(q));

  async function persist(next: Record<string, FolderValue>) {
    setBusy(true);
    setLocal(next);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
    }
  }

  const current = open ? FOLDER.find((s) => s.key === open) : undefined;

  function scrollTop() {
    const el = top.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
  }

  async function flushDraft() {
    const d = draft.current;
    draft.current = null;
    if (d) await persist({ ...localRef.current, [d.key]: d.value });
  }

  // Apre una sezione come pagina a sé. La voce nella cronologia fa funzionare il tasto indietro del telefono.
  useEffect(() => {
    if (request) void openSection(request.key);
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openSection(key: string) {
    await flushDraft();
    setDir("fwd");
    if (!open) window.history.pushState({ folder: key }, "");
    else window.history.replaceState({ folder: key }, "");
    setOpenState(key);
    scrollTop();
  }

  function back() {
    if (window.history.state?.folder) window.history.back(); // chiude tramite popstate
    else void closeSection();
  }

  async function closeSection() {
    await flushDraft();
    setDir("back");
    setOpenState(null);
    scrollTop();
  }

  useEffect(() => {
    const onPop = () => { if (!window.history.state?.folder) void closeSection(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Uscendo dal planner con una sezione aperta, la voce aggiunta alla cronologia non deve restare.
  useEffect(() => () => { if (window.history.state?.folder) window.history.replaceState(null, ""); }, []);

  if (current) {
    const idx = FOLDER.findIndex((s) => s.key === current.key);
    const prev = FOLDER[idx - 1];
    const next = FOLDER[idx + 1];
    return (
      <div className="fo fo-page is-fwd" ref={top} key={current.key}>
        <button type="button" className="fo-back pp-noprint" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          {t("Cartella", "Folder")}
        </button>
        <FolderEditor
          section={current}
          value={local[current.key]}
          vendors={vendors}
          busy={busy}
          onDraft={(value) => { draft.current = { key: current.key, value }; }}
          onSave={async (v) => { draft.current = null; await persist({ ...local, [current.key]: v }); }}
        />
        <nav className="fo-pager pp-noprint" aria-label={t("Altre sezioni", "Other sections")}>
          {prev ? (
            <button type="button" className="fo-pager-btn" onClick={() => openSection(prev.key)}>
              <ChevronLeft size={18} aria-hidden="true" />
              <span><small>{t("Precedente", "Previous")}</small>{titleOf(prev, en)}</span>
            </button>
          ) : <span />}
          {next && (
            <button type="button" className="fo-pager-btn is-next" onClick={() => openSection(next.key)}>
              <span><small>{t("Successiva", "Next")}</small>{titleOf(next, en)}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </nav>
      </div>
    );
  }

  return (
    <div className={`fo fo-page${dir === "back" ? " is-back" : ""}`} ref={top}>
      <header className="fo-head pp-noprint">
        <div>
          <p className="pp-kicker">{t("La cartella del matrimonio", "The wedding folder")}</p>
          <h2>{t(`${written} di ${FOLDER.length} sezioni con qualcosa di preparato`, `${written} of ${FOLDER.length} sections with something prepared`)}</h2>
          <p className="hint">{t(`${readyItems} elementi pronti`, `${readyItems} items ready`)}{checkable ? t(` · ${checked} di ${checkable} spuntati`, ` · ${checked} of ${checkable} ticked`) : ""}</p>
        </div>
        <button type="button" className="btn solid small" onClick={onPdf}>{t("Crea PDF", "Create PDF")}</button>
      </header>

      {urgent.length > 0 && (
        <section className="fo-urgent pp-noprint" aria-label={t("Utile adesso", "Useful now")}>
          <span className="pp-kicker">{t("Utile adesso", "Useful now")}</span>
          <div className="fo-chips">
            {urgent.map((s) => (
              <button key={s.key} type="button" className="fo-chip" onClick={() => openSection(s.key)}>{titleOf(s, en)}</button>
            ))}
          </div>
        </section>
      )}

      <div className="fo-search pp-noprint">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cerca nella cartella", "Search the folder")} aria-label={t("Cerca nella cartella", "Search the folder")} />
      </div>

      {FOLDER_GROUPS.map((group) => {
        const sections = FOLDER.filter((s) => s.group === group && matches(s));
        if (sections.length === 0) return null;
        return (
          <section key={group} className="fo-group pp-noprint" aria-label={groupOf(group, en)}>
            <h3>{groupOf(group, en)}</h3>
            <div className="fo-grid">
              {sections.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  className={`fo-card${filled(s, local[s.key]) || (s.key === "fornitori" && vendors.length) ? " is-filled" : ""}`}
                  style={{ animationDelay: `${i * 35}ms` }}
                  onClick={() => openSection(s.key)}
                >
                  <span className="fo-card-ico">{(() => { const I = iconFor(s.key); return <I size={20} strokeWidth={1.5} aria-hidden="true" />; })()}</span>
                  <strong>{titleOf(s, en)}</strong>
                  <small>{summary(s, local[s.key], vendors, en)}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}

    </div>
  );
}

function FolderEditor({
  section,
  value,
  vendors,
  busy,
  onDraft,
  onSave,
}: {
  section: FolderSection;
  value: FolderValue | undefined;
  vendors: FolderVendor[];
  busy: boolean;
  onDraft: (v: FolderValue) => void;
  onSave: (v: FolderValue) => Promise<void>;
}) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [items, setItems] = useState<FolderRow[]>(itemsOf(value));
  const [text, setText] = useState<string>(textOf(value));
  const [saved, setSaved] = useState(false);

  // Riga vuota per tipo: programma (orario, cosa), contatti (nome, ruolo, telefono), checklist (voce, fatto).
  const blank = (): FolderRow => (section.kind === "timeline" ? { time: "", item: "" } : section.kind === "contacts" ? { name: "", role: "", phone: "" } : { text: "", done: false });
  const setRow = (i: number, patch: FolderRow) => { setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setSaved(false); };
  const valueOf = (rows: FolderRow[], txt: string): FolderValue =>
    section.kind === "text" ? txt : { items: rows.filter((r) => Object.values(r).some((v) => v === true || (typeof v === "string" && v.trim()))) };

  // Ogni modifica diventa la bozza della sezione: tornando indietro si salva da sola.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (section.key !== "fornitori") onDraft(valueOf(items, text));
  }, [items, text]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    await onSave(valueOf(items, text));
    setSaved(true);
  }

  return (
    <section className="fo-editor pp-card pp-noprint" aria-label={titleOf(section, en)}>
      <header className="fo-editor-head">
        <div className="fo-editor-title">
          <span className="fo-editor-ico">{(() => { const I = iconFor(section.key); return <I size={22} strokeWidth={1.5} aria-hidden="true" />; })()}</span>
          <span className="pp-kicker">{groupOf(section.group, en)}</span>
          <h3>{titleOf(section, en)}</h3>
          <p className="hint">{en ? section.hintEn : section.hint}</p>
        </div>
      </header>

      {section.key === "fornitori" ? (
        <ul className="fo-rows">
          {vendors.length === 0 && <li className="hint">{t("Nessun fornitore: aggiungili nella scheda Fornitori.", "No vendors yet: add them in the Vendors tab.")}</li>}
          {vendors.map((v) => <li key={v.id} className="fo-row-static"><strong>{v.name}</strong> <small>{v.role}</small> <small>{v.contact}</small></li>)}
        </ul>
      ) : section.kind === "text" ? (
        <textarea className="fo-text" value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} rows={6} maxLength={4000} aria-label={titleOf(section, en)} />
      ) : (
        <ul className="fo-rows">
          {items.map((r, i) => (
            <li key={i} className="fo-row">
              {section.kind === "timeline" && (<>
                <input value={String(r.time ?? "")} onChange={(e) => setRow(i, { time: e.target.value })} placeholder={t("Ore", "Time")} maxLength={10} aria-label={t("Orario", "Time")} />
                <input value={String(r.item ?? "")} onChange={(e) => setRow(i, { item: e.target.value })} placeholder={t("Cosa succede", "What happens")} maxLength={200} aria-label={t("Momento", "Moment")} />
              </>)}
              {section.kind === "contacts" && (<>
                <input value={String(r.name ?? "")} onChange={(e) => setRow(i, { name: e.target.value })} placeholder={t("Nome", "Name")} maxLength={200} aria-label={t("Nome", "Name")} />
                <input value={String(r.role ?? "")} onChange={(e) => setRow(i, { role: e.target.value })} placeholder={t("Ruolo", "Role")} maxLength={200} aria-label={t("Ruolo", "Role")} />
                <input value={String(r.phone ?? "")} onChange={(e) => setRow(i, { phone: e.target.value })} placeholder={t("Telefono", "Phone")} maxLength={200} aria-label={t("Telefono", "Phone")} />
              </>)}
              {section.kind === "checklist" && (<>
                <Checkbox checked={Boolean(r.done)} onChange={(v) => setRow(i, { done: v })} ariaLabel={t("Fatto", "Done")} />
                <input value={String(r.text ?? "")} onChange={(e) => setRow(i, { text: e.target.value })} placeholder={t("Cosa fare", "To do")} maxLength={200} aria-label={t("Voce", "Item")} />
              </>)}
              <button type="button" className="pp-link" onClick={() => { setItems((rows) => rows.filter((_, j) => j !== i)); setSaved(false); }}>{t("Rimuovi", "Remove")}</button>
            </li>
          ))}
        </ul>
      )}

      {section.key !== "fornitori" && (
        <div className="fo-editor-actions">
          {section.kind !== "text" && <button type="button" className="btn outline small" onClick={() => { setItems((rows) => [...rows, blank()]); setSaved(false); }}>{t("Aggiungi riga", "Add row")}</button>}
          <button type="button" className="btn solid small" disabled={busy} onClick={save}>{busy ? t("Salvo…", "Saving…") : t("Salva sezione", "Save section")}</button>
          {saved && <span className="hint" role="status">{t("Salvata", "Saved")}</span>}
        </div>
      )}
    </section>
  );
}

