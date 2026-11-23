"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Catalog, TemplateCategory } from "@inviteme/shared";
import { LibraryIcon, PlannerIconPicker } from "./planner/PlannerIcon";
import { Fold } from "./admin/Fold";
import { Switch } from "./ui/Switch";
import { useLang } from "@/lib/lang";
import { themeCopy } from "@/lib/catalogCopy";

// Template: cartelle in themes/<id>/. Qui si attivano o disattivano, si caricano da ZIP e si eliminano.
// Ogni template è mostrato come nel carosello del cliente: la busta chiusa (immagine statica) dentro un telefono.
// L'invito completo si apre con «Apri anteprima».
// Un tema caricato nasce disattivato: si controlla con l'anteprima e poi si attiva.
type UploadError = { error?: string; details?: string[]; code?: string };

export function ThemesAdmin({ catalog, onChanged }: { catalog: Catalog; onChanged: () => void }) {
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ title: string; details: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [view, setView] = useState<"tutti" | "scelti" | "mai" | "off" | "premium">("tutti");
  const [cat, setCat] = useState<string>(""); // filtro per categoria: "" tutte, "-" senza categoria
  useEffect(() => {
    fetch("/api/admin/themes/usage").then((r) => (r.ok ? r.json() : {})).then(setUsage).catch(() => setUsage({}));
  }, [catalog]);
  // Ordine: i più usati in alto; i disattivati (spesso appena caricati) in cima nella loro vista.
  const shown = useMemo(() => {
    const list = [...catalog.themes].sort((a, b) => (usage[b.manifest.id] ?? 0) - (usage[a.manifest.id] ?? 0));
    const byCat = cat === "-" ? list.filter((x) => x.categories.length === 0) : cat ? list.filter((x) => x.categories.includes(cat)) : list;
    if (view === "scelti") return byCat.filter((x) => (usage[x.manifest.id] ?? 0) > 0);
    if (view === "mai") return byCat.filter((x) => !usage[x.manifest.id]);
    if (view === "off") return byCat.filter((x) => !x.enabled);
    if (view === "premium") return byCat.filter((x) => x.premium);
    return byCat;
  }, [catalog, usage, view, cat]);
  const never = catalog.themes.filter((x) => !usage[x.manifest.id]).length;
  const off = catalog.themes.filter((x) => !x.enabled).length;
  const premiumCount = catalog.themes.filter((x) => x.premium).length;

  // Premium: escluso dall'invito base (il cliente lo vede con il lucchetto).
  async function setPremium(id: string, premium: boolean) {
    const res = await fetch(`/api/admin/themes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ premium }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast.error(data.error ?? t("Modifica non riuscita", "Change failed"));
    onChanged();
  }

  // Aggiunge o toglie una categoria a un template.
  async function toggleCategory(id: string, current: string[], key: string) {
    const categories = current.includes(key) ? current.filter((x) => x !== key) : [...current, key];
    const res = await fetch(`/api/admin/themes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories }) });
    if (!res.ok) return toast.error(t("Categoria non salvata", "Category not saved"));
    onChanged();
  }

  async function setEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/admin/themes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast.error(data.error ?? t("Modifica non riuscita", "Change failed"));
    onChanged();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(t(`Eliminare il template «${name}»? La cartella themes/${id} viene cancellata dal server.`, `Delete the «${name}» template? The themes/${id} folder is removed from the server.`))) return;
    const res = await fetch(`/api/admin/themes/${id}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toast.error(data.error ?? t("Eliminazione non riuscita", "Delete failed"));
    toast.success(t(`Template «${name}» eliminato`, `Template «${name}» deleted`));
    onChanged();
  }

  async function upload(file: File, replace = false) {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/themes/upload${replace ? "?replace=1" : ""}`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as UploadError & { id?: string; name?: string; replaced?: boolean; warnings?: string[] };
      if (res.status === 409 && data.code === "exists") {
        setBusy(false);
        if (window.confirm(`${data.error}. ${t("Vuoi sostituirlo con questo ZIP? Gli inviti che lo usano vedranno subito la versione nuova.", "Replace it with this ZIP? Invitations using it will see the new version straight away.")}`)) return upload(file, true);
        return;
      }
      if (!res.ok) {
        setProblem({ title: data.error ?? t("Caricamento non riuscito", "Upload failed"), details: data.details ?? [] });
        return;
      }
      setNotice(
        data.replaced
          ? t(`Template «${data.name}» sostituito.`, `Template «${data.name}» replaced.`)
          : t(`Template «${data.name}» caricato. È disattivato: controlla l'anteprima e poi attivalo.`, `Template «${data.name}» uploaded. It's disabled: check the preview, then enable it.`),
      );
      if (data.warnings?.length) setProblem({ title: t("Caricato, con qualche avviso", "Uploaded, with some warnings"), details: data.warnings });
      onChanged();
    } catch {
      setProblem({ title: t("Caricamento non riuscito: controlla la connessione e riprova", "Upload failed: check your connection and try again"), details: [] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <Fold className="tpl-upload-fold" title={t("Carica un template", "Upload a template")} summary="ZIP">
      <section className="tpl-upload">
        <div>
          <p className="hint">{t("Uno ZIP con la cartella del tema: theme.json, theme.css, assets/ e, se servono, blocks/. Il tema viene controllato prima di essere installato in themes/. Formato: docs/TEMI.md, «Esportare lo stile per la console».", "A ZIP with the style folder: theme.json, theme.css, assets/ and, if needed, blocks/. The style is checked before being installed in themes/. Format: docs/TEMI.md, «Esportare lo stile per la console».")}</p>
        </div>
        <label className={`btn solid${busy ? " is-busy" : ""}`} aria-disabled={busy}>
          {busy ? t("Controllo e installo…", "Checking and installing…") : t("Scegli lo ZIP", "Choose the ZIP")}
          <input ref={input} type="file" accept=".zip,application/zip" disabled={busy} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {problem && (
          <div className="tpl-upload-errors" role="alert">
            <strong>{problem.title}</strong>
            {problem.details.length > 0 && <ul>{problem.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
      </section>
      </Fold>

      <CategoryManager categories={catalog.categories} counts={Object.fromEntries(catalog.categories.map((c) => [c.id, catalog.themes.filter((x) => x.categories.includes(c.id)).length]))} onSaved={onChanged} />

      <div className="tpl-filters tpl-cat-filter" role="group" aria-label={t("Categoria", "Category")}>
        {[{ id: "", label: t("Tutte le categorie", "All categories"), icon: null as string | null }, ...catalog.categories.map((c) => ({ id: c.id, label: lang === "en" ? c.nameEn : c.name, icon: c.icon as string | null })), { id: "-", label: t("Senza categoria", "No category"), icon: null }].map((c) => (
          <button key={c.id || "all"} type="button" className={cat === c.id ? "is-on" : ""} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.icon && <LibraryIcon icon={c.icon} size={15} />}{c.label}
            <b>{c.id === "" ? catalog.themes.length : c.id === "-" ? catalog.themes.filter((x) => x.categories.length === 0).length : catalog.themes.filter((x) => x.categories.includes(c.id)).length}</b>
          </button>
        ))}
      </div>

      <div className="tpl-filters" role="group" aria-label={t("Filtri", "Filters")}>
        {([["tutti", t("Tutti", "All"), catalog.themes.length], ["scelti", t("Scelti dai clienti", "Chosen by customers"), catalog.themes.length - never], ["mai", t("Mai scelti", "Never chosen"), never], ["off", t("Disattivati", "Disabled"), off], ["premium", "Premium", premiumCount]] as const).map(([v, label, n]) => (
          <button key={v} type="button" className={view === v ? "is-on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{label}<b>{n}</b></button>
        ))}
      </div>

      <div className="tpl-admin-grid">
        {shown.map((th) => {
          const m = th.manifest;
          return (
            <article key={m.id} className={`tpl-admin-card${th.enabled ? "" : " is-off"}`}>
              <div className="tpl-phone">
                <div className="tpl-screen" style={{ background: m.themeColor }}>
                  {m.envelope?.poster && <img src={`/api/themes/${encodeURIComponent(m.id)}/cover.jpg`} alt="" width={480} height={853} loading="lazy" decoding="async" draggable={false} />}
                </div>
              </div>
              <h3>{themeCopy(m, lang)}</h3>
              <small className="hint">{lang === "en" ? m.name : m.nameEn} · {(() => { const n = usage[m.id] ?? 0; return n === 0 ? t("mai scelto", "never chosen") : t(`${n} ${n === 1 ? "invito" : "inviti"}`, `${n} ${n === 1 ? "invitation" : "invitations"}`); })()}</small>
              <div className="tpl-tags"><span>IT · EN</span>{m.envelope && <span>{t("Busta-video", "Video envelope")}</span>}{m.backgroundVideo && <span>{t("Video di sfondo", "Background video")}</span>}{!th.enabled && <span className="is-off">{t("Disattivato", "Disabled")}</span>}</div>
              {/* Categorie del template: un tocco aggiunge o toglie. */}
              <details className="tpl-cats-wrap">
              <summary>{t("Categorie", "Categories")}: {th.categories.length ? catalog.categories.filter((c) => th.categories.includes(c.id)).map((c) => (lang === "en" ? c.nameEn : c.name)).join(", ") : t("nessuna", "none")}</summary>
              <div className="tpl-cats" role="group" aria-label={t("Categorie", "Categories")}>
                {catalog.categories.map((c) => {
                  const on = th.categories.includes(c.id);
                  return (
                    <button key={c.id} type="button" className={`tpl-cat${on ? " is-on" : ""}`} aria-pressed={on} title={lang === "en" ? c.nameEn : c.name} onClick={() => toggleCategory(m.id, th.categories, c.id)}>
                      <LibraryIcon icon={c.icon} size={14} /><span>{lang === "en" ? c.nameEn : c.name}</span>
                    </button>
                  );
                })}
              </div>
              </details>
              <a className="btn outline small" href={`/api/themes/${m.id}/anteprima`} target="_blank" rel="noreferrer">{t("Apri anteprima", "Open preview")}</a>
              <Switch checked={th.enabled} onChange={(v) => setEnabled(m.id, v)} label={th.enabled ? t("Attivo", "Active") : t("Disattivato", "Disabled")} />
              {/* Interruttore fisso «Premium»: acceso = escluso dall'invito base. */}
              <Switch checked={th.premium} onChange={(v) => setPremium(m.id, v)} label="Premium" ariaLabel={t("Template Premium: escluso dall'invito base", "Premium template: not in the basic invitation")} />
              <button type="button" className="link tpl-admin-del" onClick={() => remove(m.id, themeCopy(m, lang))}>{t("Elimina", "Delete")}</button>
            </article>
          );
        })}
      </div>
    </>
  );
}

// Categorie dei template: nome in italiano e in inglese, icona dalla libreria, ordine. Si salva tutto insieme.
type Draft = TemplateCategory & { key: string };
function CategoryManager({ categories, counts, onSaved }: { categories: TemplateCategory[]; counts: Record<string, number>; onSaved: () => void }) {
  const lang = useLang();
  const t = (it: string, en: string) => (lang === "en" ? en : it);
  const fresh = () => categories.map((c) => ({ ...c, key: c.id }));
  const [rows, setRows] = useState<Draft[]>(fresh);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(fresh()), [categories]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(rows.map(({ key: _k, ...r }) => r)) !== JSON.stringify(categories);
  const set = (key: string, patch: Partial<Draft>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => setRows((list) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return list; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    if (rows.some((r) => !r.name.trim())) return toast.error(t("Ogni categoria ha bisogno di un nome", "Every category needs a name"));
    setBusy(true);
    const res = await fetch("/api/admin/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: rows.map(({ key: _k, ...r }) => r) }) });
    setBusy(false);
    if (!res.ok) return toast.error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("Categorie non salvate", "Categories not saved"));
    toast.success(t("Categorie salvate", "Categories saved"));
    setIconFor(null);
    setOpen(false);
    onSaved();
  }

  const [open, setOpen] = useState(false);
  const closeEditor = () => { if (dirty && !window.confirm(t("Chiudere senza salvare le modifiche?", "Close without saving the changes?"))) return; setRows(fresh()); setIconFor(null); setOpen(false); };

  // Nella pagina: una riga compatta con le categorie; l'editor completo si apre in una finestra.
  if (!open) return (
    <section className="tpl-catbar" aria-label={t("Categorie", "Categories")}>
      <span className="tpl-catbar-k">{t("Categorie", "Categories")}</span>
      <div className="tpl-catbar-list">
        {categories.map((c) => <span key={c.id} className="tpl-catbar-chip"><LibraryIcon icon={c.icon} size={15} />{lang === "en" ? c.nameEn : c.name}<b>{counts[c.id] ?? 0}</b></span>)}
        {categories.length === 0 && <span className="hint">{t("Nessuna categoria", "No categories")}</span>}
      </div>
      <button type="button" className="btn outline small" onClick={() => setOpen(true)}>{t("Modifica categorie", "Edit categories")}</button>
    </section>
  );

  return (
    <div className="demo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditor(); }}>
    <section className="demo-modal tpl-catman" role="dialog" aria-modal="true" aria-labelledby="tpl-catman-t">
      <div className="tpl-catman-head">
        <div>
          <h3 id="tpl-catman-t">{t("Categorie", "Categories")}</h3>
          <p className="hint">{t("Guidano la scelta del template per i clienti. Ogni template può stare in più categorie: si assegnano dalle schede dei template.", "They guide customers when choosing a template. A template can be in several categories: assign them from the template cards.")}</p>
        </div>
        <button type="button" className="demo-close" aria-label={t("Chiudi", "Close")} onClick={closeEditor}>×</button>
      </div>
      <div className="tpl-catman-acts">
          <button type="button" className="btn outline small" onClick={() => { const key = `new-${Date.now()}`; setRows((l) => [...l, { key, id: "", name: "", nameEn: "", icon: "sparkles" }]); setIconFor(key); }}>{t("Aggiungi categoria", "Add category")}</button>
          <button type="button" className="btn solid small" disabled={!dirty || busy} onClick={save}>{busy ? t("Salvo…", "Saving…") : t("Salva categorie", "Save categories")}</button>
        </div>
      <ul className="tpl-catman-list">
        {rows.map((r, i) => (
          <li key={r.key} className="tpl-catman-row">
            <div className="tpl-catman-main">
              <button type="button" className={`tpl-catman-ico${iconFor === r.key ? " is-on" : ""}`} onClick={() => setIconFor(iconFor === r.key ? null : r.key)} aria-label={t("Cambia icona", "Change icon")} title={t("Cambia icona", "Change icon")}><LibraryIcon icon={r.icon} size={20} /></button>
              <input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder={t("Nome (italiano)", "Name (Italian)")} maxLength={40} aria-label={t("Nome in italiano", "Italian name")} />
              <input value={r.nameEn} onChange={(e) => set(r.key, { nameEn: e.target.value })} placeholder={t("Nome (inglese)", "Name (English)")} maxLength={40} aria-label={t("Nome in inglese", "English name")} />
              <span className="tpl-catman-n">{r.id ? t(`${counts[r.id] ?? 0} template`, `${counts[r.id] ?? 0} templates`) : t("nuova", "new")}</span>
              <div className="tpl-catman-order">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Sposta su", "Move up")}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t("Sposta giù", "Move down")}>↓</button>
              </div>
              <button type="button" className="link tpl-catman-del" onClick={() => { if (!r.id || window.confirm(t(`Eliminare la categoria «${r.name}»? I template restano, perdono solo questa categoria.`, `Delete the category «${r.nameEn || r.name}»? Templates stay, they only lose this category.`))) setRows((l) => l.filter((x) => x.key !== r.key)); }}>{t("Elimina", "Delete")}</button>
            </div>
            {iconFor === r.key && <PlannerIconPicker value={r.icon} lang={lang === "en" ? "en" : "it"} label={t("Icona della categoria", "Category icon")} onChange={(icon) => set(r.key, { icon })} />}
          </li>
        ))}
        {rows.length === 0 && <li className="hint">{t("Nessuna categoria: i clienti vedono tutti i template insieme.", "No categories: customers see all templates together.")}</li>}
      </ul>
      {dirty && <p className="hint tpl-catman-dirty">{t("Modifiche non salvate", "Unsaved changes")}</p>}
    </section>
    </div>
  );
}
