"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { FOLDER, FOLDER_KEYS } from "@inviteme/shared";
import { Folder, type FolderValue } from "./Folder";
import { Armchair, CloudSun, FolderOpen, LayoutDashboard, ListChecks, MoreHorizontal, Printer, Store, Users, Wallet, X, type LucideProps } from "lucide-react";
import { Seating } from "./Seating";
import { PdfDialog } from "./PdfDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { ShareInvite } from "./ShareInvite";
import { BudgetSection, type Payment, type Quote } from "./BudgetSection";
import { useLang, useT } from "@/lib/lang";

// Planner: servizio a sé (si compra a parte) per organizzare un evento: riepilogo, budget, invitati, tavoli,
// attività, fornitori e cartella. Si può collegare a un invito del cliente: allora ne usa i colori e il link da condividere.
// Le conferme di presenza restano dell'invito (pagina Risposte): qui solo il numero, se c'è un invito collegato.
// Ogni modifica va alle rotte /api/planners/:id/… (plannerRoutes.ts).

export type LinkedInvitation = { id: string; title: string; slug: string; published: boolean; themeId: string; themeColor: string; rsvps: number };
export type PremiumData = {
  id: string;
  event: { title: string; eventDate: string; venue: string; address: string; eventType?: string };
  invitation: LinkedInvitation | null;
  linkable: { id: string; title: string }[];
  guests: { id: string; name: string; group_name: string; party_size: number; response: "pending" | "yes" | "no"; table_id: string | null }[];
  tables: { id: string; name: string; seats: number }[];
  budget: Payment[];
  quotes: Quote[];
  tasks: { id: string; title: string; done: boolean; days_before: number }[];
  vendors: { id: string; name: string; role: string; contact: string; contract_status: "unsigned" | "signed" }[];
  rsvpResponses: number;
  docs: Record<string, FolderValue>;
  notes: string;
  budgetCents: number;
  guestQuota: number;
  groupQuotas?: Record<string, number>;
  bannerImage: string | null;
  archImage: string | null;
};

type Weather = { forecast: { tmaxC: number; tminC: number; precipMm: number; precipProb: number | null } | null; reason?: string; place?: string };
type Tab = "riepilogo" | "budget" | "invitati" | "tavoli" | "attivita" | "fornitori" | "cartella";
type Icon = ComponentType<LucideProps>;

const TABS: { key: Tab; label: string; en: string; icon: Icon }[] = [
  { key: "riepilogo", label: "Riepilogo", en: "Overview", icon: LayoutDashboard },
  { key: "budget", label: "Budget", en: "Budget", icon: Wallet },
  { key: "invitati", label: "Invitati", en: "Guests", icon: Users },
  { key: "tavoli", label: "Tavoli", en: "Tables", icon: Armchair },
  { key: "attivita", label: "Attività", en: "To-do", icon: ListChecks },
  { key: "fornitori", label: "Fornitori", en: "Vendors", icon: Store },
  { key: "cartella", label: "Cartella", en: "Folder", icon: FolderOpen },
];

// Telefono: barra in basso come un'app, con le sezioni principali e «Altro» per tutte le altre.
const MAIN_TABS: Tab[] = ["riepilogo", "invitati", "budget", "attivita"];
const MORE_TABS = TABS.filter((t) => !MAIN_TABS.includes(t.key));

