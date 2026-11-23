"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, LayoutTemplate, Mail, Search, ShoppingBag, Store, User, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/lang";
import type { Go, Tab } from "./types";

// Cerca ovunque (⌘K): clienti, inviti, planner, ordini e le sezioni della console. Frecce per scegliere, Invio per aprire.
type Results = {
  users: { id: string; name: string; email: string }[];
  invitations: { id: string; slug: string; title: string | null; live: boolean; email: string }[];
  planners: { id: string; title: string; email: string }[];
  orders: { id: string; product: string; user_id: string | null; email: string | null }[];
};
type Item = { key: string; group: string; icon: LucideIcon; title: string; sub: string; run: () => void };

export function CommandPalette({ go, onClose }: { go: Go; onClose: () => void }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`).then((r) => (r.ok ? r.json() : null)).then(setRes).catch(() => setRes(null));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const sections: { id: Tab; it: string; en: string; icon: LucideIcon }[] = [
    { id: "ordini", it: "Ordini", en: "Orders", icon: ShoppingBag },
    { id: "template", it: "Template", en: "Templates", icon: LayoutTemplate },
    { id: "shopify", it: "Shopify", en: "Shopify", icon: Store },
    { id: "email", it: "Email", en: "Email", icon: Mail },
  ];

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const ql = q.trim().toLowerCase();
    for (const s of sections) if (!ql || s.it.toLowerCase().includes(ql) || s.en.toLowerCase().includes(ql)) out.push({ key: `s-${s.id}`, group: t("Sezioni", "Sections"), icon: s.icon, title: t(s.it, s.en), sub: t("Apri la sezione", "Open the section"), run: () => go(s.id) });
    if (res) {
      for (const u of res.users) out.push({ key: `u-${u.id}`, group: t("Clienti", "Customers"), icon: User, title: u.name || u.email, sub: u.email, run: () => go("clienti", { userId: u.id }) });
      for (const i of res.invitations) out.push({ key: `i-${i.id}`, group: t("Inviti", "Invitations"), icon: Mail, title: i.title || i.slug, sub: `${i.live ? t("online", "live") : t("non pubblicato", "not published")} · ${i.email}`, run: () => go("inviti", { invitationId: i.id }) });
      for (const p of res.planners) out.push({ key: `p-${p.id}`, group: "Planner", icon: BookOpen, title: p.title || t("Senza titolo", "Untitled"), sub: p.email, run: () => window.open(`/admin/planner/${p.id}`, "_blank") });
      for (const o of res.orders) out.push({ key: `o-${o.id}`, group: t("Ordini", "Orders"), icon: ShoppingBag, title: o.id, sub: `${o.product === "planner" ? "Planner" : t("Invito", "Invitation")} · ${o.email ?? ""}`, run: () => (o.user_id ? go("clienti", { userId: o.user_id }) : go("ordini")) });
    }
    return out;
  }, [q, res, en]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setActive(0), [items.length]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); items[active].run(); onClose(); }
  }

  let lastGroup = "";
  return (
    <div className="cp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cp" role="dialog" aria-modal="true" aria-label={t("Cerca ovunque", "Search everywhere")} onKeyDown={onKey}>
        <label className="cp-input"><Search size={18} aria-hidden="true" /><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca clienti, inviti, planner, ordini…", "Search customers, invitations, planners, orders…")} aria-label={t("Cerca", "Search")} /><kbd>Esc</kbd></label>
        <ul className="cp-list" role="listbox">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <li key={it.key}>
                {head && <span className="cp-group">{head}</span>}
                <button type="button" role="option" aria-selected={i === active} className={i === active ? "is-on" : ""} onMouseEnter={() => setActive(i)} onClick={() => { it.run(); onClose(); }}>
                  <span className="cp-ico" aria-hidden="true"><Icon size={16} /></span>
                  <span className="cp-text"><b>{it.title}</b><small>{it.sub}</small></span>
                </button>
              </li>
            );
          })}
          {q.trim().length >= 2 && res && items.every((x) => x.key.startsWith("s-")) && <li className="cp-empty">{t("Nessun risultato.", "No results.")}</li>}
        </ul>
        <p className="cp-foot">{t("↑↓ per scegliere · Invio per aprire", "↑↓ to choose · Enter to open")}</p>
      </div>
    </div>
  );
}
