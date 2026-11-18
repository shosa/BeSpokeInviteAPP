"use client";

import { useMemo, useState, type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { presetQuestions, setupDefaults, type InviteConfig, type RsvpQuestion, type RsvpQuestionType } from "@inviteme/shared";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Heart, ListChecks, MailCheck, MapPin, PenLine, Plus, Trash2, type LucideIcon } from "lucide-react";
import { AddressField } from "./builder/AddressField";
import { DatePicker } from "./ui/DatePicker";
import "./setup.css";
import { useLang } from "@/lib/lang";

// Wizard iniziale: i dati di base dell'invito, chiesti a passi la prima volta che si apre il builder o il planner.
// Dalle risposte il server imposta l'evento e aggiunge o toglie i blocchi collegati (shared/src/setup.ts):
// luogo → Location, indirizzo → Mappa, ringraziamento → Firma, conferma → Conferma di presenza con le domande.
// Finché non è completato non si prosegue: niente chiusura.

type StepKey = "title" | "date" | "venue" | "signature" | "rsvp" | "questions";
const STEPS: { key: StepKey; label: string; en: string; icon: LucideIcon }[] = [
  { key: "title", label: "Nomi", en: "Names", icon: Heart },
  { key: "date", label: "Data", en: "Date", icon: CalendarDays },
  { key: "venue", label: "Luogo", en: "Venue", icon: MapPin },
  { key: "signature", label: "Firma", en: "Sign-off", icon: PenLine },
  { key: "rsvp", label: "Conferma", en: "RSVP", icon: MailCheck },
  { key: "questions", label: "Domande", en: "Questions", icon: ListChecks },
];

const TYPE_LABEL: Record<"it" | "en", Record<RsvpQuestionType, string>> = {
  it: { "yes-no": "Sì / No", text: "Testo", number: "Numero", choice: "Scelta" },
  en: { "yes-no": "Yes / No", text: "Text", number: "Number", choice: "Choice" },
};
type Custom = { id: string; label: string; type: RsvpQuestionType; options: string };

