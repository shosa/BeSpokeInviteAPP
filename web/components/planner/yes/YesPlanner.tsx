"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FOLDER, eventPhrases, type EventPhrases } from "@inviteme/shared";
import type { PremiumData } from "../PremiumPlanner";
import { PdfDialog } from "../PdfDialog";
import { IcBinder, IcChevron, IcClose, IcGear, IcGuests, IcHome, IcPlus, IcPrint, IcSearch, IcTasks, IcWallet } from "./icons";
import { DEMO_WEATHER, daysUntil, demoApply, stats, type Method, type Weather } from "./model";
import { Home } from "./Home";
import { BudgetView, BinderView, GuestsView, SettingsView, TasksView } from "./Sections";
import { DaySheet, GuestSheet, PhotoSheet, TaskSheet } from "./Sheets";
import "./yes.css";

// Planner con l'aspetto e il comportamento di un'app: barra laterale sul computer, barra in basso sul telefono,
// Riepilogo a schede, sezioni Budget, Invitati, Attività e Cartella, ricerca con Ctrl K.
// Ogni modifica va alle rotte /api/planners/:id/… ; nella demo resta in memoria e non si salva.

export type View = "home" | "budget" | "guests" | "tasks" | "binder" | "settings";
export type Guest = PremiumData["guests"][number];
export type Task = PremiumData["tasks"][number];
export type Sheet = { kind: "guest"; guest?: Guest } | { kind: "task"; task?: Task } | { kind: "day" } | { kind: "photo" } | null;

// Frasi del tipo di evento (matrimonio, compleanno…), già nella lingua del planner.
export type EventCopy = EventPhrases & { settings: string; date: string; daysBefore: string; binder: string; onTheDay: string; bigDay: string };
export function eventCopy(type: string | undefined, en: boolean): EventCopy {
  const p = eventPhrases(type, en ? "en" : "it");
  const wedding = (type ?? "wedding") === "wedding";
  return en
    ? { ...p, settings: `${p.of[0].toUpperCase()}${p.of.slice(1)} settings`, date: `the ${p.of} date`, daysBefore: `How many days before the ${p.of}`, binder: `Your ${p.of} binder`, onTheDay: `on the ${p.of} day`, bigDay: "The big day" }
    : { ...p, settings: `Impostazioni ${p.of}`, date: `la data ${p.of}`, daysBefore: `Quanti giorni prima ${p.of}`, binder: `La cartella ${p.of}`, onTheDay: `il giorno ${p.of}`, bigDay: wedding ? "Il giorno del sì" : "Il grande giorno" };
}

export type Ctx = {
  id: string;
  data: PremiumData;
  ev: EventCopy;
  en: boolean;
  demo: boolean;
  t: (it: string, en: string) => string;
  weather: Weather | null;
  view: View;
  sub: string;
  go: (view: View, sub?: string) => void;
  call: (method: Method, path: string, body?: unknown) => Promise<unknown>;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  sheet: (s: Sheet) => void;
  toast: (text: string) => void;
  pdf: () => void;
  search: () => void;
  accountHref: string;
  buyHref: string;
};

const NAV: { view: View; it: string; en: string; Icon: (p: { on?: boolean }) => React.ReactElement }[] = [
  { view: "home", it: "Riepilogo", en: "Summary", Icon: IcHome },
  { view: "budget", it: "Budget", en: "Budget", Icon: IcWallet },
  { view: "guests", it: "Invitati", en: "Guests", Icon: IcGuests },
  { view: "tasks", it: "Attività", en: "Tasks", Icon: IcTasks },
  { view: "binder", it: "Cartella", en: "Binder", Icon: IcBinder },
];

