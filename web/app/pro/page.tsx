import type { Metadata } from "next";
import { apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ProShell } from "@/components/pro/ProShell";
import { ProClients } from "@/components/pro/ProClients";
import { EVENT_LABEL, fmtDate, loadStudio } from "@/components/pro/load";
import type { ProClientRow } from "@/components/pro/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bespoke Pro" };

// Dashboard dello studio: crediti, numeri dei clienti, prossimi eventi e clienti.
export default async function ProHome() {
  const lang = (await getLang()) === "en" ? "en" : "it";
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const studio = await loadStudio();
  const clients = await apiServer<ProClientRow[]>("/api/pro/clients").catch(() => [] as ProClientRow[]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = clients.filter((c) => !c.archived && c.eventDate && c.eventDate >= today).slice(0, 3);
  const first = (await apiServer<{ user: { name?: string } | null }>("/api/auth/me").catch(() => ({ user: null }))).user?.name?.trim().split(/\s+/)[0] ?? "";
  const s = studio.stats;
  const renew = studio.nextRenewal ? fmtDate(studio.nextRenewal, en, { day: "numeric", month: "long" }) : null;
  const pct = (left: number, monthly: number) => Math.max(4, Math.min(100, monthly ? Math.round((left / monthly) * 100) : left ? 100 : 0));

  return (
    <ProShell studio={studio} active="panoramica" lang={lang}>
      <header className="pro-head">
        <div>
          <span className="pro-kicker">{new Intl.DateTimeFormat(en ? "en-GB" : "it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
          <h1 className="pro-title">{t("Buongiorno", "Good morning")}{first ? `, ${first}` : ""}</h1>
          <p className="pro-lede">
            {t(`${s.clients} ${s.clients === 1 ? "cliente" : "clienti"}, ${s.next30} ${s.next30 === 1 ? "evento" : "eventi"} nei prossimi 30 giorni.`, `${s.clients} ${s.clients === 1 ? "client" : "clients"}, ${s.next30} ${s.next30 === 1 ? "event" : "events"} in the next 30 days.`)}
          </p>
        </div>
        <div className="pro-actions">
          <a className="pro-btn" href="/pro/nuovo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {t("Nuovo evento", "New event")}
          </a>
        </div>
      </header>

      {!studio.active && <p className="pro-error" role="alert">{t("Lo studio è sospeso: puoi consultare i clienti ma non creare inviti o planner. Scrivi a Bespoke per riattivarlo.", "The studio is suspended: you can view clients but not create invitations or planners. Contact Bespoke to reactivate it.")}</p>}

      <section className="pro-credits" aria-label={t("Crediti", "Credits")}>
        <div className="pro-credit is-dark">
          <span className="pro-h2">{t("Crediti invito", "Invitation credits")}</span>
          <div className="pro-credit-row"><strong className="pro-big">{studio.credits.invitations}</strong><span>{t("disponibili", "available")}</span></div>
          <div className="pro-bar"><span style={{ width: `${pct(studio.credits.invitations, studio.plan.invitations)}%` }} /></div>
          <span className="pro-credit-sub">
            {[studio.plan.invitations && renew ? t(`+${studio.plan.invitations} il ${renew}`, `+${studio.plan.invitations} on ${renew}`) : null, t(`${studio.usedThisMonth.invitations} usati questo mese`, `${studio.usedThisMonth.invitations} used this month`)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="pro-credit pro-card">
          <span className="pro-h2">{t("Crediti planner", "Planner credits")}</span>
          <div className="pro-credit-row"><strong className="pro-big">{studio.credits.planners}</strong><span style={{ color: "var(--pro-soft)" }}>{t("disponibili", "available")}</span></div>
          <div className="pro-bar"><span style={{ width: `${pct(studio.credits.planners, studio.plan.planners)}%` }} /></div>
          <span className="pro-credit-sub">
            {[studio.plan.planners && renew ? t(`+${studio.plan.planners} il ${renew}`, `+${studio.plan.planners} on ${renew}`) : null, t(`${studio.usedThisMonth.planners} usati questo mese`, `${studio.usedThisMonth.planners} used this month`)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="pro-card pro-stats">
          <div><span>{t("Eventi attivi", "Active events")}</span><strong className="pro-num">{s.active}</strong></div>
          <div><span>{t("Inviti online", "Invitations online")}</span><strong className="pro-num">{s.online}</strong></div>
          <div><span>{t("Risposte, 7 giorni", "Replies, 7 days")}</span><strong className="pro-num">{s.rsvps7}</strong></div>
          <div><span>{t("Template da scegliere", "Templates to pick")}</span><strong className="pro-num">{s.todo}</strong></div>
        </div>
      </section>
      {!studio.plan.rollover && (studio.plan.invitations > 0 || studio.plan.planners > 0) && (
        <p className="pro-hint" style={{ margin: "-14px 0 0" }}>{t("I crediti del mese non usati scadono al rinnovo.", "Unused monthly credits expire at renewal.")}</p>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="pro-next" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="pro-next" className="pro-h2">{t("Prossimi eventi", "Upcoming events")}</h2>
          <div className="pro-upcoming">
            {upcoming.map((c) => (
              <a key={c.id} className="pro-up" href={`/pro/clienti/${c.id}`}>
                <span className="pro-up-date" aria-hidden="true">
                  <strong>{fmtDate(c.eventDate, en, { day: "2-digit" })}</strong>
                  <span>{fmtDate(c.eventDate, en, { month: "short" }).replace(".", "")}</span>
                </span>
                <span className="pro-up-text">
                  <strong>{c.name}</strong>
                  <span>{c.venue || (EVENT_LABEL[c.eventType]?.[lang] ?? "")}</span>
                  <em>{c.invitation ? (c.invitation.published ? t(`${c.invitation.rsvps} risposte`, `${c.invitation.rsvps} replies`) : t("Invito in bozza", "Invitation in draft")) : c.pendingOrder ? t("Template da scegliere", "Template to pick") : t("Senza invito", "No invitation")}</em>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <ProClients clients={clients} lang={lang} limit={8} />
      {clients.length > 8 && <a className="pro-back" href="/pro/clienti" style={{ alignSelf: "flex-start" }}>{t(`Tutti i ${clients.length} clienti →`, `All ${clients.length} clients →`)}</a>}
    </ProShell>
  );
}
