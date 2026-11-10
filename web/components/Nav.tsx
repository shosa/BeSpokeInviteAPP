"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ui, type Lang } from "@/lib/ui";
import "./nav.css";

type Me = { id: string; name: string; email: string; role: "user" | "admin" } | null;

// Barra superiore con la stessa grafica del sito di vendita (thebespokeinvite.com): logo testuale,
// link in maiuscolo con filetto d'oro, lingua a pillola, pulsante in vetro e menu a panino sotto i 990 px.
// Il contenuto è quello dell'area clienti: i miei inviti, console per gli admin, acquisto, esci.
const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? "https://thebespokeinvite.com";

const LANGS: { code: Lang; name: string }[] = [
  { code: "it", name: "Italiano" },
  { code: "en", name: "English" },
];

const COPY = {
  it: { sub: "Inviti digitali", shop: "Il sito", buy: "Crea il tuo invito", menu: "Apri menu", main: "Menu principale" },
  en: { sub: "Digital invitations", shop: "Website", buy: "Create your invitation", menu: "Open menu", main: "Main menu" },
};

// Onda al clic sul pulsante in vetro, come sul sito di vendita.
function ripple(e: React.PointerEvent<HTMLElement>) {
  const b = e.currentTarget;
  const r = b.getBoundingClientRect();
  const d = document.createElement("span");
  d.className = "bh-ripple";
  d.style.left = `${e.clientX - r.left}px`;
  d.style.top = `${e.clientY - r.top}px`;
  b.appendChild(d);
  setTimeout(() => d.remove(), 700);
}

export function Nav({ current, lang = "it" }: { current?: "account" | "admin"; lang?: Lang }) {
  const t = ui(lang);
  const T = COPY[lang];
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const langRef = useRef<HTMLDetailsElement>(null);
  const burgerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: Me }) => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  // Un clic fuori dal selettore della lingua o dal menu li chiude; Esc pure.
  useEffect(() => {
    const close = (el: HTMLDetailsElement | null, target: Node | null) => {
      if (el?.open && (!target || !el.contains(target))) el.removeAttribute("open");
    };
    const onDown = (e: PointerEvent) => { close(langRef.current, e.target as Node); close(burgerRef.current, e.target as Node); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(langRef.current, null); close(burgerRef.current, null); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  async function logout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    setMe(null);
    router.push("/account");
    router.refresh();
  }

  const links = (
    <>
      <a href="/account" aria-current={current === "account" ? "page" : undefined}>{t.myInvites}</a>
      {me?.role === "admin" && <a href="/admin" aria-current={current === "admin" ? "page" : undefined}>{t.console}</a>}
      <a href={SHOP_URL}>{T.shop}</a>
    </>
  );
  const buy = <a href={`${SHOP_URL}/#prezzi`} className="bh-btn" onPointerDown={ripple}>{T.buy}</a>;

  return (
    <header className="bh">
      <div className="bh-bar">
        <a href="/account" className="bh-logo" aria-label="The Bespoke Invite">
          <span className="bh-logo__name">The Bespoke Invite</span>
          <span className="bh-logo__sub">{T.sub}</span>
        </a>
        <nav className="bh-nav" aria-label={T.main}>{links}</nav>
        <div className="bh-actions">
          <details className="bh-lang" ref={langRef}>
            <summary aria-label={t.langLabel}>
              {lang.toUpperCase()}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <div className="bh-lang__list">
              {LANGS.map((l) => (
                <a key={l.code} href={`/lingua/${l.code}`} hrefLang={l.code} lang={l.code} aria-current={l.code === lang ? "true" : undefined}>
                  {l.name}<small>{l.code.toUpperCase()}</small>
                </a>
              ))}
            </div>
          </details>
          {buy}
          {me && (
            <button type="button" className="bh-icon" aria-label={t.logout} title={t.logout} onClick={logout}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg>
            </button>
          )}
          <details className="bh-burger" ref={burgerRef}>
            <summary aria-label={T.menu}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="bh-burger__panel" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) burgerRef.current?.removeAttribute("open"); }}>
              {links}
              {me && <button type="button" onClick={logout}>{t.logout}</button>}
              {buy}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
