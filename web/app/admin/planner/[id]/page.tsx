import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { PremiumData } from "@/components/planner/PremiumPlanner";
import { YesPlanner } from "@/components/planner/yes/YesPlanner";
import { plannerFonts } from "@/components/planner/yes/fonts";
import { ApiError, apiServer } from "@/lib/api";
import { isUuid } from "@/lib/ids";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Planner · anteprima admin", robots: { index: false } };

// Anteprima del planner di un cliente per l'amministratore: le stesse sezioni del cliente, in sola lettura.
export default async function AdminPlannerPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const lang = await getLang();
  const data = await apiServer<PremiumData>(`/api/admin/planners/${id}/data`).catch((e) => {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/account");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <main className={plannerFonts}>
      <YesPlanner id={id} initial={data} lang={lang} readOnly apiBase={`/api/admin/planners/${id}`} accountHref="/admin" />
    </main>
  );
}
