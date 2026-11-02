import { notFound, redirect } from "next/navigation";
import { Builder, type Manage } from "@/components/Builder";
import { ApiError, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Il builder si apre solo per un invito acquistato (o di prova). Senza sessione o con un invito non pagato si torna al profilo.
export default async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const manage = await apiServer<Manage>(`/api/invitations/${id}/manage`);
    if (manage.status !== "paid") redirect(`/planner/${id}`);
    return <Builder initial={manage} lang={await getLang()} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/account");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
