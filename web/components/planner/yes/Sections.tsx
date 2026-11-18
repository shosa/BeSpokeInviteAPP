"use client";

import { useEffect, useMemo, useState } from "react";
import { EVENT_TYPES, folderFor } from "@inviteme/shared";
import { BudgetSection } from "../BudgetSection";
import { Seating } from "../Seating";
import { Folder } from "../Folder";
import { ShareInvite } from "../ShareInvite";
import { eventCopy, type Ctx, type Guest } from "./YesPlanner";
import { PlannerIconPicker } from "../PlannerIcon";
import { IcCheck, IcChevron, IcClock, IcGlobe, IcList, IcPhone, IcPrint, IcSearch } from "./icons";
import { TASK_BANDS, docCount, euro, hue, initials, stats, taskWhen, validIso } from "./model";

// Sezioni del planner: colonna di 720px con titolo grande, controllo a segmenti ed elenchi raggruppati.

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className="y-seg" role="tablist" aria-label={label} style={{ "--n": options.length } as React.CSSProperties}>
      <span className="y-seg-thumb" aria-hidden="true" style={{ "--i": i } as React.CSSProperties} />
      {options.map((o) => <button key={o.v} type="button" role="tab" aria-selected={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}

// Intestazione della sezione: titolo e sottotitolo a sinistra, pulsanti della sezione (aggiungi, stampa) a destra.
function Head({ ctx, title, sub }: { ctx: Ctx; title: string; sub?: string }) {
  return (
    <div className="y-ph">
      <div className="y-ph-text">
        <h1 className="y-lt">{title}</h1>
        {sub && <p className="y-lt-sub">{sub}</p>}
      </div>
      {ctx.actions.length > 0 && (
        <div className="y-ph-acts">
          {ctx.actions.map((a) => (
            <button key={a.label} type="button" className={`y-btn y-btn-sm ${a.primary ? "y-btn-fill" : "y-btn-tinted"}`} onClick={a.onClick}>{a.icon}<span>{a.label}</span></button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Budget ----------
export function BudgetView({ ctx }: { ctx: Ctx }) {
  const { data, t, en } = ctx;
  const initial = (["voci", "pagamenti", "contratti", "confronta"] as const).find((v) => v === ctx.sub) ?? "voci";
  return (
    <div className="y-page">
      <Head ctx={ctx} title="Budget" sub={data.budgetCents ? (data.guestQuota ? t(`${euro(data.budgetCents, en)} per ${data.guestQuota} invitati`, `${euro(data.budgetCents, en)} for ${data.guestQuota} guests`) : euro(data.budgetCents, en)) : t("Imposta il budget totale per vedere quanto resta.", "Set the total budget to see what's left.")} />
      <BudgetSection key={initial} initialView={initial} quotes={data.quotes} payments={data.budget} budgetCents={data.budgetCents} guestQuota={data.guestQuota} call={ctx.call} act={ctx.act} />
      <Vendors ctx={ctx} />
    </div>
  );
}

function Vendors({ ctx }: { ctx: Ctx }) {
  const { data, t } = ctx;
  const [adding, setAdding] = useState(false);
  return (
    <section className="y-grp">
      <h2 className="y-gh"><span>{t("Fornitori e contatti", "Vendors and contacts")}</span><span className="r">{data.vendors.length || ""}</span></h2>
      <div className="y-gl">
        {data.vendors.map((v) => (
          <div key={v.id} className="y-row">
            <span className="y-r-m"><span className="y-r-t">{v.name}</span><span className="y-r-s">{[v.role, v.contact].filter(Boolean).join(" · ") || t("Nessun contatto", "No contact")}</span></span>
            <button type="button" className={`y-pill${v.contract_status === "signed" ? "" : ""}`} onClick={() => ctx.act(() => ctx.call("PATCH", `/vendors/${v.id}`, { contract_status: v.contract_status === "signed" ? "unsigned" : "signed" }))}>
              <span className={v.contract_status === "signed" ? "t-ok" : "t-warn"}>{v.contract_status === "signed" ? t("Firmato", "Signed") : t("Da firmare", "To sign")}</span>
            </button>
            <button type="button" className="y-tbtn" style={{ color: "var(--label-2)" }} aria-label={`${t("Elimina", "Delete")} ${v.name}`} onClick={() => { if (window.confirm(t(`Eliminare ${v.name}?`, `Delete ${v.name}?`))) void ctx.act(() => ctx.call("DELETE", `/vendors/${v.id}`)); }}>×</button>
          </div>
        ))}
        {adding ? (
          <form className="y-form" style={{ padding: 16 }} onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void ctx.act(() => ctx.call("POST", "/vendors", { name: String(f.get("name")), role: String(f.get("role") || ""), contact: String(f.get("contact") || "") })).then(() => setAdding(false));
          }}>
            <label className="y-field">{t("Nome", "Name")}<input name="name" required maxLength={120} autoFocus /></label>
            <div className="y-form-row">
              <label className="y-field">{t("Ruolo", "Role")}<input name="role" maxLength={80} placeholder={t("Fotografo", "Photographer")} /></label>
              <label className="y-field">{t("Contatto", "Contact")}<input name="contact" maxLength={160} /></label>
            </div>
            <div style={{ display: "flex", gap: 8 }}><button className="y-btn y-btn-fill y-btn-sm" type="submit">{t("Aggiungi", "Add")}</button><button className="y-btn y-btn-gray y-btn-sm" type="button" onClick={() => setAdding(false)}>{t("Annulla", "Cancel")}</button></div>
          </form>
        ) : (
          <button type="button" className="y-row" style={{ color: "var(--tint)", fontWeight: 500 }} onClick={() => setAdding(true)}>{t("Aggiungi un fornitore", "Add a vendor")}</button>
        )}
      </div>
    </section>
  );
}

// ---------- Invitati ----------
type Filter = "all" | "yes" | "pending" | "no";
export function GuestsView({ ctx }: { ctx: Ctx }) {
  const { data, t, en } = ctx;
  const s = useMemo(() => stats(data), [data]);
  const tab = ctx.sub === "tavoli" ? "tavoli" : ctx.sub === "famiglie" ? "famiglie" : "lista";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const tableName = (id: string | null) => data.tables.find((x) => x.id === id)?.name;
  const respLabel = (r: Guest["response"]) => (r === "yes" ? t("Viene", "Attending") : r === "no" ? t("Non viene", "Not attending") : t("Senza risposta", "No reply"));

  const list = data.guests.filter((g) => (filter === "all" || g.response === filter) && (!q.trim() || `${g.name} ${g.group_name}`.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = useMemo(() => {
    const out: { name: string; items: Guest[] }[] = [];
    for (const g of list) {
      const name = g.group_name || t("Senza gruppo", "No group");
      const grp = out.find((x) => x.name === name);
      if (grp) grp.items.push(g); else out.push({ name, items: [g] });
    }
    return out;
  }, [list, t]);
  const count = (r: Filter) => (r === "all" ? data.guests : data.guests.filter((g) => g.response === r)).reduce((n, g) => n + g.party_size, 0);

  return (
    <div className="y-page">
      <Head ctx={ctx} title={t("Invitati", "Guests")} sub={s.total ? t(`${s.yes} vengono, ${s.pending} devono rispondere e ${s.no} non vengono.`, `${s.yes} attending, ${s.pending} yet to reply and ${s.no} can't make it.`) : t("Aggiungi gli invitati per gruppo: famiglie, amici, colleghi.", "Add your guests by group: family, friends, colleagues.")} />
      <Seg label={t("Viste degli invitati", "Guest views")} value={tab} onChange={(v) => ctx.go("guests", v === "lista" ? "" : v)} options={[{ v: "lista", label: t("Lista", "List") }, { v: "famiglie", label: t("Famiglie", "Families") }, { v: "tavoli", label: t("Tavoli", "Tables") }]} />

      {tab === "lista" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="y-search"><IcSearch /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca", "Search")} aria-label={t("Cerca tra gli invitati", "Search guests")} /></label>
            <div className="y-pills">
              {([["all", t("Tutti", "All")], ["yes", t("Vengono", "Attending")], ["pending", t("Senza risposta", "No reply")], ["no", t("Non vengono", "Not attending")]] as [Filter, string][]).map(([v, label]) => (
                <button key={v} type="button" className="y-pill" aria-pressed={filter === v} onClick={() => setFilter(v)}>{label} <span className="n">{count(v)}</span></button>
              ))}
            </div>
            {data.invitation && <div><a className="y-pill" href={`/inviti/${data.invitation.id}/risposte`}><IcGlobe />{t(`Risposte online (${data.invitation.rsvps})`, `Online RSVPs (${data.invitation.rsvps})`)}</a></div>}
          </div>
          {groups.map((g) => (
            <section key={g.name} className="y-grp">
              <h2 className="y-gh"><span>{g.name}</span><span className="r tn">{g.items.reduce((n, x) => n + x.party_size, 0)}</span></h2>
              <div className="y-gl">
                {g.items.map((x) => (
                  <button key={x.id} type="button" className="y-row" onClick={() => ctx.sheet({ kind: "guest", guest: x })}>
                    <span className="y-r-m">
                      <span className="y-r-t">{x.name}</span>
                      {(x.party_size > 1 || tableName(x.table_id)) && <span className="y-r-s">{[x.party_size > 1 ? t(`${x.party_size} persone`, `${x.party_size} people`) : null, tableName(x.table_id)].filter(Boolean).join(" · ")}</span>}
                    </span>
                    <span className={`y-r-v y-resp-${x.response}`}>{respLabel(x.response)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {data.guests.length === 0 ? (
            <div className="y-w y-empty">
              <p className="y-empty-t">{t("Ancora nessun invitato", "No guests yet")}</p>
              <p className="y-empty-p">{t("Aggiungi le persone una alla volta o per famiglia: poi segni chi viene.", "Add people one by one or as families, then mark who's coming.")}</p>
              <button className="y-btn y-btn-fill y-btn-sm" type="button" onClick={() => ctx.sheet({ kind: "guest" })}>{t("Aggiungi invitato", "Add guest")}</button>
            </div>
          ) : list.length === 0 && <p className="y-gf">{t("Nessun invitato con questi filtri.", "No guests match these filters.")}</p>}
        </>
      )}

      {tab === "famiglie" && <GroupsView ctx={ctx} />}

      {tab === "tavoli" && (
        <div className="y-tables-view">
          <Seating tables={data.tables} guests={data.guests} call={(m, p, b) => ctx.act(() => ctx.call(m, p, b))} />
        </div>
      )}
    </div>
  );
}

function GroupsView({ ctx }: { ctx: Ctx }) {
  const { data, t } = ctx;
  const s = stats(data);
  const [quota, setQuota] = useState(data.guestQuota ? String(data.guestQuota) : "");
  useEffect(() => setQuota(data.guestQuota ? String(data.guestQuota) : ""), [data.guestQuota]);
  const groups = useMemo(() => {
    const map = new Map<string, { yes: number; all: number }>();
    for (const g of data.guests) {
      const k = g.group_name || t("Senza gruppo", "No group");
      const v = map.get(k) ?? { yes: 0, all: 0 };
      v.all += g.party_size;
      if (g.response === "yes") v.yes += g.party_size;
      map.set(k, v);
    }
    return [...map.entries()].sort((a, b) => b[1].all - a[1].all);
  }, [data.guests, t]);
  return (
    <>
      <section className="y-w">
        <div className="y-sum-top">
          <div><span className="y-cap">{t("Persone che vengono", "People attending")}</span><div className="y-sum-n tn">{s.yes}</div></div>
          <form className="y-cap" style={{ display: "flex", alignItems: "center", gap: 8 }} onSubmit={(e) => { e.preventDefault(); void ctx.act(() => ctx.call("PUT", "", { guestQuota: Math.max(0, Math.round(Number(quota) || 0)) })).then(() => ctx.toast(t("Limite salvato", "Limit saved"))); }}>
            <label className="y-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{t("Limite", "Limit")}<input value={quota} onChange={(e) => setQuota(e.target.value)} inputMode="numeric" style={{ width: 80, height: 34 }} aria-label={t("Limite di invitati", "Guest limit")} /></label>
            <button className="y-btn y-btn-tinted y-btn-sm" type="submit">{t("Salva", "Save")}</button>
          </form>
        </div>
        <span className={`y-bar${data.guestQuota && s.yes > data.guestQuota ? "" : " ok"}`}><i style={{ transform: `scaleX(${data.guestQuota ? Math.min(1, s.yes / data.guestQuota) : 0})` }} /></span>
      </section>
      <div className="y-gl">
        {groups.map(([name, v]) => {
          const limit = data.groupQuotas?.[name] ?? 0;
          const over = limit > 0 && v.yes > limit;
          return (
            <div key={name} className="y-row">
              <span className="y-av" style={{ "--h": hue(name) } as React.CSSProperties}>{initials(name)}</span>
              <span className="y-r-m">
                <span className="y-r-t">{name}</span>
                <span className={`y-r-s${over ? " t-warn" : ""}`}>
                  {over ? t(`${v.yes} vengono: ${v.yes - limit} oltre il limite di ${limit}`, `${v.yes} attending: ${v.yes - limit} over the allowance of ${limit}`) : t(`${v.yes} su ${v.all} vengono`, `${v.yes} of ${v.all} attending`)}
                </span>
              </span>
              <label className="y-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <span>{t("Limite", "Allowance")}</span>
                <input key={`${name}-${limit}`} defaultValue={limit || ""} inputMode="numeric" placeholder="—" style={{ width: 64, height: 32, textAlign: "center" }} aria-label={t(`Limite di persone per ${name}`, `Allowance for ${name}`)}
                  onBlur={(e) => {
                    const n = Math.max(0, Math.round(Number(e.currentTarget.value) || 0));
                    if (n === limit) return;
                    const next = { ...(data.groupQuotas ?? {}) };
                    if (n) next[name] = n; else delete next[name];
                    void ctx.act(() => ctx.call("PUT", "", { groupQuotas: next }));
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
              </label>
            </div>
          );
        })}
        {groups.length === 0 && <p className="y-row y-cap">{t("I gruppi compaiono quando aggiungi gli invitati.", "Groups show up when you add guests.")}</p>}
      </div>
    </>
  );
}

// ---------- Attività ----------
const STANDARD_TASKS: { it: string; en: string; d: number }[] = [
  { it: "Scegliere la location", en: "Choose the venue", d: 365 },
  { it: "Prenotare fotografo e video", en: "Book photographer and videographer", d: 300 },
  { it: "Definire stile, palette e tema", en: "Define the style, palette and theme", d: 300 },
  { it: "Prenotare la musica", en: "Book the music", d: 240 },
  { it: "Inviare le partecipazioni", en: "Send the invitations", d: 60 },
  { it: "Confermare i fornitori", en: "Confirm the vendors", d: 30 },
  { it: "Preparare la cartella del giorno", en: "Prepare the day's binder", d: 14 },
  { it: "Controllare il meteo e il piano B", en: "Check the weather and plan B", d: 3 },
];

export function TasksView({ ctx }: { ctx: Ctx }) {
  const { data, t, en } = ctx;
  const [mode, setMode] = useState<"todo" | "all">("todo");
  const done = data.tasks.filter((x) => x.done).length;
  const pct = data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0;
  const bands = TASK_BANDS.map((b, i) => {
    const max = i === 0 ? Infinity : TASK_BANDS[i - 1]!.min;
    const all = data.tasks.filter((x) => x.days_before >= b.min && x.days_before < max).sort((a, c) => c.days_before - a.days_before);
    return { ...b, all, shown: mode === "todo" ? all.filter((x) => !x.done) : all };
  }).filter((b) => b.shown.length > 0);

  return (
    <div className="y-page">
      <Head ctx={ctx} title={t("Attività", "Tasks")} sub={validIso(data.event.eventDate) ? t(`Le date si calcolano da sole dalla ${ctx.ev.date.replace(/^la /, "")}.`, `Dates are worked out automatically from ${ctx.ev.date}.`) : t(`Imposta ${ctx.ev.date}: le scadenze si calcolano da sole.`, `Set ${ctx.ev.date} and the due dates work themselves out.`)} />
      <section className="y-w">
        <div className="y-sum-top"><div className="y-sum-n tn">{pct}%</div><span className="y-cap">{t(`${done} di ${data.tasks.length} fatte`, `${done} of ${data.tasks.length} done`)}</span></div>
        <span className="y-bar ok"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
      </section>
      <Seg label={t("Quali attività", "Which tasks")} value={mode} onChange={setMode} options={[{ v: "todo", label: t("Da fare", "To do") }, { v: "all", label: t("Tutte", "All") }]} />
      {bands.map((b) => (
        <section key={b.min} className="y-grp">
          <h2 className="y-gh"><span>{en ? b.en : b.it}</span><span className="r tn" style={{ fontFamily: "var(--mont)", fontWeight: 600 }}>{t(`${b.all.filter((x) => x.done).length} di ${b.all.length}`, `${b.all.filter((x) => x.done).length} of ${b.all.length}`)}</span></h2>
          <div className="y-gl" style={{ "--inset": "52px" } as React.CSSProperties}>
            {b.shown.map((task) => (
              <div key={task.id} className={`y-row${task.done ? " is-done" : ""}`}>
                <button className={`y-ck${task.done ? " on" : ""}`} type="button" aria-pressed={task.done} aria-label={task.done ? t("Segna come da fare", "Mark as not done") : t("Segna come fatta", "Mark as done")} onClick={() => ctx.act(() => ctx.call("PATCH", `/tasks/${task.id}`, { done: !task.done }))}><IcCheck /></button>
                <button className="y-r-m" type="button" onClick={() => ctx.sheet({ kind: "task", task })}>
                  <span className="y-r-t y-wrap"><span className="y-stk">{task.title}</span></span>
                  <span className="y-r-s">{taskWhen(data.event.eventDate, task.days_before, en)}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {data.tasks.length === 0 && (
        <div className="y-w y-empty">
          <p className="y-empty-t">{t("Nessuna attività", "No tasks yet")}</p>
          <p className="y-empty-p">{t("Parti dalle attività consigliate: le date si mettono da sole.", "Start from the suggested tasks: the dates fill themselves in.")}</p>
          <button className="y-btn y-btn-fill y-btn-sm" type="button" onClick={() => ctx.act(async () => { for (const x of STANDARD_TASKS) await ctx.call("POST", "/tasks", { title: en ? x.en : x.it, days_before: x.d }); })}>{t("Aggiungi le attività consigliate", "Add the suggested tasks")}</button>
        </div>
      )}
      {data.tasks.length > 0 && bands.length === 0 && <p className="y-gf">{t("Tutto fatto: non resta niente da fare.", "All done: nothing left to do.")}</p>}
    </div>
  );
}

// ---------- Cartella ----------
export function BinderView({ ctx }: { ctx: Ctx }) {
  const { data, t, en } = ctx;
  const FOLDER = folderFor(data.event.eventType);
  const s = stats(data);
  const items = FOLDER.reduce((n, f) => n + docCount(data, f.key), 0);
  const C = 2 * Math.PI * 26;
  const pct = s.docsDone / FOLDER.length;
  const useful = FOLDER.filter((f) => f.priority);
  const [request, setRequest] = useState<{ key: string; n: number } | null>(null);
  const icon = (kind: string) => (kind === "contacts" ? <IcPhone /> : kind === "timeline" ? <IcClock /> : <IcList />);
  const unit = (kind: string, n: number) => (kind === "contacts" ? t(`${n} contatti`, `${n} contacts`) : kind === "timeline" ? t(`${n} momenti`, `${n} entries`) : kind === "text" ? (n ? t("Scritto", "Written") : t("Da scrivere", "To write")) : t(`${n} voci`, `${n} items`));
  return (
    <div className="y-page">
      <Head ctx={ctx} title={t("Cartella", "Binder")} sub={t("Tutto quello che serve il grande giorno, pronto da stampare.", "Everything you need on the big day, ready to print.")} />
      <section className="y-w" style={{ padding: 16 }}>
        <span className="y-cap">{ctx.ev.binder}</span>
        <h2 className="y-heading" style={{ fontSize: 28, marginBottom: 14 }}>{t(`${s.docsDone} su ${FOLDER.length} sezioni con qualcosa di pronto`, `${s.docsDone} of ${FOLDER.length} sections with something prepared`)}</h2>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="y-cap">{t(`${items} voci pronte`, `${items} items ready`)}</span>
          <svg className="y-binder-ring" viewBox="0 0 64 64" aria-hidden="true"><circle className="trk" cx="32" cy="32" r="26" /><circle className="prg" cx="32" cy="32" r="26" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} /></svg>
        </div>
        <p className="y-lt-sub" style={{ margin: "14px 0" }}>{t("Programmi, contatti, allestimento, valigie e checklist. Modifica tutto e portala stampata il grande giorno.", "Timelines, contacts, setup, packing and checklists. Edit everything and bring it printed on the big day.")}</p>
        <button className="y-btn y-btn-fill y-btn-block" type="button" onClick={ctx.pdf}><IcPrint />{t("Crea il PDF da stampare", "Create printable PDF")}</button>
      </section>
      <section className="y-grp">
        <h2 className="y-gh">{t("Utili adesso", "Useful right now")}</h2>
        <div className="y-tiles">
          {useful.map((f) => (
            <button key={f.key} type="button" className="y-tile" onClick={() => setRequest((r) => ({ key: f.key, n: (r?.n ?? 0) + 1 }))}>
              <span className="y-ri">{icon(f.kind)}</span>
              <span className="y-tile-n">{en ? f.titleEn : f.title}</span>
              <span className="y-tile-m">{unit(f.kind, docCount(data, f.key))}</span>
            </button>
          ))}
        </div>
      </section>
      <Folder
        docs={data.docs}
        vendors={data.vendors}
        tables={data.tables}
        guests={data.guests}
        eventTitle={data.event.title}
        eventDate={data.event.eventDate}
        onPdf={ctx.pdf}
        request={request}
        eventType={data.event.eventType}
        onSave={async (next) => { await ctx.act(() => ctx.call("PUT", "", { docs: next })); }}
      />
    </div>
  );
}

// ---------- Impostazioni ----------
export function SettingsView({ ctx }: { ctx: Ctx }) {
  const { data, t, en } = ctx;
  const [ev, setEv] = useState(data.event);
  const [budget, setBudget] = useState(data.budgetCents ? String(data.budgetCents / 100) : "");
  const [pick, setPick] = useState("");
  useEffect(() => setEv(data.event), [data.event]);
  const inv = data.invitation;
  return (
    <div className="y-page">
      <Head ctx={ctx} title={ctx.ev.settings} sub={t("Nomi, data e luogo: da qui si calcolano conto alla rovescia, scadenze e meteo.", "Names, date and place: the countdown, due dates and weather come from here.")} />
      <form className="y-w y-form" onSubmit={(e) => {
        e.preventDefault();
        void ctx.act(() => ctx.call("PUT", "", { ...ev, budgetCents: Math.max(0, Math.round(Number(budget.replace(/\./g, "").replace(",", ".")) * 100) || 0) })).then(() => ctx.toast(t("Salvato", "Saved")));
      }}>
        <label className="y-field">{t("Tipo di evento", "Event type")}
          <select value={ev.eventType ?? "wedding"} onChange={(e) => setEv({ ...ev, eventType: e.target.value })}>
            {EVENT_TYPES.map((x) => <option key={x.id} value={x.id}>{en ? x.labelEn : x.label}</option>)}
          </select>
        </label>
        <label className="y-field">{eventCopy(ev.eventType, en).names}<input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} maxLength={120} required placeholder={eventCopy(ev.eventType, en).namesHint} /></label>
        <div className="y-form-row">
          <label className="y-field">{t("Data", "Date")}<input type="date" value={ev.eventDate} onChange={(e) => setEv({ ...ev, eventDate: e.target.value })} /></label>
          <label className="y-field">{t("Budget totale (€)", "Total budget (€)")}<input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="25000" /></label>
        </div>
        <label className="y-field">{t("Luogo", "Venue")}<input value={ev.venue} onChange={(e) => setEv({ ...ev, venue: e.target.value })} maxLength={160} /></label>
        <label className="y-field">{t("Indirizzo (per il meteo)", "Address (for the weather)")}<input value={ev.address} onChange={(e) => setEv({ ...ev, address: e.target.value })} maxLength={200} /></label>
        <div><button className="y-btn y-btn-fill y-btn-sm" type="submit">{t("Salva", "Save")}</button></div>
      </form>

      <section className="y-grp">
        <h2 className="y-gh">{t("Icona del planner", "Planner icon")}</h2>
        <div className="y-w">
          <PlannerIconPicker value={data.icon} eventType={data.event.eventType} lang={en ? "en" : "it"} onChange={(icon) => void ctx.act(() => ctx.call("PUT", "", { icon })).then(() => ctx.toast(t("Icona cambiata", "Icon changed")))} />
        </div>
      </section>

      <section className="y-grp">
        <h2 className="y-gh">{t("Aspetto", "Look")}</h2>
        <div className="y-gl">
          <button type="button" className="y-row" onClick={() => ctx.sheet({ kind: "photo" })}><span className="y-r-m"><span className="y-r-t">{t("Foto di copertina", "Cover photo")}</span><span className="y-r-s">{data.bannerImage ? t("Foto tua", "Your photo") : t("Nessuna foto", "No photo")}</span></span><IcChevron /></button>
          <a className="y-row" href={`/lingua/${en ? "it" : "en"}`}><span className="y-r-m"><span className="y-r-t">{t("Lingua", "Language")}</span><span className="y-r-s">{en ? "English" : "Italiano"}</span></span><span className="y-r-v">{en ? "Italiano" : "English"}</span><IcChevron /></a>
        </div>
      </section>

      <section className="y-grp">
        <h2 className="y-gh">{t("Invito", "Invitation")}</h2>
        <div className="y-w">
          {inv ? (
            <div className="y-form">
              <p><strong>{inv.title || t("Invito", "Invitation")}</strong> <span className="y-cap">· {inv.rsvps} {inv.rsvps === 1 ? t("risposta", "reply") : t("risposte", "replies")}</span></p>
              <ShareInvite path={inv.published ? `/i/${inv.slug}` : null} title={data.event.title || t("Il nostro invito", "Our invitation")} editHref={`/editor/${inv.id}`} lang={en ? "en" : "it"} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="y-btn y-btn-tinted y-btn-sm" href={`/inviti/${inv.id}/risposte`}>{t("Risposte", "Replies")}</a>
                <button className="y-btn y-btn-gray y-btn-sm" type="button" onClick={() => { if (window.confirm(t("Scollegare l'invito da questo planner? I dati del planner restano.", "Unlink the invitation from this planner? The planner's data stays."))) void ctx.act(() => ctx.call("POST", "/link", { invitationId: null })); }}>{t("Scollega", "Unlink")}</button>
              </div>
            </div>
          ) : data.linkable.length > 0 ? (
            <form className="y-form" onSubmit={(e) => { e.preventDefault(); if (pick) void ctx.act(() => ctx.call("POST", "/link", { invitationId: pick })); }}>
              <label className="y-field">{t("Collega un tuo invito", "Link one of your invitations")}
                <select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">{t("Scegli un invito…", "Choose an invitation…")}</option>
                  {data.linkable.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </label>
              <div><button className="y-btn y-btn-fill y-btn-sm" type="submit" disabled={!pick}>{t("Collega", "Link")}</button></div>
            </form>
          ) : (
            <p className="y-cap">{t("Nessun invito collegato. Il planner funziona anche da solo; se compri un invito potrai collegarlo qui.", "No linked invitation. The planner works on its own; if you buy an invitation you can link it here.")}</p>
          )}
        </div>
      </section>

      <div className="y-gl">
        <a className="y-row" href={ctx.accountHref}><span className="y-r-m"><span className="y-r-t">{t("La mia area", "My account")}</span></span><IcChevron /></a>
      </div>
    </div>
  );
}
