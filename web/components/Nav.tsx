"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Ticket } from "lucide-react";
import { Logo } from "./Logo";
import { ui, type Lang } from "@/lib/ui";
import { LangSelect } from "@/components/LangSelect";

type Me = { id: string; name: string; email: string; role: "user" | "admin" } | null;

// Barra superiore: il profilo, la console per gli amministratori ed esci. Niente accesso con password: si entra con il link.
export function Nav({ current, lang = "it" }: { current?: "account" | "admin"; lang?: Lang }) {
  const t = ui(lang);
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: Me }) => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    setMe(null);
    router.push("/account");
    router.refresh();
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="/account" className="logo-link" aria-label="Bespoke Invites"><Logo /></a>
        <div className="nav-account">
          {me === undefined || !me ? null : (
            <>
              {me.role === "admin" && <a href="/admin" className={`nav-link${current === "admin" ? " is-current" : ""}`}><ShieldCheck size={16} aria-hidden="true" />{t.console}</a>}
              <a href="/account" className={`nav-link${current === "account" ? " is-current" : ""}`}><Ticket size={16} aria-hidden="true" />{t.myInvites}</a>
              <button type="button" className="btn ghost small" onClick={logout}><LogOut size={16} aria-hidden="true" />{t.logout}</button>
            </>
          )}
          <LangSelect lang={lang} />
        </div>
      </div>
    </header>
  );
}
