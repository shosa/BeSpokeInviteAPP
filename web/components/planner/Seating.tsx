"use client";

import { useState, type DragEvent } from "react";

// Organizza tavoli: una sala con i tavoli tondi, i posti occupati, gli invitati da trascinare su un tavolo
// e un vassoio con chi non ha ancora un posto. Su telefono si sceglie il tavolo dal menu.
export type SeatTable = { id: string; name: string; seats: number };
export type SeatGuest = { id: string; name: string; party_size: number; response: "pending" | "yes" | "no"; table_id: string | null };

type Call = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<unknown>;

export function Seating({ tables, guests, call }: { tables: SeatTable[]; guests: SeatGuest[]; call: Call }) {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("8");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const seated = (t: SeatTable) => guests.filter((g) => g.table_id === t.id);
  const used = (t: SeatTable) => seated(t).reduce((n, g) => n + g.party_size, 0);
  const tray = guests.filter((g) => !g.table_id && g.response !== "no");
  const totalSeats = tables.reduce((n, t) => n + t.seats, 0);
  const totalSeated = tables.reduce((n, t) => n + used(t), 0);
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
    <section className="seat" aria-label="Organizza tavoli">
      <div className="seat-top">
        <div className="seat-meter">
          <div className="seat-ring" style={{ "--pct": `${pct}%` } as React.CSSProperties}><span>{pct}%</span></div>
          <div>
            <span className="pp-kicker">Sala</span>
            <strong>{totalSeated} su {totalSeats} posti</strong>
            <small>{tray.length} {tray.length === 1 ? "invitato" : "invitati"} senza posto</small>
          </div>
        </div>
        <form className="seat-add" onSubmit={addTable}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome del tavolo" required maxLength={80} aria-label="Nome del tavolo" />
          <input value={seats} onChange={(e) => setSeats(e.target.value)} type="number" min={1} max={30} aria-label="Posti" />
          <button type="submit" className="btn solid small">Aggiungi tavolo</button>
        </form>
      </div>

      <div className="seat-body">
        <aside className="seat-tray" aria-label="Da sistemare" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const g = guests.find((x) => x.id === (dragId ?? e.dataTransfer.getData("text/plain"))); setDragId(null); if (g) place(g, null); }}>
          <span className="pp-kicker">Da sistemare</span>
          {tray.length === 0 && <p className="hint">Tutti hanno un posto.</p>}
          {tray.map((g) => (
            <div key={g.id} className="seat-chip" draggable onDragStart={(e) => { setDragId(g.id); e.dataTransfer.setData("text/plain", g.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}>
              <span>{g.name}</span>
              {g.party_size > 1 && <small>+{g.party_size - 1}</small>}
              <select defaultValue="" aria-label={`Assegna ${g.name} a un tavolo`} onChange={(e) => { const t = tables.find((x) => x.id === e.target.value); if (t) place(g, t); e.currentTarget.value = ""; }}>
                <option value="">Tavolo…</option>
                {tables.filter((t) => t.seats - used(t) >= g.party_size).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ))}
        </aside>

        <div className="seat-room">
          {tables.length === 0 && <p className="hint seat-empty">Aggiungi i tavoli: poi trascina gli invitati su un tavolo, o usa il menu.</p>}
          <div className="seat-grid">
            {tables.map((t) => {
              const n = used(t);
              const full = n >= t.seats;
              const dots = Array.from({ length: t.seats }, (_, i) => i);
              return (
                <article
                  key={t.id}
                  className={`seat-table${full ? " is-full" : ""}${overId === t.id ? " is-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOverId(t.id); }}
                  onDragLeave={() => setOverId((o) => (o === t.id ? null : o))}
                  onDrop={(e) => onDrop(e, t)}
                >
                  <div className="seat-disc">
                    {dots.map((i) => (
                      <span key={i} className={`seat-dot${i < n ? " is-taken" : ""}`} style={{ "--a": `${(i / t.seats) * 360}deg` } as React.CSSProperties} />
                    ))}
                    <div className="seat-center">
                      <strong>{t.name}</strong>
                      <small>{n} / {t.seats}</small>
                    </div>
                  </div>
                  <ul className="seat-names">
                    {seated(t).map((g) => (
                      <li key={g.id}>
                        <span>{g.name}{g.party_size > 1 ? ` +${g.party_size - 1}` : ""}</span>
                        <button type="button" className="pp-link" aria-label={`Alza ${g.name}`} onClick={() => place(g, null)}>Alza</button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="pp-link seat-del" onClick={() => call("DELETE", `/tables/${t.id}`)}>Elimina tavolo</button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
