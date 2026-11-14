"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { presetQuestions, setupDefaults, type InviteConfig, type RsvpQuestion, type RsvpQuestionType } from "@inviteme/shared";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Heart, ListChecks, MailCheck, MapPin, PenLine, Plus, Trash2, type LucideIcon } from "lucide-react";
import "./setup.css";

// Wizard iniziale: i dati di base dell'invito, chiesti a passi la prima volta che si apre il builder o il planner.
// Dalle risposte il server imposta l'evento e aggiunge o toglie i blocchi collegati (shared/src/setup.ts):
// luogo → Location, indirizzo → Mappa, ringraziamento → Firma, conferma → Conferma di presenza con le domande.
// Finché non è completato non si prosegue: niente chiusura.

type StepKey = "title" | "date" | "venue" | "signature" | "rsvp" | "questions";
const STEPS: { key: StepKey; label: string; icon: LucideIcon }[] = [
  { key: "title", label: "Nomi", icon: Heart },
  { key: "date", label: "Data", icon: CalendarDays },
  { key: "venue", label: "Luogo", icon: MapPin },
  { key: "signature", label: "Firma", icon: PenLine },
  { key: "rsvp", label: "Conferma", icon: MailCheck },
  { key: "questions", label: "Domande", icon: ListChecks },
];

const TYPE_LABEL: Record<RsvpQuestionType, string> = { "yes-no": "Sì / No", text: "Testo", number: "Numero", choice: "Scelta" };
type Custom = { id: string; label: string; type: RsvpQuestionType; options: string };

