import type { Metadata } from "next";
import { YesPlanner } from "@/components/planner/yes/YesPlanner";
import { plannerFonts } from "@/components/planner/yes/fonts";
import { demoData } from "@/components/planner/yes/model";
import { getLang } from "@/lib/i18n";
import { LangProvider } from "@/lib/lang";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return { title: en ? "Planner demo · Bespoke Invite" : "Demo del planner · Bespoke Invite" };
}

// Demo del planner senza accesso: un matrimonio d'esempio, si tocca tutto ma niente si salva.
// ?lang=en o ?lang=it sceglie la lingua senza cambiare quella del sito.
export default async function PlannerDemo({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const q = await searchParams;
  const lang = q.lang === "en" || q.lang === "it" ? q.lang : await getLang();
  return (
    <main className={plannerFonts} lang={lang}>
      <LangProvider lang={lang}>
        <YesPlanner id="demo" initial={demoData(lang === "en")} lang={lang} demo />
      </LangProvider>
    </main>
  );
}