const STANDARD_TASKS: { title: string; en: string; days_before: number }[] = [
  { title: "Scegliere la location", en: "Choose the venue", days_before: 365 },
  { title: "Prenotare fotografo e video", en: "Book photographer and videographer", days_before: 300 },
  { title: "Prenotare la musica", en: "Book the music", days_before: 240 },
  { title: "Definire stile, palette e tema", en: "Decide style, palette and theme", days_before: 300 },
  { title: "Inviare le partecipazioni", en: "Send the invitations", days_before: 60 },
  { title: "Confermare i fornitori", en: "Confirm the vendors", days_before: 30 },
  { title: "Preparare la cartella del giorno", en: "Prepare the day's folder", days_before: 14 },
  { title: "Controllare il meteo e il piano B", en: "Check the weather and plan B", days_before: 3 },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (v: string | null | undefined): v is string => !!v && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00"));
const loc = (en: boolean) => (en ? "en-GB" : "it-IT");
const euro = (cents: number, en = false) => (cents / 100).toLocaleString(loc(en), { style: "currency", currency: "EUR" });
const todayIso = () => new Date().toISOString().slice(0, 10);
const longDate = (iso: string, en = false) => new Date(iso + "T12:00:00").toLocaleDateString(loc(en), { day: "numeric", month: "long", year: "numeric" });
const daysUntil = (iso: string) => (validIso(iso) ? Math.round((Date.parse(iso + "T00:00:00") - Date.parse(todayIso() + "T00:00:00")) / 86_400_000) : null);
// Data di un'attività: giorni prima dell'evento. Senza una data valida mostra solo il conteggio.
const taskDue = (eventDate: string, daysBefore: number, en: boolean) => {
  if (!validIso(eventDate)) return en ? `${daysBefore} days before` : `${daysBefore} giorni prima`;
  const d = new Date(eventDate + "T12:00:00");
  d.setDate(d.getDate() - daysBefore);
  const when = d.toLocaleDateString(loc(en), { day: "numeric", month: "short", year: "numeric" });
  return en ? `by ${when}` : `entro il ${when}`;
};

export function PremiumPlanner({ id, initial, lang }: { id: string; initial: PremiumData; lang: "it" | "en" }) {
  const router = useRouter();
  const t = useT();
  const en = lang === "en";
  const [data, setData] = useState<PremiumData>(initial);
  const [tab, setTab] = useState<Tab>("riepilogo");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Cambio di sezione: come in un'app, la pagina riparte dall'alto.
  function go(next: Tab) {
    setTab(next);
    setMoreOpen(false);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) window.scrollTo({ top: 0 });
  }

  // Il pannello «Altro» si chiude con Esc.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  useEffect(() => {
    fetch(`/api/planners/${id}/weather`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: Weather | null) => setWeather(w))
      .catch(() => setWeather(null));
  }, [id]);

  async function call(method: "POST" | "PATCH" | "DELETE" | "PUT", path: string, body?: unknown) {
    setError(null);
    const res = await fetch(`/api/planners/${id}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(out.error ?? t("Operazione non riuscita", "Something went wrong"));
      throw new Error(out.error ?? "errore");
    }
    return out;
  }

  // Dopo ogni modifica si ricaricano i dati dal server: il server è la sola fonte di verità.
  async function reload() {
    const res = await fetch(`/api/planners/${id}/data`);
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
    if (unsigned) list.push(en ? `${unsigned} unsigned ${unsigned === 1 ? "contract" : "contracts"}` : `${unsigned} ${unsigned === 1 ? "contratto non firmato" : "contratti non firmati"}`);
    const yesPersons = data.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);
    if (data.guestQuota && yesPersons > data.guestQuota) list.push(en ? `${yesPersons - data.guestQuota} over the limit` : `${yesPersons - data.guestQuota} oltre la quota`);
    const today = todayIso();
    const overdue = data.budget.filter((b) => !b.paid && validIso(b.due_date) && b.due_date < today).length;
    if (overdue) list.push(en ? `${overdue} overdue ${overdue === 1 ? "payment" : "payments"}` : `${overdue} ${overdue === 1 ? "pagamento scaduto" : "pagamenti scaduti"}`);
    const spent = data.quotes.filter((q) => q.booked).reduce((n, q) => n + q.amount_cents, 0) + data.budget.filter((b) => !b.quote_id).reduce((n, b) => n + b.amount_cents, 0);
    if (data.budgetCents && spent > data.budgetCents) list.push(en ? `Budget exceeded by ${euro(spent - data.budgetCents, en)}` : `Budget superato di ${euro(spent - data.budgetCents)}`);
    return list;
  }, [data, en]);

  const days = daysUntil(data.event.eventDate);
  const docsWritten = FOLDER.filter((s) => (s.kind === "text" ? typeof data.docs[s.key] === "string" && (data.docs[s.key] as string).trim() : ((data.docs[s.key] as { items?: unknown[] } | undefined)?.items?.length ?? 0) > 0)).length;
  const tasksDone = data.tasks.filter((t) => t.done).length;
  const taskPct = data.tasks.length ? Math.round((tasksDone / data.tasks.length) * 100) : 0;
  const budgetSpent = data.quotes.filter((q) => q.booked).reduce((n, q) => n + q.amount_cents, 0) + data.budget.filter((b) => !b.quote_id).reduce((n, b) => n + b.amount_cents, 0);
  const budgetPct = data.budgetCents ? Math.min(100, Math.round((budgetSpent / data.budgetCents) * 100)) : 0;
  const yesPersons = data.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);
  const pendingGroups = data.guests.filter((g) => g.response === "pending").length;

  return (
    <div className="pp-shell">
      <div className="pp-layout">
        <aside className={`pp-rail${data.invitation ? "" : " is-bare"}`} aria-label={t("Sezioni del planner", "Planner sections")}>
          {/* Condividi solo con un invito collegato: il planner da solo non ha una pagina per gli ospiti. */}
          {data.invitation && <ShareInvite path={data.invitation.published ? `/i/${data.invitation.slug}` : null} title={data.event.title || t("Il nostro invito", "Our invitation")} editHref={`/editor/${data.invitation.id}`} lang={lang} />}
          <nav className="pp-rail-nav" role="tablist" aria-orientation="vertical">
            {TABS.map(({ key, label, en: labelEn, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`pp-rail-item${tab === key ? " is-on" : ""}`} onClick={() => go(key)}>
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                <span>{t(label, labelEn)}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="pp-rail-item pp-rail-print" onClick={() => setPdfOpen(true)}>
            <Printer size={18} strokeWidth={1.6} aria-hidden="true" />
            <span>{t("Crea PDF", "Create PDF")}</span>
          </button>
        </aside>

        {/* Telefono: barra delle sezioni in basso */}
        <nav className="pp-tabbar" aria-label={t("Sezioni del planner", "Planner sections")}>
          {TABS.filter((x) => MAIN_TABS.includes(x.key)).map(({ key, label, en: labelEn, icon: Icon }) => (
            <button key={key} type="button" className={`pp-tabbar-item${tab === key ? " is-on" : ""}`} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}>
              <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <span>{t(label, labelEn)}</span>
            </button>
          ))}
          <button
            type="button"
            className={`pp-tabbar-item${MORE_TABS.some((x) => x.key === tab) || moreOpen ? " is-on" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <MoreHorizontal size={22} strokeWidth={1.6} aria-hidden="true" />
            <span>{(() => { const cur = MORE_TABS.find((x) => x.key === tab); return cur ? t(cur.label, cur.en) : t("Altro", "More"); })()}</span>
          </button>
        </nav>
        {moreOpen && (
          <div className="pp-sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
            <div className="pp-sheet" role="dialog" aria-modal="true" aria-label={t("Altre sezioni", "More sections")}>
              <header className="pp-sheet-head">
                <strong>{t("Altro", "More")}</strong>
                <button type="button" className="pp-sheet-close" aria-label={t("Chiudi", "Close")} onClick={() => setMoreOpen(false)} autoFocus><X size={20} aria-hidden="true" /></button>
              </header>
              <div className="pp-sheet-grid">
                {MORE_TABS.map(({ key, label, en: labelEn, icon: Icon }) => (
                  <button key={key} type="button" className={`pp-sheet-item${tab === key ? " is-on" : ""}`} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}>
                    <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                    <span>{t(label, labelEn)}</span>
                  </button>
                ))}
                <button type="button" className="pp-sheet-item" onClick={() => { setMoreOpen(false); setPdfOpen(true); }}>
                  <Printer size={24} strokeWidth={1.5} aria-hidden="true" />
                  <span>{t("Crea PDF", "Create PDF")}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {pdfOpen && <PdfDialog id={id} onClose={() => setPdfOpen(false)} />}
        <div className="pp-content" key={tab}>
          {error && <p className="form-error pp-noprint" role="alert">{error}</p>}

          {tab === "riepilogo" && (
            <section className="pp-stagger" aria-label={t("Riepilogo", "Overview")}>
              <EventCard data={data} onSaveEvent={(ev) => act(() => call("PUT", "", ev))} onLink={(invitationId) => act(() => call("POST", "/link", { invitationId }))} />
              <div className="pp-hero-stats">
                <div className="pp-stat pp-stat-days">
                  <span className="pp-kicker">{t("Giorno del sì", "The big day")}</span>
                  <strong>{days === null ? "—" : days > 0 ? days : days === 0 ? t("Oggi", "Today") : t("Passato", "Past")}</strong>
                  <small>{days !== null && days > 0 ? (days === 1 ? t("giorno", "day") : t("giorni", "days")) : validIso(data.event.eventDate) ? longDate(data.event.eventDate, en) : t("Imposta la data dell'evento", "Set the event date")}</small>
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">{t("Invitati confermati", "Confirmed guests")}</span>
                  <strong>{yesPersons}</strong>
                  <small>{en
                    ? `${data.guests.length} ${data.guests.length === 1 ? "group" : "groups"} · ${pendingGroups} awaiting reply${data.invitation ? ` · ${data.rsvpResponses} ${data.rsvpResponses === 1 ? "reply" : "replies"} from the invitation` : ""}`
                    : `${data.guests.length} ${data.guests.length === 1 ? "gruppo" : "gruppi"} · ${pendingGroups} senza risposta${data.invitation ? ` · ${data.rsvpResponses} ${data.rsvpResponses === 1 ? "risposta" : "risposte"} dall'invito` : ""}`}</small>
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">Budget</span>
                  <strong>{euro(budgetSpent, en)}</strong>
                  <small>{data.budgetCents ? t(`su ${euro(data.budgetCents)}`, `of ${euro(data.budgetCents, true)}`) : t("imposta il budget nella scheda Budget", "set the budget in the Budget tab")}</small>
                  {data.budgetCents > 0 && <Bar value={budgetPct} />}
                </div>
                <div className="pp-stat">
                  <span className="pp-kicker">{t("Attività", "To-do")}</span>
                  <strong>{tasksDone}/{data.tasks.length}</strong>
                  <small>{t("completate", "done")}</small>
                  {data.tasks.length > 0 && <Bar value={taskPct} />}
                </div>
              </div>

              <div className="pp-two">
                <div className="pp-card">
                  <span className="pp-kicker">{t("Da sistemare", "Needs attention")}</span>
                  {alerts.length === 0 ? <p className="hint">{t("Nulla di urgente.", "Nothing urgent.")}</p> : <ul className="pp-list">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>}
                </div>
                <div className="pp-card">
                  <span className="pp-kicker">{t("Meteo il giorno del sì", "Weather on the day")}</span>
                  {!weather ? <p className="hint">{t("Caricamento…", "Loading…")}</p> : weather.forecast ? (
                    <>
                      <strong className="pp-weather"><CloudSun size={22} strokeWidth={1.5} aria-hidden="true" /> {weather.forecast.tmaxC}° / {weather.forecast.tminC}°</strong>
                      <small>{weather.forecast.precipMm} {t("mm di pioggia", "mm of rain")}{weather.forecast.precipProb !== null ? ` · ${weather.forecast.precipProb}% ${t("di probabilità", "chance")}` : ""}{weather.place ? ` · ${weather.place}` : ""}</small>
                    </>
                  ) : (
                    <p className="hint">{weather.reason === "range" ? t("La previsione arriva a circa due settimane dalla data.", "The forecast is available about two weeks before the date.") : weather.reason === "date" ? t("Imposta la data dell'evento.", "Set the event date.") : t("Indica l'indirizzo dell'evento per vedere il meteo.", "Add the event address to see the weather.")}</p>
                  )}
                </div>
                <div className="pp-card">
                  <span className="pp-kicker">{t("Cartella", "Folder")}</span>
                  <strong className="pp-big">{docsWritten}/{FOLDER.length}</strong>
                  <small>{t("sezioni con contenuto", "sections filled in")}</small>
                  <Bar value={Math.round((docsWritten / FOLDER.length) * 100)} />
                </div>
              </div>
            </section>
          )}

          {tab === "budget" && (
            <section className="pp-stagger pp-panel" aria-label="Budget">
              <BudgetSection quotes={data.quotes} payments={data.budget} budgetCents={data.budgetCents} guestQuota={data.guestQuota} call={call} act={act} />
            </section>
          )}

          {tab === "invitati" && (
            <section className="pp-stagger" aria-label={t("Invitati", "Guests")}>
              <div className="pp-card">
                <GuestQuota initial={data.guestQuota} onSave={(n) => act(() => call("PUT", "", { guestQuota: n }))} />
                <p className="hint">{t("Persone confermate", "Confirmed people")}: {yesPersons}{data.guestQuota ? ` ${t("su", "of")} ${data.guestQuota}` : ""}</p>
              </div>
              <div className="pp-card">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/guests", { name: String(f.get("name")), group_name: String(f.get("group") || ""), party_size: Number(f.get("size") || 1) }); form.reset(); });
                }}>
                  <input name="name" placeholder={t("Nome o famiglia", "Name or family")} required maxLength={120} />
                  <input name="group" placeholder={t("Gruppo (es. Lato sposa)", "Group (e.g. Bride's side)")} maxLength={80} />
                  <input name="size" type="number" min={1} max={20} defaultValue={1} aria-label={t("Persone", "People")} />
                  <button type="submit" className="btn solid small">{t("Aggiungi invitato", "Add guest")}</button>
                </form>
              </div>
              <ul className="pp-rows">
                {data.guests.map((g, i) => (
                  <li key={g.id} className={`pp-row pp-enter resp-${g.response}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <span><strong>{g.name}</strong> <small>{g.group_name}</small></span>
                    <small>{g.party_size} {g.party_size === 1 ? t("persona", "person") : t("persone", "people")}</small>
                    <select value={g.response} onChange={(e) => act(() => call("PATCH", `/guests/${g.id}`, { response: e.target.value }))} aria-label={`${t("Risposta di", "Reply from")} ${g.name}`}>
                      <option value="pending">{t("In attesa", "Pending")}</option>
                      <option value="yes">{t("Viene", "Attending")}</option>
                      <option value="no">{t("Non viene", "Not attending")}</option>
                    </select>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/guests/${g.id}`))}>{t("Elimina", "Delete")}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "tavoli" && (
            <section className="pp-stagger pp-panel" aria-label={t("Tavoli", "Tables")}>
              <Seating tables={data.tables} guests={data.guests} call={(m, p, b) => act(() => call(m, p, b))} />
            </section>
          )}

          {tab === "attivita" && (
            <section className="pp-stagger" aria-label={t("Attività", "To-do")}>
              <div className="pp-card pp-actions">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/tasks", { title: String(f.get("title")), days_before: Number(f.get("days") || 0) }); form.reset(); });
                }}>
                  <input name="title" placeholder={t("Attività", "Task")} required maxLength={160} />
                  <input name="days" type="number" min={0} max={1000} defaultValue={30} aria-label={t("Giorni prima dell'evento", "Days before the event")} />
                  <button type="submit" className="btn solid small">{t("Aggiungi", "Add")}</button>
                </form>
                {data.tasks.length === 0 && (
                  <button type="button" className="btn outline small" onClick={() => act(async () => { for (const s of STANDARD_TASKS) await call("POST", "/tasks", { title: en ? s.en : s.title, days_before: s.days_before }); })}>{t("Aggiungi le attività standard", "Add the standard tasks")}</button>
                )}
              </div>
              <ul className="pp-rows">
                {data.tasks.map((task, i) => (
                  <li key={task.id} className={`pp-row pp-enter${task.done ? " is-done" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <Checkbox className="pp-check" checked={task.done} onChange={(v) => act(() => call("PATCH", `/tasks/${task.id}`, { done: v }))} label={<span>{task.title}</span>} />
                    <small>{taskDue(data.event.eventDate, task.days_before, en)}</small>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/tasks/${task.id}`))}>{t("Elimina", "Delete")}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "fornitori" && (
            <section className="pp-stagger" aria-label={t("Fornitori", "Vendors")}>
              <div className="pp-card">
                <form className="pp-form" onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void act(async () => { await call("POST", "/vendors", { name: String(f.get("name")), role: String(f.get("role") || ""), contact: String(f.get("contact") || "") }); form.reset(); });
                }}>
                  <input name="name" placeholder={t("Nome", "Name")} required maxLength={120} />
                  <input name="role" placeholder={t("Ruolo (es. Fotografo)", "Role (e.g. Photographer)")} maxLength={80} />
                  <input name="contact" placeholder={t("Contatto", "Contact")} maxLength={160} />
                  <button type="submit" className="btn solid small">{t("Aggiungi fornitore", "Add vendor")}</button>
                </form>
              </div>
              <ul className="pp-rows">
                {data.vendors.map((v, i) => (
                  <li key={v.id} className="pp-row pp-enter" style={{ animationDelay: `${i * 40}ms` }}>
                    <span><strong>{v.name}</strong> <small>{v.role}</small></span>
                    <small>{v.contact}</small>
                    <select value={v.contract_status} onChange={(e) => act(() => call("PATCH", `/vendors/${v.id}`, { contract_status: e.target.value }))} aria-label={`${t("Contratto di", "Contract with")} ${v.name}`}>
                      <option value="unsigned">{t("Non firmato", "Not signed")}</option>
                      <option value="signed">{t("Firmato", "Signed")}</option>
                    </select>
                    <button type="button" className="pp-link" onClick={() => act(() => call("DELETE", `/vendors/${v.id}`))}>{t("Elimina", "Delete")}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "cartella" && (
            <section className="pp-stagger pp-panel" aria-label={t("Cartella del matrimonio", "Wedding folder")}>
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

// Evento del planner (nome, data, luogo) e invito collegato: si modificano qui. Il collegamento è facoltativo.
function EventCard({ data, onSaveEvent, onLink }: { data: PremiumData; onSaveEvent: (ev: { title: string; eventDate: string; venue: string; address: string }) => void; onLink: (invitationId: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [ev, setEv] = useState(data.event);
  const [pick, setPick] = useState("");
  const t = useT();
  const en = useLang() === "en";
  useEffect(() => setEv(data.event), [data.event]);
  const inv = data.invitation;
  return (
    <div className="pp-card pp-event">
      <div className="pp-event-head">
        <div>
          <span className="pp-kicker">{t("Il tuo evento", "Your event")}</span>
          <strong className="pp-event-title">{data.event.title || t("Evento senza nome", "Untitled event")}</strong>
          <small>{[validIso(data.event.eventDate) ? longDate(data.event.eventDate, en) : t("Data da definire", "Date to be set"), data.event.venue].filter(Boolean).join(" · ")}</small>
        </div>
        {!editing && <button type="button" className="pp-link" onClick={() => setEditing(true)}>{t("Modifica", "Edit")}</button>}
      </div>
      {editing && (
        <form className="pp-form pp-event-form" onSubmit={(e) => { e.preventDefault(); onSaveEvent(ev); setEditing(false); }}>
          <input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder={t("Nome dell'evento", "Event name")} maxLength={120} required aria-label={t("Nome dell'evento", "Event name")} />
          <input type="date" value={ev.eventDate} onChange={(e) => setEv({ ...ev, eventDate: e.target.value })} aria-label={t("Data", "Date")} />
          <input value={ev.venue} onChange={(e) => setEv({ ...ev, venue: e.target.value })} placeholder={t("Luogo", "Venue")} maxLength={160} aria-label={t("Luogo", "Venue")} />
          <input value={ev.address} onChange={(e) => setEv({ ...ev, address: e.target.value })} placeholder={t("Indirizzo (per il meteo)", "Address (for the weather)")} maxLength={200} aria-label={t("Indirizzo", "Address")} />
          <button type="submit" className="btn solid small">{t("Salva", "Save")}</button>
          <button type="button" className="pp-link" onClick={() => { setEv(data.event); setEditing(false); }}>{t("Annulla", "Cancel")}</button>
        </form>
      )}
      <div className="pp-event-link">
        {inv ? (
          <>
            <span className="pp-event-thumb" style={{ background: inv.themeColor }} aria-hidden="true" />
            <span className="pp-event-inv"><small>{t("Invito collegato", "Linked invitation")}</small><strong>{inv.title || t("Invito", "Invitation")} · {inv.rsvps} {inv.rsvps === 1 ? t("risposta", "reply") : t("risposte", "replies")}</strong></span>
            <a className="pp-link" href={`/inviti/${inv.id}/risposte`}>{t("Risposte", "Replies")}</a>
            <button type="button" className="pp-link" onClick={() => { if (window.confirm(t("Scollegare l'invito da questo planner? I dati del planner restano.", "Unlink the invitation from this planner? The planner's data stays."))) onLink(null); }}>{t("Scollega", "Unlink")}</button>
          </>
        ) : data.linkable.length > 0 ? (
          <form className="pp-event-pick" onSubmit={(e) => { e.preventDefault(); if (pick) onLink(pick); }}>
            <span>{t("Nessun invito collegato.", "No linked invitation.")}</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("Invito da collegare", "Invitation to link")}>
              <option value="">{t("Scegli un invito…", "Choose an invitation…")}</option>
              {data.linkable.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            <button type="submit" className="btn outline small" disabled={!pick}>{t("Collega", "Link")}</button>
          </form>
        ) : (
          <span className="hint">{t("Nessun invito collegato. Il planner funziona anche da solo; se compri un invito potrai collegarlo qui.", "No linked invitation. The planner works on its own; if you buy an invitation you can link it here.")}</span>
        )}
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

function GuestQuota({ initial, onSave }: { initial: number; onSave: (n: number) => void }) {
  const t = useT();
  const [value, setValue] = useState(initial ? String(initial) : "");
  return (
    <form className="pp-inline" onSubmit={(e) => { e.preventDefault(); onSave(Math.max(0, Math.round(Number(value) || 0))); }}>
      <label>{t("Quota di persone", "Guest limit")} <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" /></label>
      <button type="submit" className="btn outline small">{t("Salva quota", "Save limit")}</button>
    </form>
  );
}
