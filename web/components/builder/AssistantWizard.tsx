"use client";

import { useState } from "react";
import { PlaceSearch } from "./PlaceSearch";
import { DatePicker } from "@/components/ui/DatePicker";
import { ArrowLeft, ArrowRight, Baby, CalendarDays, Check, CircleDot, ClipboardCheck, Heart, ImagePlus, MapPin, Music, Shirt, Snowflake, Sparkles, Users, Wand2, Waves, type LucideIcon } from "lucide-react";

// Percorso guidato «Creiamolo insieme»: fa le domande una alla volta e compone un unico messaggio per l'assistente.
// L'assistente riceve tutto insieme e applica le modifiche in un solo giro (Ctrl+Z le ritira tutte).

type Lang = "it" | "en";

const COLORS = [
  { hex: "#A9B29B", it: "Salvia", en: "Sage" },
  { hex: "#7A1F2B", it: "Borgogna", en: "Burgundy" },
  { hex: "#B8924A", it: "Oro", en: "Gold" },
  { hex: "#F3EBDD", it: "Avorio", en: "Ivory" },
  { hex: "#1D1B19", it: "Nero", en: "Black" },
  { hex: "#1F2A44", it: "Blu notte", en: "Midnight blue" },
  { hex: "#B5654A", it: "Terracotta", en: "Terracotta" },
  { hex: "#E2B7B0", it: "Rosa cipria", en: "Dusty pink" },
  { hex: "#2F4F3A", it: "Verde bosco", en: "Forest green" },
  { hex: "#B9A8D4", it: "Lavanda", en: "Lavender" },
  { hex: "#E9DCC0", it: "Champagne", en: "Champagne" },
  { hex: "#8C8C8C", it: "Grigio perla", en: "Pearl grey" },
];

const BACKGROUNDS: { kind: string; icon: LucideIcon; it: string; en: string }[] = [
  { kind: "petals", icon: Sparkles, it: "Petali", en: "Petals" },
  { kind: "sparkles", icon: Wand2, it: "Scintille", en: "Sparkles" },
  { kind: "confetti", icon: Heart, it: "Coriandoli", en: "Confetti" },
  { kind: "snow", icon: Snowflake, it: "Neve", en: "Snow" },
  { kind: "waves", icon: Waves, it: "Onde", en: "Waves" },
  { kind: "bubbles", icon: CircleDot, it: "Bolle", en: "Bubbles" },
  { kind: "none", icon: Check, it: "Niente", en: "None" },
];

const GUEST_QUESTIONS = [
  { id: "count", icon: Users, it: "Quante persone vengono", en: "How many people are coming" },
  { id: "allergy", icon: Heart, it: "Allergie o intolleranze", en: "Allergies or intolerances" },
  { id: "highchair", icon: Baby, it: "Serve il seggiolone", en: "Need a high chair" },
  { id: "diet", icon: Check, it: "Preferenza alimentare", en: "Food preference" },
  { id: "kids", icon: Baby, it: "Quanti bambini vengono", en: "How many children are coming" },
  { id: "ride", icon: Users, it: "Serve un passaggio", en: "Need a ride" },
  { id: "plusone", icon: Users, it: "Porta un accompagnatore", en: "Bringing a plus-one" },
  { id: "hotel", icon: MapPin, it: "Serve un alloggio", en: "Need accommodation" },
  { id: "song", icon: Music, it: "Un brano da dedicare", en: "A song to dedicate" },
  { id: "note", icon: Heart, it: "Un messaggio per noi", en: "A message for us" },
];

// Esempi nei campi: generici, mai i dati di nessun invito reale. Ne esce uno a caso ad ogni apertura.
const NAME_HINTS = ["Nome e Nome", "Nome & Nome", "Nome e Nome, o il festeggiato"];
const DRESS_HINTS = ["Es. elegante, casual, a tema", "Es. formale, cocktail, bianco e nero", "Es. abbigliamento sportivo"];
const PHOTO_HINTS = ["Es. un paesaggio", "Es. dettagli di fiori", "Es. una foto di gruppo", "Es. una città di sera"];

// Casuale: Fisher-Yates su una copia; `pickN` prende n elementi a caso, nell'ordine casuale.
function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const pickN = <T,>(list: readonly T[], n: number): T[] => shuffled(list).slice(0, n);

export type Answers = {
  names: string;
  date: string;
  time: string;
  venue: string;
  venueConfirmed: boolean; // true se il luogo è stato scelto dalla ricerca
  dress: string;
  colors: string[];
  background: string;
  questions: string[];
  photo: string;
  music: boolean;
};

const EMPTY: Answers = { names: "", date: "", time: "", venue: "", venueConfirmed: false, dress: "", colors: [], background: "", questions: [], photo: "", music: false };

