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

// Navigazione per gruppi: ciò che si fa ogni giorno in alto, il catalogo al centro, il collegamento di sistema in basso.
const ICON: Record<Tab, LucideIcon> = { ordini: ShoppingBag, clienti: Users, inviti: Mail, template: LayoutTemplate, musica: Music, file: ImageIcon, shopify: Store, email: Send, assistente: Sparkles };
const GROUPS: { title: string; items: { id: Tab; label: string; hint: string }[] }[] = [
  {
    title: "Vendita",
    items: [
      { id: "ordini", label: "Ordini", hint: "Pagamenti" },
      { id: "clienti", label: "Clienti", hint: "Account e ruoli" },
    ],
  },
  {
    title: "Contenuti",
    items: [
      { id: "inviti", label: "Inviti", hint: "Tutti gli inviti" },
      { id: "template", label: "Template", hint: "Cosa scelgono i clienti" },
      { id: "musica", label: "Musica", hint: "Libreria brani" },
      { id: "file", label: "File", hint: "Immagini caricate" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { id: "shopify", label: "Shopify", hint: "Collegamento al negozio" },
      { id: "email", label: "Email", hint: "Mittente e avvisi" },
      { id: "assistente", label: "Assistente", hint: "Modello e limiti" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

// Console admin di Bespoke Invites. Il collegamento Shopify è al centro: senza di quello non ci sono pagamenti.
export function AdminConsole() {
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
      <aside className="ac-side" aria-label="Sezioni della console">
        <div className="ac-card ac-rail">
        <div className="ac-brand">
          <span className="ac-brand-mark" aria-hidden="true">B</span>
          <div>
            <strong>Console</strong>
            <small>Bespoke Invites</small>
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="ac-navgroup">
            <span className="ac-navlabel">{g.title}</span>
            {g.items.map((t) => {
              const Icon = ICON[t.id];
              return (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? "is-on" : ""}
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => setTab(t.id)}
              >
                <span className="ac-navicon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="ac-navtext"><span>{t.label}</span><small>{t.hint}</small></span>
                {t.id === "shopify" && needsShopify && <i className="ac-dot" aria-label="da completare" />}
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
            <span className="ac-kicker">{GROUPS.find((g) => g.items.some((i) => i.id === tab))?.title}</span>
            <h1>{current?.label}</h1>
            <p className="hint">{current?.hint}</p>
          </div>
          <div className="ac-headside">
            {shopify && (
              <button type="button" className={`ac-pill ${shopify.configured ? "is-ok" : shopify.demo ? "is-info" : "is-warn"}`} onClick={() => setTab("shopify")}>
                {shopify.configured ? "Shopify collegato" : shopify.demo ? "Demo: nessun pagamento reale" : "Shopify da collegare"}
              </button>
            )}
          </div>
        </header>

        <div className="ac-body">
          {tab === "ordini" && <AdminOrders />}
          {tab === "clienti" && <AdminUsers onOpenInvitations={(id) => { setClientId(id); setTab("inviti"); }} />}
          {tab === "inviti" && <AdminInvitations initialUser={clientId} onClearUser={() => setClientId(undefined)} />}
          {tab === "template" && (catalog ? <ThemesAdmin catalog={catalog} onChanged={reload} /> : <p className="hint">Caricamento…</p>)}
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
