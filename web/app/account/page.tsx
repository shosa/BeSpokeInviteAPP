import { Nav } from "@/components/Nav";
import { CopyLink } from "@/components/CopyLink";
import { DeleteDraft } from "@/components/DeleteDraft";
import { DemoCreate } from "@/components/DemoCreate";
import { RequestLoginLink } from "@/components/RequestLoginLink";
import { ApiError, apiPublic, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ui } from "@/lib/ui";
import type { PendingPurchase } from "@/lib/pending";
import type { ThemeManifest } from "@inviteme/shared";

export const dynamic = "force-dynamic";

type Row = { id: string; slug: string; status: "draft" | "paid"; published: boolean; tier: string; title: string; eventDate: string; model: string; views: number; guests: number; rsvps: number };
type View = "tutti" | "attivi" | "da-pubblicare" | "bozze";

const COPY = {
  it: {
    kicker: "Area cliente",
    intro: "Qui trovi i tuoi inviti. Attiva quelli acquistati, modifica le bozze e pubblica quando sei pronto.",
    buy: "Acquista un invito",
    stats: { todo: "Da attivare", todoHint: "pagati, da scegliere", publish: "Da pubblicare", publishHint: "creati, manca il link", live: "Attivi", liveHint: "pubblicati", drafts: "Bozze", draftsHint: "non pagate" },
    todoTitle: (n: number) => (n === 1 ? "Hai un invito da attivare" : `Hai ${n} inviti da attivare`),
    todoText: "Il pagamento è andato a buon fine. Scegli il template: il tuo invito nasce con quello.",
    create: "Crea il tuo invito",
    bought: "Acquistato il",
    premium: "Invito con planner",
    standard: "Invito",
    shopOrder: "Ordine su Shopify",
    filters: { tutti: "Tutti", attivi: "Attivi", "da-pubblicare": "Da pubblicare", bozze: "Bozze" },
    emptyTitle: "Nessun invito ancora",
    emptyText: "Acquista il tuo invito dal negozio. Dopo il pagamento lo trovi qui, pronto da attivare: scegli il template e pubblica con il tuo link.",
    emptyCta: "Vai al negozio",
    noneInView: "Nessun invito in questa vista.",
    live: "Attivo",
    toPublish: "Da pubblicare",
    draft: "Bozza",
    manage: "Gestisci",
    publish: "Pubblica",
    view: "Vedi invito",
    planner: "Planner",
    onDate: (d: string) => `Il ${new Date(d).toLocaleDateString("it-IT")}`,
    dateTbd: "Data da definire",
  },
  en: {
    kicker: "Customer area",
    intro: "Here are your invitations. Activate the ones you bought, edit drafts and publish when you are ready.",
    buy: "Buy an invitation",
    stats: { todo: "To activate", todoHint: "paid, to choose", publish: "To publish", publishHint: "created, link missing", live: "Live", liveHint: "published", drafts: "Drafts", draftsHint: "unpaid" },
    todoTitle: (n: number) => (n === 1 ? "You have one invitation to activate" : `You have ${n} invitations to activate`),
    todoText: "Payment went through. Choose the template: your invitation starts from it.",
    create: "Create your invitation",
    bought: "Bought on",
    premium: "Invitation with planner",
    standard: "Invitation",
    shopOrder: "Shopify order",
    filters: { tutti: "All", attivi: "Live", "da-pubblicare": "To publish", bozze: "Drafts" },
    emptyTitle: "No invitations yet",
    emptyText: "Buy your invitation from the shop. After payment it appears here, ready to activate.",
    emptyCta: "Go to the shop",
    noneInView: "No invitations in this view.",
    live: "Live",
    toPublish: "To publish",
    draft: "Draft",
    manage: "Manage",
    publish: "Publish",
    view: "View invitation",
    planner: "Planner",
    onDate: (d: string) => `On ${new Date(d).toLocaleDateString("en-GB")}`,
    dateTbd: "Date to be set",
  },
};

