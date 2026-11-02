import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { PlannerPanel, type PlannerData } from "@/components/planner/PlannerPanel";
import { ApiError, apiServer } from "@/lib/api";
import { accentOf, inkOn } from "@/lib/invitePalette";
import { InviteHero } from "@/components/dashboard/InviteHero";
import { themeDecor } from "@/lib/themeAssets";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Pannello di gestione dell'invito: risultati delle conferme, ospiti, conto alla rovescia e note.
export default async function Planner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            <PlannerPanel data={{ manage, summary }} lang={lang} />
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
