"use client";

import { BLOCK_LABELS, EVENT_FIELDS, EVENT_TYPES, HERO_EVENT_KEYS, blockDef, type BlockDef, type BlockInstance, type Catalog, type EventType, type FieldDef, type FontId, type InviteConfig, type RsvpQuestion, BACKGROUND_KINDS, BACKGROUND_LABELS, type BackgroundKind, type BackgroundSpec } from "@inviteme/shared";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Ellipsis, Eye, EyeOff, Image as ImageIcon, LayoutGrid, Palette, Shapes, Trash2, Type } from "lucide-react";
import { Field, FieldEditor, type Values } from "./fields";
import { FontButton } from "./FontButton";
import { ui } from "@/lib/ui";
import { blockCopy, blockDescCopy, fieldCopy } from "@/lib/catalogCopy";
import { MusicPicker } from "./MusicPicker";
import { Checkbox } from "@/components/ui/Checkbox";

// Luogo e indirizzo: con il blocco Mappa si modificano lì, non nel pannello Evento.
const LOCATION_KEYS = ["address"];

// I testi del template (sopratitolo, etichette): se il campo è vuoto mostra il testo predefinito, così si può modificare.
function templateValue(p: Props, def: BlockDef, key: string): unknown {
  const raw = (p.block!.props as Values)[key];
  const isTemplateText = (def.type === "hero" && key === "kicker") || (BLOCK_LABELS[def.type] ?? []).some((l) => l.key === key);
  if (!isTemplateText || (raw !== undefined && raw !== "")) return raw ?? def.defaults[key];
  return (p.config.locale === "en" ? def.defaultsEn?.[key] : undefined) ?? def.defaults[key];
}

// Gruppi di proprietà, nell'ordine in cui compaiono nelle schede: testi, colori, forme, immagini, altro.
type TabKey = "all" | "texts" | "colors" | "shapes" | "media" | "other";
const SHAPE_KEYS = ["cellShape", "galleryStyle", "lookShape", "photoShape"];
const MEDIA_TYPES = ["photo", "photos", "video", "audio"];
const MEDIA_KEYS = ["photoFit", "photoFocus"];
function fieldTab(f: FieldDef): Exclude<TabKey, "all"> {
  if (["text", "longtext", "url", "date", "time", "number"].includes(f.type)) return "texts";
  if (f.type === "color") return "colors";
  if (f.type === "choice" && SHAPE_KEYS.includes(f.key)) return "shapes";
  if (MEDIA_TYPES.includes(f.type) || MEDIA_KEYS.includes(f.key)) return "media";
  return "other";
}
const TAB_ORDER: Exclude<TabKey, "all">[] = ["texts", "colors", "shapes", "media", "other"];
const isTextField = (f: FieldDef) => f.type === "text" || f.type === "longtext";
// Campi della busta che non servono quando il filmato è del tema.
const VIDEO_BUSTA_HIDDEN = ["envelopeColor", "sealColor", "sealText", "coverVideo"];

// Una riga del pannello: una proprietà del blocco, oppure un dato dell'evento (solo nell'Intestazione).
type Item = { field: FieldDef; event: boolean };

