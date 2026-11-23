import type { Metadata } from "next";
import { apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ProShell } from "@/components/pro/ProShell";
import { ProClients } from "@/components/pro/ProClients";
import { loadStudio } from "@/components/pro/load";
import type { ProClientRow } from "@/components/pro/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clienti · Bespoke Pro" };

export default async function ProClientsPage() {
  const lang = (await getLang()) === "en" ? "en" : "it";
  const studio = await loadStudio();
  const clients = await apiServer<ProClientRow[]>("/api/pro/clients").catch(() => [] as ProClientRow[]);
  return (
    <ProShell studio={studio} active="clienti" lang={lang}>
      <header className="pro-head">
        <div>
          <span className="pro-kicker">Bespoke Pro</span>
          <h1 className="pro-title">{lang === "en" ? "Clients" : "Clienti"}</h1>
          <p className="pro-lede">{lang === "en" ? "Every client with their invitation, planner and replies." : "Ogni cliente con il suo invito, il planner e le risposte."}</p>
        </div>
        <div className="pro-actions"><a className="pro-btn" href="/pro/nuovo">{lang === "en" ? "New event" : "Nuovo evento"}</a></div>
      </header>
      <ProClients clients={clients} lang={lang} title={lang === "en" ? "All clients" : "Tutti i clienti"} />
    </ProShell>
  );
}
