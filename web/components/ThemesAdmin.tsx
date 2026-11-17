"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Catalog } from "@inviteme/shared";
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
  useEffect(() => {
    fetch("/api/admin/themes/usage").then((r) => (r.ok ? r.json() : {})).then(setUsage).catch(() => setUsage({}));
  }, [catalog]);
  // Ordine: i più usati in alto; i disattivati (spesso appena caricati) in cima nella loro vista.
  const shown = useMemo(() => {
    const list = [...catalog.themes].sort((a, b) => (usage[b.manifest.id] ?? 0) - (usage[a.manifest.id] ?? 0));
    if (view === "scelti") return list.filter((x) => (usage[x.manifest.id] ?? 0) > 0);
    if (view === "mai") return list.filter((x) => !usage[x.manifest.id]);
    if (view === "off") return list.filter((x) => !x.enabled);
    if (view === "premium") return list.filter((x) => x.premium);
    return list;
  }, [catalog, usage, view]);
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
      <section className="tpl-upload">
        <div>
          <h3>{t("Carica un template", "Upload a template")}</h3>
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
              <a className="btn outline small" href={`/api/themes/${m.id}/anteprima`} target="_blank" rel="noreferrer">{t("Apri anteprima", "Open preview")}</a>
              <Switch checked={th.enabled} onChange={(v) => setEnabled(m.id, v)} label={th.enabled ? t("Attivo", "Active") : t("Disattivato", "Disabled")} />
              <Switch checked={th.premium} onChange={(v) => setPremium(m.id, v)} label={th.premium ? t("Premium (escluso dall'invito base)", "Premium (not in the basic invitation)") : t("Incluso nell'invito base", "Included in the basic invitation")} />
              <button type="button" className="link tpl-admin-del" onClick={() => remove(m.id, themeCopy(m, lang))}>{t("Elimina", "Delete")}</button>
            </article>
          );
        })}
      </div>
    </>
  );
}
