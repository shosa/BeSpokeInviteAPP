import { Nav } from "@/components/Nav";
import { CopyLink } from "@/components/CopyLink";
import { DeleteDraft } from "@/components/DeleteDraft";
import { DemoCreate } from "@/components/DemoCreate";
import { ApiError, apiPublic, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Row = { id: string; slug: string; status: "draft" | "paid"; tier: string; title: string; eventDate: string; model: string; views: number; guests: number; rsvps: number };

// Profilo: gli inviti acquistati, con builder, planner e link pubblico. Senza sessione si chiede il link di accesso.
export default async function Account({ searchParams }: { searchParams: Promise<{ stato?: string; accesso?: string }> }) {
  const { stato, accesso } = await searchParams;
  const lang = await getLang();
  const t = ui(lang);
  const catalog = await apiPublic<{ demo?: boolean; themes?: { enabled: boolean; manifest: { id: string; name: string; models: string[] } }[]; models?: { id: string }[] }>("/api/catalog");
  const demo = Boolean(catalog?.demo);
  const demoThemes = (catalog?.themes ?? []).filter((t) => t.enabled).map((t) => ({ id: t.manifest.id, name: t.manifest.name, models: t.manifest.models }));
  const demoModels = (catalog?.models ?? []).map((m) => m.id);
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL ?? "https://lucatelliphotographer.com";
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
          {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : null}
        </main>
      </>
    );
  }

  const paid = rows.filter((r) => r.status === "paid").length;
  const filter = stato === "bozze" || stato === "attivi" ? stato : "tutti";
  const shown = filter === "tutti" ? rows : rows.filter((r) => (filter === "attivi" ? r.status === "paid" : r.status !== "paid"));
  const labels = lang === "en" ? { all: "All", drafts: "Drafts", active: "Active" } : { all: "Tutti", drafts: "Bozze", active: "Attivi" };

  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="wrap dash">
        <header className="dash-head">
          <div>
            <h1>{t.myInvites}</h1>
            <p className="hint">{t.kActiveDrafts(paid, rows.length - paid)}</p>
          </div>
          {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : <a className="btn solid" href={shopUrl}>{t.dashNew}</a>}
        </header>

        <nav className="dash-filter" aria-label={t.listTitle}>
          <a href="/account" className={filter === "tutti" ? "is-on" : undefined} aria-current={filter === "tutti" ? "page" : undefined}>{labels.all}</a>
          <a href="/account?stato=bozze" className={filter === "bozze" ? "is-on" : undefined} aria-current={filter === "bozze" ? "page" : undefined}>{labels.drafts}</a>
          <a href="/account?stato=attivi" className={filter === "attivi" ? "is-on" : undefined} aria-current={filter === "attivi" ? "page" : undefined}>{labels.active}</a>
        </nav>

        <section aria-label={t.listTitle}>
          {rows.length === 0 ? (
            <div className="empty">
              <h3>{t.emptyTitle}</h3>
              <p className="lede">{t.emptyText}</p>
              {demo ? <DemoCreate label={createLabel} themes={demoThemes} models={demoModels} /> : <a className="btn solid" href={shopUrl}>{t.chooseStyle}</a>}
            </div>
          ) : (
            <ul className="invite-cards">
              {shown.map((r) => (
                <li key={r.id} className="invite-card">
                  <div className="invite-card-head">
                    <div>
                      <h3>{r.title}</h3>
                      <p className="hint">{r.eventDate ? t.onDate(r.eventDate) : t.dateTbd}</p>
                    </div>
                    <span className={`pill ${r.status === "paid" ? "yes" : "draft"}`}>{r.status === "paid" ? t.active : t.draft}</span>
                  </div>
                  <dl className="invite-stats">
                    <div><dt>{t.visits}</dt><dd>{r.views}</dd></div>
                    <div><dt>{t.replies}</dt><dd>{r.rsvps}</dd></div>
                    <div><dt>{t.guests}</dt><dd>{r.guests}</dd></div>
                  </dl>
                  <div className="invite-actions">
                    {r.status === "paid" ? (
                      <>
                        <a className="btn solid small" href={`/editor/${r.id}`}>{t.manage}</a>
                        {r.tier === "premium" ? (
                          <a className="btn solid small planner-cta" href={`/planner/${r.id}`}>Planner</a>
                        ) : (
                          <a className="btn outline small" href={`/planner/${r.id}`}>{t.managePlanner}</a>
                        )}
                        <a className="btn outline small" href={`/i/${r.slug}`}>{t.viewInvite}</a>
                        <CopyLink path={`/i/${r.slug}`} lang={lang} />
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
