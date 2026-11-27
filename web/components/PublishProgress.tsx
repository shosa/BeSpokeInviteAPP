"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { LOCALE_INFO, type Locale } from "@inviteme/shared";
import { Flag } from "@/components/ui/Flag";

// Pubblicazione con le fasi in lista. La richiesta è una sola (confirm-edit): il server traduce davvero con BeSpoke AI
// nelle lingue in più e poi pubblica. Le fasi prima e dopo accompagnano l'attesa; quelle della traduzione restano
// in corso finché il server non risponde, e una lingua non riuscita si vede con il suo avviso.
type Result = { ok: true; translated: Locale[]; failed: Locale[] } | { ok: false; error: string; code?: string };
type Step = { key: string; label: string; locale?: Locale };

export function PublishProgress({ id, body, extraLocales, lang, onDone, onError }: {
  id: string;
  body: Record<string, unknown>;
  extraLocales: Locale[];
  lang: "it" | "en";
  onDone: () => void;
  onError: (error: string, code?: string) => void;
}) {
  const en = lang === "en";
  const t = (it: string, e: string) => (en ? e : it);
  const steps: Step[] = [
    { key: "save", label: t("Salvo le ultime modifiche", "Saving your latest changes") },
    { key: "check", label: t("Controllo testi, foto e sezioni", "Checking texts, photos and sections") },
    ...extraLocales.map((l) => ({ key: `tr-${l}`, locale: l, label: t(`Traduco in ${LOCALE_INFO[l].it.toLowerCase()} con BeSpoke AI`, `Translating into ${LOCALE_INFO[l].en} with BeSpoke AI`) })),
    { key: "page", label: t("Preparo la pagina per gli ospiti", "Preparing the page for your guests") },
    { key: "link", label: t("Pubblico il link", "Publishing the link") },
  ];
  const firstAfter = 2 + extraLocales.length; // indice della prima fase dopo le traduzioni
  const [active, setActive] = useState(0);
  const [failedNow, setFailedNow] = useState<Locale[]>([]);
  const [finished, setFinished] = useState(false);

  // Una sola sequenza: la richiesta vera parte subito; le prime fasi scorrono, quelle della traduzione aspettano
  // la risposta del server (l'ultima non si chiude prima), poi le ultime si completano in fretta.
  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let res: Result | null = null;
    const req: Promise<Result> = fetch(`/api/invitations/${id}/confirm-edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r): Promise<Result> => {
        const data = (await r.json().catch(() => ({}))) as { error?: string; code?: string; translated?: Locale[]; failed?: Locale[] };
        return r.ok
          ? { ok: true, translated: data.translated ?? [], failed: data.failed ?? [] }
          : { ok: false, error: data.error ?? t("Pubblicazione non riuscita, riprova.", "Publishing failed, please try again."), code: data.code };
      })
      .catch((): Result => ({ ok: false, error: t("Connessione assente, riprova.", "No connection, please try again.") }))
      .then((x) => { res = x; return x; });
    (async () => {
      let i = 0;
      for (; i < 2; i++) {
        if (!alive) return;
        setActive(i);
        await sleep(650);
        if (res && !(res as Result).ok) break;
      }
      for (; i < firstAfter; i++) {
        if (!alive) return;
        setActive(i);
        if (i < firstAfter - 1) await Promise.race([sleep(2600), req]);
        else await req;
        if (res) await sleep(300);
      }
      const r = await req;
      if (!alive) return;
      if (!r.ok) return onError(r.error, r.code);
      for (; i < steps.length; i++) {
        if (!alive) return;
        setActive(i);
        await sleep(380);
      }
      setFailedNow(r.failed);
      setFinished(true);
      if (r.failed.length === 0) {
        await sleep(800);
        if (alive) onDone();
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pub-progress" role="status" aria-live="polite">
      <h2>{finished ? t("Il vostro invito è online", "Your invitation is live") : t("Pubblico il vostro invito…", "Publishing your invitation…")}</h2>
      <ul className="pub-steps">
        {steps.map((s, i) => {
          const isFailed = !!s.locale && finished && failedNow.includes(s.locale);
          const state = isFailed ? "is-failed" : finished || i < active ? "is-done" : i === active ? "is-active" : "";
          return (
            <li key={s.key} className={`pub-step ${state}`}>
              <span className="pub-ico" aria-hidden="true">{isFailed ? <AlertTriangle size={14} /> : state === "is-done" ? <Check size={15} /> : null}</span>
              {s.locale && <Flag locale={s.locale} />}
              <span>{s.label}</span>
            </li>
          );
        })}
      </ul>
      {finished && failedNow.length > 0 && (
        <>
          <p className="pub-note">
            {t(
              `L'invito è online. La traduzione in ${failedNow.map((l) => LOCALE_INFO[l].it.toLowerCase()).join(" e ")} non è riuscita: riprova pubblicando di nuovo tra poco.`,
              `Your invitation is live. The ${failedNow.map((l) => LOCALE_INFO[l].en).join(" and ")} translation didn't work: try publishing again in a moment.`,
            )}
          </p>
          <button type="button" className="btn solid" onClick={onDone}>{t("Continua", "Continue")}</button>
        </>
      )}
    </div>
  );
}
