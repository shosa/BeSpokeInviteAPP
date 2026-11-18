"use client";

import { useRef, useState } from "react";
import type { Ctx, Guest, Task } from "./YesPlanner";
import { IcCamera, IcClose, IcPhone } from "./icons";

// Finestre del planner: dal basso sul telefono, al centro sul computer. Si chiudono con Esc o toccando fuori.

function Sheet({ title, onClose, children, action }: { title: string; onClose: () => void; children: React.ReactNode; action?: React.ReactNode }) {
  const closeLabel = typeof document !== "undefined" && document.documentElement.lang === "en" ? "Close" : "Chiudi";
  return (
    <>
      <div className="y-dim" onClick={onClose} />
      <div className="y-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="y-sheet-h">
          <button type="button" className="y-nbtn" aria-label={closeLabel} onClick={onClose} style={{ justifySelf: "start" }}><IcClose /></button>
          <h2>{title}</h2>
          <div>{action}</div>
        </div>
        <div className="y-sheet-b">{children}</div>
      </div>
    </>
  );
}

export function GuestSheet({ ctx, guest, onClose }: { ctx: Ctx; guest?: Guest; onClose: () => void }) {
  const { t, data } = ctx;
  const [g, setG] = useState({ name: guest?.name ?? "", group_name: guest?.group_name ?? "", party_size: guest?.party_size ?? 1, response: guest?.response ?? "pending", table_id: guest?.table_id ?? null } as Omit<Guest, "id">);
  const groups = [...new Set(data.guests.map((x) => x.group_name).filter(Boolean))];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!g.name.trim()) return;
    const body = { ...g, name: g.name.trim(), party_size: Math.max(1, Math.min(20, Number(g.party_size) || 1)) };
    await ctx.act(() => (guest ? ctx.call("PATCH", `/guests/${guest.id}`, body) : ctx.call("POST", "/guests", body)));
    ctx.toast(guest ? t("Salvato", "Saved") : t("Invitato aggiunto", "Guest added"));
    onClose();
  }
  return (
    <Sheet title={guest ? guest.name : t("Nuovo invitato", "New guest")} onClose={onClose}>
      <form className="y-form" onSubmit={save}>
        <label className="y-field">{t("Nome o famiglia", "Name or family")}<input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} required maxLength={120} autoFocus={!guest} /></label>
        <div className="y-form-row">
          <label className="y-field">{t("Gruppo", "Group")}<input value={g.group_name} onChange={(e) => setG({ ...g, group_name: e.target.value })} maxLength={80} list="y-groups" placeholder={t("Famiglia della sposa", "Bride's family")} /></label>
          <label className="y-field">{t("Persone", "People")}<input type="number" min={1} max={20} value={g.party_size} onChange={(e) => setG({ ...g, party_size: Number(e.target.value) })} /></label>
        </div>
        <datalist id="y-groups">{groups.map((x) => <option key={x} value={x} />)}</datalist>
        <div className="y-field">{t("Risposta", "Reply")}
          <div className="y-seg" role="radiogroup" style={{ "--n": 3 } as React.CSSProperties}>
            <span className="y-seg-thumb" aria-hidden="true" style={{ "--i": g.response === "yes" ? 0 : g.response === "pending" ? 1 : 2 } as React.CSSProperties} />
            {(["yes", "pending", "no"] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={g.response === r} aria-selected={g.response === r} onClick={() => setG({ ...g, response: r })}>
                {r === "yes" ? t("Viene", "Attending") : r === "pending" ? t("In attesa", "No reply") : t("Non viene", "Not attending")}
              </button>
            ))}
          </div>
        </div>
        {data.tables.length > 0 && (
          <label className="y-field">{t("Tavolo", "Table")}
            <select value={g.table_id ?? ""} onChange={(e) => setG({ ...g, table_id: e.target.value || null })}>
              <option value="">{t("Nessun tavolo", "No table")}</option>
              {data.tables.map((tb) => <option key={tb.id} value={tb.id}>{tb.name}</option>)}
            </select>
          </label>
        )}
        <button className="y-btn y-btn-fill y-btn-block" type="submit">{guest ? t("Salva", "Save") : t("Aggiungi invitato", "Add guest")}</button>
        {guest && <button className="y-btn y-btn-danger y-btn-block" type="button" onClick={async () => { await ctx.act(() => ctx.call("DELETE", `/guests/${guest.id}`)); onClose(); }}>{t("Elimina invitato", "Delete guest")}</button>}
      </form>
    </Sheet>
  );
}

export function TaskSheet({ ctx, task, onClose }: { ctx: Ctx; task?: Task; onClose: () => void }) {
  const { t } = ctx;
  const [title, setTitle] = useState(task?.title ?? "");
  const [days, setDays] = useState(String(task?.days_before ?? 30));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const body = { title: title.trim(), days_before: Math.max(0, Math.min(1000, Math.round(Number(days) || 0))) };
    await ctx.act(() => (task ? ctx.call("PATCH", `/tasks/${task.id}`, body) : ctx.call("POST", "/tasks", body)));
    ctx.toast(task ? t("Salvato", "Saved") : t("Attività aggiunta", "Task added"));
    onClose();
  }
  return (
    <Sheet title={task ? t("Attività", "Task") : t("Nuova attività", "New task")} onClose={onClose}>
      <form className="y-form" onSubmit={save}>
        <label className="y-field">{t("Cosa c'è da fare", "What needs doing")}<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} autoFocus={!task} /></label>
        <label className="y-field">{ctx.ev.daysBefore}<input type="number" min={0} max={1000} value={days} onChange={(e) => setDays(e.target.value)} /></label>
        {task && (
          <button className="y-btn y-btn-tinted y-btn-block" type="button" onClick={async () => { await ctx.act(() => ctx.call("PATCH", `/tasks/${task.id}`, { done: !task.done })); onClose(); }}>
            {task.done ? t("Segna come da fare", "Mark as not done") : t("Segna come fatta", "Mark as done")}
          </button>
        )}
        <button className="y-btn y-btn-fill y-btn-block" type="submit">{task ? t("Salva", "Save") : t("Aggiungi attività", "Add task")}</button>
        {task && <button className="y-btn y-btn-danger y-btn-block" type="button" onClick={async () => { await ctx.act(() => ctx.call("DELETE", `/tasks/${task.id}`)); onClose(); }}>{t("Elimina attività", "Delete task")}</button>}
      </form>
    </Sheet>
  );
}

