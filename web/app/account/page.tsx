import { Nav } from "@/components/Nav";
import { CopyLink } from "@/components/CopyLink";
import { DeleteDraft } from "@/components/DeleteDraft";
import { DemoCreate } from "@/components/DemoCreate";
import { RequestLoginLink } from "@/components/RequestLoginLink";
import { ShareLinkButton } from "@/components/account/ShareLinkButton";
import { ApiError, apiPublic, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ui } from "@/lib/ui";
import { themeCopy } from "@/lib/catalogCopy";
import type { PendingPurchase } from "@/lib/pending";
import type { ThemeManifest } from "@inviteme/shared";
import "./account.css";

export const dynamic = "force-dynamic";

type Row = { id: string; slug: string; status: "draft" | "paid"; published: boolean; title: string; eventDate: string; views: number; rsvps: number; themeId: string; plannerId: string | null };
type PlannerRow = {
  id: string; title: string; eventDate: string; venue: string; budgetCents: number; tasks: number; tasksDone: number; spentCents: number; guests: number;
  invitation: { id: string; title: string; slug: string; published: boolean; themeId: string; themeColor: string; rsvps: number } | null;
};
type Theme = { enabled: boolean; manifest: ThemeManifest & { models: string[] } };

const COPY = {
  it: {
    hello: "Ciao",
    summary: (live: number, prep: number, planners: number, pending: number) =>
      [`${live} ${live === 1 ? "invito online" : "inviti online"}`, `${prep} in preparazione`, `${planners} ${planners === 1 ? "planner" : "planner"}`].join(", ") + (pending ? `. ${pending} ${pending === 1 ? "acquisto aspetta" : "acquisti aspettano"} di essere aperti.` : "."),
    buyInvite: "Acquista un invito",
    buyPlanner: "Acquista un planner",
    toActivate: (n: number) => `Da attivare · ${n}`,
    invTag: "Invito", planTag: "Planner",
    invTitle: (n: number) => (n > 1 ? `${n} inviti ti aspettano` : "Un invito ti aspetta"),
    invText: "Scegli il template: l'invito nasce con quello.",
    invCta: "Scegli il template →",
    planTitle: (n: number) => (n > 1 ? `${n} planner ti aspettano` : "Un planner ti aspetta"),
    planText: "Dai un nome all'evento e scegli la data. Se vuoi, collegalo a uno dei tuoi inviti.",
    planCta: "Inizia il planner →",
    invitations: "I tuoi inviti", online: "Online", prep: "In preparazione", drafts: "Bozze",
    count: (n: number) => `${n} ${n === 1 ? "invito" : "inviti"}`,
    noInv: "Nessun invito ancora. Lo trovi qui appena acquistato.",
    daysTo: (d: number) => (d > 1 ? `tra ${d} giorni` : d === 1 ? "domani" : d === 0 ? "oggi" : "passato"),
    dateTbd: "Data da definire",
    stats: (v: number, r: number) => `${v} ${v === 1 ? "visita" : "visite"} · ${r ? `${r} ${r === 1 ? "risposta" : "risposte"}` : "nessuna risposta ancora"}`,
    linked: "Planner collegato", organize: "Organizzalo con un planner",
    share: "Condividi", copied: "Link copiato", replies: "Risposte", open: "Apri l'invito",
    stepTpl: "Template", stepData: "Dati", stepLink: "Link",
    missLink: "manca il link", missData: "dati da completare",
    cont: "Continua",
    planners: "I tuoi planner", plannersSub: "Organizza l'evento: attività, budget, invitati, tavoli e fornitori",
    days: "giorni", tasks: "Attività", budget: "Budget", of: "di",
    linkedInv: "Invito collegato", noLinked: "Nessun invito collegato", link: "Collega",
    openPlanner: "Apri il planner",
    another: "Organizza un altro evento", anotherText: "Il planner si compra a parte: attività con le scadenze, budget, invitati e tavoli, fornitori, cartella del giorno e PDF. Con o senza invito.",
    discover: "Scopri il planner →",
    draft: "Bozza",
  },
  en: {
    hello: "Hi",
    summary: (live: number, prep: number, planners: number, pending: number) =>
      [`${live} live ${live === 1 ? "invitation" : "invitations"}`, `${prep} in progress`, `${planners} ${planners === 1 ? "planner" : "planners"}`].join(", ") + (pending ? `. ${pending} ${pending === 1 ? "purchase is" : "purchases are"} waiting to be opened.` : "."),
    buyInvite: "Buy an invitation",
    buyPlanner: "Buy a planner",
    toActivate: (n: number) => `To activate · ${n}`,
    invTag: "Invitation", planTag: "Planner",
    invTitle: (n: number) => (n > 1 ? `${n} invitations are waiting` : "An invitation is waiting"),
    invText: "Choose the template: your invitation starts from it.",
    invCta: "Choose the template →",
    planTitle: (n: number) => (n > 1 ? `${n} planners are waiting` : "A planner is waiting"),
    planText: "Name the event and pick the date. If you like, link it to one of your invitations.",
    planCta: "Start the planner →",
    invitations: "Your invitations", online: "Live", prep: "In progress", drafts: "Drafts",
    count: (n: number) => `${n} ${n === 1 ? "invitation" : "invitations"}`,
    noInv: "No invitations yet. You will find them here once purchased.",
    daysTo: (d: number) => (d > 1 ? `in ${d} days` : d === 1 ? "tomorrow" : d === 0 ? "today" : "past"),
    dateTbd: "Date to be set",
    stats: (v: number, r: number) => `${v} ${v === 1 ? "visit" : "visits"} · ${r ? `${r} ${r === 1 ? "reply" : "replies"}` : "no replies yet"}`,
    linked: "Planner linked", organize: "Organise it with a planner",
    share: "Share", copied: "Link copied", replies: "Replies", open: "Open the invitation",
    stepTpl: "Template", stepData: "Details", stepLink: "Link",
    missLink: "link missing", missData: "details to complete",
    cont: "Continue",
    planners: "Your planners", plannersSub: "Organise the event: tasks, budget, guests, tables and vendors",
    days: "days", tasks: "Tasks", budget: "Budget", of: "of",
    linkedInv: "Linked invitation", noLinked: "No linked invitation", link: "Link",
    openPlanner: "Open the planner",
    another: "Organise another event", anotherText: "The planner is sold separately: tasks with deadlines, budget, guests and tables, vendors, day folder and PDF. With or without an invitation.",
    discover: "Discover the planner →",
    draft: "Draft",
  },
};

