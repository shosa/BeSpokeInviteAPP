import Link from "next/link";
import type { ReactNode } from "react";
import { Confetti } from "./Clipart";
import type { ThemeDecor } from "@/lib/themeAssets";

// Testata dell'invito nei colori del tema: usata dalla dashboard e dalla gestione ospiti.
// banner: foto di sfondo scelta dal cliente (con un velo scuro per leggere i testi); arch: foto dell'arco al posto di quella del tema.
// actions: comandi in alto a destra (es. «Personalizza testata» nel planner).
export function InviteHero({ kicker, title, when, ink, backHref, backLabel, decor, banner, arch, actions }: { kicker: string; title: string; when: string; ink: string; backHref?: string; backLabel?: string; decor?: ThemeDecor; banner?: string | null; arch?: string | null; actions?: ReactNode }) {
  const photo = arch ?? decor?.photos[0];
  return (
    <section className={`idash-hero${banner ? " has-banner" : ""}`}>
      {banner && <img className="idash-banner" src={banner} alt="" aria-hidden="true" draggable={false} />}
      <Confetti className="idash-confetti" color={ink} />
      {decor?.floral && !banner && <img className="idash-floral idash-floral-l" src={decor.floral} alt="" aria-hidden="true" draggable={false} />}
      {decor?.floral && !banner && <img className="idash-floral idash-floral-r" src={decor.floral} alt="" aria-hidden="true" draggable={false} />}
      {photo && <img className="idash-photo" src={photo} alt="" aria-hidden="true" draggable={false} />}
      {actions && <div className="idash-actions">{actions}</div>}
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
