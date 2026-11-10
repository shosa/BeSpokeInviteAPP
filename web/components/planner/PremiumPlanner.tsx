"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { FOLDER, FOLDER_KEYS } from "@inviteme/shared";
import { Folder, type FolderValue } from "./Folder";
import { Armchair, CloudSun, FolderOpen, LayoutDashboard, ListChecks, MailCheck, Printer, Store, Users, Wallet, type LucideProps } from "lucide-react";
import { Seating } from "./Seating";
import { PdfDialog } from "./PdfDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { RsvpStats, RsvpTable, type RsvpSummary } from "./RsvpInsights";

// Planner premium: riepilogo, budget, invitati, attività, fornitori e cartella del matrimonio.
// Colori e font seguono il tema dell'invito (variabili --inv e --inv-ink impostate dalla pagina).
// Ogni modifica va alle rotte /api/invitations/:id/planner/… e il server applica le regole del livello premium.

export type PremiumData = {
  tier: string;
  event: { title: string; eventDate: string; venue: string; address: string };
  guests: { id: string; name: string; group_name: string; party_size: number; response: "pending" | "yes" | "no"; table_id: string | null }[];
  tables: { id: string; name: string; seats: number }[];
  budget: { id: string; category: string; label: string; amount_cents: number; due_date: string | null; paid: boolean }[];
  tasks: { id: string; title: string; done: boolean; days_before: number }[];
  vendors: { id: string; name: string; role: string; contact: string; contract_status: "unsigned" | "signed" }[];
  rsvpResponses: number;
  docs: Record<string, FolderValue>;
  notes: string;
  budgetCents: number;
  guestQuota: number;
};

type Weather = { forecast: { tmaxC: number; tminC: number; precipMm: number; precipProb: number | null } | null; reason?: string; place?: string };
type Tab = "riepilogo" | "conferme" | "budget" | "invitati" | "tavoli" | "attivita" | "fornitori" | "cartella";
type Icon = ComponentType<LucideProps>;

const TABS: { key: Tab; label: string; icon: Icon }[] = [
  { key: "riepilogo", label: "Riepilogo", icon: LayoutDashboard },
  { key: "conferme", label: "Conferme", icon: MailCheck },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "invitati", label: "Invitati", icon: Users },
  { key: "tavoli", label: "Tavoli", icon: Armchair },
  { key: "attivita", label: "Attività", icon: ListChecks },
  { key: "fornitori", label: "Fornitori", icon: Store },
  { key: "cartella", label: "Cartella", icon: FolderOpen },
];