const daysUntil = (iso: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const today = new Date(new Date().toDateString()).getTime();
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - today) / 86_400_000);
};
const longDate = (iso: string, lang: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const euro = (cents: number, lang: string) => (cents / 100).toLocaleString(lang === "en" ? "en-GB" : "it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// Icone a tratto (24px): planner, risposte, apri, copia.
const Ico = {
  replies: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>,
  open: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>,
  plus: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  next: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>,
};

// Area cliente: acquisti da attivare (inviti e planner), inviti per stato, planner come servizio a parte.
export default async function Account({ searchParams }: { searchParams: Promise<{ accesso?: string }> }) {
  const { accesso } = await searchParams;
  const lang = await getLang();
  const t = ui(lang);
  const c = COPY[lang === "en" ? "en" : "it"];
  const catalog = await apiPublic<{ demo?: boolean; themes?: Theme[]; models?: { id: string }[] }>("/api/catalog");
  const demo = Boolean(catalog?.demo);
  const demoThemes = (catalog?.themes ?? []).filter((x) => x.enabled).map((x) => ({ id: x.manifest.id, name: themeCopy(x.manifest, lang), models: x.manifest.models }));
  const demoModels = (catalog?.models ?? []).map((m) => m.id);
  const themeOf = (id: string) => catalog?.themes?.find((x) => x.manifest.id === id)?.manifest;
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? "https://thebespokeinvite.com";
  // Pulsanti d'acquisto: ognuno alla pagina del suo prodotto nel negozio (ricavata dagli ID della console).
  const links = await apiPublic<{ home: string; invitation: string | null; planner: string | null; bundle: string | null }>("/api/shop/links").catch(() => null);
  const buyInviteUrl = links?.invitation ?? shopUrl;
  const buyPlannerUrl = links?.planner ?? shopUrl;
  const createLabel = lang === "en" ? "Create a test invitation" : "Crea un invito di prova";

  let rows: Row[];
  try {
    rows = await apiServer<Row[]>("/api/account/invitations");
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e;
    const expired = accesso === "scaduto";
    return (
      <>
        <Nav current="account" lang={lang} />
        <main className="wrap narrow dash">
          <h1>{t.myInvites}</h1>
          <p className="lede">
            {expired
              ? (lang === "en" ? "This link is not valid or has expired. Use the link we sent you after your purchase." : "Il link non è valido o è scaduto. Usa quello che ti abbiamo inviato dopo l'acquisto.")
              : (lang === "en" ? "Open the link we sent you after your purchase to see your invitations." : "Apri il link che ti abbiamo inviato dopo l'acquisto per vedere i tuoi inviti.")}
          </p>
          <RequestLoginLink />
          {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : null}
        </main>
      </>
    );
  }

  const [pending, planners, me] = await Promise.all([
    apiServer<PendingPurchase[]>("/api/account/pending").catch(() => [] as PendingPurchase[]),
    apiServer<PlannerRow[]>("/api/account/planners").catch(() => [] as PlannerRow[]),
    apiServer<{ user: { name?: string } | null }>("/api/auth/me").catch(() => ({ user: null })),
  ]);
  const firstName = (me.user?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const online = rows.filter((r) => r.status === "paid" && r.published);
  const prep = rows.filter((r) => r.status === "paid" && !r.published);
  const drafts = rows.filter((r) => r.status !== "paid");
  const pendingInv = pending.filter((p) => p.product === "invitation");
  const pendingPlan = pending.filter((p) => p.product === "planner");

  const thumb = (r: Row, cls: string) => {
    const m = themeOf(r.themeId);
    return (
      <span className={cls} style={{ background: m?.themeColor ?? "#efe6d6" }} aria-hidden="true">
        {m?.envelope?.poster ? <img src={`/api/themes/${encodeURIComponent(r.themeId)}/cover.jpg`} alt="" loading="lazy" /> : null}
      </span>
    );
  };
  const when = (iso: string) => {
    const d = daysUntil(iso);
    if (d === null) return <>{c.dateTbd}</>;
    return <>{longDate(iso, lang)} · <strong>{c.daysTo(d)}</strong></>;
  };

  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="acx">
        <section className="acx-hero">
          <div>
            <h1>{c.hello}{firstName ? <>, <em>{firstName}</em></> : null}</h1>
            <p>{c.summary(online.length, prep.length, planners.length, pending.length)}</p>
          </div>
          <div className="acx-buy">
            {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : <a className="acx-pill" href={buyInviteUrl}>{c.buyInvite}</a>}
            <a className="acx-pill" href={buyPlannerUrl}>{c.buyPlanner}</a>
          </div>
        </section>

        {pending.length > 0 && (
          <section className="acx-todo" id="da-attivare" aria-label={c.toActivate(pending.length)}>
            <span className="acx-eyebrow">{c.toActivate(pending.length)}</span>
            <div className="acx-todo-grid">
              {pendingInv.length > 0 && (
                <article className="acx-ticket is-inv">
                  <div className="acx-env" aria-hidden="true"><span className="acx-env-back" /><span className="acx-env-front"><span className="acx-env-flap" /><span className="acx-env-seal">B</span></span></div>
                  <div className="acx-ticket-text">
                    <span className="acx-tag">{pendingInv[0].plan === "base" ? (lang === "en" ? "Basic invitation" : "Invito base") : c.invTag}</span>
                    <h2>{c.invTitle(pendingInv.length)}</h2>
                    <p>{c.invText}</p>
                    <a className="acx-cta is-gold" href={`/account/attiva/${encodeURIComponent(pendingInv[0].id)}`}>{c.invCta}</a>
                  </div>
                </article>
              )}
              {pendingPlan.length > 0 && (
                <article className="acx-ticket is-plan">
                  <div className="acx-book" aria-hidden="true"><span className="acx-book-cover" /><span className="acx-book-page"><i /><i /><i /><i /></span><span className="acx-book-ribbon" /></div>
                  <div className="acx-ticket-text">
                    <span className="acx-tag">{c.planTag}</span>
                    <h2>{c.planTitle(pendingPlan.length)}</h2>
                    <p>{c.planText}</p>
                    <a className="acx-cta is-sage" href={`/account/attiva/${encodeURIComponent(pendingPlan[0].id)}`}>{c.planCta}</a>
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        <section className="acx-section" id="inviti" aria-label={c.invitations}>
          <header className="acx-section-head"><h2>{c.invitations}</h2><span>{c.count(rows.length)}</span></header>
          {rows.length === 0 && <p className="hint">{c.noInv}</p>}

          {online.length > 0 && (
            <>
              <h3 className="acx-sub is-online">{c.online}</h3>
              <div className="acx-online">
                {online.map((r) => (
                  <article key={r.id} className="acx-inv">
                    {thumb(r, "acx-thumb")}
                    <div className="acx-inv-body">
                      <div className="acx-inv-top"><span className="acx-live"><i />{c.online}</span><span className="acx-theme">{(() => { const th = themeOf(r.themeId); return th ? themeCopy(th, lang) : ""; })()}</span></div>
                      <h4>{r.title}</h4>
                      <p className="acx-when">{when(r.eventDate)}</p>
                      <p className="acx-meta">{c.stats(r.views, r.rsvps)}</p>
                      {r.plannerId
                        ? <a className="acx-chip" href={`/planner/${r.plannerId}`}>{Ico.link}{c.linked}</a>
                        : <a className="acx-soft" href={buyPlannerUrl}>{c.organize}</a>}
                      <div className="acx-actions">
                        <ShareLinkButton className="acx-cta is-dark" path={`/i/${r.slug}`} title={r.title} label={c.share} copiedLabel={c.copied} />
                        <a className="acx-ico" href={`/inviti/${r.id}/risposte`} aria-label={c.replies} title={c.replies}>{Ico.replies}</a>
                        <a className="acx-ico" href={`/i/${r.slug}`} target="_blank" rel="noreferrer" aria-label={c.open} title={c.open}>{Ico.open}</a>
                        <span className="acx-copy"><CopyLink path={`/i/${r.slug}`} lang={lang} /></span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {prep.length > 0 && (
            <>
              <h3 className="acx-sub is-prep">{c.prep}</h3>
              <div className="acx-prep">
                {prep.map((r) => {
                  const hasData = Boolean(r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.eventDate));
                  return (
                    <a key={r.id} className="acx-prep-card" href={`/editor/${r.id}`}>
                      {thumb(r, "acx-prep-thumb")}
                      <span className="acx-prep-body">
                        <strong>{r.title}</strong>
                        <small>{r.eventDate ? longDate(r.eventDate, lang) : c.dateTbd} · {hasData ? c.missLink : c.missData}</small>
                        <span className="acx-steps" aria-label={`${c.stepTpl}, ${c.stepData}, ${c.stepLink}`}><i className="is-on" /><i className={hasData ? "is-on" : ""} /><i /></span>
                      </span>
                      <span className="acx-prep-go" aria-hidden="true">{Ico.next}</span>
                      <span className="visually-hidden">{c.cont}</span>
                    </a>
                  );
                })}
              </div>
            </>
          )}

          {drafts.length > 0 && (
            <>
              <h3 className="acx-sub">{c.drafts}</h3>
              <ul className="acx-drafts">
                {drafts.map((r) => (
                  <li key={r.id}><span>{r.title} · <small>{c.draft}</small></span><DeleteDraft id={r.id} lang={lang} /></li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="acx-section is-plan" id="planner" aria-label={c.planners}>
          <header className="acx-section-head"><h2>{c.planners}</h2><span>{c.plannersSub}</span></header>
          <div className="acx-planners">
            {planners.map((p) => {
              const d = daysUntil(p.eventDate);
              const taskPct = p.tasks ? Math.round((p.tasksDone / p.tasks) * 100) : 0;
              const budPct = p.budgetCents ? Math.min(100, Math.round((p.spentCents / p.budgetCents) * 100)) : 0;
              return (
                <article key={p.id} className="acx-plan">
                  <div className="acx-plan-top">
                    <div><span className="acx-tag is-sage">{c.planTag}</span><h4>{p.title}</h4></div>
                    {d !== null && d >= 0 && <span className="acx-days"><strong>{d}</strong><small>{c.days}</small></span>}
                  </div>
                  <div className="acx-bars">
                    <div className="acx-bar-row"><span>{c.tasks}</span><span>{p.tasksDone} {c.of} {p.tasks}</span></div>
                    <div className="acx-bar"><i style={{ width: `${taskPct}%` }} /></div>
                    {p.budgetCents > 0 && (
                      <>
                        <div className="acx-bar-row"><span>{c.budget}</span><span>{euro(p.spentCents, lang)} {c.of} {euro(p.budgetCents, lang)}</span></div>
                        <div className="acx-bar is-gold"><i style={{ width: `${budPct}%` }} /></div>
                      </>
                    )}
                  </div>
                  {p.invitation ? (
                    <a className="acx-linked" href={`/inviti/${p.invitation.id}/risposte`}>
                      <span className="acx-linked-thumb" style={{ background: p.invitation.themeColor }} aria-hidden="true" />
                      <span><small>{c.linkedInv}</small><strong>{p.invitation.title} · {p.invitation.rsvps} {lang === "en" ? (p.invitation.rsvps === 1 ? "reply" : "replies") : (p.invitation.rsvps === 1 ? "risposta" : "risposte")}</strong></span>
                    </a>
                  ) : (
                    <a className="acx-unlinked" href={`/planner/${p.id}`}>{Ico.link}{c.noLinked} · <strong>{c.link}</strong></a>
                  )}
                  <a className="acx-cta is-sage is-wide" href={`/planner/${p.id}`}>{c.openPlanner}</a>
                </article>
              );
            })}
            <a className="acx-plan-new" href={buyPlannerUrl}>
              <span className="acx-plan-new-ico">{Ico.plus}</span>
              <strong>{c.another}</strong>
              <span>{c.anotherText}</span>
              <em>{c.discover}</em>
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
