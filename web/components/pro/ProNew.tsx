"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_TYPES, type EventType } from "@inviteme/shared";
import { AddressField } from "@/components/builder/AddressField";
import { DatePicker } from "@/components/ui/DatePicker";
import type { ProClientRow } from "./types";

// Nuovo evento: cliente (nuovo o esistente), evento, cosa preparare. Ogni invito e ogni planner usa un credito.
// Con l'invito si passa alla scelta del template; con il solo planner si apre la scheda del cliente.
export function ProNew({ lang, credits, clients, active }: { lang: "it" | "en"; credits: { invitations: number; planners: number }; clients: ProClientRow[]; active: boolean }) {
  const en = lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState<EventType>("wedding");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [invitation, setInvitation] = useState(credits.invitations > 0);
  const [planner, setPlanner] = useState(credits.planners > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = clients.find((c) => c.id === existing);

  const cost = [invitation && t("1 credito invito", "1 invitation credit"), planner && t("1 credito planner", "1 planner credit")].filter(Boolean) as string[];
  const ready = active && (mode === "new" ? name.trim().length > 0 : !!pick) && (mode === "new" || invitation || planner);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const res = mode === "new"
      ? await fetch("/api/pro/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, eventType, eventDate: eventDate || undefined, venue, address, invitation, planner }) })
      : await fetch(`/api/pro/clients/${existing}/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitation, planner }) });
    const out = (await res.json().catch(() => ({}))) as { id?: string; orderId?: string | null; error?: string };
    const clientId = mode === "new" ? out.id : existing;
    if (!res.ok) {
      setBusy(false);
      setError(out.error ?? t("Non è stato possibile creare l'evento", "The event could not be created"));
      if (clientId && res.status === 409) router.push(`/pro/clienti/${clientId}`);
      return;
    }
    router.push(out.orderId ? `/account/attiva/${out.orderId}` : `/pro/clienti/${clientId}`);
  }

  return (
    <form className="pro-wrap-narrow" onSubmit={submit}>
      <a className="pro-back" href="/pro">← {t("Dashboard", "Dashboard")}</a>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="pro-kicker">{t("Nuovo evento", "New event")}</span>
        <h1 className="pro-title">{t("Per chi lavori?", "Who is it for?")}</h1>
        <p className="pro-lede">{t("Un cliente, un evento: scegli cosa preparargli. Ogni invito e ogni planner usa un credito.", "One client, one event: choose what to prepare. Each invitation and each planner uses one credit.")}</p>
      </header>

      <section className="pro-card pro-pad" aria-labelledby="pn1" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 id="pn1" className="pro-h2">{t("1 · Cliente", "1 · Client")}</h2>
        <div className="pro-seg" role="tablist" aria-label={t("Cliente", "Client")} style={{ alignSelf: "flex-start" }}>
          <button type="button" role="tab" aria-selected={mode === "new"} onClick={() => setMode("new")}>{t("Nuovo cliente", "New client")}</button>
          <button type="button" role="tab" aria-selected={mode === "existing"} onClick={() => setMode("existing")} disabled={!clients.length}>{t("Cliente esistente", "Existing client")}</button>
        </div>
        {mode === "new" ? (
          <div className="pro-fields">
            <label className="pro-field">{t("Nomi o titolo", "Names or title")}<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bianca & Leonardo" maxLength={120} required /></label>
            <label className="pro-field">{t("Email del cliente (facoltativa)", "Client email (optional)")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.it" maxLength={200} /></label>
            <label className="pro-field">{t("Telefono (facoltativo)", "Phone (optional)")}<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+39 …" maxLength={40} /></label>
          </div>
        ) : (
          <label className="pro-field">{t("Cliente", "Client")}
            <select value={existing} onChange={(e) => setExisting(e.target.value)}>
              <option value="">{t("Scegli un cliente…", "Choose a client…")}</option>
              {clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
      </section>

      {mode === "new" && (
        <section className="pro-card pro-pad" aria-labelledby="pn2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 id="pn2" className="pro-h2">{t("2 · Evento", "2 · Event")}</h2>
          <div className="pro-types" role="group" aria-label={t("Tipo di evento", "Event type")}>
            {EVENT_TYPES.map((x) => <button key={x.id} type="button" aria-pressed={eventType === x.id} onClick={() => setEventType(x.id)}>{en ? x.labelEn : x.label}</button>)}
          </div>
          <div className="pro-fields">
            <DatePicker label={t("Data (facoltativa)", "Date (optional)")} value={eventDate} onChange={setEventDate} lang={lang} />
            <label className="pro-field">{t("Luogo (facoltativo)", "Venue (optional)")}<input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Villa Sola Cabiati" maxLength={160} /></label>
          </div>
          <AddressField className="pro-field" label={t("Indirizzo (facoltativo, per mappa e meteo)", "Address (optional, for map and weather)")} value={address} onChange={setAddress} placeholder={t("Inizia a scrivere: via, città…", "Start typing: street, city…")} />
        </section>
      )}

      <section aria-labelledby="pn3" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="pn3" className="pro-h2">{mode === "new" ? t("3 · Cosa preparare", "3 · What to prepare") : t("2 · Cosa preparare", "2 · What to prepare")}</h2>
        <div className="pro-grid2">
          <label className={`pro-pick${invitation ? " is-on" : ""}${credits.invitations < 1 ? " is-off" : ""}`}>
            <span className="pro-pick-top"><strong>{t("Invito", "Invitation")}</strong><input type="checkbox" checked={invitation} disabled={credits.invitations < 1} onChange={(e) => setInvitation(e.target.checked)} /></span>
            <p>{t("Tutti i template, anche Premium, con conferma di presenza e BeSpoke AI.", "Every template, Premium included, with RSVP and BeSpoke AI.")}</p>
            <em>{credits.invitations < 1 ? t("Crediti invito esauriti", "No invitation credits left") : t(`1 credito invito · ne restano ${credits.invitations - (invitation ? 1 : 0)}`, `1 invitation credit · ${credits.invitations - (invitation ? 1 : 0)} left`)}</em>
          </label>
          <label className={`pro-pick${planner ? " is-on" : ""}${credits.planners < 1 ? " is-off" : ""}`}>
            <span className="pro-pick-top"><strong>Planner</strong><input type="checkbox" checked={planner} disabled={credits.planners < 1} onChange={(e) => setPlanner(e.target.checked)} /></span>
            <p>{t("Budget, invitati, tavoli, attività e cartella, collegato all'invito.", "Budget, guests, tables, tasks and folder, linked to the invitation.")}</p>
            <em>{credits.planners < 1 ? t("Crediti planner esauriti", "No planner credits left") : t(`1 credito planner · ne restano ${credits.planners - (planner ? 1 : 0)}`, `1 planner credit · ${credits.planners - (planner ? 1 : 0)} left`)}</em>
          </label>
        </div>
      </section>

      {error && <p className="pro-error" role="alert">{error}</p>}
      {!active && <p className="pro-error" role="alert">{t("Lo studio è sospeso: non puoi creare eventi.", "The studio is suspended: you can't create events.")}</p>}

      <div className="pro-sticky">
        <span style={{ fontSize: 15 }}>
          {cost.length ? <>{t("Usi", "You use")} <strong>{cost.join(t(" e ", " and "))}</strong></> : mode === "new" ? t("Solo il cliente, senza crediti: invito e planner li aggiungi dopo", "Only the client, no credits: add invitation and planner later") : t("Scegli invito o planner", "Choose invitation or planner")}
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="pro-btn is-ghost" href="/pro">{t("Annulla", "Cancel")}</a>
          <button type="submit" className="pro-btn is-gold" disabled={!ready || busy}>
            {busy ? t("Creo…", "Creating…") : invitation ? t("Crea e scegli il template", "Create and pick the template") : t("Crea", "Create")}
          </button>
        </div>
      </div>
    </form>
  );
}
