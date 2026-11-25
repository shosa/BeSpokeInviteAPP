import type { Metadata } from "next";
import { ArrowLeft, Mail } from "lucide-react";
import { Nav } from "@/components/Nav";
import { getLang } from "@/lib/i18n";
import "./not-found.css";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return { title: en ? "Page not found · Bespoke Invite" : "Pagina non trovata · Bespoke Invite", robots: { index: false } };
}

// Pagina 404 del sito: un invito che è volato via (doodle a tratto, nei colori del sito) e due strade per tornare.
export default async function NotFound() {
  const lang = await getLang();
  const en = lang === "en";
  return (
    <>
      <Nav lang={lang} />
      <main className="nf">
        <Doodle />
        <p className="kicker">{en ? "Error 404" : "Errore 404"}</p>
        <h1>{en ? <>This invitation <em>flew away</em></> : <>Questo invito <em>è volato via</em></>}</h1>
        <p className="lede">
          {en
            ? "The page you're looking for doesn't exist, or it has moved. If someone sent you a link to an invitation, check that it's complete or ask them to send it again."
            : "La pagina che cerchi non esiste, o è stata spostata. Se ti hanno mandato il link di un invito, controlla che sia completo o chiedi di rimandartelo."}
        </p>
        <div className="nf-actions">
          <a className="btn solid" href="/"><ArrowLeft size={18} aria-hidden="true" /> {en ? "Back to the home page" : "Torna alla home"}</a>
          <a className="btn outline" href="/account"><Mail size={18} aria-hidden="true" /> {en ? "My invitations" : "I miei inviti"}</a>
        </div>
      </main>
    </>
  );
}

// Doodle: la busta aperta da cui è scappato l'invito, che vola via con una scia a puntini; sigillo di ceralacca «404».
function Doodle() {
  return (
    <svg className="nf-doodle" viewBox="0 0 520 300" role="img" aria-hidden="true">
      {/* scia dell'invito: un giro della morte a puntini */}
      <path className="nf-trail" d="M150 196 C 210 150, 250 70, 330 92 C 390 110, 360 178, 316 160 C 276 144, 312 70, 400 58 C 432 54, 452 60, 470 52" />
      {/* busta aperta, un po' storta, con il lembo sollevato */}
      <g className="nf-envelope" transform="rotate(-6 120 210)">
        <path className="nf-paper" d="M44 170 L196 170 L196 262 L44 262 Z" />
        <path className="nf-line" d="M44 170 L120 112 L196 170" />
        <path className="nf-line" d="M44 262 L106 214 M196 262 L134 214" />
        <path className="nf-line" d="M44 170 L120 226 L196 170" />
        {/* sigillo di ceralacca con 404 */}
        <g transform="translate(120 226)">
          <path className="nf-seal" d="M-24 -2 C -25 -16, -12 -26, 2 -25 C 16 -24, 26 -13, 24 1 C 23 15, 12 25, -2 24 C -16 23, -23 12, -24 -2 Z" />
          <circle className="nf-seal-ring" r="16" />
          <text className="nf-seal-text" y="5" textAnchor="middle">404</text>
        </g>
      </g>
      {/* l'invito in volo: un biglietto piegato ad aeroplanino */}
      <g className="nf-plane" transform="translate(470 52) rotate(-14)">
        <path className="nf-paper" d="M0 0 L-58 -22 L-40 4 Z" />
        <path className="nf-paper is-shade" d="M0 0 L-40 4 L-46 20 Z" />
        <path className="nf-line" d="M0 0 L-58 -22 L-40 4 L-46 20 Z M-40 4 L0 0" />
      </g>
      {/* stelline e cuoricino, tratto a mano */}
      <path className="nf-spark" d="M262 34 l0 14 M255 41 l14 0" />
      <path className="nf-spark" d="M84 70 l0 10 M79 75 l10 0" />
      <path className="nf-heart" d="M408 150 c -6 -10, -20 -2, -12 8 l 12 12 l 12 -12 c 8 -10, -6 -18, -12 -8 Z" />
    </svg>
  );
}
