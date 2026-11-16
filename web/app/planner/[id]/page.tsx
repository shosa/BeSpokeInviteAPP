import { notFound, redirect } from "next/navigation";
import type { Catalog } from "@inviteme/shared";
import { Nav } from "@/components/Nav";
import { PremiumPlanner, type PremiumData } from "@/components/planner/PremiumPlanner";
import { ApiError, apiPublic, apiServer } from "@/lib/api";
import { accentOf, inkOn } from "@/lib/invitePalette";
import { InviteHero } from "@/components/dashboard/InviteHero";
import { themeDecor } from "@/lib/themeAssets";
import { getLang } from "@/lib/i18n";
import { HeroImages } from "@/components/planner/HeroImages";

export const dynamic = "force-dynamic";

// Colore del planner senza invito collegato: il verde salvia del servizio.
const PLANNER_COLOR = "#56683f";

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

// Il planner è un servizio a sé, con il suo id. Un vecchio link con l'id di un invito porta al planner collegato,
// se c'è, altrimenti alla pagina delle risposte di quell'invito.
export default async function Planner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  const data = await apiServer<PremiumData>(`/api/planners/${id}/data`).catch(async (e) => {
    if (e instanceof ApiError && e.status === 401) redirect("/account");
    if (e instanceof ApiError && e.status === 404) {
      const inv = await apiServer<{ id: string; plannerId: string | null }>(`/api/invitations/${id}/manage`).catch(() => null);
      if (inv?.plannerId) redirect(`/planner/${inv.plannerId}`);
      if (inv) redirect(`/inviti/${inv.id}/risposte`);
      notFound();
    }
    throw e;
  });

  // Con un invito collegato il planner prende i colori e le decorazioni del suo tema.
  const catalog = data.invitation ? await apiPublic<Catalog>("/api/catalog") : null;
  const theme = data.invitation ? catalog?.themes.find((t) => t.manifest.id === data.invitation!.themeId)?.manifest : undefined;
  const color = data.invitation?.themeColor ?? PLANNER_COLOR;
  const when = data.event.eventDate;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(when) ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${when}T12:00:00`)) : "";
  const title = data.event.title || (lang === "en" ? "Your event" : "Il tuo evento");
  const textTone = contrast(accentOf(color), "#ffffff") >= 4.5 ? accentOf(color) : "#5a4632";
  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="idash pp-page" style={{ "--inv": color, "--inv-ink": inkOn(color), "--inv-text": textTone } as React.CSSProperties}>
        <InviteHero
          kicker={lang === "en" ? "Planner" : "Planner"}
          title={title}
          when={date || (lang === "en" ? "Date to be set" : "Data da definire")}
          ink={accentOf(color)}
          backHref="/account#planner"
          backLabel={lang === "en" ? "My account" : "La mia area"}
          decor={theme ? themeDecor(theme) : undefined}
          banner={data.bannerImage}
          arch={data.archImage}
          actions={<HeroImages id={id} banner={data.bannerImage} arch={data.archImage} />}
        />
        <div className="wrap idash-body pp-body">
          <PremiumPlanner id={id} initial={data} lang={lang} />
        </div>
      </main>
    </>
  );
}
