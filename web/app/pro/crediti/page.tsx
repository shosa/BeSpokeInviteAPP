import type { Metadata } from "next";
import { apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ProShell } from "@/components/pro/ProShell";
import { fmtDate, loadStudio } from "@/components/pro/load";
import type { ProLedgerRow } from "@/components/pro/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crediti · Bespoke Pro" };

// Crediti dello studio: quanti ne restano, il piano mensile e ogni movimento (rinnovi, assegnazioni, inviti e planner creati).
export default async function ProCredits() {
  const lang = (await getLang()) === "en" ? "en" : "it";
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const studio = await loadStudio();
  const ledger = await apiServer<ProLedgerRow[]>("/api/pro/ledger").catch(() => [] as ProLedgerRow[]);
  const delta = (n: number, one: string, many: string) => (n ? `${n > 0 ? "+" : "−"} ${Math.abs(n)} ${Math.abs(n) === 1 ? one : many}` : "");
  const p = studio.plan;
  return (
    <ProShell studio={studio} active="crediti" lang={lang}>
      <header className="pro-head">
        <div>
          <span className="pro-kicker">Bespoke Pro</span>
          <h1 className="pro-title">{t("Crediti", "Credits")}</h1>
          <p className="pro-lede">{t("Ogni invito e ogni planner che crei per un cliente usa un credito.", "Every invitation and planner you create for a client uses one credit.")}</p>
        </div>
      </header>

      <section className="pro-credits" aria-label={t("Crediti", "Credits")}>
        <div className="pro-credit is-dark">
          <span className="pro-h2">{t("Crediti invito", "Invitation credits")}</span>
          <div className="pro-credit-row"><strong className="pro-big">{studio.credits.invitations}</strong><span>{t("disponibili", "available")}</span></div>
        </div>
        <div className="pro-credit pro-card">
          <span className="pro-h2">{t("Crediti planner", "Planner credits")}</span>
          <div className="pro-credit-row"><strong className="pro-big">{studio.credits.planners}</strong><span style={{ color: "var(--pro-soft)" }}>{t("disponibili", "available")}</span></div>
        </div>
        <div className="pro-credit pro-card">
          <span className="pro-h2">{t("Piano mensile", "Monthly plan")}</span>
          {p.invitations || p.planners ? (
            <>
              <strong style={{ fontWeight: 500, fontSize: 18 }}>{t(`${p.invitations} inviti e ${p.planners} planner al mese`, `${p.invitations} invitations and ${p.planners} planners a month`)}</strong>
              <span className="pro-credit-sub">
                {studio.nextRenewal && t(`Prossimo rinnovo: ${fmtDate(studio.nextRenewal, en, { day: "numeric", month: "long" })}. `, `Next renewal: ${fmtDate(studio.nextRenewal, en, { day: "numeric", month: "long" })}. `)}
                {p.rollover ? t("I crediti non usati restano.", "Unused credits carry over.") : t("I crediti non usati scadono al rinnovo.", "Unused credits expire at renewal.")}
              </span>
            </>
          ) : (
            <span className="pro-credit-sub">{t("Nessun piano mensile: i crediti li assegna Bespoke. Per averne altri scrivici.", "No monthly plan: Bespoke assigns your credits. Write to us for more.")}</span>
          )}
        </div>
      </section>

      <section className="pro-card pro-sect" aria-labelledby="pr-mov">
        <h2 id="pr-mov" className="pro-h2">{t("Movimenti", "Activity")}</h2>
        <ol className="pro-log">
          {ledger.map((m, i) => {
            const parts = [delta(m.invitations, t("invito", "invitation"), t("inviti", "invitations")), delta(m.planners, "planner", "planner")].filter(Boolean).join(", ");
            return (
              <li key={i}>
                <time>{fmtDate(m.at, en, { day: "numeric", month: "short", year: "2-digit" })}</time>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{m.what}</span>
                <b className={m.invitations + m.planners >= 0 ? "is-plus" : "is-minus"}>{parts}</b>
              </li>
            );
          })}
          {!ledger.length && <li><span className="pro-hint">{t("Ancora nessun movimento.", "No activity yet.")}</span></li>}
        </ol>
      </section>
    </ProShell>
  );
}