function BlockFields({ p, def, L, tab, setTab }: { p: Props; def: BlockDef; L: ReturnType<typeof ui>["builder"]; tab: TabKey; setTab: (t: TabKey) => void }) {
  const items = useMemo<Item[]>(() => {
    const own = def.fields.map((field) => ({ field, event: false }));
    const fromEvent = def.type === "hero" ? EVENT_FIELDS.filter((f) => HERO_EVENT_KEYS.includes(f.key)).map((field) => ({ field, event: true })) : [];
    return [...fromEvent, ...own].sort((a, b) => TAB_ORDER.indexOf(fieldTab(a.field)) - TAB_ORDER.indexOf(fieldTab(b.field)));
  }, [def]);
  const shown = tab === "all" ? items : items.filter((i) => fieldTab(i.field) === tab);
  const present = new Set(items.map((i) => fieldTab(i.field)));
  const groupLabel: Record<Exclude<TabKey, "all">, string> = { texts: L.tabTexts, colors: L.tabColors, shapes: L.tabShapes, media: L.tabMedia, other: L.tabOther };
  // Font scelti per i singoli testi del blocco (campo → font), salvati nelle proprietà del blocco.
  const fontsOf = (p.block!.props.fonts ?? {}) as Record<string, string>;
  function setFont(key: string, id: FontId | null) {
    const next = { ...fontsOf };
    if (id) next[key] = id;
    else delete next[key];
    p.onSetProp(p.block!.id, "fonts", next, `${p.block!.id}:fonts:${key}`);
  }
  const tabs: [TabKey, string, LucideIcon][] = [
    ["all", L.tabAll, LayoutGrid],
    ["texts", L.tabTexts, Type],
    ["colors", L.tabColors, Palette],
    ["shapes", L.tabShapes, Shapes],
    ["media", L.tabMedia, ImageIcon],
    ["other", L.tabOther, Ellipsis],
  ];
  return (
    <>
      <div className="bl-tabs" role="tablist">
        {tabs.filter(([k]) => k === "all" || present.has(k)).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "bl-tab on" : "bl-tab"} onClick={() => setTab(k)}>
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="bl-fields">
        {shown.map(({ field: f, event }, i) => {
          const group = fieldTab(f);
          // Nella scheda «Tutto» ogni gruppo ha la sua intestazione, al primo campo che lo apre.
          const opens = tab === "all" && (i === 0 || fieldTab(shown[i - 1].field) !== group);
          // Ogni testo ha il suo «Aa», dentro il campo: il font si sceglie per quel campo solo.
          const addon = isTextField(f) ? <FontButton label={f.label} value={fontsOf[f.key]} onChange={(id) => setFont(f.key, id)} /> : undefined;
          const field = event ? (
            <FieldEditor
              key={`event:${f.key}`}
              copy={(k, l) => fieldCopy("event", k, l, p.lang ?? "it")}
              field={f}
              value={(p.config.event as Values)[f.key]}
              disabledByFeature={false}
              busy={p.busy}
              library={p.catalog.music}
              onChange={(v) => p.onSetEvent(f.key, v, `event:${f.key}`)}
              onUpload={p.onUpload}
              addon={addon}
            />
          ) : (
            <FieldEditor
              key={f.key}
              copy={(k, l) => fieldCopy(def.type, k, l, p.lang ?? "it")}
              standard={L.standardStyle}
              field={f}
              value={templateValue(p, def, f.key)}
              disabledByFeature={false}
              busy={p.busy}
              library={p.catalog.music}
              onChange={(v) => p.onSetProp(p.block!.id, f.key, v, `${p.block!.id}:${f.key}`)}
              onUpload={p.onUpload}
              addon={addon}
            />
          );
          if (!opens) return field;
          return (
            <Fragment key={`group:${group}:${i}`}>
              <p className="bl-group">{groupLabel[group]}</p>
              {field}
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

type Props = {
  config: InviteConfig;
  catalog: Catalog;
  block: BlockInstance | null;
  busy: string | null;
  onSetProp: (id: string, key: string, value: unknown, group?: string) => void;
  onSetEvent: (key: string, value: unknown, group?: string) => void;
  locked?: boolean;
  videoEnvelope?: boolean; // il tema apre l'invito con un filmato: la Busta non ha proprietà
  onSetLocale: (locale: "it" | "en") => void;
  // Quale parte del pannello generale mostrare, scelta dalle schede: dettagli, tema, lingua, link.
  section?: "dettagli" | "tema" | "lingua" | "link";
  shareUrl?: string;
  slug?: string;
  onSaveSlug?: (slug: string) => Promise<string | null>; // ritorna l'errore, o null se salvato
  onSetEventType: (t: EventType) => void;
  onSetBackground: (b: BackgroundSpec | null) => void;
  onSetQuestions: (q: RsvpQuestion[]) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onBack?: () => void;
  onUpload: (kind: "photo" | "video" | "audio", file: File) => Promise<string | null>;
  lang?: "it" | "en";
};

// Colonna destra: le proprietà del blocco selezionato, oppure i dati generali dell'invito.
export function Inspector(p: Props) {
  const L = ui(p.lang ?? "it").builder;
  // Scheda di secondo livello del blocco (Tutto, Testi, Colori…): tenuta qui per mostrarla nella riga di navigazione.
  const [sub, setSub] = useState<{ id: string; tab: TabKey }>({ id: "", tab: "all" });
  if (p.block) {
    const subTab: TabKey = sub.id === p.block.id ? sub.tab : "all";
    const subLabels: Record<TabKey, string> = { all: L.tabAll, texts: L.tabTexts, colors: L.tabColors, shapes: L.tabShapes, media: L.tabMedia, other: L.tabOther };
    const def = blockDef(p.block.type);
    if (!def) return null;
    // Con il filmato del tema la busta non ha colori né sigillo né filmato propri: restano le scritte e il comportamento al tocco.
    const fieldsDef = p.block.type === "cover" && p.videoEnvelope ? { ...def, fields: def.fields.filter((f) => !VIDEO_BUSTA_HIDDEN.includes(f.key)) } : def;
    return (
      <div className="bl-inspector">
        {p.onBack && (
          <div className="bl-back-row">
            <button type="button" className="bl-back" onClick={p.onBack}><ArrowLeft size={15} aria-hidden="true" />{p.lang === "en" ? "Back to blocks" : "Torna ai blocchi"}</button>
            <nav className="bl-crumbs" aria-label={p.lang === "en" ? "You are here" : "Dove sei"}>
              <button type="button" className="bl-crumb" onClick={p.onBack}>{p.lang === "en" ? "Blocks" : "Blocchi"}</button>
              <span className="bl-crumb-sep" aria-hidden="true">›</span>
              <span className="bl-crumb">{blockCopy(def.type, def.label, p.lang ?? "it")}</span>
              <span className="bl-crumb-sep" aria-hidden="true">›</span>
              <span className="bl-crumb is-current" aria-current="page">{subLabels[subTab]}</span>
            </nav>
          </div>
        )}
        <header className="bl-insp-head">
          <div>
            <p className="bl-kicker">{L.block}</p>
            <h2>{blockCopy(def.type, def.label, p.lang ?? "it")}</h2>
            <p className="hint">{blockDescCopy(def.type, def.description, p.lang ?? "it")}</p>
          </div>
          <div className="bl-insp-actions">
            <button type="button" className="bl-icon" aria-label={p.block.hidden ? L.show : L.hide} onClick={() => p.onToggle(p.block!.id)}>
              {p.block.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <button type="button" className="bl-icon" aria-label={L.remove} onClick={() => p.onRemove(p.block!.id)}>
              <Trash2 size={17} />
            </button>
          </div>
        </header>
        {fieldsDef.fields.length === 0 && p.block.type !== "map" ? (
          <p className="hint">{L.blockHint}</p>
        ) : (
          p.block.type === "music" ? (
            <MusicPicker
              lang={p.lang ?? "it"}
              library={p.catalog.music}
              value={String(p.block.props.music ?? "")}
              onChange={(url) => p.onSetProp(p.block!.id, "music", url, `${p.block!.id}:music`)}
              onUpload={(file) => p.onUpload("audio", file)}
              busy={!!p.busy}
            />
          ) : (
            <BlockFields key={p.block.id} p={p} def={fieldsDef} L={L} tab={subTab} setTab={(t) => setSub({ id: p.block!.id, tab: t })} />
          )
        )}
        {p.block.type === "map" && (
          <section className="bl-group" aria-labelledby="bl-loc">
            <h3 id="bl-loc">{L.location}</h3>
            <p className="hint">{L.locationHelp}</p>
            <div className="bl-fields">
              {EVENT_FIELDS.filter((f) => LOCATION_KEYS.includes(f.key)).map((f) => (
                <FieldEditor
                  key={f.key}
                  copy={(k, l) => fieldCopy("event", k, l, p.lang ?? "it")}
                  field={f}
                  value={(p.config.event as Values)[f.key]}
                  disabledByFeature={false}
                  busy={p.busy}
                  library={p.catalog.music}
                  onChange={(v) => p.onSetEvent(f.key, v, `event:${f.key}`)}
                  onUpload={p.onUpload}
                />
              ))}
            </div>
          </section>
        )}
        {p.block.type === "rsvp" && <StandardQuestions lang={p.lang ?? "it"} questions={p.config.rsvpQuestions} onChange={p.onSetQuestions} />}
        {p.block.type === "rsvp" && <QuestionsEditor questions={p.config.rsvpQuestions} onChange={p.onSetQuestions} L={L} />}
      </div>
    );
  }

  const hasMap = p.config.blocks.some((b) => b.type === "map");
  const hasHero = p.config.blocks.some((b) => b.type === "hero");
  const show = (k: "dettagli" | "tema" | "lingua" | "link") => !p.section || p.section === k;
  return (
    <div className="bl-inspector">
      <header className="bl-insp-head">
        <div>
          <p className="bl-kicker">{L.eventStyle}</p>
          <h2>{L.eventDetails}</h2>
          <p className="hint">{L.selectHint}</p>
        </div>
      </header>

      {show("dettagli") && (
      <section className="bl-group" aria-labelledby="bl-event">
        <h3 id="bl-event">{L.eventDetails}</h3>
        {hasMap && <p className="hint">{L.locationInMap}</p>}
        <div className="bl-fields">
          {EVENT_FIELDS.filter((f) => !(hasHero && HERO_EVENT_KEYS.includes(f.key)) && !(hasMap && LOCATION_KEYS.includes(f.key))).map((f) => (
            <FieldEditor
              key={f.key}
              copy={(k, l) => fieldCopy("event", k, l, p.lang ?? "it")}
              field={f}
              value={(p.config.event as Values)[f.key]}
              disabledByFeature={false}
              busy={p.busy}
              library={p.catalog.music}
              onChange={(v) => p.onSetEvent(f.key, v, `event:${f.key}`)}
              onUpload={p.onUpload}
            />
          ))}
          <Field label={L.eventType}>
            <select value={p.config.eventType} onChange={(e) => p.onSetEventType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
        </div>
      </section>
      )}

      {show("lingua") && (
      <section className="bl-group" aria-labelledby="bl-lang">
        <h3 id="bl-lang">{L.pageLang}</h3>
        <div className="bl-fields">
          <Field label={L.pageLang}>
            <select value={p.config.locale} onChange={(e) => p.onSetLocale(e.target.value as "it" | "en")}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
      </section>
      )}

      {show("link") && <LinkSection lang={p.lang ?? "it"} slug={p.slug} shareUrl={p.shareUrl} onSave={p.onSaveSlug} />}

      {show("tema") && (
      <section className="bl-group" aria-labelledby="bl-style">
        <h3 id="bl-style">{p.lang === "en" ? "Background" : "Sfondo"}</h3>
        <Field label={p.lang === "en" ? "Animated background" : "Sfondo animato"}>
          <select value={p.config.background?.kind ?? ""} onChange={(e) => p.onSetBackground(e.target.value ? { kind: e.target.value as BackgroundKind, color: p.config.background?.color } : null)}>
            <option value="">{p.lang === "en" ? "Theme default" : "Predefinito dello stile"}</option>
            {BACKGROUND_KINDS.map((k) => <option key={k} value={k}>{BACKGROUND_LABELS[k][p.lang === "en" ? "en" : "it"]}</option>)}
          </select>
        </Field>
        {p.config.background && p.config.background.kind !== "none" && (
          <Field label={p.lang === "en" ? "Motion colour" : "Colore del movimento"}>
            <div className="color-row">
              <input type="color" aria-label={p.lang === "en" ? "Motion colour" : "Colore del movimento"} value={p.config.background.color ?? "#b8924a"} onChange={(e) => p.onSetBackground({ kind: p.config.background!.kind, color: e.target.value })} />
              <button type="button" className="link" disabled={!p.config.background.color} onClick={() => p.onSetBackground({ kind: p.config.background!.kind })}>{p.lang === "en" ? "Theme colours" : "Colori del tema"}</button>
            </div>
          </Field>
        )}
      </section>
      )}
    </div>
  );
}

// Domande standard della conferma di presenza, accese e spente con un interruttore (come nel riferimento).
const STANDARD_QUESTIONS: { id: string; it: string; en: string; itHelp: string; enHelp: string }[] = [
  { id: "messaggio", it: "Messaggio personale", en: "Personal message", itHelp: "Gli ospiti possono lasciare un pensiero.", enHelp: "Guests can leave a message." },
  { id: "canzone", it: "Richiesta di canzone", en: "Song request", itHelp: "Gli ospiti suggeriscono le canzoni della festa.", enHelp: "Guests suggest songs for the party." },
  { id: "allergie", it: "Allergie e intolleranze", en: "Allergies and intolerances", itHelp: "Una domanda aperta per le esigenze alimentari.", enHelp: "An open question about dietary needs." },
];

function StandardQuestions({ lang, questions, onChange }: { lang: "it" | "en"; questions: RsvpQuestion[]; onChange: (q: RsvpQuestion[]) => void }) {
  const en = lang === "en";
  const on = (id: string) => questions.some((q) => q.id === id);
  function flip(item: (typeof STANDARD_QUESTIONS)[number], value: boolean) {
    if (value) onChange([...questions, { id: item.id, label: en ? item.en : item.it, type: "text" }]);
    else onChange(questions.filter((q) => q.id !== item.id));
  }
  return (
    <div className="bl-group std-questions">
      <h4 className="std-title">{en ? "Standard questions" : "Domande standard"}</h4>
      {STANDARD_QUESTIONS.map((item) => (
        <label key={item.id} className="std-row">
          <span className="std-text">
            <strong>{en ? item.en : item.it}</strong>
            <small>{en ? item.enHelp : item.itHelp}</small>
          </span>
          <input type="checkbox" className="std-switch" checked={on(item.id)} onChange={(e) => flip(item, e.target.checked)} />
        </label>
      ))}
    </div>
  );
}

// Link dell'invito: visibile sempre, modificabile solo finché l'invito è in bozza.
function LinkSection({ lang, slug, shareUrl, onSave }: { lang: "it" | "en"; slug?: string; shareUrl?: string; onSave?: (slug: string) => Promise<string | null> }) {
  const en = lang === "en";
  const [value, setValue] = useState(slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(slug ?? ""), [slug]);
  return (
    <section className="bl-group" aria-labelledby="bl-link">
      <h3 id="bl-link">{en ? "Invitation link" : "Link dell'invito"}</h3>
      {shareUrl && <code className="bl-link-url">{shareUrl}</code>}
      {!shareUrl && !onSave && <p className="hint">{en ? "The link is chosen when you publish the invitation." : "Il link si sceglie quando pubblichi l'invito."}</p>}
      {onSave && (
        <form className="link-edit" onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          const err = await onSave(value);
          setError(err);
          setSaved(!err);
        }}>
          <Field label={en ? "Link name" : "Nome del link"}>
            <input value={value} maxLength={60} onChange={(e) => { setValue(e.target.value); setSaved(false); }} aria-describedby="link-hint" />
          </Field>
          <p id="link-hint" className="hint">{en ? "Lowercase letters, numbers and dashes. Once the invitation is published the link stays the same." : "Solo lettere minuscole, numeri e trattini. Dopo la pubblicazione il link non cambia."}</p>
          {error && <p role="alert" className="form-error">{error}</p>}
          {saved && <p className="hint">{en ? "Link saved." : "Link salvato."}</p>}
          <button type="submit" className="btn solid small">{en ? "Save link" : "Salva il link"}</button>
        </form>
      )}
    </section>
  );
}

function QuestionsEditor({ questions, onChange, L }: { questions: RsvpQuestion[]; onChange: (q: RsvpQuestion[]) => void; L: ReturnType<typeof ui>["builder"] }) {
  const update = (id: string, changes: Partial<RsvpQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...changes } : q)));
  return (
    <div className="bl-questions">
      {questions.map((q) => (
        <div key={q.id} className="bl-question">
          <div className="row">
            <input aria-label={L.question} value={q.label} maxLength={160} onChange={(e) => update(q.id, { label: e.target.value })} />
            <select aria-label={L.answerType} value={q.type} onChange={(e) => update(q.id, { type: e.target.value as RsvpQuestion["type"] })}>
              <option value="yes-no">{L.yesNo}</option>
              <option value="choice">{L.choice}</option>
              <option value="number">{L.numberType}</option>
              <option value="text">{L.textType}</option>
            </select>
          </div>
          <Checkbox checked={!!q.required} onChange={(v) => update(q.id, { required: v })} label={L.required} />
          {q.type === "yes-no" && (
            <div className="row">
              <input aria-label={L.yesLabel} value={q.yes ?? "Sì"} maxLength={40} onChange={(e) => update(q.id, { yes: e.target.value })} />
              <input aria-label={L.noLabel} value={q.no ?? "No"} maxLength={40} onChange={(e) => update(q.id, { no: e.target.value })} />
            </div>
          )}
          {q.type === "choice" && (
            <input aria-label={L.options} placeholder="Sì, No, Forse" value={(q.options ?? []).join(", ")} onChange={(e) => update(q.id, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />
          )}
          <button type="button" className="link" onClick={() => onChange(questions.filter((x) => x.id !== q.id))}>{L.removeQuestion}</button>
        </div>
      ))}
      <button type="button" className="btn outline" disabled={questions.length >= 8} onClick={() => onChange([...questions, { id: `q${Date.now().toString(36)}`, label: "Nuova domanda", type: "text" }])}>
        {L.addQuestion}
      </button>
    </div>
  );
}
