"use client";

import { useEffect, useState } from "react";
import type { Catalog } from "@inviteme/shared";
import { ThemesAdmin } from "./ThemesAdmin";
import { AdminInvitations } from "./admin/AdminInvitations";
import { AdminMedia } from "./admin/AdminMedia";
import { AdminMail } from "./admin/AdminMail";
import { AdminAssistant } from "./admin/AdminAssistant";
import type { ShopifyState, Tab } from "./admin/types";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminShopify } from "./admin/AdminShopify";
import { MusicLibrary } from "./admin/MusicLibrary";
import { ShoppingBag, Users, Mail, LayoutTemplate, Music, Image as ImageIcon, Store, Send, Sparkles, type LucideIcon } from "lucide-react";
import "./admin/console.css";
import { useT } from "@/lib/lang";

// Navigazione per gruppi: ciò che si fa ogni giorno in alto, il catalogo al centro, il collegamento di sistema in basso.
const ICON: Record<Tab, LucideIcon> = { ordini: ShoppingBag, clienti: Users, inviti: Mail, template: LayoutTemplate, musica: Music, file: ImageIcon, shopify: Store, email: Send, assistente: Sparkles };
type Pair = [string, string]; // [italiano, inglese]
const GROUPS: { title: Pair; items: { id: Tab; label: Pair; hint: Pair }[] }[] = [
  {
    title: ["Vendita", "Sales"],
    items: [
      { id: "ordini", label: ["Ordini", "Orders"], hint: ["Pagamenti", "Payments"] },
      { id: "clienti", label: ["Clienti", "Customers"], hint: ["Account e ruoli", "Accounts and roles"] },
    ],
  },
  {
    title: ["Contenuti", "Content"],
    items: [
      { id: "inviti", label: ["Inviti", "Invitations"], hint: ["Tutti gli inviti", "All invitations"] },
      { id: "template", label: ["Template", "Templates"], hint: ["Cosa scelgono i clienti", "What customers choose from"] },
      { id: "musica", label: ["Musica", "Music"], hint: ["Libreria brani", "Track library"] },
      { id: "file", label: ["File", "Files"], hint: ["Immagini caricate", "Uploaded images"] },
    ],
  },
  {
    title: ["Sistema", "System"],
    items: [
      { id: "shopify", label: ["Shopify", "Shopify"], hint: ["Collegamento al negozio", "Shop connection"] },
      { id: "email", label: ["Email", "Email"], hint: ["Mittente e avvisi", "Sender and notices"] },
      { id: "assistente", label: ["Assistente", "Assistant"], hint: ["Modello e limiti", "Model and limits"] },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

// Console admin di Bespoke Invites. Il collegamento Shopify è al centro: senza di quello non ci sono pagamenti.
export function AdminConsole() {
  const tt = useT();
  const t = (p: Pair) => tt(p[0], p[1]);
  const [tab, setTab] = useState<Tab>("ordini");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [shopify, setShopify] = useState<ShopifyState | null>(null);
  const [clientId, setClientId] = useState<string | undefined>(undefined);

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

  const current = ALL.find((t) => t.id === tab);
  const needsShopify = shopify !== null && !shopify.configured && !shopify.demo;

  return (
    <main className="ac">
      <aside className="ac-side" aria-label={tt("Sezioni della console", "Console sections")}>
        <div className="ac-card ac-rail">
        <div className="ac-brand">
          <span className="ac-brand-mark" aria-hidden="true">B</span>
          <div>
            <strong>Console</strong>
            <small>Bespoke Invites</small>
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title[0]} className="ac-navgroup">
            <span className="ac-navlabel">{t(g.title)}</span>
            {g.items.map((item) => {
              const Icon = ICON[item.id];
              return (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "is-on" : ""}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setTab(item.id)}
              >
                <span className="ac-navicon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="ac-navtext"><span>{t(item.label)}</span><small>{t(item.hint)}</small></span>
                {item.id === "shopify" && needsShopify && <i className="ac-dot" aria-label={tt("da completare", "to complete")} />}
              </button>
              );
            })}
          </div>
        ))}
        </div>
      </aside>

      <section className="ac-main">
        <header className="ac-head">
          <div>
            <span className="ac-kicker">{(() => { const g = GROUPS.find((x) => x.items.some((i) => i.id === tab)); return g ? t(g.title) : ""; })()}</span>
            <h1>{current ? t(current.label) : ""}</h1>
            <p className="hint">{current ? t(current.hint) : ""}</p>
          </div>
          <div className="ac-headside">
            {shopify && (
              <button type="button" className={`ac-pill ${shopify.configured ? "is-ok" : shopify.demo ? "is-info" : "is-warn"}`} onClick={() => setTab("shopify")}>
                {shopify.configured ? tt("Shopify collegato", "Shopify connected") : shopify.demo ? tt("Demo: nessun pagamento reale", "Demo: no real payments") : tt("Shopify da collegare", "Shopify to connect")}
              </button>
            )}
          </div>
        </header>

        <div className="ac-body">
          {tab === "ordini" && <AdminOrders />}
          {tab === "clienti" && <AdminUsers onOpenInvitations={(id) => { setClientId(id); setTab("inviti"); }} />}
          {tab === "inviti" && <AdminInvitations initialUser={clientId} onClearUser={() => setClientId(undefined)} />}
          {tab === "template" && (catalog ? <ThemesAdmin catalog={catalog} onChanged={reload} /> : <p className="hint">{tt("Caricamento…", "Loading…")}</p>)}
          {tab === "musica" && <MusicLibrary tracks={catalog?.music ?? []} onChange={reload} />}
          {tab === "file" && <AdminMedia />}
          {tab === "shopify" && <AdminShopify />}
          {tab === "email" && <AdminMail />}
          {tab === "assistente" && <AdminAssistant />}
        </div>
      </section>
    </main>
  );
}