export function SetupGate({ id, config, setupDone, children }: { id: string; config: InviteConfig; setupDone: boolean; children: ReactNode }) {
  const router = useRouter();
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const locale = config.locale === "en" ? "en" : "it";
  const start = useMemo(() => setupDefaults(config), [config]);
  const presets = useMemo(() => presetQuestions(locale), [locale]);

  // Dopo il salvataggio il builder si apre solo con i dati nuovi della pagina (setupDone dal server): aperto subito,
  // partirebbe dall'invito di prima (nomi d'esempio) e al primo salvataggio cancellerebbe quelli appena scritti.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => window.location.reload(), 5000); // aggiornamento non arrivato: si ricarica la pagina
    return () => clearTimeout(t);
  }, [saved]);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(start.title);
  const [eventDate, setEventDate] = useState(start.eventDate);
  const [venue, setVenue] = useState(start.venue);
  const [address, setAddress] = useState(start.address);
  const [signature, setSignature] = useState(start.signature);
  const [rsvp, setRsvp] = useState<boolean | null>(start.rsvp ? true : null);
  // Domande pronte attive: quelle già nell'invito, altrimenti quelle consigliate.
  const [picked, setPicked] = useState<Set<string>>(() => {
    const existing = new Set(start.questions.map((q) => q.id));
    return new Set(presets.filter((p) => p.locked || (existing.size ? existing.has(p.id) : p.on)).map((p) => p.id));
  });
  // Domande proprie già presenti nell'invito (id non tra quelle pronte) e quelle aggiunte qui.
  const [custom, setCustom] = useState<Custom[]>(() =>
    start.questions.filter((q) => !presets.some((p) => p.id === q.id)).map((q) => ({ id: q.id, label: q.label, type: q.type, options: (q.options ?? []).join(", ") })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = STEPS.filter((s) => s.key !== "questions" || rsvp === true);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const total = picked.size + custom.filter((c) => c.label.trim()).length;

  // Cosa manca per andare avanti in questo passo.
  const blocker = (() => {
    if (current.key === "title" && !title.trim()) return t("Scrivete i nomi o il titolo dell'evento", "Enter the names or the event title");
    if (current.key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return t("Scegliete la data", "Choose the date");
    if (current.key === "rsvp" && rsvp === null) return t("Scegliete se chiedere la conferma", "Choose whether to ask for RSVPs");
    if (current.key === "questions" && total > 8) return t("Al massimo 8 domande", "At most 8 questions");
    if (current.key === "questions" && custom.some((c) => c.type === "choice" && c.label.trim() && c.options.split(",").filter((o) => o.trim()).length < 2)) return t("Le domande a scelta hanno bisogno di almeno due opzioni", "Choice questions need at least two options");
    return null;
  })();

  function questions(): RsvpQuestion[] {
    const fromPresets = presets.filter((p) => picked.has(p.id)).map(({ locked: _l, on: _o, ...q }) => q);
    const used = new Set(fromPresets.map((q) => q.id));
    const own = custom
      .filter((c) => c.label.trim())
      .map((c, i) => {
        let qid = /^[a-z][A-Za-z0-9]{0,39}$/.test(c.id) ? c.id : `q${i + 1}`;
        while (used.has(qid)) qid = `q${Math.random().toString(36).slice(2, 7)}`;
        used.add(qid);
        const q: RsvpQuestion = { id: qid, label: c.label.trim().slice(0, 160), type: c.type };
        if (c.type === "choice") q.options = c.options.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 6);
        if (c.type === "yes-no") { q.yes = locale === "en" ? "Yes" : "Sì"; q.no = "No"; }
        return q;
      });
    return [...fromPresets, ...own];
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${id}/setup`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, eventDate, venue, address, signature, rsvp: rsvp === true, questions: rsvp ? questions() : [] }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? t("Non è stato possibile salvare", "Could not save"));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Errore", "Error"));
      setBusy(false);
    }
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    if (blocker || busy) return;
    if (last) void finish();
    else setStep((s) => s + 1);
  }

  if (setupDone) return <>{children}</>;

  return (
    <>
      {children}
      <div className="demo-backdrop setup-backdrop">
        <form className="demo-modal setup-modal sw" role="dialog" aria-modal="true" aria-labelledby="sw-title" onSubmit={next}>
          <ol className="sw-steps" aria-label={t("Passi", "Steps")}>
            {steps.map((s, i) => {
              const Icon = s.icon;
              const state = i < step ? "is-done" : i === step ? "is-on" : "";
              return (
                <li key={s.key} className={`sw-step ${state}`} aria-current={i === step ? "step" : undefined}>
                  <span className="sw-step-ico">{i < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
                  <span className="sw-step-label">{t(s.label, s.en)}</span>
                </li>
              );
            })}
          </ol>
          <div className="sw-bar" aria-hidden="true"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

          <div className="sw-body" key={current.key}>
            <span className="sw-ico" aria-hidden="true">{(() => { const I = current.icon; return <I size={26} strokeWidth={1.5} />; })()}</span>
            <p className="sw-count">{t(`Passo ${step + 1} di ${steps.length}`, `Step ${step + 1} of ${steps.length}`)}</p>

            {current.key === "title" && (<>
              <h2 id="sw-title">{t("Come si chiama il vostro evento?", "What is your event called?")}</h2>
              <p className="hint">{t("I nomi degli sposi o il titolo dell'evento: compaiono sulla busta e in apertura dell'invito.", "The couple's names or the event title: they appear on the envelope and at the top of the invitation.")}</p>
              <label className="demo-field">
                <span>{t("Nomi o titolo", "Names or title")}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sara & Luca" maxLength={80} autoFocus />
              </label>
            </>)}

            {current.key === "date" && (<>
              <h2 id="sw-title">{t("Quando sarà?", "When is it?")}</h2>
              <p className="hint">{t("La data serve alla data dell'invito, al conto alla rovescia e al planner.", "The date is used for the invitation, the countdown and the planner.")}</p>
              <DatePicker id="sw-date" label={t("Data dell'evento", "Event date")} value={eventDate} onChange={setEventDate} lang={lang} inline autoFocus />
            </>)}

            {current.key === "venue" && (<>
              <h2 id="sw-title">{t("Dove sarà?", "Where is it?")}</h2>
              <p className="hint">{t("Con il nome del luogo l'invito mostra la sezione Location; con l'indirizzo anche la mappa. Lasciateli vuoti se non volete queste sezioni.", "With the venue name the invitation shows the Venue section; with the address, the map too. Leave them empty if you don't want these sections.")}</p>
              <label className="demo-field">
                <span>{t("Luogo dell'evento", "Event venue")}</span>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Villa Aurelia" maxLength={120} autoFocus />
              </label>
              <AddressField className="demo-field" label={t("Indirizzo per la mappa (facoltativo)", "Address for the map (optional)")} value={address} onChange={setAddress} placeholder={t("Inizia a scrivere: via, città…", "Start typing: street, city…")} />
              <p className="hint sw-addr-hint">{t("Sceglietelo dai suggerimenti: così la mappa trova il punto giusto.", "Pick it from the suggestions so the map finds the right spot.")}</p>
            </>)}

            {current.key === "signature" && (<>
              <h2 id="sw-title">{t("Un ringraziamento per chiudere", "A thank-you to close")}</h2>
              <p className="hint">{t("Compare in fondo all'invito, nella Firma. Lasciatelo vuoto se non volete la Firma.", "It appears at the bottom of the invitation, in the Sign-off. Leave it empty if you don't want a Sign-off.")}</p>
              <label className="demo-field">
                <span>{t("Ringraziamento", "Thank-you")}</span>
                <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={t("Grazie di far parte del nostro giorno", "Thank you for being part of our day")} maxLength={80} autoFocus />
              </label>
            </>)}

            {current.key === "rsvp" && (<>
              <h2 id="sw-title">{t("Volete la conferma di presenza?", "Do you want RSVPs?")}</h2>
              <p className="hint">{t("Gli ospiti rispondono dall'invito e voi vedete le risposte nel planner.", "Guests reply from the invitation and you see the replies in your account.")}</p>
              <div className="sw-choice" role="radiogroup" aria-labelledby="sw-title">
                <button type="button" role="radio" aria-checked={rsvp === true} className={`sw-option${rsvp === true ? " is-on" : ""}`} onClick={() => setRsvp(true)}>
                  <MailCheck size={22} aria-hidden="true" />
                  <strong>{t("Sì, chiediamola", "Yes, ask for them")}</strong>
                  <small>{t("Aggiunge il modulo di conferma", "Adds the reply form")}</small>
                </button>
                <button type="button" role="radio" aria-checked={rsvp === false} className={`sw-option${rsvp === false ? " is-on" : ""}`} onClick={() => setRsvp(false)}>
                  <Heart size={22} aria-hidden="true" />
                  <strong>{t("No, non serve", "No, not needed")}</strong>
                  <small>{t("L'invito resta solo da leggere", "The invitation is read-only")}</small>
                </button>
              </div>
            </>)}

            {current.key === "questions" && (<>
              <h2 id="sw-title">{t("Cosa chiedere agli ospiti?", "What should guests be asked?")}</h2>
              <p className="hint">{t("Nome e presenza ci sono sempre. Attivate le altre domande o aggiungetene di vostre (al massimo 8). Si cambiano anche dopo, nel builder.", "Name and attendance are always included. Turn on other questions or add your own (up to 8). You can change them later in the builder.")}</p>
              <ul className="sw-questions">
                {presets.map((p) => (
                  <li key={p.id}>
                    <label className={`sw-q${picked.has(p.id) ? " is-on" : ""}${p.locked ? " is-locked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        disabled={p.locked}
                        onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })}
                      />
                      <span className="sw-q-box" aria-hidden="true"><Check size={14} /></span>
                      <span className="sw-q-text">{p.label}<small>{TYPE_LABEL[lang][p.type]}{p.locked ? t(" · sempre inclusa", " · always included") : ""}</small></span>
                    </label>
                  </li>
                ))}
              </ul>
              {custom.map((c, i) => (
                <div key={i} className="sw-custom">
                  <input value={c.label} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={t("La vostra domanda", "Your question")} maxLength={160} aria-label={t("Testo della domanda", "Question text")} />
                  <select value={c.type} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value as RsvpQuestionType } : x)))} aria-label={t("Tipo di risposta", "Answer type")}>
                    {(Object.keys(TYPE_LABEL[lang]) as RsvpQuestionType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[lang][k]}</option>)}
                  </select>
                  <button type="button" className="sw-icon-btn" aria-label={t("Togli la domanda", "Remove the question")} onClick={() => setCustom((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></button>
                  {c.type === "choice" && (
                    <input className="sw-custom-opts" value={c.options} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} placeholder={t("Opzioni separate da virgola: Carne, Pesce, Vegetariano", "Options separated by commas: Meat, Fish, Vegetarian")} maxLength={300} aria-label={t("Opzioni", "Options")} />
                  )}
                </div>
              ))}
              <button type="button" className="sw-add" disabled={total >= 8} onClick={() => setCustom((l) => [...l, { id: "", label: "", type: "text", options: "" }])}>
                <Plus size={16} aria-hidden="true" />{t("Aggiungi una domanda", "Add a question")}
              </button>
            </>)}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {blocker && current.key === "questions" && <p className="hint sw-blocker">{blocker}</p>}
          <div className="sw-actions">
            {step > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />{t("Indietro", "Back")}</button>
            ) : <span />}
            <button type="submit" className="btn solid" disabled={busy || Boolean(blocker)} title={blocker ?? undefined}>
              {busy ? t("Preparo l'invito…", "Preparing the invitation…") : last ? <>{t("Crea l'invito", "Create the invitation")}<Check size={16} aria-hidden="true" /></> : <>{t("Avanti", "Next")}<ArrowRight size={16} aria-hidden="true" /></>}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
