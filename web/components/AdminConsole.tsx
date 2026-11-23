"use client";

import { useEffect, useState } from "react";
import type { Catalog } from "@inviteme/shared";
import { ThemesAdmin } from "./ThemesAdmin";
import { AdminInvitations } from "./admin/AdminInvitations";
import { AdminMedia } from "./admin/AdminMedia";
import { AdminMail } from "./admin/AdminMail";
import { AdminAssistant } from "./admin/AdminAssistant";
import type { Go, ShopifyState, Tab } from "./admin/types";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminShopify } from "./admin/AdminShopify";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminPlanners } from "./admin/AdminPlanners";
import { AdminPro } from "./admin/AdminPro";
import { CommandPalette } from "./admin/CommandPalette";
import { MusicLibrary } from "./admin/MusicLibrary";
import { BookOpen, Briefcase, LayoutDashboard, MoreHorizontal, ShoppingBag, Users, Mail, LayoutTemplate, Music, Image as ImageIcon, Search, Store, Send, Sparkles, X, type LucideIcon } from "lucide-react";
import "./admin/console.css";
import { useT } from "@/lib/lang";

// Navigazione per gruppi: la panoramica in cima, poi vendite, prodotti e impostazioni.
const ICON: Record<Tab, LucideIcon> = { panoramica: LayoutDashboard, ordini: ShoppingBag, clienti: Users, inviti: Mail, planner: BookOpen, template: LayoutTemplate, musica: Music, file: ImageIcon, shopify: Store, email: Send, assistente: Sparkles, pro: Briefcase };
type Pair = [string, string]; // [italiano, inglese]
const GROUPS: { title: Pair | null; items: { id: Tab; label: Pair; hint: Pair }[] }[] = [
  { title: null, items: [{ id: "panoramica", label: ["Panoramica", "Overview"], hint: ["Cosa fare oggi e cosa è successo", "What to do today and what happened"] }] },
  {
    title: ["Vendite", "Sales"],
    items: [
      { id: "ordini", label: ["Ordini", "Orders"], hint: ["Acquisti e attivazioni", "Purchases and activations"] },
      { id: "clienti", label: ["Clienti", "Customers"], hint: ["Schede, acquisti assegnati, accesso", "Profiles, assigned purchases, access"] },
      { id: "pro", label: ["Wedding planner", "Wedding planners"], hint: ["Studi Pro, crediti e piani mensili", "Pro studios, credits and monthly plans"] },
    ],
  },
  {
    title: ["Prodotti", "Products"],
    items: [
      { id: "inviti", label: ["Inviti", "Invitations"], hint: ["Tutti gli inviti", "All invitations"] },
      { id: "planner", label: ["Planner", "Planners"], hint: ["Tutti i planner", "All planners"] },
      { id: "template", label: ["Template", "Templates"], hint: ["Cosa scelgono i clienti", "What customers choose from"] },
      { id: "musica", label: ["Musica", "Music"], hint: ["Libreria brani", "Track library"] },
      { id: "file", label: ["File", "Files"], hint: ["Immagini caricate", "Uploaded images"] },
    ],
  },
  {
    title: ["Impostazioni", "Settings"],
    items: [
      { id: "shopify", label: ["Shopify", "Shopify"], hint: ["Collegamento al negozio", "Shop connection"] },
      { id: "email", label: ["Email", "Email"], hint: ["Mittente, avvisi e testi", "Sender, notices and texts"] },
      { id: "assistente", label: ["BeSpoke AI", "BeSpoke AI"], hint: ["Modello e limiti", "Model and limits"] },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);
// Telefono: barra in basso come nel planner, con le sezioni principali, la ricerca e «Altro» per tutte le altre.
const MAIN_TABS: Tab[] = ["panoramica", "ordini", "clienti"];
const MORE_TABS = ALL.filter((x) => !MAIN_TABS.includes(x.id));

// Console admin di Bespoke Invites.
export function AdminConsole() {
  const tt = useT();
  const t = (p: Pair) => tt(p[0], p[1]);
  const [tab, setTab] = useState<Tab>("panoramica");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [shopify, setShopify] = useState<ShopifyState | null>(null);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [openUser, setOpenUser] = useState<string | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  async function reload() {
    const res = await fetch("/api/admin/catalog");
    if (res.ok) setCatalog((await res.json()) as Catalog);
  }
  async function reloadShopify() {
    const res = await fetch("/api/admin/shopify");
    if (res.ok) {
      const d = (await res.json()) as ShopifyState;
      setShopify({ configured: d.configured, demo: d.demo });
    }
  }
  useEffect(() => {
    void reload();
    void reloadShopify();
  }, []);

  // ⌘K / Ctrl+K apre la ricerca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearching(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go: Go = (next, target) => {
    if (next === "clienti") setOpenUser(target?.userId);
    if (next === "inviti") setClientId(target?.userId);
    setTab(next);
    setSearching(false);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  const current = ALL.find((x) => x.id === tab);
  const needsShopify = shopify !== null && !shopify.configured && !shopify.demo;

  return (
    <main className="ac">
      <aside className="ac-side" aria-label={tt("Sezioni della console", "Console sections")}>
        <div className="ac-brand">
          <span className="ac-brand-mark" aria-hidden="true">B</span>
          <div>
            <strong>Console</strong>
            <small>The Bespoke Invite</small>
          </div>
        </div>
        <button type="button" className="ac-search-btn" onClick={() => setSearching(true)}>
          <Search size={16} aria-hidden="true" />
          <span>{tt("Cerca clienti, ordini, inviti", "Search customers, orders, invitations")}</span>
          <kbd>⌘K</kbd>
        </button>
        {GROUPS.map((g, gi) => (
          <div key={gi} className="ac-navgroup">
            {g.title && <span className="ac-navlabel">{t(g.title)}</span>}
            {g.items.map((item) => {
              const Icon = ICON[item.id];
              return (
                <button key={item.id} type="button" className={tab === item.id ? "is-on" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => go(item.id)}>
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span>{t(item.label)}</span>
                  {item.id === "shopify" && needsShopify && <i className="ac-dot" aria-label={tt("da completare", "to complete")} />}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <section className="ac-main">
        <header className="ac-head">
          <div>
            <span className="ac-kicker">{(() => { const g = GROUPS.find((x) => x.items.some((i) => i.id === tab)); return g?.title ? t(g.title) : "Console"; })()}</span>
            <h1>{current ? t(current.label) : ""}</h1>
            <p className="hint">{current ? t(current.hint) : ""}</p>
          </div>
          <div className="ac-headside">
            {shopify && (
              <button type="button" className={`ac-pill ${shopify.configured ? "is-ok" : shopify.demo ? "is-info" : "is-warn"}`} onClick={() => go("shopify")}>
                {shopify.configured ? tt("Shopify collegato", "Shopify connected") : shopify.demo ? tt("Demo: nessun pagamento reale", "Demo: no real payments") : tt("Shopify da collegare", "Shopify to connect")}
              </button>
            )}
          </div>
        </header>

        <div className="ac-body" key={tab}>
          {tab === "panoramica" && <AdminOverview go={go} />}
          {tab === "ordini" && <AdminOrders go={go} />}
          {tab === "clienti" && <AdminUsers openId={openUser} onOpen={setOpenUser} onOpenInvitations={(id) => go("inviti", { userId: id })} />}
          {tab === "inviti" && <AdminInvitations initialUser={clientId} onClearUser={() => setClientId(undefined)} />}
          {tab === "planner" && <AdminPlanners go={go} />}
          {tab === "pro" && <AdminPro />}
          {tab === "template" && (catalog ? <ThemesAdmin catalog={catalog} onChanged={reload} /> : <p className="hint">{tt("Caricamento…", "Loading…")}</p>)}
          {tab === "musica" && <MusicLibrary tracks={catalog?.music ?? []} onChange={reload} />}
          {tab === "file" && <AdminMedia />}
          {tab === "shopify" && <AdminShopify />}
          {tab === "email" && <AdminMail />}
          {tab === "assistente" && <AdminAssistant />}
        </div>
      </section>
      <nav className="pp-tabbar ac-tabbar" aria-label={tt("Sezioni della console", "Console sections")}>
        {MAIN_TABS.map((id) => {
          const item = ALL.find((x) => x.id === id)!;
          const Icon = ICON[id];
          return (
            <button key={id} type="button" className={`pp-tabbar-item${tab === id ? " is-on" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
              <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <span>{t(item.label)}</span>
            </button>
          );
        })}
        <button type="button" className="pp-tabbar-item" onClick={() => setSearching(true)}>
          <Search size={22} strokeWidth={1.6} aria-hidden="true" />
          <span>{tt("Cerca", "Search")}</span>
        </button>
        <button type="button" className={`pp-tabbar-item${MORE_TABS.some((x) => x.id === tab) || moreOpen ? " is-on" : ""}`} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          <MoreHorizontal size={22} strokeWidth={1.6} aria-hidden="true" />
          <span>{(() => { const cur = MORE_TABS.find((x) => x.id === tab); return cur ? t(cur.label) : tt("Altro", "More"); })()}</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="pp-sheet-backdrop ac-sheet" onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }} onKeyDown={(e) => { if (e.key === "Escape") setMoreOpen(false); }}>
          <div className="pp-sheet" role="dialog" aria-modal="true" aria-label={tt("Altre sezioni", "More sections")}>
            <header className="pp-sheet-head">
              <strong>{tt("Altro", "More")}</strong>
              <button type="button" className="pp-sheet-close" aria-label={tt("Chiudi", "Close")} onClick={() => setMoreOpen(false)} autoFocus><X size={20} aria-hidden="true" /></button>
            </header>
            <div className="pp-sheet-grid">
              {MORE_TABS.map((item) => {
                const Icon = ICON[item.id];
                return (
                  <button key={item.id} type="button" className={`pp-sheet-item${tab === item.id ? " is-on" : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => go(item.id)}>
                    <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                    <span>{t(item.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {searching && <CommandPalette go={go} onClose={() => setSearching(false)} />}
    </main>
  );
}
