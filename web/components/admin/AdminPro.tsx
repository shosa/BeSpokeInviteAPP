"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";
import { Switch } from "../ui/Switch";
import { fmtDate } from "./format";

type Studio = {
  id: string; name: string; email: string; active: boolean; clients: number;
  credits: { invitations: number; planners: number };
  plan: { invitations: number; planners: number; renewDay: number; rollover: boolean };
  nextRenewal: string | null;
  createdAt?: string;
};
type Detail = Studio & { ledger: { at: string; what: string; invitations: number; planners: number; by: string | null }[] };

const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "·";

// Wedding planner (Bespoke Pro): studi, crediti assegnati a mano, piano mensile e movimenti. Il pagamento è fuori dal sito.
export function AdminPro() {
  const en = useLang() === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const [list, setList] = useState<Studio[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [plan, setPlan] = useState({ invitations: "0", planners: "0", renewDay: "1", rollover: false });
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ email: "", name: "", notify: true });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = (await fetch("/api/admin/pro").then((r) => (r.ok ? r.json() : [])).catch(() => [])) as Studio[];
    setList(rows);
    setSel((cur) => cur ?? rows[0]?.id ?? null);
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const x = (await fetch(`/api/admin/pro/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Detail | null;
    setD(x);
    if (x) setPlan({ invitations: String(x.plan.invitations), planners: String(x.plan.planners), renewDay: String(x.plan.renewDay), rollover: x.plan.rollover });
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (sel) void loadDetail(sel); }, [sel, loadDetail]);

  async function send(url: string, method: string, body: unknown, ok: string) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    setBusy(false);
    if (!res.ok) { toast.error(out.error ?? t("Operazione non riuscita", "Something went wrong")); return null; }
    toast.success(ok);
    await load();
    return out;
  }
  async function credits(inv: number, pl: number) {
    if (!d) return;
    if (await send(`/api/admin/pro/${d.id}/credits`, "POST", { invitations: inv, planners: pl, reason: reason.trim() || undefined }, t("Crediti aggiornati", "Credits updated"))) { setReason(""); await loadDetail(d.id); }
  }
  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    if (await send(`/api/admin/pro/${d.id}`, "PATCH", { plan: { invitations: Number(plan.invitations), planners: Number(plan.planners), renewDay: Number(plan.renewDay), rollover: plan.rollover } }, t("Piano salvato", "Plan saved"))) await loadDetail(d.id);
  }
  async function setActive(active: boolean) {
    if (!d) return;
    if (await send(`/api/admin/pro/${d.id}`, "PATCH", { active }, active ? t("Studio attivo", "Studio active") : t("Studio sospeso", "Studio suspended"))) await loadDetail(d.id);
  }
  async function addStudio(e: React.FormEvent) {
    e.preventDefault();
    const out = await send("/api/admin/pro", "POST", nw, t("Studio aggiunto", "Studio added"));
    if (out?.id) { setAdding(false); setNw({ email: "", name: "", notify: true }); setSel(out.id); }
  }
  async function accessLink() {
    if (!d) return;
    const res = await fetch(`/api/admin/users/${d.id}/access-link`, { method: "POST" });
    if (res.ok) toast.success(t(`Link di accesso inviato a ${d.email}`, `Access link sent to ${d.email}`));
    else toast.error(t("Email non inviata", "Email not sent"));
  }

  return (
    <div className="ac-stack apro">
      <div className="ac-toolbar">
        <p className="hint">{list ? t(`${list.length} studi`, `${list.length} studios`) : ""}</p>
        <button type="button" className="btn solid small" onClick={() => setAdding(true)}>{t("Aggiungi studio", "Add studio")}</button>
      </div>

      {list && list.length === 0 && !adding && (
        <div className="apro-empty">
          <h3>{t("Nessuno studio Pro", "No Pro studios")}</h3>
          <p className="hint">{t("Aggiungi un wedding planner con la sua email: avrà un'area per gestire clienti, inviti e planner con i crediti che gli assegni.", "Add a wedding planner by email: they get an area to manage clients, invitations and planners with the credits you assign.")}</p>
        </div>
      )}

      <div className="apro-grid">
        {list && list.length > 0 && (
          <section className="apro-list" aria-label={t("Studi", "Studios")}>
            <ul>
              {list.map((s) => (
                <li key={s.id}>
                  <button type="button" className={sel === s.id ? "is-on" : ""} aria-pressed={sel === s.id} onClick={() => setSel(s.id)}>
                    <span className="apro-mono" aria-hidden="true">{initials(s.name)}</span>
                    <span className="apro-who"><strong>{s.name}</strong><small>{s.plan.invitations || s.plan.planners ? t(`Mensile · ${s.plan.invitations} inviti + ${s.plan.planners} planner`, `Monthly · ${s.plan.invitations} inv. + ${s.plan.planners} planners`) : t("Crediti a mano", "Manual credits")}{s.active ? "" : ` · ${t("sospeso", "suspended")}`}</small></span>
                    <span className="apro-cr">{s.credits.invitations} · {s.credits.planners}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {d && (
          <div className="apro-detail">
            <section className="apro-card">
              <div className="apro-head">
                <span className="apro-mono is-lg" aria-hidden="true">{initials(d.name)}</span>
                <div className="apro-who">
                  <h3>{d.name}</h3>
                  <small>{d.email} · {t(`dal ${fmtDate(d.createdAt ?? "")}`, `since ${fmtDate(d.createdAt ?? "")}`)} · {t(`${d.clients} clienti`, `${d.clients} clients`)}</small>
                </div>
                <Switch checked={d.active} onChange={setActive} label={d.active ? t("Attivo", "Active") : t("Sospeso", "Suspended")} />
              </div>
              <div className="apro-credits">
                {([["invitations", t("Crediti invito", "Invitation credits")], ["planners", t("Crediti planner", "Planner credits")]] as const).map(([k, label]) => (
                  <div key={k} className="apro-credit">
                    <span className="apro-k">{label}</span>
                    <strong>{d.credits[k]}</strong>
                    <div className="apro-steps">
                      <button type="button" disabled={busy || d.credits[k] < 1} onClick={() => credits(k === "invitations" ? -1 : 0, k === "planners" ? -1 : 0)}>− 1</button>
                      <button type="button" disabled={busy} onClick={() => credits(k === "invitations" ? 1 : 0, k === "planners" ? 1 : 0)}>+ 1</button>
                      <button type="button" className="is-main" disabled={busy} onClick={() => credits(k === "invitations" ? 5 : 0, k === "planners" ? 5 : 0)}>+ 5</button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="apro-field">{t("Motivo (facoltativo, finisce nei movimenti)", "Reason (optional, shown in the activity)")}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Es. pagamento di novembre", "E.g. November payment")} maxLength={160} /></label>
              <button type="button" className="btn outline small" onClick={accessLink} style={{ alignSelf: "flex-start" }}>{t("Invia link di accesso", "Send access link")}</button>
            </section>

            <form className="apro-card" onSubmit={savePlan}>
              <span className="apro-k">{t("Piano mensile", "Monthly plan")}</span>
              <div className="apro-fields">
                <label className="apro-field">{t("Inviti al mese", "Invitations per month")}<input inputMode="numeric" value={plan.invitations} onChange={(e) => setPlan({ ...plan, invitations: e.target.value.replace(/\D/g, "") })} /></label>
                <label className="apro-field">{t("Planner al mese", "Planners per month")}<input inputMode="numeric" value={plan.planners} onChange={(e) => setPlan({ ...plan, planners: e.target.value.replace(/\D/g, "") })} /></label>
                <label className="apro-field">{t("Giorno di rinnovo (1–28)", "Renewal day (1–28)")}<input inputMode="numeric" value={plan.renewDay} onChange={(e) => setPlan({ ...plan, renewDay: e.target.value.replace(/\D/g, "") })} /></label>
              </div>
              <div className="adm-seg apro-seg" role="radiogroup" aria-label={t("Crediti non usati", "Unused credits")}>
                <button type="button" role="radio" aria-checked={!plan.rollover} className={!plan.rollover ? "is-on" : ""} onClick={() => setPlan({ ...plan, rollover: false })}>{t("Si perdono al rinnovo", "Expire at renewal")}</button>
                <button type="button" role="radio" aria-checked={plan.rollover} className={plan.rollover ? "is-on" : ""} onClick={() => setPlan({ ...plan, rollover: true })}>{t("Si accumulano", "Carry over")}</button>
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {d.nextRenewal ? t(`Prossimo rinnovo: ${fmtDate(d.nextRenewal)} · +${d.plan.invitations} inviti, +${d.plan.planners} planner`, `Next renewal: ${fmtDate(d.nextRenewal)} · +${d.plan.invitations} invitations, +${d.plan.planners} planners`) : t("Nessun piano: con 0 e 0 i crediti si assegnano solo a mano.", "No plan: with 0 and 0 credits are assigned by hand only.")}
              </p>
              <button type="submit" className="btn solid small" disabled={busy} style={{ alignSelf: "flex-start" }}>{t("Salva piano", "Save plan")}</button>
            </form>

            <section className="apro-card">
              <span className="apro-k">{t("Movimenti dei crediti", "Credit activity")}</span>
              <ol className="apro-log">
                {d.ledger.map((m, i) => (
                  <li key={i}>
                    <time>{fmtDate(m.at)}</time>
                    <span>{m.what}{m.by ? <small> · {m.by}</small> : null}</span>
                    <b className={m.invitations + m.planners >= 0 ? "is-plus" : "is-minus"}>
                      {[m.invitations ? `${m.invitations > 0 ? "+" : "−"} ${Math.abs(m.invitations)} ${t("inv.", "inv.")}` : "", m.planners ? `${m.planners > 0 ? "+" : "−"} ${Math.abs(m.planners)} planner` : ""].filter(Boolean).join(", ")}
                    </b>
                  </li>
                ))}
                {!d.ledger.length && <li><span className="hint">{t("Ancora nessun movimento.", "No activity yet.")}</span></li>}
              </ol>
            </section>
          </div>
        )}
      </div>

      {adding && (
        <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <form className="demo-modal apro-modal" role="dialog" aria-modal="true" aria-labelledby="apro-new" onSubmit={addStudio}>
            <header className="demo-modal-head">
              <h2 id="apro-new">{t("Aggiungi studio", "Add studio")}</h2>
              <button type="button" className="demo-close" aria-label={t("Chiudi", "Close")} onClick={() => setAdding(false)}>×</button>
            </header>
            <p className="hint">{t("L'email diventa l'accesso dello studio: se esiste già un cliente con questa email, diventa uno studio.", "The email becomes the studio's login: if a customer with this email exists, it becomes a studio.")}</p>
            <label className="apro-field">{t("Nome dello studio", "Studio name")}<input value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="Lucia Marchetti Events" maxLength={120} required autoFocus /></label>
            <label className="apro-field">Email<input type="email" value={nw.email} onChange={(e) => setNw({ ...nw, email: e.target.value })} placeholder="studio@email.it" maxLength={200} required /></label>
            <label className="apro-check"><input type="checkbox" checked={nw.notify} onChange={(e) => setNw({ ...nw, notify: e.target.checked })} />{t("Manda subito il link di accesso", "Send the access link now")}</label>
            <button type="submit" className="btn solid" disabled={busy}>{t("Aggiungi", "Add")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
