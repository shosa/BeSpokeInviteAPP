import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { PlannerPanel, type PlannerData } from "@/components/planner/PlannerPanel";
import { PremiumPlanner, type PremiumData } from "@/components/planner/PremiumPlanner";
import { ApiError, apiServer } from "@/lib/api";
import { accentOf, inkOn } from "@/lib/invitePalette";
import { InviteHero } from "@/components/dashboard/InviteHero";
import { themeDecor } from "@/lib/themeAssets";
import { getLang } from "@/lib/i18n";
import { SetupGate } from "@/components/SetupGate";

export const dynamic = "force-dynamic";

// Rapporto di contrasto WCAG tra due colori esadecimali (#rrggbb). Se il valore non è valido, risponde 1.
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const la = lum(a);
  const lb = lum(b);
  if (la === null || lb === null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Pannello di gestione dell'invito: risultati delle conferme, ospiti, conto alla rovescia e note.
export default async function Planner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Planner premium: il pannello completo. Negli altri livelli resta il pannello base (ospiti, risposte, note).
  const premium = await apiServer<PremiumData>(`/api/invitations/${id}/planner/data`).catch((e) => {
    if (e instanceof ApiError && e.status === 403) return null;
    if (e instanceof ApiError && e.status === 401) redirect("/account");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  if (premium) {
    const lang = await getLang();
    // Stessa testata dell'invito del planner base: colori, font e decorazioni del tema scelto.
    const manage = await apiServer<PlannerData["manage"]>(`/api/invitations/${id}/manage`);
    const theme = manage.catalog?.themes.find((t) => t.manifest.id === manage.config.themeId)?.manifest;
    const color = theme?.themeColor ?? "#14B8A6";
    const when = String(manage.config.event.eventDate ?? "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(when) ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${when}T12:00:00`)) : "";
    const title = String(manage.config.event.title ?? "") || (lang === "en" ? "Your invitation" : "Il vostro invito");
    const decor = theme ? themeDecor(theme) : undefined;
    // Testo sul bianco: il colore del tema solo se è leggibile (almeno 4,5:1), altrimenti un marrone scuro.
    const textTone = contrast(accentOf(color), "#ffffff") >= 4.5 ? accentOf(color) : "#5a4632";
    return (
      <>
        <Nav current="account" lang={lang} />
        <main className="idash pp-page" style={{ "--inv": color, "--inv-ink": inkOn(color), "--inv-text": textTone } as React.CSSProperties}>
          <InviteHero
            kicker={lang === "en" ? "Premium planner" : "Planner premium"}
            title={title}
            when={date || (lang === "en" ? "Date to be set" : "Data da definire")}
            ink={accentOf(color)}
            backHref="/account"
            backLabel={lang === "en" ? "My invitations" : "I miei inviti"}
            decor={decor}
          />
          <div className="wrap idash-body">
            <SetupGate id={id} setupDone={Boolean((manage as { planner?: { setupDone?: boolean } }).planner?.setupDone)} initial={{ title: String(manage.config.event.title ?? ""), eventDate: String(manage.config.event.eventDate ?? ""), venue: String(manage.config.event.venue ?? "") }}>
              <PremiumPlanner id={id} initial={premium} lang={lang} sharePath={(manage.editCount ?? 0) >= 1 && manage.slug ? `/i/${manage.slug}` : null} />
            </SetupGate>
          </div>
        </main>
      </>
    );
  }
  try {
    const [manage, summary] = await Promise.all([
      apiServer<PlannerData["manage"]>(`/api/invitations/${id}/manage`),
      apiServer<PlannerData["summary"]>(`/api/invitations/${id}/rsvps`),
    ]);
    const lang = await getLang();
    if (manage.status !== "paid") redirect(`/editor/${id}`);
    // Stessa testata dell'invito della dashboard: colori del tema e dati dell'evento.
    const theme = manage.catalog?.themes.find((t) => t.manifest.id === manage.config.themeId)?.manifest;
    const color = theme?.themeColor ?? "#14B8A6";
    const when = String(manage.config.event.eventDate ?? "");
    const date = when ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${when}T12:00:00`)) : "";
    const title = String(manage.config.event.title ?? "") || (lang === "en" ? "Your invitation" : "Il vostro invito");
    const decor = theme ? themeDecor(theme) : undefined;
    return (
      <>
        <Nav current="account" lang={lang} />
        <main className="idash" style={{ "--inv": color, "--inv-ink": inkOn(color) } as React.CSSProperties}>
          <InviteHero
            kicker={lang === "en" ? "Guests and replies" : "Ospiti e risposte"}
            title={title}
            when={date || (lang === "en" ? "Date to be set" : "Data da definire")}
            ink={accentOf(color)}
            backHref="/account"
            backLabel={lang === "en" ? "My invitations" : "I miei inviti"}
            decor={decor}
          />
          <div className="wrap idash-body">
            <SetupGate id={id} setupDone={Boolean((manage as { planner?: { setupDone?: boolean } }).planner?.setupDone)} initial={{ title: String(manage.config.event.title ?? ""), eventDate: String(manage.config.event.eventDate ?? ""), venue: String(manage.config.event.venue ?? "") }}>
              <PlannerPanel data={{ manage, summary }} lang={lang} />
            </SetupGate>
          </div>
        </main>
      </>
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/account");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
