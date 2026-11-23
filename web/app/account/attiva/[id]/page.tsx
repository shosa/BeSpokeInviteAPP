import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ActivateTemplate } from "@/components/ActivateTemplate";
import { PlannerActivate } from "@/components/account/PlannerActivate";
import "../../account.css";
import { apiPublic, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import type { TemplateCategory, ThemeManifest } from "@inviteme/shared";
import type { PendingPurchase } from "@/lib/pending";

export const dynamic = "force-dynamic";

// Attivazione di un acquisto: passi, scelta del template con anteprima, poi il builder.
export default async function Activate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getLang();
  let pending: PendingPurchase[];
  try {
    pending = await apiServer<PendingPurchase[]>("/api/account/pending");
  } catch {
    redirect("/account");
  }
  const item = pending.find((p) => p.id === id);
  if (!item) redirect("/account");
  const isEn = lang === "en";

  // Acquisto di un planner: nome e data dell'evento, invito da collegare facoltativo.
  if (item.product === "planner") {
    const rows = await apiServer<{ id: string; title: string; status: string; eventType?: string; plannerId: string | null }[]>("/api/account/invitations").catch(() => []);
    const free = rows.filter((r) => r.status === "paid" && !r.plannerId).map((r) => ({ id: r.id, title: r.title, eventType: r.eventType }));
    return (
      <>
        <Nav current="account" lang={lang} />
        <main className="wrap narrow act-page">
          <a className="link act-back" href="/account">{isEn ? "← My account" : "← La mia area"}</a>
          <ol className="act-steps" aria-label={isEn ? "Steps" : "Passi"}>
            <li className="is-done"><span>1</span>{isEn ? "Purchase" : "Acquisto"}</li>
            <li className="is-on"><span>2</span>{isEn ? "Your event" : "Il tuo evento"}</li>
            <li><span>3</span>{isEn ? "Organise" : "Organizza"}</li>
          </ol>
          <h1>{isEn ? "Start your planner" : "Inizia il tuo planner"}</h1>
          <p className="lede">{isEn ? "Give your event a name: tasks, budget, guests, tables and vendors will all be here." : "Dai un nome al tuo evento: attività, budget, invitati, tavoli e fornitori staranno tutti qui."}</p>
          <PlannerActivate orderId={id} invitations={free} lang={lang === "en" ? "en" : "it"} />
        </main>
      </>
    );
  }
  const catalog = await apiPublic<{ themes?: { enabled: boolean; premium?: boolean; categories?: string[]; manifest: ThemeManifest }[]; categories?: TemplateCategory[] }>("/api/catalog");
  const enabled = (catalog?.themes ?? []).filter((t) => t.enabled);
  // Invito base: i template Premium restano visibili, in fondo e con il lucchetto.
  const basic = item.plan === "base";
  const templates = (basic ? [...enabled.filter((t) => !t.premium), ...enabled.filter((t) => t.premium)] : enabled).map((t) => t.manifest);
  const locked = basic ? enabled.filter((t) => t.premium).map((t) => t.manifest.id) : [];
  // Categorie per la navigazione (Matrimoni, Compleanni…): solo quelle con almeno un template attivo.
  const themeCategories = Object.fromEntries(enabled.map((t) => [t.manifest.id, t.categories ?? []]));
  const categories = (catalog?.categories ?? []).filter((c) => enabled.some((t) => t.categories?.includes(c.id)));

  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="wrap narrow act-page">
        <a className="link act-back" href={item.pro ? "/pro" : "/account"}>{item.pro ? (isEn ? "← Pro area" : "← Area Pro") : isEn ? "← My invitations" : "← I miei inviti"}</a>
        <ol className="act-steps" aria-label={isEn ? "Steps" : "Passi"}>
          <li className="is-done"><span>1</span>{isEn ? "Purchase" : "Acquisto"}</li>
          <li className="is-on"><span>2</span>{isEn ? "Template" : "Template"}</li>
          <li><span>3</span>{isEn ? "Build and publish" : "Personalizza e pubblica"}</li>
        </ol>
        <h1>{isEn ? "Choose your template" : "Scegli il tuo template"}</h1>
        <p className="lede">
          {isEn
            ? "Browse the templates and open the preview, with or without the envelope. Your invitation starts from the one you choose."
            : "Sfoglia i template e apri l'anteprima, con o senza busta. Il tuo invito parte da quello che scegli."}
        </p>
        {basic && (
          <p className="act-basic">
            {isEn
              ? "You bought the basic invitation: choose among the templates included. The ones marked Premium are part of the full invitation."
              : "Hai acquistato l'invito base: scegli tra i template inclusi. Quelli con il lucchetto Premium fanno parte dell'invito completo."}
          </p>
        )}
        <ActivateTemplate orderId={id} templates={templates} locked={locked} categories={categories} themeCategories={themeCategories} initialEventType={item.pro ? item.eventType : undefined} />
      </main>
    </>
  );
}
