"use client";

import { useState, type DragEvent } from "react";
import { useT } from "@/lib/lang";

// Organizza tavoli: una sala con i tavoli tondi, i posti occupati, gli invitati da trascinare su un tavolo
// e un vassoio con chi non ha ancora un posto. Su telefono si sceglie il tavolo dal menu.
export type SeatTable = { id: string; name: string; seats: number };
export type SeatGuest = { id: string; name: string; party_size: number; response: "pending" | "yes" | "no"; table_id: string | null };

type Call = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<unknown>;

export function Seating({ tables, guests, call }: { tables: SeatTable[]; guests: SeatGuest[]; call: Call }) {
  const t = useT();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("8");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const seated = (tb: SeatTable) => guests.filter((g) => g.table_id === tb.id);
  const used = (tb: SeatTable) => seated(tb).reduce((n, g) => n + g.party_size, 0);
  const tray = guests.filter((g) => !g.table_id && g.response !== "no");
  const totalSeats = tables.reduce((n, tb) => n + tb.seats, 0);
  const totalSeated = tables.reduce((n, tb) => n + used(tb), 0);
  const pct = totalSeats ? Math.round((totalSeated / totalSeats) * 100) : 0;

  async function addTable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await call("POST", "/tables", { name: name.trim(), seats: Number(seats) || 8 });
      setName("");
      setSeats("8");
    } catch {
      /* errore già mostrato dal planner */
    }
  }

  function place(guest: SeatGuest, table: SeatTable | null) {
    if (table && used(table) + guest.party_size > table.seats) return;
    void call("PATCH", `/guests/${guest.id}`, { table_id: table?.id ?? null }).catch(() => undefined);
  }

  function onDrop(e: DragEvent<HTMLElement>, table: SeatTable) {
    e.preventDefault();
    const guest = guests.find((g) => g.id === (dragId ?? e.dataTransfer.getData("text/plain")));
    setOverId(null);
    setDragId(null);
    if (guest) place(guest, table);
  }

  return (
    <section className="seat" aria-label={t("Organizza tavoli", "Seating plan")}>
      <div className="seat-top">
        <div className="seat-meter">
          <div className="seat-ring" style={{ "--pct": `${pct}%` } as React.CSSProperties}><span>{pct}%</span></div>
          <div>
            <span className="pp-kicker">{t("Sala", "Room")}</span>
            <strong>{t(`${totalSeated} su ${totalSeats} posti`, `${totalSeated} of ${totalSeats} seats`)}</strong>
            <small>{t(`${tray.length} ${tray.length === 1 ? "invitato" : "invitati"} senza posto`, `${tray.length} ${tray.length === 1 ? "guest" : "guests"} without a seat`)}</small>
          </div>
        </div>
        <form className="seat-add" onSubmit={addTable}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Nome del tavolo", "Table name")} required maxLength={80} aria-label={t("Nome del tavolo", "Table name")} />
          <input value={seats} onChange={(e) => setSeats(e.target.value)} type="number" min={1} max={30} aria-label={t("Posti", "Seats")} />
          <button type="submit" className="btn solid small">{t("Aggiungi tavolo", "Add table")}</button>
        </form>
      </div>

      <div className="seat-body">
        <aside className="seat-tray" aria-label={t("Da sistemare", "To seat")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const g = guests.find((x) => x.id === (dragId ?? e.dataTransfer.getData("text/plain"))); setDragId(null); if (g) place(g, null); }}>
          <span className="pp-kicker">{t("Da sistemare", "To seat")}</span>
          {tray.length === 0 && <p className="hint">{t("Tutti hanno un posto.", "Everyone has a seat.")}</p>}
          {tray.map((g) => (
            <div key={g.id} className="seat-chip" draggable onDragStart={(e) => { setDragId(g.id); e.dataTransfer.setData("text/plain", g.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}>
              <span>{g.name}</span>
              {g.party_size > 1 && <small>+{g.party_size - 1}</small>}
              <select defaultValue="" aria-label={t(`Assegna ${g.name} a un tavolo`, `Seat ${g.name} at a table`)} onChange={(e) => { const tb = tables.find((x) => x.id === e.target.value); if (tb) place(g, tb); e.currentTarget.value = ""; }}>
                <option value="">{t("Tavolo…", "Table…")}</option>
                {tables.filter((tb) => tb.seats - used(tb) >= g.party_size).map((tb) => <option key={tb.id} value={tb.id}>{tb.name}</option>)}
              </select>
            </div>
          ))}
        </aside>

        <div className="seat-room">
          {tables.length === 0 && <p className="hint seat-empty">{t("Aggiungi i tavoli: poi trascina gli invitati su un tavolo, o usa il menu.", "Add the tables, then drag guests onto a table or use the menu.")}</p>}
          <div className="seat-grid">
            {tables.map((tb) => {
              const n = used(tb);
              const full = n >= tb.seats;
              const dots = Array.from({ length: tb.seats }, (_, i) => i);
              return (
                <article
                  key={tb.id}
                  className={`seat-table${full ? " is-full" : ""}${overId === tb.id ? " is-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOverId(tb.id); }}
                  onDragLeave={() => setOverId((o) => (o === tb.id ? null : o))}
                  onDrop={(e) => onDrop(e, tb)}
                >
                  <div className="seat-disc">
                    {dots.map((i) => (
                      <span key={i} className={`seat-dot${i < n ? " is-taken" : ""}`} style={{ "--a": `${(i / tb.seats) * 360}deg` } as React.CSSProperties} />
                    ))}
                    <div className="seat-center">
                      <strong>{tb.name}</strong>
                      <small>{n} / {tb.seats}</small>
                    </div>
                  </div>
                  <ul className="seat-names">
                    {seated(tb).map((g) => (
                      <li key={g.id}>
                        <span>{g.name}{g.party_size > 1 ? ` +${g.party_size - 1}` : ""}</span>
                        <button type="button" className="pp-link" aria-label={t(`Alza ${g.name}`, `Unseat ${g.name}`)} onClick={() => place(g, null)}>{t("Alza", "Unseat")}</button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="pp-link seat-del" onClick={() => call("DELETE", `/tables/${tb.id}`)}>{t("Elimina tavolo", "Delete table")}</button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
