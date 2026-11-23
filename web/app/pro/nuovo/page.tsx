import type { Metadata } from "next";
import { apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ProShell } from "@/components/pro/ProShell";
import { ProNew } from "@/components/pro/ProNew";
import { loadStudio } from "@/components/pro/load";
import type { ProClientRow } from "@/components/pro/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuovo evento · Bespoke Pro" };

export default async function ProNewPage() {
  const lang = (await getLang()) === "en" ? "en" : "it";
  const studio = await loadStudio();
  const clients = await apiServer<ProClientRow[]>("/api/pro/clients").catch(() => [] as ProClientRow[]);
  return (
    <ProShell studio={studio} active="nuovo" lang={lang}>
      <ProNew lang={lang} credits={studio.credits} clients={clients} active={studio.active} />
    </ProShell>
  );
}
