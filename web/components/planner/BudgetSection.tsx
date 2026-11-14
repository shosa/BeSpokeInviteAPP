"use client";

import { useMemo, useState } from "react";
import { BUDGET_CATEGORIES } from "@inviteme/shared";
import { Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";

// Budget del planner in quattro viste:
// Voci (spesa prenotata per categoria contro la quota consigliata), Pagamenti (scadenze per mese),
// Contratti (firma, arrivo, referente, mance e buste), Confronta (preventivi per categoria, da prenotare).
// Un preventivo prenotato è il fornitore scelto per quella categoria; i pagamenti si collegano a lui.

export type Quote = { id: string; category: string; name: string; amount_cents: number; rating: number; notes: string; booked: boolean; signed: boolean; arrival: string; contact: string; tip_cents: number; envelope: boolean };
export type Payment = { id: string; category: string; label: string; amount_cents: number; due_date: string | null; paid: boolean; quote_id: string | null };
type Call = (method: "POST" | "PATCH" | "DELETE" | "PUT", path: string, body?: unknown) => Promise<unknown>;
type View = "voci" | "pagamenti" | "contratti" | "confronta";

const CATS = [...BUDGET_CATEGORIES.map((c) => ({ key: c.key as string, label: c.it as string, share: c.share as number })), { key: "altro", label: "Altro", share: 0 }];
const catLabel = (k: string) => CATS.find((c) => c.key === k)?.label ?? "Altro";
const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
const toCents = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) * 100) || 0);
const monthOf = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { month: "long", year: "numeric" }) : "Senza data");
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

function Stars({ value, onChange, label }: { value: number; onChange?: (n: number) => void; label: string }) {
  return (
    <span className="bg-stars" role={onChange ? "radiogroup" : "img"} aria-label={`${label}: ${value} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => onChange ? (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} su 5`} className={n <= value ? "is-on" : ""} onClick={() => onChange(n === value ? 0 : n)}><Star size={15} aria-hidden="true" /></button>
      ) : (
        <Star key={n} size={15} className={n <= value ? "is-on" : ""} aria-hidden="true" />
      ))}
    </span>
  );
}