export function YesPlanner({ id, initial, lang, demo = false, accountHref = "/account#planner", buyHref = "/account#planner" }: { id: string; initial: PremiumData; lang: "it" | "en"; demo?: boolean; accountHref?: string; buyHref?: string }) {
  const router = useRouter();
  const en = lang === "en";
  const t = useCallback((it: string, eng: string) => (en ? eng : it), [en]);
  const [data, setData] = useState<PremiumData>(initial);
  const [view, setView] = useState<View>("home");
  const [sub, setSub] = useState("");
  const [weather, setWeather] = useState<Weather | null>(demo ? DEMO_WEATHER : null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [palette, setPalette] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 2600);
  }, []);

  // Le sezioni hanno un indirizzo (#budget, #invitati/tavoli…): il tasto Indietro del browser torna alla precedente.
  const HASH: Record<View, string> = { home: "", budget: "budget", guests: "invitati", tasks: "attivita", binder: "cartella", settings: "impostazioni" };
  const go = useCallback((next: View, nextSub = "") => {
    setView(next);
    setSub(nextSub);
    setPalette(false);
    const hash = HASH[next] + (nextSub ? `/${nextSub}` : "");
    if (typeof window !== "undefined") {
      history.pushState(null, "", hash ? `#${hash}` : window.location.pathname + window.location.search);
      window.scrollTo({ top: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const read = () => {
      const [h, s] = window.location.hash.slice(1).split("/");
      const found = (Object.keys(HASH) as View[]).find((k) => HASH[k] === h && h);
      setView(found ?? "home");
      setSub(found ? s ?? "" : "");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (demo) return;
    fetch(`/api/planners/${id}/weather`).then((r) => (r.ok ? r.json() : null)).then((w: Weather | null) => setWeather(w ?? { forecast: null })).catch(() => setWeather({ forecast: null }));
  }, [id, demo]);

  // Barra in alto traslucida appena la pagina scorre.
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Ctrl K (⌘K) apre la ricerca; Esc chiude ricerca e finestre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); }
      if (e.key === "Escape") { setPalette(false); setSheet(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const call = useCallback(async (method: Method, path: string, body?: unknown) => {
    setError(null);
    if (demo) {
      setData((d) => demoApply(d, method, path, body));
      return {};
    }
    const res = await fetch(`/api/planners/${id}${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      const msg = out.error ?? t("Operazione non riuscita", "Something went wrong");
      setError(msg);
      toast(msg);
      throw new Error(msg);
    }
    return out;
  }, [demo, id, t, toast]);

  // Dopo ogni modifica si ricaricano i dati dal server: il server è la sola fonte di verità.
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      if (demo) return;
      const res = await fetch(`/api/planners/${id}/data`);
      if (res.ok) setData((await res.json()) as PremiumData);
      router.refresh();
    } catch {
      /* l'errore è già mostrato */
    }
  }, [demo, id, router]);

  const s = useMemo(() => stats(data), [data]);
  const days = daysUntil(data.event.eventDate);
  const budgetPct = data.budgetCents ? Math.round((s.planned / data.budgetCents) * 100) : null;
  const meta: Record<View, string | null> = {
    home: null,
    budget: budgetPct === null ? null : `${budgetPct} %`,
    guests: s.total ? `${s.yes}/${s.total}` : null,
    tasks: data.tasks.length ? `${s.tasksDone}/${data.tasks.length}` : null,
    binder: `${s.docsDone}/${FOLDER.length}`,
    settings: null,
  };

  const openPdf = () => (demo ? toast(t("Nella demo il PDF non si crea: con il planner lo scarichi pronto da stampare.", "The demo can't create the PDF: with the planner you download it ready to print.")) : setPdfOpen(true));
  const ev = eventCopy(data.event.eventType, en);
  const ctx: Ctx = { id, data, ev, en, demo, t, weather, view, sub, go, call, act, sheet: setSheet, toast, pdf: openPdf, search: () => setPalette(true), accountHref, buyHref };
  const navIndex = NAV.findIndex((n) => n.view === view);
  const couple = data.event.title || ev.your;

  // Pulsanti in alto a destra di ogni sezione (come nell'app: aggiungi, stampa).
  const actions: { label: string; icon: React.ReactNode; onClick: () => void }[] = [];
  if (view === "home") {
    actions.push({ label: t("Cerca", "Search"), icon: <IcSearch />, onClick: () => setPalette(true) });
    actions.push({ label: ev.settings, icon: <IcGear />, onClick: () => go("settings") });
  }
  if (view === "tasks") actions.push({ label: t("Crea PDF", "Create PDF"), icon: <IcPrint />, onClick: openPdf });
  if (view === "binder") actions.push({ label: t("Crea PDF", "Create PDF"), icon: <IcPrint />, onClick: openPdf });
  if (view === "tasks") actions.push({ label: t("Nuova attività", "New task"), icon: <IcPlus />, onClick: () => setSheet({ kind: "task" }) });
  if (view === "guests") actions.push({ label: t("Aggiungi invitato", "Add guest"), icon: <IcPlus />, onClick: () => setSheet({ kind: "guest" }) });
  if (view === "budget") actions.push({ label: t("Aggiungi o cerca", "Add or search"), icon: <IcPlus />, onClick: () => setPalette(true) });

  return (
    <div className={`yp${demo ? " is-demo" : ""}${view === "home" ? " y-home" : ""}`}>
      <aside className="y-sidebar" aria-label={t("Sezioni", "Sections")}>
        <div className="y-brand"><b>Bespoke Invite</b><span>Planner</span></div>
        <nav>
          <button type="button" onClick={() => setPalette(true)}>
            <IcSearch /><span>{t("Cerca", "Search")}</span><kbd>Ctrl K</kbd>
          </button>
          {NAV.map(({ view: v, it, en: eng, Icon }) => (
            <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
              <Icon on={view === v} /><span>{t(it, eng)}</span>
              {meta[v] && <span className="y-side-meta tn">{meta[v]}</span>}
            </button>
          ))}
        </nav>
        <div className="y-side-foot">
          <div className="y-side-count">
            <img src="/planner/rings.svg" alt="" width={60} height={58} />
            <div>
              <p className="y-cap">{couple}</p>
              <p className="tn" style={{ fontFamily: "var(--brand)", fontStyle: "italic", fontWeight: 500, fontSize: "1.5rem" }} suppressHydrationWarning>
                {days === null ? t("Data da fissare", "Date to set") : days > 0 ? `${days} ${days === 1 ? t("giorno", "day") : t("giorni", "days")}` : days === 0 ? t("È oggi", "It's today") : ev.after}
              </p>
            </div>
          </div>
          <button type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => go("settings")}><IcGear /><span>{ev.settings}</span></button>
        </div>
      </aside>

      <div className="y-content">
        <header className={`y-nb${scrolled ? " is-scrolled" : ""}`}>
          <div className="y-nb-in">
            <div className="y-nb-l">{view === "home" ? <span className="y-home-brand">Bespoke Invite <small>Planner</small></span> : null}</div>
            <div className="y-nb-t" aria-hidden="true">{view === "home" ? couple : view === "settings" ? t("Impostazioni", "Settings") : t(NAV[navIndex]?.it ?? "", NAV[navIndex]?.en ?? "")}</div>
            <div className="y-nb-r">
              {actions.map((a) => <button key={a.label} type="button" className="y-nbtn" aria-label={a.label} title={a.label} onClick={a.onClick}>{a.icon}</button>)}
            </div>
          </div>
        </header>

        {error && view !== "home" && <p className="y-error" role="alert" style={{ maxWidth: 720, margin: "0 auto 12px", padding: "0 16px" }}>{error}</p>}
        <div key={view} className="y-enter">
          {view === "home" && <Home ctx={ctx} />}
          {view === "budget" && <BudgetView ctx={ctx} />}
          {view === "guests" && <GuestsView ctx={ctx} />}
          {view === "tasks" && <TasksView ctx={ctx} />}
          {view === "binder" && <BinderView ctx={ctx} />}
          {view === "settings" && <SettingsView ctx={ctx} />}
        </div>
      </div>

      <nav className="y-tabbar" aria-label={t("Sezioni", "Sections")}>
        <div className="y-tabbar-in">
          {navIndex >= 0 && <span className="y-tpw" aria-hidden="true" style={{ transform: `translateX(${navIndex * 100}%)` }}><span className="y-tpill" /></span>}
          {NAV.map(({ view: v, it, en: eng, Icon }) => (
            <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}>
              <Icon on={view === v} /><span>{t(it, eng)}</span>
            </button>
          ))}
        </div>
      </nav>

      {demo && <a className="y-demo-buy" href={buyHref}>{t("Acquista il planner", "Get the planner")}</a>}
      {palette && <Palette ctx={ctx} onClose={() => setPalette(false)} openSheet={(x) => { setPalette(false); setSheet(x); }} />}
      {sheet?.kind === "guest" && <GuestSheet ctx={ctx} guest={sheet.guest} onClose={() => setSheet(null)} />}
      {sheet?.kind === "task" && <TaskSheet ctx={ctx} task={sheet.task} onClose={() => setSheet(null)} />}
      {sheet?.kind === "day" && <DaySheet ctx={ctx} onClose={() => setSheet(null)} />}
      {sheet?.kind === "photo" && <PhotoSheet ctx={ctx} onClose={() => setSheet(null)} />}
      {pdfOpen && <PdfDialog id={id} onClose={() => setPdfOpen(false)} />}
      {toastText && <div className="y-toast" role="status" aria-live="polite">{toastText}</div>}
    </div>
  );
}

// Ricerca e azioni rapide (Ctrl K): senza testo propone le azioni, con il testo cerca in invitati, attività, fornitori e cartella.
function Palette({ ctx, onClose, openSheet }: { ctx: Ctx; onClose: () => void; openSheet: (s: Sheet) => void }) {
  const { t, data, go } = ctx;
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const query = q.trim().toLowerCase();

  type Item = { key: string; label: string; sub?: string; run: () => void };
  const groups: { title: string; items: Item[] }[] = [];
  if (!query) {
    groups.push({ title: "", items: [
      { key: "a-guest", label: t("Aggiungi invitato", "Add guest"), run: () => openSheet({ kind: "guest" }) },
      { key: "a-item", label: t("Aggiungi voce di spesa", "Add item"), run: () => go("budget") },
      { key: "a-task", label: t("Nuova attività", "New task"), run: () => openSheet({ kind: "task" }) },
      { key: "a-pdf", label: t("Crea il PDF della cartella", "Create binder PDF"), run: () => { onClose(); ctx.pdf(); } },
    ] });
  } else {
    const has = (s: string) => s.toLowerCase().includes(query);
    const sections: Item[] = [
      ...NAV.map((n) => ({ key: `s-${n.view}`, label: t(n.it, n.en), run: () => go(n.view) })),
      { key: "s-tables", label: t("Tavoli", "Tables"), run: () => go("guests", "tavoli") },
      { key: "s-settings", label: ctx.ev.settings, run: () => go("settings") },
    ].filter((x) => has(x.label));
    const guests = data.guests.filter((g) => has(g.name) || has(g.group_name)).slice(0, 6).map((g) => ({ key: `g-${g.id}`, label: g.name, sub: g.group_name, run: () => openSheet({ kind: "guest", guest: g }) }));
    const tasks = data.tasks.filter((x) => has(x.title)).slice(0, 6).map((x) => ({ key: `t-${x.id}`, label: x.title, run: () => openSheet({ kind: "task", task: x }) }));
    const vendors = [...data.vendors.map((v) => ({ id: v.id, name: v.name, role: v.role })), ...data.quotes.filter((x) => x.booked).map((x) => ({ id: x.id, name: x.name, role: "" }))]
      .filter((v) => has(v.name) || has(v.role)).slice(0, 6).map((v) => ({ key: `v-${v.id}`, label: v.name, sub: v.role, run: () => go("budget") }));
    const folder = FOLDER.filter((f) => has(ctx.en ? f.titleEn : f.title)).slice(0, 6).map((f) => ({ key: `f-${f.key}`, label: ctx.en ? f.titleEn : f.title, run: () => go("binder") }));
    if (sections.length) groups.push({ title: t("Sezioni", "Sections"), items: sections });
    if (guests.length) groups.push({ title: t("Invitati", "Guests"), items: guests });
    if (tasks.length) groups.push({ title: t("Attività", "Tasks"), items: tasks });
    if (vendors.length) groups.push({ title: t("Fornitori", "Vendors"), items: vendors });
    if (folder.length) groups.push({ title: t("Cartella", "Binder"), items: folder });
  }
  const flat = groups.flatMap((g) => g.items);
  useEffect(() => setActive(0), [query]);

  return (
    <>
      <div className="y-dim" onClick={onClose} />
      <div className="y-palette" role="dialog" aria-modal="true" aria-label={t("Aggiungi o cerca", "Add or search")}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === "Enter" && flat[active]) { e.preventDefault(); flat[active]!.run(); }
        }}>
        <div className="y-palette-head">
          <h2>{t("Aggiungi o cerca", "Add or search")}</h2>
          <button type="button" className="y-nbtn" aria-label={t("Chiudi", "Close")} onClick={onClose}><IcClose /></button>
        </div>
        <label className="y-search">
          <IcSearch />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca nel planner", "Search the planner")} aria-label={t("Cerca nel planner", "Search the planner")} />
        </label>
        {groups.map((g) => (
          <div key={g.title || "actions"}>
            {g.title && <h3 className="y-gh">{g.title}</h3>}
            <div className="y-palette-list">
              {g.items.map((it) => {
                const i = flat.indexOf(it);
                return (
                  <button key={it.key} type="button" className={`y-row${i === active ? " is-active" : ""}`} onMouseEnter={() => setActive(i)} onClick={it.run}>
                    <span className="y-r-m"><span className="y-r-t y-wrap">{it.label}</span>{it.sub && <span className="y-r-s">{it.sub}</span>}</span>
                    <IcChevron />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {query && flat.length === 0 && <p className="y-gf" style={{ marginTop: 14 }}>{t("Nessun risultato.", "No results.")}</p>}
      </div>
    </>
  );
}