const STEPS = [
  { it: "Evento", en: "Event", icon: CalendarDays },
  { it: "Luogo", en: "Venue", icon: MapPin },
  { it: "Stile", en: "Style", icon: Shirt },
  { it: "Conferma", en: "RSVP", icon: ClipboardCheck },
  { it: "Foto e musica", en: "Photo & music", icon: ImagePlus },
];

// Il messaggio che l'assistente riceve: solo ciò che la persona ha risposto.
export function composeBrief(a: Answers, lang: Lang): string {
  const it = lang === "it";
  const lines: string[] = [it ? "Creiamo l'invito con questi dati." : "Let's create the invitation with these details."];
  if (a.names) lines.push(`${it ? "Nomi" : "Names"}: ${a.names}`);
  if (a.date) lines.push(`${it ? "Data" : "Date"}: ${a.date}`);
  if (a.time) lines.push(`${it ? "Ora" : "Time"}: ${a.time}`);
  if (a.venue) {
    const note = a.venueConfirmed ? (it ? "indirizzo scelto dalla ricerca" : "address chosen from the search") : (it ? "cerca l'indirizzo e fammelo scegliere" : "find the address and let me choose it");
    lines.push(`${it ? "Luogo" : "Venue"}: ${a.venue} (${note})`);
  }
  const colorNames = COLORS.filter((c) => a.colors.includes(c.hex)).map((c) => (it ? c.it : c.en));
  if (a.dress || colorNames.length) lines.push(`Dress code: ${[a.dress, colorNames.join(", ")].filter(Boolean).join(" · ")}`);
  const bg = BACKGROUNDS.find((b) => b.kind === a.background);
  if (bg && bg.kind !== "none") lines.push(`${it ? "Sfondo" : "Background"}: ${it ? bg.it : bg.en}`);
  const qs = GUEST_QUESTIONS.filter((q) => a.questions.includes(q.id)).map((q) => (it ? q.it : q.en));
  if (qs.length) lines.push(`${it ? "Domande per chi risponde (nel modulo, come domande vere)" : "Questions for guests (as real form questions)"}: ${qs.join("; ")}`);
  if (a.photo) lines.push(`${it ? "Foto nell'intestazione" : "Header photo"}: ${a.photo}`);
  lines.push(a.music ? (it ? "Musica: sì, dalla libreria." : "Music: yes, from the library.") : it ? "Musica: nessuna per ora." : "Music: none for now.");
  return lines.join("\n");
}