export function SetupGate({ id, config, setupDone, children }: { id: string; config: InviteConfig; setupDone: boolean; children: ReactNode }) {
  const router = useRouter();
  const locale = config.locale === "en" ? "en" : "it";
  const start = useMemo(() => setupDefaults(config), [config]);
  const presets = useMemo(() => presetQuestions(locale), [locale]);

  const [done, setDone] = useState(setupDone);
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
    if (current.key === "title" && !title.trim()) return "Scrivete i nomi o il titolo dell'evento";
    if (current.key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return "Scegliete la data";
    if (current.key === "rsvp" && rsvp === null) return "Scegliete se chiedere la conferma";
    if (current.key === "questions" && total > 8) return "Al massimo 8 domande";
    if (current.key === "questions" && custom.some((c) => c.type === "choice" && c.label.trim() && c.options.split(",").filter((o) => o.trim()).length < 2)) return "Le domande a scelta hanno bisogno di almeno due opzioni";
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
      if (!res.ok) throw new Error(out.error ?? "Non è stato possibile salvare");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setBusy(false);
    }
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    if (blocker || busy) return;
    if (last) void finish();
    else setStep((s) => s + 1);
  }

  if (done) return <>{children}</>;

  return (
    <>
      {children}
      <div className="demo-backdrop setup-backdrop">
        <form className="demo-modal setup-modal sw" role="dialog" aria-modal="true" aria-labelledby="sw-title" onSubmit={next}>
          <ol className="sw-steps" aria-label="Passi">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const state = i < step ? "is-done" : i === step ? "is-on" : "";
              return (
                <li key={s.key} className={`sw-step ${state}`} aria-current={i === step ? "step" : undefined}>
                  <span className="sw-step-ico">{i < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
                  <span className="sw-step-label">{s.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="sw-bar" aria-hidden="true"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

          <div className="sw-body" key={current.key}>
            <span className="sw-ico" aria-hidden="true">{(() => { const I = current.icon; return <I size={26} strokeWidth={1.5} />; })()}</span>
            <p className="sw-count">Passo {step + 1} di {steps.length}</p>

            {current.key === "title" && (<>
              <h2 id="sw-title">Come si chiama il vostro evento?</h2>
              <p className="hint">I nomi degli sposi o il titolo dell&apos;evento: compaiono sulla busta e in apertura dell&apos;invito.</p>
              <label className="demo-field">
                <span>Nomi o titolo</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sara & Luca" maxLength={80} autoFocus />
              </label>
            </>)}

            {current.key === "date" && (<>
              <h2 id="sw-title">Quando sarà?</h2>
              <p className="hint">La data serve alla data dell&apos;invito, al conto alla rovescia e al planner.</p>
              <label className="demo-field">
                <span>Data dell&apos;evento</span>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} autoFocus />
              </label>
            </>)}

            {current.key === "venue" && (<>
              <h2 id="sw-title">Dove sarà?</h2>
              <p className="hint">Con il nome del luogo l&apos;invito mostra la sezione Location; con l&apos;indirizzo anche la mappa. Lasciateli vuoti se non volete queste sezioni.</p>
              <label className="demo-field">
                <span>Luogo dell&apos;evento</span>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Villa Aurelia" maxLength={120} autoFocus />
              </label>
              <label className="demo-field">
                <span>Indirizzo per la mappa (facoltativo)</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via Leone XIII 461, Roma" maxLength={200} />
              </label>
            </>)}

            {current.key === "signature" && (<>
              <h2 id="sw-title">Un ringraziamento per chiudere</h2>
              <p className="hint">Compare in fondo all&apos;invito, nella Firma. Lasciatelo vuoto se non volete la Firma.</p>
              <label className="demo-field">
                <span>Ringraziamento</span>
                <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Grazie di far parte del nostro giorno" maxLength={80} autoFocus />
              </label>
            </>)}

            {current.key === "rsvp" && (<>
              <h2 id="sw-title">Volete la conferma di presenza?</h2>
              <p className="hint">Gli ospiti rispondono dall&apos;invito e voi vedete le risposte nel planner.</p>
              <div className="sw-choice" role="radiogroup" aria-labelledby="sw-title">
                <button type="button" role="radio" aria-checked={rsvp === true} className={`sw-option${rsvp === true ? " is-on" : ""}`} onClick={() => setRsvp(true)}>
                  <MailCheck size={22} aria-hidden="true" />
                  <strong>Sì, chiediamola</strong>
                  <small>Aggiunge il modulo di conferma</small>
                </button>
                <button type="button" role="radio" aria-checked={rsvp === false} className={`sw-option${rsvp === false ? " is-on" : ""}`} onClick={() => setRsvp(false)}>
                  <Heart size={22} aria-hidden="true" />
                  <strong>No, non serve</strong>
                  <small>L&apos;invito resta solo da leggere</small>
                </button>
              </div>
            </>)}

            {current.key === "questions" && (<>
              <h2 id="sw-title">Cosa chiedere agli ospiti?</h2>
              <p className="hint">Nome e presenza ci sono sempre. Attivate le altre domande o aggiungetene di vostre (al massimo 8). Si cambiano anche dopo, nel builder.</p>
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
                      <span className="sw-q-text">{p.label}<small>{TYPE_LABEL[p.type]}{p.locked ? " · sempre inclusa" : ""}</small></span>
                    </label>
                  </li>
                ))}
              </ul>
              {custom.map((c, i) => (
                <div key={i} className="sw-custom">
                  <input value={c.label} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="La vostra domanda" maxLength={160} aria-label="Testo della domanda" />
                  <select value={c.type} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, type: e.target.value as RsvpQuestionType } : x)))} aria-label="Tipo di risposta">
                    {(Object.keys(TYPE_LABEL) as RsvpQuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                  <button type="button" className="sw-icon-btn" aria-label="Togli la domanda" onClick={() => setCustom((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></button>
                  {c.type === "choice" && (
                    <input className="sw-custom-opts" value={c.options} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} placeholder="Opzioni separate da virgola: Carne, Pesce, Vegetariano" maxLength={300} aria-label="Opzioni" />
                  )}
                </div>
              ))}
              <button type="button" className="sw-add" disabled={total >= 8} onClick={() => setCustom((l) => [...l, { id: "", label: "", type: "text", options: "" }])}>
                <Plus size={16} aria-hidden="true" />Aggiungi una domanda
              </button>
            </>)}
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {blocker && current.key === "questions" && <p className="hint sw-blocker">{blocker}</p>}
          <div className="sw-actions">
            {step > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />Indietro</button>
            ) : <span />}
            <button type="submit" className="btn solid" disabled={busy || Boolean(blocker)} title={blocker ?? undefined}>
              {busy ? "Preparo l'invito…" : last ? <>Crea l&apos;invito<Check size={16} aria-hidden="true" /></> : <>Avanti<ArrowRight size={16} aria-hidden="true" /></>}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
