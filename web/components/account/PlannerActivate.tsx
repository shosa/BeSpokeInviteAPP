"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { EVENT_TYPES, eventPhrases, type EventType } from "@inviteme/shared";

// Attivazione di un acquisto planner: nome e data dell'evento, luogo facoltativo e, se si vuole, l'invito da collegare.
export function PlannerActivate({ orderId, invitations, lang }: { orderId: string; invitations: { id: string; title: string; eventType?: string }[]; lang: "it" | "en" }) {
  const en = lang === "en";
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("wedding");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [invitationId, setInvitationId] = useState(invitations.length === 1 ? invitations[0].id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collegando un invito, il nome dell'evento può partire dal suo titolo.
  function pickInvitation(id: string) {
    setInvitationId(id);
    const inv = invitations.find((i) => i.id === id);
    if (inv && !title.trim()) setTitle(inv.title);
    // Il tipo di evento parte da quello dell'invito collegato.
    const type = EVENT_TYPES.find((x) => x.id === inv?.eventType);
    if (type) setEventType(type.id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/planner-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, eventType, title, eventDate: eventDate || undefined, venue, invitationId: invitationId || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; plannerId?: string };
    if (!res.ok || !body.plannerId) {
      setBusy(false);
      return setError(body.error ?? (en ? "Could not create the planner. Try again." : "Non è stato possibile creare il planner. Riprova."));
    }
    router.push(`/planner/${body.plannerId}`);
  }

  return (
    <form className="acx-plan-form" onSubmit={submit}>
      <label className="demo-field">
        <span>{en ? "Event type" : "Tipo di evento"}</span>
        <select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
          {EVENT_TYPES.map((x) => <option key={x.id} value={x.id}>{en ? x.labelEn : x.label}</option>)}
        </select>
      </label>
      <label className="demo-field">
        <span>{eventPhrases(eventType, lang).names}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={eventPhrases(eventType, lang).namesHint} maxLength={120} required />
      </label>
      <DatePicker label={en ? "Date (optional)" : "Data (facoltativa)"} value={eventDate} onChange={setEventDate} lang={lang} />
      <label className="demo-field">
        <span>{en ? "Venue (optional)" : "Luogo (facoltativo)"}</span>
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Villa Aurelia, Roma" maxLength={160} />
      </label>
      <fieldset className="acx-plan-link">
        <legend>{en ? "Link an invitation (optional)" : "Collega un invito (facoltativo)"}</legend>
        <p className="hint">{en ? "Linked, the planner shows the replies of the invitation and its link to share. You can do it later too." : "Collegato, il planner mostra le risposte dell'invito e il link da condividere. Puoi farlo anche dopo."}</p>
        <label className="acx-radio">
          <input type="radio" name="inv" checked={invitationId === ""} onChange={() => setInvitationId("")} />
          <span>{en ? "No invitation, for now" : "Nessun invito, per ora"}</span>
        </label>
        {invitations.map((i) => (
          <label key={i.id} className="acx-radio">
            <input type="radio" name="inv" checked={invitationId === i.id} onChange={() => pickInvitation(i.id)} />
            <span>{i.title || (en ? "Untitled invitation" : "Invito senza titolo")}</span>
          </label>
        ))}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn solid" disabled={busy || !title.trim()}>{busy ? (en ? "Creating…" : "Creo il planner…") : (en ? "Start the planner" : "Inizia il planner")}</button>
    </form>
  );
}
