import { Nav } from "@/components/Nav";
import { AdminConsole } from "@/components/AdminConsole";
import { apiServer } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Admin() {
  let me: { user: { role: string } | null } = { user: null };
  try {
    me = await apiServer("/api/auth/me");
  } catch {
    me = { user: null };
  }
  if (!me.user) {
    return (
      <>
        <Nav />
        <main className="wrap narrow admin-denied">
          <h1>Accesso riservato</h1>
          <p className="lede">La console si apre con il link di accesso dell'amministratore.</p>
        </main>
      </>
    );
  }
  if (me.user.role !== "admin") {
    return (
      <>
        <Nav />
        <main className="wrap narrow admin-denied">
          <h1>Non hai accesso alla console</h1>
          <p className="lede">La console è riservata agli amministratori di InviteMe.</p>
        </main>
      </>
    );
  }
  return (
    <>
      <Nav current="admin" />
      <AdminConsole />
    </>
  );
}