type Row = { time?: string; item?: string; name?: string; role?: string; phone?: string };

// Il giorno del sì: cosa succede adesso, cosa viene dopo (dal programma della cartella) e chi chiamare.
export function DaySheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { t, data } = ctx;
  const rows = (key: string) => (((data.docs[key] as { items?: Row[] } | undefined)?.items ?? []) as Row[]);
  const plan = rows("programma-generale").filter((r) => r.time || r.item).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const people = rows("chi-chiamare").filter((r) => r.name || r.phone);
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let cur = -1;
  plan.forEach((r, i) => { if ((r.time ?? "") <= hm) cur = i; });
  const current = plan[cur] ?? plan[0];
  const after = plan.slice(cur + 1, cur + 4);
  return (
    <Sheet title={ctx.ev.bigDay} onClose={onClose}>
      <p className="y-gf" style={{ padding: 0 }}>{t(`Così sarà il planner ${ctx.ev.onTheDay}. Le voci vengono dal programma e da «Chi chiamare» nella cartella.`, `This is how the planner looks ${ctx.ev.onTheDay}. It uses the schedule and «Who to call» from the binder.`)}</p>
      <div className="y-day">
        <section className="y-day-now">
          <p className="y-eyebrow">{t("Adesso", "Now")}{current?.time ? ` · ${current.time}` : ""}</p>
          <p className="y-heading">{current?.item || t("Compila il programma generale nella cartella", "Fill in the overall schedule in the binder")}</p>
        </section>
        {after.length > 0 && (
          <section className="y-grp">
            <h3 className="y-gh">{t("Dopo", "Next")}</h3>
            <div className="y-gl">{after.map((r, i) => <div key={i} className="y-row"><span className="y-r-v tn" style={{ minWidth: 48 }}>{r.time}</span><span className="y-r-m"><span className="y-r-t y-wrap">{r.item}</span></span></div>)}</div>
          </section>
        )}
        <section className="y-grp">
          <h3 className="y-gh">{t("Chi chiamare", "Who to call")}</h3>
          <div className="y-gl">
            {people.map((p, i) => (
              <a key={i} className="y-row" href={p.phone ? `tel:${p.phone.replace(/\s+/g, "")}` : undefined}>
                <span className="y-r-m"><span className="y-r-t">{p.name}</span><span className="y-r-s">{[p.role, p.phone].filter(Boolean).join(" · ")}</span></span>
                {p.phone && <span className="y-ri"><IcPhone /></span>}
              </a>
            ))}
            {people.length === 0 && <p className="y-row y-cap">{t("Aggiungi i numeri utili in «Chi chiamare» nella cartella.", "Add useful numbers in «Who to call» in the binder.")}</p>}
          </div>
        </section>
        <button className="y-btn y-btn-tinted y-btn-block" type="button" onClick={() => { onClose(); ctx.go("binder"); }}>{t("Apri la cartella", "Open the binder")}</button>
      </div>
    </Sheet>
  );
}

export function PhotoSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { t, data, demo, id } = ctx;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = data.bannerImage || data.archImage;
  async function upload(file: File) {
    if (demo) { ctx.toast(t("Nella demo la foto non si salva.", "The demo doesn't save photos.")); return; }
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    await ctx.act(async () => {
      const res = await fetch(`/api/planners/${id}/image/banner`, { method: "POST", body });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(out.error ?? t("Caricamento non riuscito", "Upload failed")); throw new Error("upload"); }
    });
    setBusy(false);
  }
  async function reset() {
    if (demo) return;
    setBusy(true);
    await ctx.act(async () => { await fetch(`/api/planners/${id}/image/banner`, { method: "DELETE" }); });
    setBusy(false);
  }
  return (
    <Sheet title={t("Foto di copertina", "Cover photo")} onClose={onClose}>
      <div className="y-hero" style={{ height: 200, minHeight: 200, order: 0 }}>
        {current ? <img src={current} alt="" /> : <img src="/planner/cover.svg" alt="" />}
        <div className="y-hero-in"><p className="y-hero-n" style={{ fontSize: 24 }}>{data.event.venue || data.event.title}</p></div>
      </div>
      <p className="y-gf" style={{ padding: 0 }}>{t("Meglio una foto orizzontale: la location, voi due, un dettaglio che vi piace.", "A landscape photo works best: the venue, the two of you, a detail you love.")}</p>
      <button className="y-btn y-btn-fill y-btn-block" type="button" disabled={busy} onClick={() => input.current?.click()}><IcCamera />{busy ? t("Caricamento…", "Uploading…") : current ? t("Cambia foto", "Change photo") : t("Scegli una foto", "Choose a photo")}</button>
      {data.bannerImage && <button className="y-btn y-btn-gray y-btn-block" type="button" disabled={busy} onClick={reset}>{t("Togli la foto", "Remove the photo")}</button>}
      {error && <p className="y-error" role="alert">{error}</p>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
    </Sheet>
  );
}
