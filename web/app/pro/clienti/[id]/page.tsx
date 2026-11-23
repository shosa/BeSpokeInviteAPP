import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, apiServer } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { ProShell } from "@/components/pro/ProShell";
import { ProClient } from "@/components/pro/ProClient";
import { loadStudio } from "@/components/pro/load";
import type { ProClientDetail } from "@/components/pro/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cliente · Bespoke Pro" };

export default async function ProClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = (await getLang()) === "en" ? "en" : "it";
  const studio = await loadStudio();
  const client = await apiServer<ProClientDetail>(`/api/pro/clients/${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <ProShell studio={studio} active="clienti" lang={lang}>
      <ProClient c={client} lang={lang} appUrl={process.env.PUBLIC_APP_URL ?? "https://app.thebespokeinvite.com"} active={studio.active} />
    </ProShell>
  );
}