export function BudgetSection({ quotes, payments, budgetCents, guestQuota, call, act }: { quotes: Quote[]; payments: Payment[]; budgetCents: number; guestQuota: number; call: Call; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [view, setView] = useState<View>("voci");
  const [cat, setCat] = useState<string>(() => quotes.find((q) => !q.booked)?.category ?? CATS[0].key);
  const [editing, setEditing] = useState<string | null>(null);
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState(false);

  const booked = quotes.filter((q) => q.booked);
  const loose = payments.filter((p) => !p.quote_id);
  // Previsto: preventivi prenotati più le voci libere (vecchie righe senza fornitore).
  const planned = booked.reduce((n, q) => n + q.amount_cents, 0) + loose.reduce((n, p) => n + p.amount_cents, 0);
  const paid = payments.filter((p) => p.paid).reduce((n, p) => n + p.amount_cents, 0);
  const due = payments.filter((p) => !p.paid).reduce((n, p) => n + p.amount_cents, 0);
  const pct = budgetCents ? Math.round((planned / budgetCents) * 100) : 0;

  const byCat = useMemo(() => CATS.map((c) => {
    const list = booked.filter((q) => q.category === c.key);
    const extra = loose.filter((p) => p.category === c.label || p.category === c.key);
    return { ...c, names: [...list.map((q) => q.name), ...extra.map((p) => p.label)], total: list.reduce((n, q) => n + q.amount_cents, 0) + extra.reduce((n, p) => n + p.amount_cents, 0), guide: Math.round((budgetCents * c.share) / 100) };
  }).filter((c) => c.key !== "altro" || c.total > 0), [booked, loose, budgetCents]);

  const months = useMemo(() => {
    const sorted = [...payments].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    const groups: { month: string; items: Payment[] }[] = [];
    for (const p of sorted) {
      const m = monthOf(p.due_date);
      const g = groups.find((x) => x.month === m);
      if (g) g.items.push(p); else groups.push({ month: m, items: [p] });
    }
    return groups;
  }, [payments]);
  const quoteName = (id: string | null) => quotes.find((q) => q.id === id)?.name ?? "";
  const paidFor = (q: Quote) => payments.filter((p) => p.quote_id === q.id && p.paid).reduce((n, p) => n + p.amount_cents, 0);
  const tips = booked.filter((q) => q.tip_cents > 0);

  const inCat = quotes.filter((q) => q.category === cat).sort((a, b) => a.amount_cents - b.amount_cents);
  const cheapest = inCat[0];
  // Miglior qualità-prezzo: il voto più alto per euro, solo tra preventivi con voto e se ce n'è più d'uno.
  const bestValue = inCat.length > 1 ? [...inCat].filter((q) => q.rating > 0 && q.amount_cents > 0).sort((a, b) => b.rating / b.amount_cents - a.rating / a.amount_cents)[0] : undefined;

  return (
    <div className="bg">
      <header className="bg-head">
        <div>
          <span className="pp-kicker">Budget</span>
          {editBudget ? (
            <form className="bg-total-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(() => call("PUT", "", { budgetCents: toCents(f.get("total")), guestQuota: Math.max(0, Math.round(Number(f.get("guests")) || 0)) })).then(() => setEditBudget(false)); }}>
              <label><span>Budget totale (€)</span><input name="total" inputMode="decimal" defaultValue={budgetCents ? String(budgetCents / 100) : ""} placeholder="25000" /></label>
              <label><span>Invitati</span><input name="guests" inputMode="numeric" defaultValue={guestQuota || ""} placeholder="120" /></label>
              <button type="submit" className="btn solid small">Salva</button>
              <button type="button" className="pp-link" onClick={() => setEditBudget(false)}>Annulla</button>
            </form>
          ) : (
            <h2 className="bg-total">
              {budgetCents ? euro(budgetCents) : "Imposta il budget"}{guestQuota ? <small> per {guestQuota} invitati</small> : null}
              <button type="button" className="pp-link" onClick={() => setEditBudget(true)}>Modifica</button>
            </h2>
          )}
        </div>
        {budgetCents > 0 && (
          <div className={`bg-gauge${pct > 100 ? " is-over" : ""}`} role="img" aria-label={`Previsto ${pct}% del budget`}>
            <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" /><circle cx="18" cy="18" r="15.5" style={{ strokeDasharray: `${Math.min(100, pct) * 0.974} 100` }} /></svg>
            <strong>{pct}%</strong>
          </div>
        )}
      </header>

      <div className="bg-sum" role="list">
        <div role="listitem"><span>Previsto</span><strong>{euro(planned)}</strong></div>
        <div role="listitem"><span>Pagato</span><strong>{euro(paid)}</strong></div>
        <div role="listitem"><span>Da pagare</span><strong>{euro(due)}</strong></div>
        {budgetCents > 0 && <div role="listitem" className={budgetCents - planned < 0 ? "is-over" : ""}><span>{budgetCents - planned < 0 ? "Oltre il budget" : "Ancora libero"}</span><strong>{euro(Math.abs(budgetCents - planned))}</strong></div>}
      </div>

      <div className="bg-tabs" role="tablist" aria-label="Viste del budget">
        {(["voci", "pagamenti", "contratti", "confronta"] as View[]).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "is-on" : ""} onClick={() => setView(v)}>
            {{ voci: "Voci", pagamenti: "Pagamenti", contratti: "Contratti", confronta: "Confronta" }[v]}
          </button>
        ))}
      </div>

      {view === "voci" && (
        <div className="bg-panel">
          <ul className="bg-cats">
            {byCat.map((c) => {
              const ratio = c.guide ? c.total / c.guide : 0;
              return (
                <li key={c.key}>
                  <button type="button" className="bg-cat" onClick={() => { setCat(c.key); setView("confronta"); }}>
                    <span className="bg-cat-text"><strong>{c.label}</strong><small>{c.names.length ? c.names.join(", ") : "Ancora niente"}</small></span>
                    <span className="bg-cat-num"><strong>{euro(c.total)}</strong>{c.guide > 0 && <small>consigliato {euro(c.guide)}</small>}</span>
                    {c.guide > 0 && <span className={`bg-meter${ratio > 1 ? " is-over" : ""}`} aria-hidden="true"><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint bg-note">{budgetCents ? "La quota consigliata è una ripartizione indicativa del vostro budget: serve a vedere subito quale voce pesa più del previsto." : "Imposta il budget totale per vedere la quota consigliata di ogni voce."} Tocca una voce per confrontare i preventivi.</p>
        </div>
      )}

      {view === "pagamenti" && (
        <div className="bg-panel">
          <form className="bg-add" onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget; const f = new FormData(form);
            const q = booked.find((x) => x.id === f.get("quote"));
            void act(async () => { await call("POST", "/budget", { label: String(f.get("label") || "Acconto"), amount_cents: toCents(f.get("amount")), due_date: String(f.get("due") || "") || null, quote_id: q?.id ?? null, category: q ? catLabel(q.category) : "Altro" }); form.reset(); });
          }}>
            <select name="quote" aria-label="Fornitore" defaultValue="">
              <option value="">Senza fornitore</option>
              {booked.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
            <input name="label" placeholder="Acconto, saldo…" maxLength={120} aria-label="Descrizione" />
            <input name="amount" placeholder="Importo €" inputMode="decimal" required aria-label="Importo" />
            <input name="due" type="date" aria-label="Scadenza" />
            <button type="submit" className="btn solid small"><Plus size={15} aria-hidden="true" />Aggiungi</button>
          </form>
          {months.length === 0 && <p className="hint">Nessun pagamento in calendario. Aggiungi acconti e saldi dei fornitori prenotati.</p>}
          {months.map((g) => (
            <div key={g.month} className="bg-month">
              <div className="bg-month-head"><span>{g.month}</span><strong>{euro(g.items.reduce((n, p) => n + p.amount_cents, 0))}</strong></div>
              <ul className="bg-pays">
                {g.items.map((p) => {
                  const late = !p.paid && p.due_date && p.due_date < today();
                  return (
                    <li key={p.id} className={`${p.paid ? "is-paid" : ""}${late ? " is-late" : ""}`}>
                      <Checkbox className="pp-check" checked={p.paid} onChange={(v) => act(() => call("PATCH", `/budget/${p.id}`, { paid: v }))} ariaLabel={p.paid ? "Pagato" : "Segna come pagato"} />
                      <span className="bg-pay-text"><strong>{quoteName(p.quote_id) || p.label}</strong><small>{[p.due_date ? shortDate(p.due_date) : null, quoteName(p.quote_id) ? p.label : p.category].filter(Boolean).join(" · ")}</small></span>
                      <span className="bg-pay-amt"><strong>{euro(p.amount_cents)}</strong><small>{p.paid ? "Pagato" : late ? "In ritardo" : "Da pagare"}</small></span>
                      <button type="button" className="bg-icon" aria-label="Elimina pagamento" onClick={() => act(() => call("DELETE", `/budget/${p.id}`))}><Trash2 size={15} aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {view === "contratti" && (
        <div className="bg-panel">
          <div className="bg-kpis">
            <div><span>Firmati</span><strong>{booked.filter((q) => q.signed).length}/{booked.length}</strong></div>
            <div><span>Mance</span><strong>{euro(tips.reduce((n, q) => n + q.tip_cents, 0))}</strong></div>
            <div><span>Buste pronte</span><strong>{tips.filter((q) => q.envelope).length}/{tips.length}</strong></div>
          </div>
          {booked.length === 0 && <p className="hint">Nessun fornitore prenotato. Prenotalo dalla vista Confronta.</p>}
          <ul className="bg-vendors">
            {booked.map((q) => (
              <li key={q.id} className={openVendor === q.id ? "is-open" : ""}>
                <div className="bg-vendor-row">
                  <Checkbox className="pp-check" checked={q.signed} onChange={(v) => act(() => call("PATCH", `/quotes/${q.id}`, { signed: v }))} ariaLabel="Contratto firmato" />
                  <button type="button" className="bg-vendor-main" aria-expanded={openVendor === q.id} onClick={() => setOpenVendor(openVendor === q.id ? null : q.id)}>
                    <strong>{q.name}</strong>
                    <small>{[q.signed ? "Firmato" : "Da firmare", catLabel(q.category), q.arrival && `arriva alle ${q.arrival}`, q.contact].filter(Boolean).join(" · ")}</small>
                  </button>
                  <span className="bg-pay-amt"><strong>{euro(q.amount_cents)}</strong><small>{euro(paidFor(q))} pagati</small></span>
                </div>
                {openVendor === q.id && (
                  <form className="bg-vendor-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(() => call("PATCH", `/quotes/${q.id}`, { arrival: String(f.get("arrival") ?? ""), contact: String(f.get("contact") ?? ""), notes: String(f.get("notes") ?? ""), tip_cents: toCents(f.get("tip")) })).then(() => setOpenVendor(null)); }}>
                    <label><span>Ora d&apos;arrivo</span><input name="arrival" defaultValue={q.arrival} placeholder="09:30" maxLength={40} /></label>
                    <label><span>Referente</span><input name="contact" defaultValue={q.contact} placeholder="Nome e telefono" maxLength={120} /></label>
                    <label><span>Mancia (€)</span><input name="tip" defaultValue={q.tip_cents ? String(q.tip_cents / 100) : ""} inputMode="decimal" placeholder="0" /></label>
                    <label className="is-wide"><span>Cosa include, ore extra, cancellazione</span><textarea name="notes" defaultValue={q.notes} rows={3} maxLength={400} /></label>
                    <div className="bg-form-actions"><button type="submit" className="btn solid small">Salva</button><button type="button" className="pp-link" onClick={() => setOpenVendor(null)}>Chiudi</button></div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {tips.length > 0 && (
            <div className="bg-tips">
              <div className="bg-month-head"><span>Mance del giorno</span><strong>{euro(tips.reduce((n, q) => n + q.tip_cents, 0))}</strong></div>
              <ul className="bg-pays">
                {tips.map((q) => (
                  <li key={q.id} className={q.envelope ? "is-paid" : ""}>
                    <Checkbox className="pp-check" checked={q.envelope} onChange={(v) => act(() => call("PATCH", `/quotes/${q.id}`, { envelope: v }))} ariaLabel="Busta pronta" />
                    <span className="bg-pay-text"><strong>{q.name}</strong><small>{q.envelope ? "Busta pronta" : "Prepara la busta"}</small></span>
                    <span className="bg-pay-amt"><strong>{euro(q.tip_cents)}</strong></span>
                  </li>
                ))}
              </ul>
              <p className="hint bg-note">Affidate le buste a una persona di fiducia, che le consegni a fine festa.</p>
            </div>
          )}
        </div>
      )}

      {view === "confronta" && (
        <div className="bg-panel">
          <div className="bg-chips" role="tablist" aria-label="Categorie">
            {CATS.map((c) => {
              const n = quotes.filter((q) => q.category === c.key).length;
              return (
                <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} className={cat === c.key ? "is-on" : ""} onClick={() => { setCat(c.key); setEditing(null); }}>
                  {c.label}{n ? <span>{n}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="bg-quotes">
            {inCat.map((q) => (
              <article key={q.id} className={`bg-quote${q.booked ? " is-booked" : ""}${bestValue?.id === q.id ? " is-best" : ""}`}>
                {editing === q.id ? (
                  <form className="bg-quote-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act(() => call("PATCH", `/quotes/${q.id}`, { name: String(f.get("name")), amount_cents: toCents(f.get("amount")), notes: String(f.get("notes") ?? "") })).then(() => setEditing(null)); }}>
                    <input name="name" defaultValue={q.name} required maxLength={120} aria-label="Fornitore" />
                    <input name="amount" defaultValue={String(q.amount_cents / 100)} inputMode="decimal" aria-label="Prezzo" />
                    <textarea name="notes" defaultValue={q.notes} rows={3} maxLength={400} aria-label="Note" />
                    <div className="bg-form-actions">
                      <button type="submit" className="btn solid small">Salva</button>
                      <button type="button" className="pp-link" onClick={() => setEditing(null)}>Annulla</button>
                      <button type="button" className="bg-icon" aria-label="Elimina preventivo" onClick={() => { if (window.confirm(`Eliminare il preventivo di ${q.name}?`)) void act(() => call("DELETE", `/quotes/${q.id}`)); }}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="bg-quote-top">
                      <strong>{q.name}</strong>
                      {q.booked ? <span className="bg-tag is-booked"><Check size={12} aria-hidden="true" />Prenotato</span> : bestValue?.id === q.id ? <span className="bg-tag">Miglior qualità-prezzo</span> : null}
                    </div>
                    <span className="bg-quote-price">{euro(q.amount_cents)}</span>
                    <Stars value={q.rating} label="Voto" onChange={(n) => act(() => call("PATCH", `/quotes/${q.id}`, { rating: n }))} />
                    {q.notes && <p className="bg-quote-notes">{q.notes}</p>}
                    <small className="bg-quote-delta">{cheapest && q.id === cheapest.id ? (inCat.length > 1 ? "Il più economico" : "Unico preventivo") : cheapest ? `+${euro(q.amount_cents - cheapest.amount_cents)} rispetto al più economico` : ""}</small>
                    <div className="bg-quote-actions">
                      <button type="button" className="btn outline small" onClick={() => setEditing(q.id)}><Pencil size={14} aria-hidden="true" />Modifica</button>
                      <button type="button" className={`btn small ${q.booked ? "outline" : "solid"}`} title={q.booked ? "Annulla la prenotazione" : undefined} onClick={() => act(() => call("PATCH", `/quotes/${q.id}`, { booked: !q.booked }))}>{q.booked ? "Annulla" : "Prenota"}</button>
                    </div>
                  </>
                )}
              </article>
            ))}
            <form className="bg-quote bg-quote-new" onSubmit={(e) => {
              e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
              void act(async () => { await call("POST", "/quotes", { category: cat, name: String(f.get("name")), amount_cents: toCents(f.get("amount")), notes: String(f.get("notes") ?? "") }); form.reset(); });
            }}>
              <span className="bg-quote-new-title"><Plus size={16} aria-hidden="true" />Nuovo preventivo · {catLabel(cat)}</span>
              <input name="name" placeholder="Fornitore" required maxLength={120} aria-label="Fornitore" />
              <input name="amount" placeholder="Prezzo €" inputMode="decimal" required aria-label="Prezzo" />
              <textarea name="notes" placeholder="Cosa include, condizioni…" rows={2} maxLength={400} aria-label="Note" />
              <button type="submit" className="btn solid small">Aggiungi</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
