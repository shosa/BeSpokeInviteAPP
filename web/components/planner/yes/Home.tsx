"use client";

import { useMemo, useRef, useState } from "react";
import { FOLDER } from "@inviteme/shared";
import type { Ctx, View } from "./YesPlanner";
import { IcCamera, IcCheck, IcChevron, IcCloud, IcPlus, IcPrint, IcSearch, IcSun } from "./icons";
import { daysUntil, dayMonth, docFilled, euro, hue, initials, longDate, stats, taskWhen, todayIso, validIso } from "./model";

// Riepilogo: meteo del giorno, foto con il conto alla rovescia, prossime attività, da sistemare,
// budget, invitati, pagamenti, tavoli e cartella. Da 1200px è una griglia a 12 colonne.

export function Home({ ctx }: { ctx: Ctx }) {
  const { data, t, en, go, demo } = ctx;
  const s = useMemo(() => stats(data), [data]);
  const days = daysUntil(data.event.eventDate);
  const title = data.event.title || t("Il vostro matrimonio", "Your wedding");
  const today = new Date().toLocaleDateString(en ? "en-GB" : "it-IT", { weekday: "long", day: "numeric", month: "long" });

  // Da sistemare: contratti da firmare, pagamenti scaduti, invitati oltre il limite, budget superato.
  const alerts = useMemo(() => {
    const list: { text: string; to: View; sub?: string; urgent?: boolean }[] = [];
    const unsigned = data.vendors.filter((v) => v.contract_status === "unsigned").length + data.quotes.filter((q) => q.booked && !q.signed && !data.vendors.some((v) => v.name === q.name)).length;
    if (unsigned) list.push({ text: en ? `${unsigned} unsigned ${unsigned === 1 ? "contract" : "contracts"}` : `${unsigned} ${unsigned === 1 ? "contratto da firmare" : "contratti da firmare"}`, to: "budget", sub: "contratti" });
    const overdue = data.budget.filter((b) => !b.paid && validIso(b.due_date) && b.due_date < todayIso()).length;
    if (overdue) list.push({ text: en ? `${overdue} overdue ${overdue === 1 ? "payment" : "payments"}` : `${overdue} ${overdue === 1 ? "pagamento scaduto" : "pagamenti scaduti"}`, to: "budget", sub: "pagamenti", urgent: true });
    if (data.guestQuota && s.yes > data.guestQuota) list.push({ text: en ? `${s.yes - data.guestQuota} guests over the limit of ${data.guestQuota}` : `${s.yes - data.guestQuota} invitati oltre il limite di ${data.guestQuota}`, to: "guests" });
    for (const [group, quota] of Object.entries(data.groupQuotas ?? {})) {
      const over = data.guests.filter((g) => g.group_name === group && g.response === "yes").reduce((n, g) => n + g.party_size, 0) - quota;
      if (over > 0) list.push({ text: en ? `${group}: ${over} ${over === 1 ? "guest" : "guests"} over the allowance` : `${group}: ${over} ${over === 1 ? "invitato" : "invitati"} oltre il limite`, to: "guests", sub: "famiglie" });
    }
    // I posti contano negli ultimi due mesi: prima non è un'urgenza.
    const unseated = data.tables.length && days !== null && days <= 60 ? data.guests.filter((g) => g.response === "yes" && !g.table_id).reduce((n, g) => n + g.party_size, 0) : 0;
    if (unseated) list.push({ text: en ? `${unseated} attending ${unseated === 1 ? "guest" : "guests"} without a table` : `${unseated} ${unseated === 1 ? "invitato confermato" : "invitati confermati"} senza tavolo`, to: "guests", sub: "tavoli" });
    if (data.budgetCents && s.planned > data.budgetCents) list.push({ text: en ? `Budget exceeded by ${euro(s.planned - data.budgetCents, en)}` : `Budget superato di ${euro(s.planned - data.budgetCents, en)}`, to: "budget", urgent: true });
    return list;
  }, [data, en, s]);

  const next = data.tasks.filter((x) => !x.done).sort((a, b) => b.days_before - a.days_before).slice(0, 4);
  const taskPct = data.tasks.length ? s.tasksDone / data.tasks.length : 0;
  const C = 2 * Math.PI * 24;

  // Budget: le cinque categorie più grandi, il resto insieme in «Altro».
  const cats = s.byCat.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const top = cats.slice(0, 5);
  const rest = cats.slice(5).reduce((n, c) => n + c.total, 0);
  const legend = [...top.map((c) => ({ cls: `cat-${c.key}`, label: en ? c.en : c.it, total: c.total })), ...(rest ? [{ cls: "cat-rest", label: t("Altro", "Other"), total: rest }] : [])];
  const base = Math.max(data.budgetCents, s.planned) || 1;
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;
  const left = data.budgetCents - s.planned;

  const avatars = data.guests.filter((g) => g.response === "yes").slice(0, 4);
  const next3 = s.unpaid.slice(0, 3);
  const nextPay = s.unpaid[0];
  const payName = (p: (typeof s.unpaid)[number]) => data.quotes.find((q) => q.id === p.quote_id)?.name || p.label || t("Pagamento", "Payment");

  const miniTables = data.tables.slice(0, 4).map((tb) => {
    const used = data.guests.filter((g) => g.table_id === tb.id).reduce((n, g) => n + g.party_size, 0);
    const n = Math.max(1, Math.min(tb.seats, 12));
    return { ...tb, dots: Array.from({ length: n }, (_, i) => ({ a: (360 / n) * i, on: i < used })) };
  });

  const priority = FOLDER.filter((f) => f.priority);
  const suggest = new Intl.ListFormat(en ? "en-GB" : "it-IT", { style: "long", type: "conjunction" }).format(priority.map((f) => (en ? f.titleEn : f.title)));

  const w = ctx.weather;
  const f = w?.forecast;
  const dateIso = data.event.eventDate;
  // Ora della cerimonia: dal primo orario dell'ordine della cerimonia, o dal momento «Cerimonia» del programma.
  // Con le previsioni ora per ora si guarda la pioggia da un'ora prima a un'ora dopo.
  const ceremony = useMemo(() => {
    type R = { time?: string; item?: string };
    const rows = (k: string) => ((data.docs[k] as { items?: R[] } | undefined)?.items ?? []);
    const time = rows("ordine-cerimonia").find((r) => /^\d{1,2}:\d{2}/.test(r.time ?? ""))?.time
      ?? rows("programma-generale").find((r) => /cerimon|ceremon/i.test(r.item ?? "") && /^\d{1,2}:\d{2}/.test(r.time ?? ""))?.time;
    return time ? Number(time.split(":")[0]) : null;
  }, [data.docs]);
  const around = f?.hourly && ceremony !== null ? f.hourly.filter((h) => h.hour >= ceremony - 1 && h.hour <= ceremony + 1) : [];
  const atCeremony = around.find((h) => h.hour === ceremony);
  const aroundMm = Math.round(around.reduce((n, h) => n + h.precipMm, 0) * 10) / 10;
  const hh = (n: number) => `${String(Math.max(0, n)).padStart(2, "0")}:00`;
  const risk = !!f && (around.length ? aroundMm >= 0.5 : f.precipMm >= 1 || (f.precipProb ?? 0) >= 50);

  async function addPlanB() {
    const title = t("Confermare il piano B per la pioggia con la location", "Confirm the rain plan with the venue");
    if (data.tasks.some((x) => x.title === title)) return ctx.toast(t("È già tra le attività", "It's already in your tasks"));
    await ctx.act(() => ctx.call("POST", "/tasks", { title, days_before: 3 }));
    ctx.toast(t("Aggiunta alle attività", "Added to your tasks"));
  }
  async function warnGuests() {
    const text = t(`Per il ${validIso(dateIso) ? dayMonth(dateIso, false) : "giorno del sì"} è prevista un po' di pioggia: portate un ombrello, il piano B è pronto!`, `A little rain is forecast for ${validIso(dateIso) ? dayMonth(dateIso, true) : "the big day"}: bring an umbrella, the rain plan is ready!`);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); ctx.toast(t("Messaggio copiato: incollalo nella chat degli invitati", "Message copied: paste it in the guests' chat")); }
    } catch { /* condivisione annullata */ }
  }

  return (
    <div className="y-page y-bento">
      <div className="y-home-head">
        <div>
          <p className="y-eyebrow" suppressHydrationWarning>{today}</p>
          <h1>{title}</h1>
        </div>
        <div className="y-home-head-actions">
          <button className="y-search-field" type="button" onClick={ctx.search}><IcSearch /><span>{t("Cerca nel planner", "Search the planner")}</span><kbd>Ctrl K</kbd></button>
          <button className="y-btn y-btn-fill" type="button" onClick={ctx.search}><IcPlus />{t("Aggiungi", "Add")}</button>
        </div>
      </div>

      <section className={`y-card y-wx${risk ? " is-risk" : ""}`} aria-labelledby="ywxT">
        <p className="y-eyebrow">{validIso(dateIso) ? t(`Il meteo per il ${dayMonth(dateIso, false)}`, `The weather for ${dayMonth(dateIso, true)}`) : t("Il meteo del giorno del sì", "The weather on the big day")}</p>
        {f ? (
          <div className="y-wx-main">
            <p className="y-wx-temp tn"><IcCloud rain={risk} /><span className="mid">{Math.round(f.tmaxC)}°</span><span className="y-cap"> / {Math.round(f.tminC)}°</span></p>
            <h2 id="ywxT" className={`y-heading y-wx-h${risk ? " t-warn" : ""}`}>
              {around.length && ceremony !== null
                ? risk
                  ? t(`Potrebbe piovere intorno alla cerimonia: ${aroundMm} mm tra le ${hh(ceremony - 1)} e le ${hh(ceremony + 1)}`, `It may rain around the ceremony: ${aroundMm} mm between ${hh(ceremony - 1)} and ${hh(ceremony + 1)}`)
                  : t(`Niente pioggia intorno alla cerimonia, tra le ${hh(ceremony - 1)} e le ${hh(ceremony + 1)}`, `No rain around the ceremony, between ${hh(ceremony - 1)} and ${hh(ceremony + 1)}`)
                : risk
                  ? t(`Potrebbe piovere il giorno del sì: ${f.precipMm} mm${f.precipProb !== null ? `, probabilità ${f.precipProb}%` : ""}`, `It may rain on the day: ${f.precipMm} mm${f.precipProb !== null ? `, ${f.precipProb}% chance` : ""}`)
                  : t("Tempo asciutto previsto per il giorno del sì", "Dry weather forecast for the big day")}
            </h2>
            <p className="y-caption">
              {atCeremony && ceremony !== null
                ? t(`Alle ${hh(ceremony)}: ${atCeremony.tempC}° · ${atCeremony.precipMm} mm`, `At ${hh(ceremony)}: ${atCeremony.tempC}° · ${atCeremony.precipMm} mm`)
                : [t(`Massima ${Math.round(f.tmaxC)}°, minima ${Math.round(f.tminC)}°`, `High ${Math.round(f.tmaxC)}°, low ${Math.round(f.tminC)}°`), `${f.precipMm} mm`, w?.place].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : (
          <div className="y-wx-main">
            <p className="y-wx-temp"><IcCloud /><span className="y-cap">{w ? "" : t("Caricamento…", "Loading…")}</span></p>
            <h2 id="ywxT" className="y-heading y-wx-h">
              {!w ? t("Stiamo controllando le previsioni", "Checking the forecast")
                : w.reason === "range" ? t("Le previsioni arrivano due settimane prima", "The forecast arrives two weeks before")
                : w.reason === "date" ? t("Imposta la data per vedere il meteo", "Set the date to see the weather")
                : t("Aggiungi l'indirizzo per vedere il meteo", "Add the address to see the weather")}
            </h2>
            {w && <p className="y-caption">{validIso(dateIso) && days !== null && days > 0 ? t(`Mancano ${days} giorni: ti avvisiamo qui appena c'è la previsione.`, `${days} days to go: it shows up here as soon as there's a forecast.`) : t("Dalle impostazioni del matrimonio.", "From the wedding settings.")}</p>}
          </div>
        )}
        {risk ? (
          <div className="y-wx-acts">
            <button className="y-btn y-btn-fill y-btn-sm" type="button" onClick={warnGuests}>{t("Avvisa gli invitati", "Let the guests know")}</button>
            <button className="y-btn y-btn-tinted y-btn-sm" type="button" onClick={addPlanB}>{t("Conferma il piano B con la location", "Confirm the rain plan with the venue")}</button>
          </div>
        ) : w && !f && w.reason !== "range" ? (
          <div className="y-wx-acts"><button className="y-btn y-btn-tinted y-btn-sm" type="button" onClick={() => go("settings")}>{t("Apri le impostazioni", "Open settings")}</button></div>
        ) : null}
        {f && <p className="y-cap y-wx-credit"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">{t("Previsioni: Open-Meteo (CC BY 4.0)", "Forecast: Open-Meteo (CC BY 4.0)")}</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{t("Luogo: © OpenStreetMap", "Location: © OpenStreetMap")}</a></p>}
        {w?.sample && <p className="y-cap">{t("Previsione di esempio", "Sample forecast")}</p>}
      </section>

      <div className="y-home-top">
        <section className="y-hero" aria-label={t("Il vostro matrimonio", "Your wedding")}>
          {data.bannerImage || data.archImage ? <img src={(data.bannerImage || data.archImage)!} alt="" /> : <img src="/planner/cover.svg" alt="" width={736} height={832} />}
          <button className="y-hero-set" type="button" aria-label={t("Cambia la foto di copertina", "Change the cover photo")} onClick={() => ctx.sheet({ kind: "photo" })}><IcCamera /></button>
          <div className="y-hero-in">
            <div className="y-hero-venue">
              <p className="y-hero-n">{data.event.venue || title}</p>
              <p className="y-hero-m">{validIso(dateIso) ? longDate(dateIso, en) : t("Data da fissare", "Date to be set")}</p>
            </div>
            {days !== null && days >= 0 && (
              <div className="y-hero-c" suppressHydrationWarning>
                <b>{days}</b>
                <span>{days === 1 ? t("giorno", "day") : t("giorni", "days")}</span>
              </div>
            )}
          </div>
        </section>

        <div className="y-task-area">
          <section className="y-card y-now">
            <header>
              <div>
                <p className="y-eyebrow">{t("Attività", "Tasks")}</p>
                <h2 className="y-heading">{t("Prossime", "Up next")}</h2>
              </div>
              <div className="y-ring" role="img" aria-label={t(`${s.tasksDone} di ${data.tasks.length} fatte`, `${s.tasksDone} of ${data.tasks.length} done`)}>
                <svg viewBox="0 0 56 56" aria-hidden="true"><circle className="trk" cx="28" cy="28" r="24" /><circle className="prg" cx="28" cy="28" r="24" strokeDasharray={C} strokeDashoffset={C * (1 - taskPct)} /></svg>
                <span className="tn">{s.tasksDone}/{data.tasks.length}</span>
              </div>
            </header>
            <div className="y-task-rows">
              {next.map((task) => (
                <SwipeRow key={task.id} label={t("Fatta", "Done")} onDone={() => ctx.act(() => ctx.call("PATCH", `/tasks/${task.id}`, { done: true }))}>
                  <div className="y-row">
                    <button className="y-ck" type="button" aria-pressed="false" aria-label={t("Segna come fatta", "Mark as done")} onClick={() => ctx.act(() => ctx.call("PATCH", `/tasks/${task.id}`, { done: true }))}><IcCheck /></button>
                    <button className="y-r-m" type="button" onClick={() => ctx.sheet({ kind: "task", task })}>
                      <span className="y-r-t y-wrap"><span className="y-stk">{task.title}</span></span>
                      <span className="y-r-s">{taskWhen(data.event.eventDate, task.days_before, en)}</span>
                    </button>
                  </div>
                </SwipeRow>
              ))}
            </div>
            {next.length === 0 && <p className="y-task-empty">{data.tasks.length ? t("Tutto fatto. Bravissimi!", "All done. Well done!") : t("Nessuna attività ancora: parti da quelle consigliate.", "No tasks yet: start from the suggested ones.")}</p>}
            <button className="y-row y-task-all" type="button" onClick={() => go("tasks")}><span>{t("Vedi tutte le attività", "See all tasks")}</span><IcChevron /></button>
          </section>
          <section className="y-card y-tease">
            <span className="y-ri"><IcSun /></span>
            <div>
              <h2 className="y-heading">{t("Il giorno del sì, l'app cambia", "On the big day, the app changes")}</h2>
              <p className="y-caption">{t("Vedrai cosa succede adesso, cosa viene dopo e chi chiamare.", "You'll see what's happening now, what's next and who to call.")}</p>
            </div>
            <button className="y-btn y-btn-tinted y-btn-sm" type="button" onClick={() => ctx.sheet({ kind: "day" })}>{t("Provalo ora", "Try it now")}</button>
          </section>
          {next.length > 0 && <p className="y-gf y-task-note">{t("Trascina un'attività verso destra per segnarla come fatta.", "Swipe a task right to mark it as done.")}</p>}
        </div>
      </div>

      {demo && (
        <div className="y-w y-banner">
          <p>{t("Questa è una demo con un matrimonio d'esempio. Tocca quello che vuoi: le modifiche non si salvano.", "This is a demo with a sample wedding. Tap anything you like; changes aren't saved.")}</p>
          <a className="y-btn y-btn-fill y-btn-sm" href={ctx.buyHref}>{t("Acquista il planner", "Get the planner")}</a>
        </div>
      )}

      {alerts.length > 0 && (
        <section className={`y-card y-alerts${alerts.some((a) => a.urgent) ? " is-urgent" : ""}`}>
          <h2 className="y-eyebrow">{t("Da sistemare", "Needs attention")}</h2>
          <div>
            {alerts.map((a) => (
              <button key={a.text} className="y-row" type="button" onClick={() => go(a.to, a.sub)}>
                <i className={`y-dot ${a.urgent ? "red" : "orange"}`} /><span>{a.text}</span><IcChevron />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={`y-metrics${next3.length ? " has-pays" : ""}`}>
        <button className="y-card y-budget" type="button" onClick={() => go("budget")}>
          <span className="y-eyebrow">Budget</span>
          <span className="y-mob">
            <span className="y-number tn">{euro(s.planned, en)}</span>
            <span className="y-caption">{data.budgetCents ? t(`su un budget di ${euro(data.budgetCents, en)}`, `of a ${euro(data.budgetCents, en)} budget`) : t("imposta il budget", "set the budget")}</span>
            <span className="y-bar"><i style={{ transform: `scaleX(${Math.min(1, s.planned / base)})` }} /></span>
            {data.budgetCents > 0 && (left >= 0 ? <span className="y-sage">{t(`${euro(left, en)} liberi`, `${euro(left, en)} left`)}</span> : <span className="y-excess">{t(`${euro(-left, en)} oltre`, `${euro(-left, en)} over`)}</span>)}
          </span>
          <span className="y-desk">
            <span className="y-heading">{data.budgetCents ? (left >= 0 ? t(`${euro(left, en)} liberi`, `${euro(left, en)} left`) : t(`${euro(-left, en)} oltre il budget`, `${euro(-left, en)} over budget`)) : euro(s.planned, en)}</span>
            <span className="y-budget-layout">
              <span className="y-donut">
                <svg viewBox="0 0 132 132" aria-hidden="true">
                  <circle cx="66" cy="66" r={R} stroke="var(--fill)" />
                  {legend.map((c) => {
                    const len = (c.total / base) * CIRC;
                    const el = <circle key={c.cls} className={`seg ${c.cls}`} cx="66" cy="66" r={R} strokeDasharray={`${Math.max(0, len - 1.5)} ${CIRC}`} strokeDashoffset={-acc} />;
                    acc += len;
                    return el;
                  })}
                </svg>
                <span className="y-donut-c"><b className="tn">{euro(s.planned, en)}</b>{data.budgetCents > 0 && <span>{t(`su ${euro(data.budgetCents, en)}`, `of ${euro(data.budgetCents, en)}`)}</span>}</span>
              </span>
              <span className="y-legend">
                {legend.map((c) => <span key={c.cls}><i className={c.cls} /><span>{c.label}</span><b className="tn">{euro(c.total, en)}</b></span>)}
                {legend.length === 0 && <span className="y-caption">{t("Ancora nessuna spesa prenotata.", "Nothing booked yet.")}</span>}
              </span>
            </span>
          </span>
        </button>

        <button className="y-card y-guests" type="button" onClick={() => go("guests")}>
          <span className="y-eyebrow">{t("Invitati", "Guests")}</span>
          <span className="y-mob">
            <span className="y-avatars" aria-hidden="true">
              {avatars.map((g) => <span key={g.id} className="y-av" style={{ "--h": hue(g.name) } as React.CSSProperties}>{initials(g.name)}</span>)}
              {s.yes > avatars.length && <span className="y-av y-av-more">+{Math.max(0, data.guests.filter((g) => g.response === "yes").length - avatars.length)}</span>}
            </span>
            <span className="y-number tn">{s.yes} <span className="y-attending">{t("vengono", "attending")}</span></span>
            <span className="y-caption">{t(`su ${s.total} · ${s.pending} senza risposta`, `of ${s.total} · ${s.pending} no reply yet`)}</span>
          </span>
          <span className="y-desk y-heading">{t(`${s.yes} su ${s.total} vengono`, `${s.yes} of ${s.total} attending`)}</span>
          <div className="y-guest-bar" role="img" aria-label={t(`${s.yes} vengono, ${s.pending} senza risposta, ${s.no} non vengono`, `${s.yes} attending, ${s.pending} no reply, ${s.no} not attending`)}>
            <i className="g-si" style={{ flex: s.yes }} /><i className="g-pend" style={{ flex: s.pending }} /><i className="g-no" style={{ flex: s.no }} />
          </div>
          <span className="y-desk y-guest-stats">
            <span><b className="tn" style={{ color: "var(--tint)" }}>{s.yes}</b><span>{t("Vengono", "Attending")}</span></span>
            <span><b className="tn" style={{ color: "var(--blue)" }}>{s.pending}</b><span>{t("Senza risposta", "No reply")}</span></span>
            <span><b className="tn" style={{ color: "var(--label-2)" }}>{s.no}</b><span>{t("Non vengono", "Not attending")}</span></span>
          </span>
        </button>

        {next3.length > 0 && (
          <section className="y-card y-pays">
            <p className="y-eyebrow">{t("Pagamenti", "Payments")}</p>
            <h2 className="y-heading tn">{euro(s.due, en)}</h2>
            <p className="y-caption">{t("Da pagare", "To pay")}</p>
            <ol className="y-pay-timeline">
              {next3.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => go("budget", "pagamenti")}>
                    <span>{payName(p)}</span><b className="tn">{euro(p.amount_cents, en)}</b>
                    <span className="y-caption">{p.due_date ? longDate(p.due_date, en) : t("Senza data", "No date")}</span>
                  </button>
                </li>
              ))}
            </ol>
            <button className="y-tbtn" type="button" onClick={() => go("budget", "pagamenti")}>{t("Vedi le scadenze", "See payment schedule")}</button>
          </section>
        )}
      </div>

      {nextPay && (
        <section className="y-card y-next-pay">
          <div className="y-next-info">
            <img src="/planner/envelope.svg" alt="" width={50} height={43} />
            <div>
              <p className="y-eyebrow">{t("Prossimo pagamento", "Next payment")}</p>
              <p className="y-pay-name">{payName(nextPay)}</p>
              <p className="y-caption">{nextPay.due_date ? longDate(nextPay.due_date, en) : t("Senza data", "No date")}</p>
            </div>
            <b className="y-pay-amount tn">{euro(nextPay.amount_cents, en)}</b>
          </div>
          <button className="y-btn y-btn-fill y-btn-block" type="button" onClick={async () => { await ctx.act(() => ctx.call("PATCH", `/budget/${nextPay.id}`, { paid: true })); ctx.toast(t("Segnato come pagato", "Marked as paid")); }}>{t("Segna come pagato", "Mark as paid")}</button>
          <button className="y-tbtn" type="button" onClick={() => go("budget", "pagamenti")}>{t("Vedi le scadenze", "See payment schedule")}</button>
        </section>
      )}

      <div className={`y-bottom${miniTables.length ? " has-tables" : ""}`}>
        {miniTables.length > 0 && (
          <button className="y-card y-tables" type="button" onClick={() => go("guests", "tavoli")}>
            <span>
              <span className="y-eyebrow">{t("Tavoli", "Tables")}</span>
              <span className="y-heading">{t(`${s.seated} su ${s.seats} seduti`, `${s.seated} of ${s.seats} seated`)}</span>
            </span>
            <span className="y-mini-tables" aria-hidden="true">
              {miniTables.map((tb) => (
                <span key={tb.id}>
                  <span className="y-mini-table">{tb.dots.map((d, i) => <i key={i} className={d.on ? "on" : ""} style={{ "--a": `${d.a}deg` } as React.CSSProperties} />)}</span>
                  <span className="y-caption">{tb.name}</span>
                </span>
              ))}
            </span>
          </button>
        )}
        <section className="y-folder" aria-labelledby="yFolderT">
          <div className="y-folder-copy">
            <div>
              <p className="y-eyebrow">{t("La cartella del matrimonio", "Your wedding binder")}</p>
              <h2 id="yFolderT" className="y-folder-t">{t(`${s.docsDone} su ${FOLDER.length} sezioni con qualcosa di pronto`, `${s.docsDone} of ${FOLDER.length} sections with something prepared`)}</h2>
              <p className="y-caption y-folder-sugg">{t(`Utili adesso: ${suggest}`, `Useful right now: ${suggest}`)}</p>
              <div className="y-folder-pills">
                {priority.map((p) => <button key={p.key} type="button" onClick={() => go("binder")} className={docFilled(data, p.key) ? "" : ""}>{en ? p.titleEn : p.title}</button>)}
              </div>
            </div>
            <div className="y-folder-acts">
              <button className="y-btn y-btn-fill" type="button" onClick={() => go("binder")}>{t("Apri la cartella", "Open the binder")}</button>
              <button className="y-tbtn" type="button" onClick={ctx.pdf}><IcPrint />{t("Crea PDF", "Create PDF")}</button>
            </div>
          </div>
          <img src="/planner/locket.svg" alt="" width={104} height={130} />
        </section>
      </div>
    </div>
  );
}

// Riga che si trascina verso destra (sul telefono) per segnare l'attività come fatta, come nelle app.
function SwipeRow({ label, onDone, children }: { label: string; onDone: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const armed = dx > 90;
  return (
    <div className="y-sw">
      <div className={`y-sw-a${armed ? " is-armed" : ""}`} aria-hidden="true" style={{ opacity: dx > 8 ? 1 : 0 }}><IcCheck /><span>{label}</span></div>
      <div
        className="y-sw-c"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current ? "none" : undefined }}
        onPointerDown={(e) => { if (e.pointerType === "touch") start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const x = e.clientX - s.x;
          if (Math.abs(e.clientY - s.y) > Math.abs(x) && dx === 0) { start.current = null; return; }
          setDx(Math.max(0, Math.min(160, x)));
        }}
        onPointerUp={() => { const go = armed; start.current = null; setDx(0); if (go) onDone(); }}
        onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        {children}
      </div>
    </div>
  );
}
