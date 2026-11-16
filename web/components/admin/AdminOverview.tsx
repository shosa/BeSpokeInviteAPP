"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Mail, MessageCircle, ShoppingBag } from "lucide-react";
import { useLang } from "@/lib/lang";
import { fmtDate } from "./format";
import type { Go } from "./types";

// Panoramica: cosa c'è da fare e cosa è successo. Niente importi né numeri di vendita: quelli stanno su Shopify.
type Overview = {
  counts: { pending: number; live: number; in_progress: number; published_30: number; planners: number; planners_linked: number; rsvps_7: number; customers_30: number };
  stale: { id: string; created_at: string; product: string; user_id: string; name: string; email: string }[];
  todo: { kind: "shopify-planner" | "stale-pending" | "mail-failed" | "themes-off" | "past-events"; count?: number }[];
  mail: { ok: boolean; error?: string; at: string } | null;
  themesOff: string[];
  recent: { kind: "order" | "planner" | "rsvp" | "invitation"; at: string; detail: string | null; who: string | null; user_id: string | null; ref: string | null }[];
};

export function AdminOverview({ go }: { go: Go }) {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/overview").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="form-error">{t("Panoramica non disponibile.", "Overview not available.")}</p>;
  if (!data) return <p className="hint">{t("Caricamento…", "Loading…")}</p>;
  const c = data.counts;

  const todoItem = (x: Overview["todo"][number]) => {
    switch (x.kind) {
      case "shopify-planner":
        return { tone: "warn", title: t("ID del prodotto planner mancante", "Planner product ID missing"), text: t("Gli acquisti del planner dal negozio non vengono riconosciuti.", "Planner purchases from the shop aren't recognised."), cta: t("Apri Shopify", "Open Shopify"), act: () => go("shopify") };
      case "stale-pending":
        return { tone: "info", title: t(`${x.count} ${x.count === 1 ? "acquisto non attivato" : "acquisti non attivati"} da più di 3 giorni`, `${x.count} ${x.count === 1 ? "purchase" : "purchases"} not activated for over 3 days`), text: data.stale.map((s) => s.name || s.email).slice(0, 4).join(", "), cta: t("Vedi gli ordini", "See the orders"), act: () => go("ordini") };
      case "mail-failed":
        return { tone: "warn", title: t("Ultima email non consegnata", "Last email not delivered"), text: data.mail?.error ?? "", cta: t("Apri Email", "Open Email"), act: () => go("email") };
      case "themes-off":
        return { tone: "info", title: t(`${x.count} ${x.count === 1 ? "template disattivato" : "template disattivati"}`, `${x.count} disabled ${x.count === 1 ? "template" : "templates"}`), text: data.themesOff.slice(0, 4).join(", "), cta: t("Apri Template", "Open Templates"), act: () => go("template") };
      case "past-events":
        return { tone: "info", title: t(`${x.count} inviti con l'evento passato da più di una settimana`, `${x.count} invitations whose event was over a week ago`), text: t("Restano online: controlla se qualcuno va chiuso.", "They're still online: check whether any should be closed."), cta: t("Apri Inviti", "Open Invitations"), act: () => go("inviti") };
    }
  };

  const recentLabel = (r: Overview["recent"][number]) => {
    if (r.kind === "order") return r.detail === "planner" ? t("Nuovo acquisto: planner", "New purchase: planner") : t("Nuovo acquisto: invito", "New purchase: invitation");
    if (r.kind === "planner") return t(`Planner creato · ${r.detail ?? ""}`, `Planner created · ${r.detail ?? ""}`);
    if (r.kind === "rsvp") return t(`Nuova risposta · ${r.detail ?? "invito"}`, `New reply · ${r.detail ?? "invitation"}`);
    return t(`Invito creato · ${r.detail ?? "senza titolo"}`, `Invitation created · ${r.detail ?? "untitled"}`);
  };
  const recentIcon = { order: ShoppingBag, planner: BookOpen, rsvp: MessageCircle, invitation: Mail } as const;

  return (
    <div className="ov">
      <section className="ov-stats" aria-label={t("Stato", "Status")}>
        <button type="button" className={`ov-stat${c.pending ? " is-accent" : ""}`} onClick={() => go("ordini")}><span>{t("Da attivare", "To activate")}</span><strong>{c.pending}</strong><small>{t("acquisti in attesa del cliente", "purchases waiting for the customer")}</small></button>
        <button type="button" className="ov-stat" onClick={() => go("inviti")}><span>{t("Inviti online", "Live invitations")}</span><strong>{c.live}</strong><small>{t(`${c.in_progress} in preparazione`, `${c.in_progress} in progress`)}</small></button>
        <button type="button" className="ov-stat" onClick={() => go("planner")}><span>Planner</span><strong>{c.planners}</strong><small>{t(`${c.planners_linked} collegati a un invito`, `${c.planners_linked} linked to an invitation`)}</small></button>
        <div className="ov-stat"><span>{t("Risposte · 7 giorni", "Replies · 7 days")}</span><strong>{c.rsvps_7}</strong><small>{t("dagli ospiti degli inviti", "from invitation guests")}</small></div>
      </section>

      <div className="ov-row">
        <section className="ac-card ov-todo" aria-label={t("Da fare", "To do")}>
          <div className="ov-card-head"><h2>{t("Da fare", "To do")}</h2><span className="hint">{data.todo.length ? `${data.todo.length}` : ""}</span></div>
          {data.todo.length === 0 ? (
            <p className="ov-clear"><CheckCircle2 size={18} aria-hidden="true" />{t("Tutto a posto: niente da sistemare.", "All good: nothing to fix.")}</p>
          ) : (
            <ul>
              {data.todo.map((x) => {
                const i = todoItem(x);
                return (
                  <li key={x.kind} className={`is-${i.tone}`}>
                    <span className="ov-dot" aria-hidden="true" />
                    <div><b>{i.title}</b>{i.text && <small>{i.text}</small>}</div>
                    <button type="button" className="ov-go" onClick={i.act}>{i.cta} →</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ac-card ov-feed" aria-label={t("Attività recente", "Recent activity")}>
          <div className="ov-card-head"><h2>{t("Attività recente", "Recent activity")}</h2></div>
          <ul>
            {data.recent.map((r, i) => {
              const Icon = recentIcon[r.kind];
              const open = () => (r.kind === "planner" && r.ref ? window.open(`/planner/${r.ref}`, "_blank") : r.user_id ? go("clienti", { userId: r.user_id }) : undefined);
              return (
                <li key={i}>
                  <span className={`ov-ico is-${r.kind}`} aria-hidden="true"><Icon size={15} /></span>
                  <button type="button" className="ov-feed-main" onClick={open}><b>{recentLabel(r)}</b>{r.who && <small>{r.who}</small>}</button>
                  <time>{fmtDate(r.at)}</time>
                </li>
              );
            })}
            {data.recent.length === 0 && <li className="hint">{t("Ancora niente.", "Nothing yet.")}</li>}
          </ul>
        </section>
      </div>

      <p className="hint ov-foot">{t(`Negli ultimi 30 giorni: ${c.customers_30} nuovi clienti, ${c.published_30} inviti pubblicati. Vendite e incassi sono su Shopify.`, `Last 30 days: ${c.customers_30} new customers, ${c.published_30} invitations published. Sales and revenue are on Shopify.`)}</p>
    </div>
  );
}
