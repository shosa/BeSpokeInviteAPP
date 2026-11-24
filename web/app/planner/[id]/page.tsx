import { notFound, redirect } from "next/navigation";
import type { PremiumData } from "@/components/planner/PremiumPlanner";
import { PlannerShell } from "@/components/planner/yes/PlannerShell";
import { plannerFonts } from "@/components/planner/yes/fonts";
import { ApiError, apiServer } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { getLang } from "@/lib/i18n";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

// Il planner è un servizio a sé, con il suo id, e si apre a tutto schermo come un'app.
// Un vecchio link con l'id di un invito porta al planner collegato, se c'è, altrimenti alla pagina delle risposte di quell'invito.
export default async function Planner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
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

  // Pagina del sito con la copertina del planner; «Accedi al planner» lo apre a tutto schermo.
  return (
    <>
      <Nav current="account" lang={lang} />
      <main className={plannerFonts}>
        <PlannerShell id={id} initial={data} lang={lang} backLabel={lang === "en" ? "My account" : "La mia area"} />
      </main>
    </>
  );
}