// initial: i valori già inseriti (wizard iniziale, builder), così il percorso non richiede cose già note.
export function AssistantWizard({ lang, onCompose, onCancel, initial }: { lang: Lang; onCompose: (brief: string) => void; onCancel: () => void; initial?: Partial<Answers> }) {
  const it = lang === "it";
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(() => ({
    ...EMPTY,
    ...(initial ?? {}),
    // Colori salvati (minuscoli) riportati ai pallini del percorso; quelli fuori palette restano nell'invito.
    colors: (initial?.colors ?? []).map((h) => COLORS.find((c) => c.hex.toLowerCase() === h.toLowerCase())?.hex).filter((h): h is string => Boolean(h)),
  }));
  // Opzioni e suggerimenti: scelti a caso ad ogni apertura del percorso.
  const [pool] = useState(() => ({
    // I colori già scelti restano tra quelli mostrati.
    colors: [...COLORS.filter((c) => initial?.colors?.includes(c.hex.toLowerCase())), ...pickN(COLORS.filter((c) => !initial?.colors?.includes(c.hex.toLowerCase())), 6)].slice(0, Math.max(6, initial?.colors?.length ?? 0)),
    backgrounds: shuffled(BACKGROUNDS),
    questions: pickN(GUEST_QUESTIONS, 6),
    names: pick(NAME_HINTS),
    dress: pick(DRESS_HINTS),
    photo: pick(PHOTO_HINTS),
  }));
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((x) => ({ ...x, [k]: v }));
  const last = step === STEPS.length - 1;
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="aw">
      <div className="aw-track" role="list" aria-label={it ? "Passi" : "Steps"}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <div key={s.it} role="listitem" className={`aw-step is-${state}`} aria-current={state === "current" ? "step" : undefined}>
              <span className="aw-dot">{state === "done" ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}</span>
              <span className="aw-label">{it ? s.it : s.en}</span>
            </div>
          );
        })}
        <span className="aw-bar" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} aria-hidden="true" />
      </div>

      <div key={step} className="aw-card">
        {step === 0 && (
          <>
            <h3 className="aw-q">{it ? "Chi si sposa, o chi festeggia?" : "Who is getting married, or who is celebrating?"}</h3>
            <label className="aw-field">
              <span>{it ? "Nomi" : "Names"}</span>
              <input value={a.names} placeholder={it ? pool.names : "Name & name"} onChange={(e) => set("names", e.target.value)} />
            </label>
            <div className="aw-row">
              <div className="aw-field">
                <DatePicker label={it ? "Data" : "Date"} value={a.date} onChange={(v) => set("date", v)} lang={lang} />
              </div>
              <label className="aw-field">
                <span>{it ? "Ora" : "Time"}</span>
                <input type="time" value={a.time} onChange={(e) => set("time", e.target.value)} />
              </label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="aw-q">{it ? "Dove si festeggia?" : "Where is the celebration?"}</h3>
            <PlaceSearch
              lang={lang}
              initial={a.venue}
              onType={(t) => setA((x) => ({ ...x, venue: t, venueConfirmed: false }))}
              onPick={(addr) => setA((x) => ({ ...x, venue: addr, venueConfirmed: true }))}
            />
            <p className="aw-hint">{it ? "Scrivi il nome e la città, poi scegli l'indirizzo tra i risultati. Se non lo trovi, puoi anche lasciarlo vuoto." : "Type the name and city, then pick the address from the results. If you can't find it, you can leave it empty."}</p>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="aw-q">{it ? "Che atmosfera vuoi?" : "What atmosphere do you want?"}</h3>
            <label className="aw-field">
              <span>{it ? "Dress code" : "Dress code"}</span>
              <input value={a.dress} placeholder={it ? pool.dress : "E.g. formal, casual, themed"} onChange={(e) => set("dress", e.target.value)} />
            </label>
            <div className="aw-chips" role="group" aria-label={it ? "Colori" : "Colours"}>
              {pool.colors.map((c) => {
                const on = a.colors.includes(c.hex);
                return (
                  <button key={c.hex} type="button" className={`aw-swatch${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => set("colors", toggle(a.colors, c.hex))}>
                    <span className="aw-color" style={{ background: c.hex }} aria-hidden="true" />
                    {it ? c.it : c.en}
                  </button>
                );
              })}
            </div>
            <p className="aw-sub">{it ? "Sfondo animato" : "Animated background"}</p>
            <div className="aw-chips" role="radiogroup" aria-label={it ? "Sfondo" : "Background"}>
              {pool.backgrounds.map((b) => {
                const Icon = b.icon;
                const on = a.background === b.kind;
                return (
                  <button key={b.kind} type="button" role="radio" aria-checked={on} className={`aw-pick${on ? " is-on" : ""}`} onClick={() => set("background", b.kind)}>
                    <Icon size={16} aria-hidden="true" />
                    {it ? b.it : b.en}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="aw-q">{it ? "Cosa vuoi chiedere a chi risponde?" : "What do you want to ask guests?"}</h3>
            <div className="aw-chips" role="group" aria-label={it ? "Domande" : "Questions"}>
              {pool.questions.map((q) => {
                const Icon = q.icon;
                const on = a.questions.includes(q.id);
                return (
                  <button key={q.id} type="button" className={`aw-pick${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => set("questions", toggle(a.questions, q.id))}>
                    <Icon size={16} aria-hidden="true" />
                    {it ? q.it : q.en}
                  </button>
                );
              })}
            </div>
            <p className="aw-hint">{it ? "Scegli quelle che ti servono: le preparo nel modulo di conferma." : "Pick the ones you need: I'll set them up in the RSVP form."}</p>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="aw-q">{it ? "Ultimo passo: foto e musica" : "Last step: photo and music"}</h3>
            <label className="aw-field">
              <span>{it ? "Foto di copertina (che soggetto?)" : "Cover photo (what subject?)"}</span>
              <input value={a.photo} placeholder={it ? pool.photo : "E.g. a landscape"} onChange={(e) => set("photo", e.target.value)} />
            </label>
            <div className="aw-chips" role="group" aria-label={it ? "Musica" : "Music"}>
              <button type="button" className={`aw-pick${a.music ? " is-on" : ""}`} aria-pressed={a.music} onClick={() => set("music", !a.music)}>
                <Music size={16} aria-hidden="true" />
                {it ? "Sì, metti una musica" : "Yes, add music"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="aw-nav">
        <button type="button" className="aw-back" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          <ArrowLeft size={16} aria-hidden="true" />
          {step === 0 ? (it ? "Annulla" : "Cancel") : it ? "Indietro" : "Back"}
        </button>
        {last ? (
          <button type="button" className="aw-next aw-go" onClick={() => onCompose(composeBrief(a, lang))}>
            <Wand2 size={16} aria-hidden="true" />
            {it ? "Componi l'invito" : "Compose the invitation"}
          </button>
        ) : (
          <button type="button" className="aw-next" onClick={() => setStep(step + 1)}>
            {it ? "Avanti" : "Next"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
