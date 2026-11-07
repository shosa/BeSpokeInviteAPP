import Link from "next/link";
import { Confetti } from "./Clipart";
import type { ThemeDecor } from "@/lib/themeAssets";

// Testata dell'invito nei colori del tema: usata dalla dashboard e dalla gestione ospiti.
export function InviteHero({ kicker, title, when, ink, backHref, backLabel, decor }: { kicker: string; title: string; when: string; ink: string; backHref?: string; backLabel?: string; decor?: ThemeDecor }) {
  return (
    <section className="idash-hero">
      <Confetti className="idash-confetti" color={ink} />
      {decor?.floral && <img className="idash-floral idash-floral-l" src={decor.floral} alt="" aria-hidden="true" draggable={false} />}
      {decor?.floral && <img className="idash-floral idash-floral-r" src={decor.floral} alt="" aria-hidden="true" draggable={false} />}
      {decor?.photos[0] && <img className="idash-photo" src={decor.photos[0]} alt="" aria-hidden="true" draggable={false} />}
      <div className="wrap">
        {backHref && <Link className="idash-back" href={backHref}>← {backLabel}</Link>}
        <p className="idash-kicker">{kicker}</p>
        <h1>{title}</h1>
        {decor?.ornament && <img className="idash-orn" src={decor.ornament} alt="" aria-hidden="true" draggable={false} />}
        <p className="idash-when">{when}</p>
      </div>
    </section>
  );
}
