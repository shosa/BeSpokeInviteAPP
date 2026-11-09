import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ActivateTemplate } from "@/components/ActivateTemplate";
import { apiPublic, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import type { ThemeManifest } from "@inviteme/shared";
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
  const catalog = await apiPublic<{ themes?: { enabled: boolean; manifest: ThemeManifest }[] }>("/api/catalog");
  const templates = (catalog?.themes ?? []).filter((t) => t.enabled).map((t) => t.manifest);
  const isEn = lang === "en";

  return (
    <>
      <Nav current="account" lang={lang} />
      <main className="wrap narrow act-page">
        <a className="link act-back" href="/account">{isEn ? "← My invitations" : "← I miei inviti"}</a>
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
        <ActivateTemplate orderId={id} templates={templates} />
      </main>
    </>
  );
}
