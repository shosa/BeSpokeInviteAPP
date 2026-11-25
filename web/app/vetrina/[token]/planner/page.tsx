import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOWCASE_TOKEN } from "@inviteme/shared";
import { PlannerShell } from "@/components/planner/yes/PlannerShell";
import { plannerFonts } from "@/components/planner/yes/fonts";
import type { Weather } from "@/components/planner/yes/model";
import { showcasePlanner } from "@/lib/showcasePlanner";
import { getLang } from "@/lib/i18n";
import { LangProvider } from "@/lib/lang";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return { title: en ? "Planner · Chiara & Salvo" : "Planner · Chiara & Salvo", robots: { index: false, follow: false } };
}

// Meteo d'esempio per Noto a metà settembre: sole, caldo, un filo di vento la sera.
const TEMPS = [21, 20, 20, 19, 19, 20, 21, 23, 25, 27, 28, 29, 30, 30, 30, 29, 28, 27, 26, 25, 24, 23, 22, 22];
const NOTO_WEATHER: Weather = { forecast: { tmaxC: 30, tminC: 19, precipMm: 0, precipProb: 5, code: 1, hourly: TEMPS.map((tempC, hour) => ({ hour, tempC, precipMm: 0 })) }, place: "Noto", sample: true };

// Planner della vetrina: modalità demo, ogni modifica resta in memoria e sparisce uscendo dalla pagina.
export default async function ShowcasePlanner({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  if (token !== SHOWCASE_TOKEN) notFound();
  const q = await searchParams;
  const lang = q.lang === "en" || q.lang === "it" ? q.lang : await getLang();
  const en = lang === "en";
  return (
    <>
      <Nav lang={lang} />
      <main className={plannerFonts} lang={lang}>
        <LangProvider lang={lang}>
          <PlannerShell
            id="demo"
            initial={showcasePlanner(en)}
            lang={lang}
            demo
            demoWeather={NOTO_WEATHER}
            backHref={`/vetrina/${token}${en ? "?lang=en" : ""}`}
            backLabel={en ? "Back to the showcase" : "Torna alla vetrina"}
            buyHref="https://www.thebespokeinvite.com"
          />
        </LangProvider>
      </main>
    </>
  );
}
