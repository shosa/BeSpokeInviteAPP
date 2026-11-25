import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Nav } from "@/components/Nav";
import { getLang } from "@/lib/i18n";
import { DEMO_CARDS } from "../../cards";
import "../../demo.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const card = DEMO_CARDS.find((c) => c.key === key);
  return { title: card ? `${card.title} · Demo` : "Demo", robots: { index: false, follow: false, nocache: true } };
}

// Un invito della demo, con la busta. Al computer sta dentro un telefono al centro della pagina;
// al telefono occupa tutto lo schermo, come lo vedono gli ospiti, con un pulsante per tornare indietro.
export default async function DemoInvite({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const card = DEMO_CARDS.find((c) => c.key === key);
  if (!card) notFound();
  const lang = await getLang();
  const en = lang === "en";
  return (
    <>
      <Nav lang={lang} />
      <main className="dmv">
        <a className="back-link dmv-back" href={`/demo#${card.key}`} aria-label={en ? "Back to the demo" : "Torna alla demo"}><ArrowLeft size={16} aria-hidden="true" /> <span>{en ? "Back to the demo" : "Torna alla demo"}</span></a>
        <div className="dmv-stage">
          <div className="dm-phone is-viewer">
            <div className="dm-screen">
              <iframe src={`/demo/invito/${card.key}/pagina?lang=${lang}`} title={`${card.title} · ${card.theme}`} />
            </div>
          </div>
          <div className="dmv-info">
            <p className="kicker">{en ? card.kind[1] : card.kind[0]} · {card.theme}</p>
            <h1>{card.title}</h1>
            <p className="lede">{en ? "Tap the envelope to open it, then scroll: everything works as it does for guests. The reply is not sent to anyone." : "Tocca la busta per aprirla, poi scorri: funziona tutto come per gli ospiti. La risposta non arriva a nessuno."}</p>
          </div>
        </div>
      </main>
    </>
  );
}