const STANDARD_TASKS: { title: string; days_before: number }[] = [
  { title: "Scegliere la location", days_before: 365 },
  { title: "Prenotare fotografo e video", days_before: 300 },
  { title: "Prenotare la musica", days_before: 240 },
  { title: "Definire stile, palette e tema", days_before: 300 },
  { title: "Inviare le partecipazioni", days_before: 60 },
  { title: "Confermare i fornitori", days_before: 30 },
  { title: "Preparare la cartella del giorno", days_before: 14 },
  { title: "Controllare il meteo e il piano B", days_before: 3 },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (v: string | null | undefined): v is string => !!v && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00"));
const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const todayIso = () => new Date().toISOString().slice(0, 10);
const longDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
const daysUntil = (iso: string) => (validIso(iso) ? Math.round((Date.parse(iso + "T00:00:00") - Date.parse(todayIso() + "T00:00:00")) / 86_400_000) : null);
// Data di un'attività: giorni prima dell'evento. Senza una data valida mostra solo il conteggio.
const taskDue = (eventDate: string, daysBefore: number) => {
  if (!validIso(eventDate)) return `${daysBefore} giorni prima`;
  const d = new Date(eventDate + "T12:00:00");
  d.setDate(d.getDate() - daysBefore);
  return `entro il ${d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;
};

export function PremiumPlanner({ id, initial, lang }: { id: string; initial: PremiumData; lang: "it" | "en" }) {
  const router = useRouter();
  const [data, setData] = useState<PremiumData>(initial);
  const [tab, setTab] = useState<Tab>("riepilogo");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [rsvp, setRsvp] = useState<RsvpSummary | null>(null);
  const [rsvpFailed, setRsvpFailed] = useState(false);

  // Risposte alla conferma: si caricano all'apertura della scheda e si aggiornano ogni 30 secondi finché resta aperta.
  useEffect(() => {
    if (tab !== "conferme") return;
    let alive = true;
    const load = () =>
      fetch(`/api/invitations/${id}/rsvps`)
        .then((r) => (r.ok ? (r.json() as Promise<RsvpSummary>) : Promise.reject()))
        .then((d) => { if (alive) { setRsvp(d); setRsvpFailed(false); } })
        .catch(() => { if (alive) setRsvpFailed(true); });
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [tab, id]);

  useEffect(() => {
    fetch(`/api/invitations/${id}/planner/weather`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: Weather | null) => setWeather(w))
      .catch(() => setWeather(null));
  }, [id]);

  async function call(method: "POST" | "PATCH" | "DELETE" | "PUT", path: string, body?: unknown) {
    setError(null);
    const res = await fetch(`/api/invitations/${id}/planner${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(out.error ?? "Operazione non riuscita");
      throw new Error(out.error ?? "errore");
    }
    return out;
  }

  // Dopo ogni modifica si ricaricano i dati dal server: il server è la sola fonte di verità.
  async function reload() {
    const res = await fetch(`/api/invitations/${id}/planner/data`);
    if (res.ok) setData((await res.json()) as PremiumData);
    router.refresh();
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch {
      /* l'errore è già mostrato */
    }
  }

  const alerts = useMemo(() => {
    const list: string[] = [];
    const unsigned = data.vendors.filter((v) => v.contract_status === "unsigned").length;
    if (unsigned) list.push(`${unsigned} ${unsigned === 1 ? "contratto non firmato" : "contratti non firmati"}`);
    const yesPersons = data.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);
    if (data.guestQuota && yesPersons > data.guestQuota) list.push(`${yesPersons - data.guestQuota} oltre la quota`);
    const today = todayIso();
    const overdue = data.budget.filter((b) => !b.paid && validIso(b.due_date) && b.due_date < today).length;
    if (overdue) list.push(`${overdue} ${overdue === 1 ? "pagamento scaduto" : "pagamenti scaduti"}`);
    const spent = data.budget.reduce((n, b) => n + b.amount_cents, 0);
    if (data.budgetCents && spent > data.budgetCents) list.push(`Budget superato di ${euro(spent - data.budgetCents)}`);
    return list;
  }, [data]);

  const days = daysUntil(data.event.eventDate);
  const docsWritten = FOLDER.filter((s) => (s.kind === "text" ? typeof data.docs[s.key] === "string" && (data.docs[s.key] as string).trim() : ((data.docs[s.key] as { items?: unknown[] } | undefined)?.items?.length ?? 0) > 0)).length;
  const tasksDone = data.tasks.filter((t) => t.done).length;
  const taskPct = data.tasks.length ? Math.round((tasksDone / data.tasks.length) * 100) : 0;
  const budgetSpent = data.budget.reduce((n, b) => n + b.amount_cents, 0);
  const budgetPaid = data.budget.filter((b) => b.paid).reduce((n, b) => n + b.amount_cents, 0);
  const budgetPct = data.budgetCents ? Math.min(100, Math.round((budgetSpent / data.budgetCents) * 100)) : 0;
  const yesPersons = data.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);
  const pendingGroups = data.guests.filter((g) => g.response === "pending").length;

  return (
    <div className="pp-shell">
      <div className="pp-layout">
        <aside className="pp-rail" aria-label="Sezioni del planner">
          <nav className="pp-rail-nav" role="tablist" aria-orientation="vertical">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`pp-rail-item${tab === key ? " is-on" : ""}`} onClick={() => setTab(key)}>
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="pp-rail-item pp-rail-print" onClick={() => setPdfOpen(true)}>
            <Printer size={18} strokeWidth={1.6} aria-hidden="true" />
            <span>Crea PDF</span>
          </button>
        </aside>

        {pdfOpen && <PdfDialog id={id} onClose={() => setPdfOpen(false)} />}
        <div className="pp-content" key={tab}>
          {error && <p className="form-error pp-noprint" role="alert">{error}</p>}

          {tab === "riepilogo" && (
            <section className="pp-stagger" aria-label="Riepilogo">
              <div className="pp-hero-stats">
                <div className="pp-stat pp-stat-days">
                  <span className="pp-kicker">Giorno del sì</span>
                  <strong>{days === null ? "—" : days > 0 ? days : days === 0 ? "Oggi" : "Passato"}</strong>
                  <small>{days !== null && days > 0 ? "giorni" : validIso(data.event.eventDate) ? longDate(data.event.eventDate) : "Imposta la data dell'evento"}</small>
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">Invitati confermati</span>
                  <strong>{yesPersons}</strong>
                  <small>{data.guests.length} gruppi · {pendingGroups} senza risposta · {data.rsvpResponses} risposte dall&apos;invito</small>
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">Budget</span>
                  <strong>{euro(budgetSpent)}</strong>
                  <small>{data.budgetCents ? `su ${euro(data.budgetCents)}` : "imposta il budget nella scheda Budget"}</small>
                  {data.budgetCents > 0 && <Bar value={budgetPct} />}
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">Attività</span>
                  <strong>{tasksDone}/{data.tasks.length}</strong>
                  <small>completate</small>
                  {data.tasks.length > 0 && <Bar value={taskPct} />}
                </div>
              </div>

              <div className="pp-two">
                <div className="pp-card">
                  <span className="pp-kicker">Da sistemare</span>
                  {alerts.length === 0 ? <p className="hint">Nulla di urgente.</p> : <ul className="pp-list">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>}
                </div>
                <div className="pp-card">
                  <span className="pp-kicker">Meteo il giorno del sì</span>
                  {!weather ? <p className="hint">Caricamento…</p> : weather.forecast ? (
                    <>
                      <strong className="pp-weather"><CloudSun size={22} strokeWidth={1.5} aria-hidden="true" /> {weather.forecast.tmaxC}° / {weather.forecast.tminC}°</strong>
                      <small>{weather.forecast.precipMm} mm di pioggia{weather.forecast.precipProb !== null ? ` · ${weather.forecast.precipProb}% di probabilità` : ""}{weather.place ? ` · ${weather.place}` : ""}</small>
                    </>
                  ) : (
                    <p className="hint">{weather.reason === "range" ? "La previsione arriva a circa due settimane dalla data." : weather.reason === "date" ? "Imposta la data dell'evento." : "Indica l'indirizzo dell'evento per vedere il meteo."}</p>
                  )}
                </div>
                <div className="pp-card">
                  <span className="pp-kicker">Cartella</span>
                  <strong className="pp-big">{docsWritten}/{FOLDER.length}</strong>
                  <small>sezioni con contenuto</small>
                  <Bar value={Math.round((docsWritten / FOLDER.length) * 100)} />
                </div>
              </div>
            </section>
          )}

          {tab === "conferme" && (
            <section className="pp-stagger" aria-label="Conferme">
              {!rsvp ? (
                <div className="pp-card"><p className="hint">{rsvpFailed ? "Non è stato possibile caricare le risposte. Riprova tra poco." : "Caricamento delle risposte…"}</p></div>
              ) : (
                <>
                  <div className="pp-hero-stats">
                    <div className="pp-stat"><span className="pp-kicker">Risposte</span><strong>{rsvp.total}</strong><small>dal link dell&apos;invito</small></div>
                    <div className="pp-stat"><span className="pp-kicker">Presenti</span><strong>{rsvp.attending}</strong><small>{rsvp.declined} non potranno</small></div>
                    <div className="pp-stat"><span className="pp-kicker">Persone</span><strong>{rsvp.guests}</strong><small>attese in tutto</small></div>
                  </div>
                  <div className="pp-card">
                    <span className="pp-kicker">Statistiche delle risposte</span>
                    <RsvpStats summary={rsvp} lang={lang} />
                  </div>
                  <div className="pp-card">
                    <span className="pp-kicker">Tutte le risposte</span>
                    <RsvpTable invitationId={id} summary={rsvp} lang={lang} />
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "budget" && (
            <section className="pp-stagger" aria-label="Budget">
              <div className="pp-card">
                <BudgetSettings initial={data.budgetCents} onSave={(cents) => act(() => call("PUT", "", { budgetCents: cents }))} />
                <p className="hint">Speso {euro(budgetSpent)} · pagato {euro(budgetPaid)}{data.budgetCents ? ` · rimasti ${euro(Math.max(0, data.budgetCents - budgetSpent))}` : ""}</p>
              </div>
              <div className="pp-card">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  const amount = Math.round(Number(String(f.get("amount")).replace(",", ".")) * 100);
                  const due = String(f.get("due") || "") || null;
                  void act(async () => { await call("POST", "/budget", { category: String(f.get("category") || "Varie"), label: String(f.get("label")), amount_cents: amount, due_date: due }); form.reset(); });
                }}>
                  <input name="category" placeholder="Categoria (es. Location)" maxLength={60} />
                  <input name="label" placeholder="Voce" required maxLength={120} />
                  <input name="amount" placeholder="Importo €" inputMode="decimal" required />
                  <input name="due" type="date" aria-label="Scadenza" />
                  <button type="submit" className="btn solid small">Aggiungi voce</button>
                </form>
              </div>
              <ul className="pp-rows">
                {data.budget.map((b, i) => (
                  <li key={b.id} className={`pp-row pp-enter${!b.paid && validIso(b.due_date) && b.due_date < todayIso() ? " is-late" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <Checkbox className="pp-check" checked={b.paid} onChange={(v) => act(() => call("PATCH", `/budget/${b.id}`, { paid: v }))} label={<span>{b.label}</span>} />
                    <small>{b.category}{validIso(b.due_date) ? ` · entro il ${shortDate(b.due_date)}` : ""}</small>
                    <strong>{euro(b.amount_cents)}</strong>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/budget/${b.id}`))}>Elimina</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "invitati" && (
            <section className="pp-stagger" aria-label="Invitati">
              <div className="pp-card">
                <GuestQuota initial={data.guestQuota} onSave={(n) => act(() => call("PUT", "", { guestQuota: n }))} />
                <p className="hint">Persone confermate: {yesPersons}{data.guestQuota ? ` su ${data.guestQuota}` : ""}</p>
              </div>
              <div className="pp-card">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/guests", { name: String(f.get("name")), group_name: String(f.get("group") || ""), party_size: Number(f.get("size") || 1) }); form.reset(); });
                }}>
                  <input name="name" placeholder="Nome o famiglia" required maxLength={120} />
                  <input name="group" placeholder="Gruppo (es. Lato sposa)" maxLength={80} />
                  <input name="size" type="number" min={1} max={20} defaultValue={1} aria-label="Persone" />
                  <button type="submit" className="btn solid small">Aggiungi invitato</button>
                </form>
              </div>
              <ul className="pp-rows">
                {data.guests.map((g, i) => (
                  <li key={g.id} className={`pp-row pp-enter resp-${g.response}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <span><strong>{g.name}</strong> <small>{g.group_name}</small></span>
                    <small>{g.party_size} {g.party_size === 1 ? "persona" : "persone"}</small>
                    <select value={g.response} onChange={(e) => act(() => call("PATCH", `/guests/${g.id}`, { response: e.target.value }))} aria-label={`Risposta di ${g.name}`}>
                      <option value="pending">In attesa</option>
                      <option value="yes">Viene</option>
                      <option value="no">Non viene</option>
                    </select>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/guests/${g.id}`))}>Elimina</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "tavoli" && (
            <section className="pp-stagger pp-panel" aria-label="Tavoli">
              <Seating tables={data.tables} guests={data.guests} call={(m, p, b) => act(() => call(m, p, b))} />
            </section>
          )}

          {tab === "attivita" && (
            <section className="pp-stagger" aria-label="Attività">
              <div className="pp-card pp-actions">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/tasks", { title: String(f.get("title")), days_before: Number(f.get("days") || 0) }); form.reset(); });
                }}>
                  <input name="title" placeholder="Attività" required maxLength={160} />
                  <input name="days" type="number" min={0} max={1000} defaultValue={30} aria-label="Giorni prima dell'evento" />
                  <button type="submit" className="btn solid small">Aggiungi</button>
                </form>
                {data.tasks.length === 0 && (
                  <button type="button" className="btn outline small" onClick={() => act(async () => { for (const t of STANDARD_TASKS) await call("POST", "/tasks", t); })}>Aggiungi le attività standard</button>
                )}
              </div>
              <ul className="pp-rows">
                {data.tasks.map((t, i) => (
                  <li key={t.id} className={`pp-row pp-enter${t.done ? " is-done" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <Checkbox className="pp-check" checked={t.done} onChange={(v) => act(() => call("PATCH", `/tasks/${t.id}`, { done: v }))} label={<span>{t.title}</span>} />
                    <small>{taskDue(data.event.eventDate, t.days_before)}</small>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/tasks/${t.id}`))}>Elimina</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "fornitori" && (
            <section className="pp-stagger" aria-label="Fornitori">
              <div className="pp-card">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/vendors", { name: String(f.get("name")), role: String(f.get("role") || ""), contact: String(f.get("contact") || "") }); form.reset(); });
                }}>
                  <input name="name" placeholder="Nome" required maxLength={120} />
                  <input name="role" placeholder="Ruolo (es. Fotografo)" maxLength={80} />
                  <input name="contact" placeholder="Contatto" maxLength={160} />
                  <button type="submit" className="btn solid small">Aggiungi fornitore</button>
                </form>
              </div>
              <ul className="pp-rows">
                {data.vendors.map((v, i) => (
                  <li key={v.id} className="pp-row pp-enter" style={{ animationDelay: `${i * 40}ms` }}>
                    <span><strong>{v.name}</strong> <small>{v.role}</small></span>
                    <small>{v.contact}</small>
                    <select value={v.contract_status} onChange={(e) => act(() => call("PATCH", `/vendors/${v.id}`, { contract_status: e.target.value }))} aria-label={`Contratto di ${v.name}`}>
                      <option value="unsigned">Non firmato</option>
                      <option value="signed">Firmato</option>
                    </select>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/vendors/${v.id}`))}>Elimina</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "cartella" && (
            <section className="pp-stagger pp-panel" aria-label="Cartella del matrimonio">
              <Folder
                docs={data.docs}
                vendors={data.vendors}
                tables={data.tables}
                guests={data.guests}
                eventTitle={data.event.title}
                eventDate={data.event.eventDate}
                onPdf={() => setPdfOpen(true)}
                onSave={async (next) => { await call("PUT", "", { docs: next }); await reload(); }}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="pp-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function BudgetSettings({ initial, onSave }: { initial: number; onSave: (cents: number) => void }) {
  const [value, setValue] = useState(initial ? String(initial / 100) : "");
  return (
    <form className="pp-inline" onSubmit={(e) => { e.preventDefault(); onSave(Math.round(Number(value.replace(",", ".") || 0) * 100)); }}>
      <label>Budget totale € <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" /></label>
      <button type="submit" className="btn outline small">Salva budget</button>
    </form>
  );
}

function GuestQuota({ initial, onSave }: { initial: number; onSave: (n: number) => void }) {
  const [value, setValue] = useState(initial ? String(initial) : "");
  return (
    <form className="pp-inline" onSubmit={(e) => { e.preventDefault(); onSave(Math.max(0, Math.round(Number(value) || 0))); }}>
      <label>Quota di persone <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" /></label>
      <button type="submit" className="btn outline small">Salva quota</button>
    </form>
  );
}