// Area cliente: contatori, acquisti da attivare, lista degli inviti. Senza sessione si chiede il link di accesso.
export default async function Account({ searchParams }: { searchParams: Promise<{ stato?: string; accesso?: string }> }) {
  const { stato, accesso } = await searchParams;
  const lang = await getLang();
  const t = ui(lang);
  const c = COPY[lang === "en" ? "en" : "it"];
  const catalog = await apiPublic<{ demo?: boolean; themes?: { enabled: boolean; manifest: ThemeManifest & { models: string[] } }[]; models?: { id: string }[] }>("/api/catalog");
  const demo = Boolean(catalog?.demo);
  const demoThemes = (catalog?.themes ?? []).filter((x) => x.enabled).map((x) => ({ id: x.manifest.id, name: x.manifest.name, models: x.manifest.models }));
  const demoModels = (catalog?.models ?? []).map((m) => m.id);
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? "https://thebespokeinvite.com";
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

  const pending = await apiServer<PendingPurchase[]>("/api/account/pending").catch(() => [] as PendingPurchase[]);
  const live = rows.filter((r) => r.status === "paid" && r.published).length;
  const toPublish = rows.filter((r) => r.status === "paid" && !r.published).length;
  const drafts = rows.filter((r) => r.status !== "paid").length;
  const view: View = stato === "attivi" || stato === "da-pubblicare" || stato === "bozze" ? stato : "tutti";
  const shown = rows.filter((r) => {
    if (view === "attivi") return r.status === "paid" && r.published;
    if (view === "da-pubblicare") return r.status === "paid" && !r.published;
    if (view === "bozze") return r.status !== "paid";
    return true;
  });
  const tabs: View[] = ["tutti", "attivi", "da-pubblicare", "bozze"];
  const hrefOf = (v: View) => (v === "tutti" ? "/account" : `/account?stato=${v}`);

  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="wrap dash">
        <header className="acc-head">
          <div>
            <span className="acc-kicker">{c.kicker}</span>
            <h1>{t.myInvites}</h1>
            <p className="hint">{c.intro}</p>
          </div>
          {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : <a className="btn outline" href={shopUrl}>{c.buy}</a>}
        </header>

        <div className="acc-stats" role="list">
          <a className={`acc-stat is-todo`} role="listitem" href="#da-attivare"><span>{c.stats.todo}</span><strong>{pending.length}</strong><small>{c.stats.todoHint}</small></a>
          <a className="acc-stat" role="listitem" href="/account?stato=da-pubblicare"><span>{c.stats.publish}</span><strong>{toPublish}</strong><small>{c.stats.publishHint}</small></a>
          <a className="acc-stat" role="listitem" href="/account?stato=attivi"><span>{c.stats.live}</span><strong>{live}</strong><small>{c.stats.liveHint}</small></a>
          <a className="acc-stat" role="listitem" href="/account?stato=bozze"><span>{c.stats.drafts}</span><strong>{drafts}</strong><small>{c.stats.draftsHint}</small></a>
        </div>

        {pending.length > 0 && (
          <section className="acc-todo" id="da-attivare" aria-label={c.todoTitle(pending.length)}>
            <div className="acc-todo-head">
              <span className="acc-todo-count" aria-hidden="true">{pending.length}</span>
              <div>
                <span className="acc-kicker">{c.stats.todo}</span>
                <h2>{c.todoTitle(pending.length)}</h2>
                <p>{c.todoText}</p>
              </div>
            </div>
            <ul>
              {pending.map((p) => (
                <li key={p.id}>
                  <div>
                    <b>{p.tier === "premium" ? c.premium : c.standard}</b>
                    <small>{c.bought} {new Date(p.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "it-IT")}</small>
                  </div>
                  <a className="btn solid" href={`/account/attiva/${p.id}`}>{c.create}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="dash-filter" aria-label={t.listTitle}>
          {tabs.map((v) => (
            <a key={v} href={hrefOf(v)} className={view === v ? "is-on" : undefined} aria-current={view === v ? "page" : undefined}>{c.filters[v]}</a>
          ))}
        </nav>

        <section aria-label={t.listTitle}>
          {rows.length === 0 ? (
            <div className="acc-empty">
              <h3>{c.emptyTitle}</h3>
              <p>{c.emptyText}</p>
              {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : <a className="btn solid" href={shopUrl}>{c.emptyCta}</a>}
            </div>
          ) : shown.length === 0 ? (
            <p className="hint">{c.noneInView}</p>
          ) : (
            <ul className="invite-cards">
              {shown.map((r) => (
                <li key={r.id} className="invite-card">
                  <div className="invite-card-head">
                    <div>
                      <h3>{r.title}</h3>
                      <p className="hint">{r.eventDate ? c.onDate(r.eventDate) : c.dateTbd}</p>
                    </div>
                    {r.status === "paid" ? (
                      <span className={`acc-list-status ${r.published ? "is-live" : ""}`}>{r.published ? c.live : c.toPublish}</span>
                    ) : (
                      <span className="pill draft">{c.draft}</span>
                    )}
                  </div>
                  <dl className="invite-stats">
                    <div><dt>{t.visits}</dt><dd>{r.views}</dd></div>
                    <div><dt>{t.replies}</dt><dd>{r.rsvps}</dd></div>
                  </dl>
                  <div className="invite-actions">
                    {r.status === "paid" ? (
                      <>
                        <a className={r.published ? "btn outline small" : "btn solid small"} href={`/editor/${r.id}`}>{r.published ? c.manage : c.publish}</a>
                        <a className={r.tier === "premium" ? "btn solid small planner-cta" : "btn outline small"} href={`/planner/${r.id}`}>{r.tier === "premium" ? c.planner : t.managePlanner}</a>
                        {r.published && (
                          <>
                            <a className="btn outline small" href={`/i/${r.slug}`}>{c.view}</a>
                            <CopyLink path={`/i/${r.slug}`} lang={lang} />
                          </>
                        )}
                      </>
                    ) : (
                      <DeleteDraft id={r.id} lang={lang} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
