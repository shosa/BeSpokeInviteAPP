"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EVENT_TYPES, type EventType } from "@inviteme/shared";
import { AddressField } from "@/components/builder/AddressField";
import { ShareLinkButton } from "@/components/account/ShareLinkButton";
import { EVENT_LABEL, fmtDate } from "./format";
import { initials, type ProClientDetail } from "./types";

// Scheda del cliente: dati e contatti, invito e planner (o il pulsante per aggiungerli con un credito),
// accesso della coppia con i suoi permessi, attività e note dello studio.
export function ProClient({ c, lang, appUrl, active }: { c: ProClientDetail; lang: "it" | "en"; appUrl: string; active: boolean }) {
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: c.name, email: c.email, phone: c.phone, eventType: c.eventType, eventDate: c.eventDate, venue: c.venue, address: c.address });
  const [notes, setNotes] = useState(c.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState(c.email);
  const [canInvite, setCanInvite] = useState(c.access[0]?.canInvite ?? true);
  const [canPlanner, setCanPlanner] = useState(c.access[0]?.canPlanner ?? true);
  const [link, setLink] = useState<string | null>(null);

  const days = c.eventDate ? Math.round((new Date(`${c.eventDate}T12:00:00`).getTime() - Date.now()) / 86_400_000) : null;
  const meta = [c.venue, days !== null && days >= 0 ? t(`${days} giorni`, `${days} days`) : null, c.email, c.phone].filter(Boolean).join(" · ");

  async function call(key: string, url: string, init: RequestInit, ok?: string) {
    setBusy(key);
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(null);
    if (!res.ok) { toast.error(String(out.error ?? t("Operazione non riuscita", "Something went wrong"))); return null; }
    if (ok) toast.success(ok);
    return out;
  }

  async function saveData(e: React.FormEvent) {
    e.preventDefault();
    if (await call("data", `/api/pro/clients/${c.id}`, { method: "PATCH", body: JSON.stringify(form) }, t("Dati salvati", "Details saved"))) { setEditing(false); router.refresh(); }
  }
  async function create(kind: "invitation" | "planner") {
    const out = await call(kind, `/api/pro/clients/${c.id}/create`, { method: "POST", body: JSON.stringify({ [kind]: true }) });
    if (!out) return;
    if (kind === "invitation" && out.orderId) router.push(`/account/attiva/${out.orderId}`);
    else router.refresh();
  }
  async function sendAccess() {
    const out = await call("access", `/api/pro/clients/${c.id}/access`, { method: "POST", body: JSON.stringify({ email: accessEmail, canInvite, canPlanner, send: true }) });
    if (!out) return;
    setLink(typeof out.link === "string" ? out.link : null);
    // Per un account che esisteva già il link non torna allo studio: parte solo per email al cliente.
    if (out.mailed) toast.success(t("Accesso inviato via email", "Access sent by email"));
    else if (typeof out.link === "string") toast.success(t("Accesso creato: copia il link e mandalo tu", "Access created: copy the link and send it yourself"));
    else toast.error(t("Accesso salvato, ma l'email non è partita: il cliente può chiedere il link dalla pagina di accesso", "Access saved, but the email wasn't sent: the client can request the link from the sign-in page"));
    router.refresh();
  }
  async function savePerms(email: string, inv: boolean, pl: boolean) {
    if (await call("perm", `/api/pro/clients/${c.id}/access`, { method: "POST", body: JSON.stringify({ email, canInvite: inv, canPlanner: pl }) }, t("Permessi aggiornati", "Permissions updated"))) router.refresh();
  }
  async function revoke(email: string) {
    if (!window.confirm(t(`Togliere l'accesso a ${email}?`, `Remove access for ${email}?`))) return;
    if (await call("revoke", `/api/pro/clients/${c.id}/access?email=${encodeURIComponent(email)}`, { method: "DELETE" }, t("Accesso tolto", "Access removed"))) router.refresh();
  }
  async function saveNotes() {
    if (notes !== c.notes) await call("notes", `/api/pro/clients/${c.id}`, { method: "PATCH", body: JSON.stringify({ notes }) }, t("Note salvate", "Notes saved"));
  }
  async function archive() {
    if (await call("archive", `/api/pro/clients/${c.id}`, { method: "PATCH", body: JSON.stringify({ archived: !c.archived }) }, c.archived ? t("Cliente riattivato", "Client restored") : t("Cliente archiviato", "Client archived"))) router.refresh();
  }
  const copy = async (text: string) => { await navigator.clipboard.writeText(text).catch(() => undefined); toast.success(t("Link copiato", "Link copied")); };

  return (
    <>
      <a className="pro-back" href="/pro/clienti">← {t("Tutti i clienti", "All clients")}</a>

      <header className="pro-card pro-hero">
        <span className="pro-hero-av" aria-hidden="true">{initials(c.name)}</span>
        <div className="pro-hero-text">
          <span className="pro-kicker">{EVENT_LABEL[c.eventType]?.[lang] ?? c.eventType}{c.eventDate ? ` · ${fmtDate(c.eventDate, en, { day: "numeric", month: "long", year: "numeric" })}` : ""}{c.archived ? ` · ${t("Archiviato", "Archived")}` : ""}</span>
          <h1 className="pro-title">{c.name}</h1>
          {meta && <span className="pro-hero-meta">{meta}</span>}
        </div>
        <div className="pro-actions" style={{ width: "auto" }}>
          <button type="button" className="pro-btn is-line is-sm" onClick={() => setEditing((v) => !v)}>{editing ? t("Chiudi", "Close") : t("Modifica dati", "Edit details")}</button>
          <a className="pro-btn is-sm" href="#accesso">{t("Accesso alla coppia", "Couple access")}</a>
        </div>
      </header>

      {editing && (
        <form className="pro-card pro-pad" onSubmit={saveData} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="pro-fields">
            <label className="pro-field">{t("Nomi o titolo", "Names or title")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required /></label>
            <label className="pro-field">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} /></label>
            <label className="pro-field">{t("Telefono", "Phone")}<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} /></label>
            <label className="pro-field">{t("Tipo di evento", "Event type")}
              <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value as EventType })}>
                {EVENT_TYPES.map((x) => <option key={x.id} value={x.id}>{en ? x.labelEn : x.label}</option>)}
              </select>
            </label>
            <label className="pro-field">{t("Data", "Date")}<input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></label>
            <label className="pro-field">{t("Luogo", "Venue")}<input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} maxLength={160} /></label>
          </div>
          <AddressField className="pro-field" label={t("Indirizzo", "Address")} value={form.address} onChange={(address) => setForm({ ...form, address })} placeholder={t("Inizia a scrivere: via, città…", "Start typing: street, city…")} />
          <div className="pro-btns">
            <button type="submit" className="pro-btn is-brass is-sm" disabled={busy === "data"}>{t("Salva", "Save")}</button>
            <button type="button" className="pro-btn is-soft is-sm" onClick={archive}>{c.archived ? t("Riattiva cliente", "Restore client") : t("Archivia cliente", "Archive client")}</button>
          </div>
        </form>
      )}

      <div className="pro-grid2">
        {c.invitations.map((inv) => (
          <section key={inv.id} className="pro-card pro-inv" aria-label={t("Invito", "Invitation")}>
            <div className="pro-phone">{inv.themeId && <img src={`/api/themes/${encodeURIComponent(inv.themeId)}/cover.jpg`} alt="" loading="lazy" />}</div>
            <div className="pro-inv-body">
              <span className="pro-h2">{t("Invito", "Invitation")}</span>
              <h3>{inv.themeName || t("Invito", "Invitation")}</h3>
              <span className={`pro-chip ${inv.published ? "is-ok" : "is-draft"}`} style={{ alignSelf: "flex-start" }}>
                {inv.published ? t(`Online · ${inv.views} visite · ${inv.rsvps} risposte`, `Online · ${inv.views} views · ${inv.rsvps} replies`) : t("Bozza: non ancora pubblicato", "Draft: not published yet")}
              </span>
              {inv.published && <span className="pro-url">{appUrl.replace(/^https?:\/\//, "")}/i/{inv.slug}</span>}
              <div className="pro-btns">
                <a className="pro-btn is-brass is-sm" href={`/editor/${inv.id}`}>{t("Apri editor", "Open editor")}</a>
                <a className="pro-btn is-soft is-sm" href={`/inviti/${inv.id}/risposte`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 10.4 12 3.8l8 6.6V20a.9.9 0 0 1-.9.9h-4.3v-5.6H9.2v5.6H4.9A.9.9 0 0 1 4 20z" /></svg>{t("Gestisci", "Manage")}</a>
                {inv.published && <ShareLinkButton className="pro-btn is-soft is-sm" path={`/i/${inv.slug}`} title={c.name} label={t("Condividi", "Share")} />}
              </div>
            </div>
          </section>
        ))}
        {c.pendingOrders.map((o) => (
          <section key={o} className="pro-card pro-add" aria-label={t("Invito da creare", "Invitation to create")}>
            <span className="pro-h2">{t("Invito", "Invitation")}</span>
            <h3>{t("Scegli il template", "Pick the template")}</h3>
            <p>{t("Il credito è già usato: manca solo il template, poi si apre l'editor.", "The credit is already used: only the template is missing, then the editor opens.")}</p>
            <a className="pro-btn is-brass is-sm" href={`/account/attiva/${o}`}>{t("Scegli il template", "Pick the template")}</a>
          </section>
        ))}
        {c.invitations.length === 0 && c.pendingOrders.length === 0 && (
          <section className="pro-add" aria-label={t("Aggiungi invito", "Add invitation")}>
            <span className="pro-h2">{t("Invito", "Invitation")}</span>
            <h3>{t("Nessun invito", "No invitation")}</h3>
            <p>{t(`Crea l'invito di questo cliente: usa 1 credito invito (ne hai ${c.credits.invitations}).`, `Create this client's invitation: uses 1 invitation credit (you have ${c.credits.invitations}).`)}</p>
            <button type="button" className="pro-btn is-brass is-sm" disabled={!active || c.credits.invitations < 1 || busy === "invitation"} onClick={() => create("invitation")}>{t("Crea invito", "Create invitation")}</button>
          </section>
        )}

        {c.planners.map((p) => (
          <section key={p.id} className="pro-card pro-pl" aria-label="Planner">
            <div className="pro-pl-head">
              <span className="pro-pl-ico" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></span>
              <div><span className="pro-h2">Planner</span><h3>{t("Attivo", "Active")}</h3></div>
            </div>
            <div className="pro-mini">
              <div><span>Budget</span><strong>{p.budgetPct === null ? "—" : `${p.budgetPct}%`}</strong></div>
              <div><span>{t("Attività", "Tasks")}</span><strong>{p.tasks ? `${p.tasksDone}/${p.tasks}` : "—"}</strong></div>
              <div><span>{t("Tavoli", "Tables")}</span><strong>{p.tables || "—"}</strong></div>
            </div>
            <div className="pro-btns">
              <a className="pro-btn is-brass is-sm" href={`/planner/${p.id}`}>{t("Apri planner", "Open planner")}</a>
              <a className="pro-btn is-soft is-sm" href={`/planner/${p.id}#invitati`}>{t("Invitati", "Guests")} · {p.guests}</a>
            </div>
          </section>
        ))}
        {c.planners.length === 0 && (
          <section className="pro-add" aria-label={t("Aggiungi planner", "Add planner")}>
            <span className="pro-h2">Planner</span>
            <h3>{t("Nessun planner", "No planner")}</h3>
            <p>{t(`Budget, invitati, tavoli e cartella per questo evento: usa 1 credito planner (ne hai ${c.credits.planners}).`, `Budget, guests, tables and folder for this event: uses 1 planner credit (you have ${c.credits.planners}).`)}</p>
            <button type="button" className="pro-btn is-brass is-sm" disabled={!active || c.credits.planners < 1 || busy === "planner"} onClick={() => create("planner")}>{t("Crea planner", "Create planner")}</button>
          </section>
        )}
      </div>

      <div className="pro-grid3">
        <section id="accesso" className="pro-card pro-sect" aria-labelledby="pc-acc">
          <h2 id="pc-acc" className="pro-h2">{t("Accesso della coppia", "Couple access")}</h2>
          <p>{t("La coppia entra con il proprio link e vede ciò che le permetti. Lo studio resta proprietario e può togliere l'accesso.", "The couple signs in with their own link and sees what you allow. The studio stays the owner and can remove access.")}</p>
          {c.access.map((a) => (
            <div key={a.email} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 10, borderBottom: "1px solid var(--pro-line-2)" }}>
              <strong style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{a.email}</strong>
              <label className="pro-toggle">{t("Può modificare l'invito", "Can edit the invitation")}<input type="checkbox" checked={a.canInvite} onChange={(e) => savePerms(a.email, e.target.checked, a.canPlanner)} /></label>
              <label className="pro-toggle">{t("Può usare il planner", "Can use the planner")}<input type="checkbox" checked={a.canPlanner} onChange={(e) => savePerms(a.email, a.canInvite, e.target.checked)} /></label>
              <span className="pro-hint">{t(`Link inviato il ${fmtDate(a.sentAt, en)}`, `Link sent on ${fmtDate(a.sentAt, en)}`)} · <button type="button" className="pro-back" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }} onClick={() => revoke(a.email)}>{t("Togli accesso", "Remove access")}</button></span>
            </div>
          ))}
          <label className="pro-field">{c.access.length ? t("Invia (di nuovo) l'accesso a", "Send access (again) to") : t("Email della coppia", "Couple email")}<input type="email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} placeholder="nome@email.it" /></label>
          {!c.access.length && (
            <>
              <label className="pro-toggle">{t("Può modificare l'invito", "Can edit the invitation")}<input type="checkbox" checked={canInvite} onChange={(e) => setCanInvite(e.target.checked)} /></label>
              <label className="pro-toggle">{t("Può usare il planner", "Can use the planner")}<input type="checkbox" checked={canPlanner} onChange={(e) => setCanPlanner(e.target.checked)} /></label>
            </>
          )}
          <button type="button" className="pro-btn is-sm" disabled={!active || !accessEmail.trim() || busy === "access"} onClick={sendAccess} style={{ alignSelf: "flex-start" }}>{busy === "access" ? t("Invio…", "Sending…") : t("Invia accesso alla coppia", "Send access to the couple")}</button>
          {link && <button type="button" className="pro-btn is-soft is-sm" onClick={() => copy(link)} style={{ alignSelf: "flex-start" }}>{t("Copia il link di accesso", "Copy the access link")}</button>}
        </section>

        <section className="pro-card pro-sect" aria-labelledby="pc-log">
          <h2 id="pc-log" className="pro-h2">{t("Attività recente", "Recent activity")}</h2>
          <ol className="pro-log">
            {c.invitations.filter((i) => i.lastRsvp).map((i) => <li key={`r-${i.id}`}><time>{fmtDate(i.lastRsvp!, en, { day: "numeric", month: "short" })}</time><span>{t(`Ultima risposta all'invito · ${i.rsvps} in tutto`, `Latest reply · ${i.rsvps} in total`)}</span></li>)}
            {c.activity.map((a, i) => <li key={i}><time>{fmtDate(a.at, en, { day: "numeric", month: "short" })}</time><span>{a.what}</span></li>)}
            {!c.activity.length && !c.invitations.some((i) => i.lastRsvp) && <li><span className="pro-hint">{t("Ancora niente.", "Nothing yet.")}</span></li>}
          </ol>
        </section>

        <section className="pro-card pro-sect" aria-labelledby="pc-note">
          <h2 id="pc-note" className="pro-h2">{t("Note dello studio", "Studio notes")}</h2>
          <label className="pro-field">{t("Visibili solo allo studio", "Visible only to the studio")}
            <textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} maxLength={4000} placeholder={t("Fornitori, scadenze, cose da ricordare…", "Vendors, deadlines, things to remember…")} />
          </label>
        </section>
      </div>
    </>
  );
}
