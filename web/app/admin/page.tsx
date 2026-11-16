import { Nav } from "@/components/Nav";
import { AdminConsole } from "@/components/AdminConsole";
import { apiServer } from "@/lib/api";
import { getLang, tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const lang = await getLang();
  const t = tr(lang);
  let me: { user: { role: string } | null } = { user: null };
  try {
    me = await apiServer("/api/auth/me");
  } catch {
    me = { user: null };
  }
  if (!me.user) {
    return (
      <>
        <Nav lang={lang} />
        <main className="wrap narrow admin-denied">
          <h1>{t("Accesso riservato", "Restricted access")}</h1>
          <p className="lede">{t("La console si apre con il link di accesso dell'amministratore.", "The console opens with the administrator's sign-in link.")}</p>
        </main>
      </>
    );
  }
  if (me.user.role !== "admin") {
    return (
      <>
        <Nav lang={lang} />
        <main className="wrap narrow admin-denied">
          <h1>{t("Non hai accesso alla console", "You don't have access to the console")}</h1>
          <p className="lede">{t("La console è riservata agli amministratori di Bespoke Invites.", "The console is reserved for Bespoke Invites administrators.")}</p>
        </main>
      </>
    );
  }
  return (
    <>
      <Nav current="admin" lang={lang} />
      <AdminConsole />
    </>
  );
}
