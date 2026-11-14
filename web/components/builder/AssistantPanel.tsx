"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Command, Sparkles, Wand2 } from "lucide-react";
import { AssistantWizard, type Answers } from "./AssistantWizard";
import { COMMANDS, CommandWidget, matchCommands, type CommandId } from "./AssistantTools";
import { PlaceSearch } from "./PlaceSearch";
import type { Action, Catalog, InviteConfig } from "@inviteme/shared";

// BeSpoke AI, la chat del builder: il cliente scrive o usa i comandi visivi; il server propone modifiche già validate.
// I comandi visivi (AssistantTools) applicano le modifiche subito, senza consumare richieste.
// Le modifiche si applicano dal builder in un solo passo di cronologia: Annulla (Ctrl+Z) le ritira tutte.
type Choice = { question: string; options: string[]; photos?: string[]; answered?: boolean };
type Line = { role: "user" | "assistant"; text: string; error?: boolean; applied?: number; choice?: Choice; placeAsk?: { question: string; answered?: boolean }; widget?: CommandId; command?: boolean };

// Solo questi elementi dal markdown della risposta: niente titoli, immagini o link.
const ALLOWED = ["p", "strong", "em", "ul", "ol", "li", "br"];

export function AssistantPanel({
  lang,
  invitationId,
  readOnly,
  limit,
  used,
  onApply,
  config,
  catalog,
}: {
  config: InviteConfig;
  catalog: Catalog;
  lang: "it" | "en";
  invitationId: string;
  readOnly: boolean;
  limit: number;
  used: number;
  onApply: (actions: Action[], allowed: { mediaAllowed: string[]; placesAllowed: string[] }) => number;
}) {
  const it = lang !== "en";
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(Math.max(0, limit - used));
  const out = remaining <= 0;

  const [picks, setPicks] = useState<Record<number, string>>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  // «Creiamolo insieme» si usa una volta sola per invito: il ricordo sta nel browser (dopo il montaggio, per non sfasare il rendering).
  const wizardKey = `inviteme-wizard-used-${invitationId}`;
  const [wizardUsed, setWizardUsed] = useState(true);
  useEffect(() => {
    try {
      setWizardUsed(window.localStorage.getItem(wizardKey) === "1");
    } catch {
      setWizardUsed(false);
    }
  }, [wizardKey]);
  const startWizard = () => {
    try {
      window.localStorage.setItem(wizardKey, "1");
    } catch {
      // Senza memoria del browser il pulsante resta usabile per questa visita.
    }
    setWizardUsed(true);
    setWizardOpen(true);
  };
  // Palette dei comandi: si apre scrivendo «/» o con il pulsante accanto al campo.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const slash = draft.startsWith("/");
  const paletteItems = useMemo(() => matchCommands(slash ? draft.slice(1) : "", lang), [draft, slash, lang]);
  const showPalette = (paletteOpen || slash) && !readOnly && !out;
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [lines.length, busy]);

  // Valori già inseriti (wizard iniziale e builder): il percorso guidato parte da lì.
  const wizardInitial = useMemo<Partial<Answers>>(() => {
    const ev = (config.event ?? {}) as Record<string, unknown>;
    const s2 = (v: unknown) => (typeof v === "string" ? v : "");
    const dress = config.blocks.find((b) => b.type === "dresscode");
    const music = config.blocks.find((b) => b.type === "music");
    const venue = config.blocks.find((b) => b.type === "venue");
    const address = s2(ev.address);
    return {
      names: s2(ev.title),
      date: s2(ev.eventDate),
      time: s2(ev.eventTime),
      venue: address || s2(venue?.props.venue) || s2(ev.venue),
      venueConfirmed: Boolean(address),
      dress: s2(dress?.props.dress),
      colors: Array.isArray(dress?.props.colors) ? (dress!.props.colors as { hex?: string }[]).map((c) => String(c.hex ?? "").toLowerCase()).filter(Boolean) : [],
      background: config.background?.kind ?? "",
      music: Boolean(s2(music?.props.music)),
    };
  }, [config]);

  // Un comando apre il suo controllo visivo nella conversazione.
  function runCommand(id: CommandId) {
    const c = COMMANDS.find((x) => x.id === id)!;
    setDraft("");
    setPaletteOpen(false);
    setPaletteIdx(0);
    setLines((l) => [...l, { role: "user", text: it ? c.it : c.en, command: true }, { role: "assistant", text: "", widget: id }]);
  }
  const toolCtx = { lang, config, catalog, invitationId, disabled: readOnly || busy, apply: (actions: Action[], allowed?: { mediaAllowed?: string[]; placesAllowed?: string[] }) => onApply(actions, { mediaAllowed: allowed?.mediaAllowed ?? [], placesAllowed: allowed?.placesAllowed ?? [] }), ask: (prompt: string) => void send(prompt) };

  // Indirizzi proposti finora: il server li riconosce anche nelle richieste successive.
  const [offered, setOffered] = useState<string[]>([]);
  // Foto proposte: il server le rimanda ad ogni risposta, così la scelta si applica senza cercare di nuovo.
  const [photosOffered, setPhotosOffered] = useState<{ id: number; label: string; preview?: string }[]>([]);

  async function send(override?: string, answeredAt?: number) {
    const text = (override ?? draft).trim();
    if (!text || busy || out) return;
    const base = answeredAt === undefined ? lines : lines.map((x, j) => (j === answeredAt ? { ...x, choice: x.choice && { ...x.choice, answered: true }, placeAsk: x.placeAsk && { ...x.placeAsk, answered: true } } : x));
    const next: Line[] = [...base, { role: "user", text }];
    setLines(next);
    setDraft("");
    setBusy(true);
    try {
      // Solo il testo della conversazione: niente risposte d'errore, al massimo le ultime dodici voci.
      const messages = next.filter((l) => !l.error && !l.widget && !l.command && l.text).slice(-12).map((l) => ({ role: l.role, content: l.text }));
      const res = await fetch(`/api/invitations/${invitationId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, placesAllowed: offered, photosOffered }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; actions?: Action[]; remaining?: number; mediaAllowed?: string[]; placesAllowed?: string[]; photosOffered?: { id: number; label: string; preview?: string }[]; choice?: Choice; placeAsk?: { question: string }; error?: string };
      if (!res.ok || typeof data.reply !== "string") throw new Error(data.error ?? (it ? "L'assistente non risponde." : "The assistant is not responding."));
      if (data.photosOffered) setPhotosOffered(data.photosOffered);
      if (data.placesAllowed?.length) setOffered((o) => [...new Set([...o, ...(data.placesAllowed ?? [])])].slice(-30));
      const applied = data.actions?.length ? onApply(data.actions, { mediaAllowed: data.mediaAllowed ?? [], placesAllowed: data.placesAllowed ?? [] }) : 0;
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setLines((l) => [...l, { role: "assistant", text: data.reply ?? "", applied, ...(data.choice ? { choice: { ...data.choice } } : {}), ...(data.placeAsk ? { placeAsk: { ...data.placeAsk } } : {}) }]);
    } catch (e) {
      setLines((l) => [...l, { role: "assistant", text: e instanceof Error ? e.message : "Errore", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bl-inspector as-panel">
      <div className="as-body">
      <div className="bl-tabs-head">
        <span className="bl-kicker as-kicker"><Sparkles size={12} aria-hidden="true" />AI</span>
        <h2 className="as-title">BeSpoke AI</h2>
      </div>

      <div className="as-counter" aria-live="polite">
        <span>{it ? "Richieste disponibili" : "Requests left"}</span>
        <strong key={remaining} className="as-tick">
          {remaining} / {limit}
        </strong>
      </div>

      {lines.length === 0 && !readOnly && !wizardOpen && (
        <div className="as-start">
          {!wizardUsed && (
          <button type="button" className="as-cta" onClick={startWizard}>
            <span className="as-cta-ico">
              <Wand2 size={22} aria-hidden="true" />
            </span>
            <span className="as-cta-text">
              <strong>{it ? "Creiamolo insieme" : "Let's create it together"}</strong>
              <small>{it ? "Ti faccio qualche domanda, poi compongo l'invito" : "I'll ask a few questions, then compose the invitation"}</small>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          )}
          <p className="as-ideas-title">{it ? "Comandi rapidi · si applicano subito" : "Quick commands · applied instantly"}</p>
          <div className="as-cmds" aria-label={it ? "Comandi" : "Commands"}>
            {COMMANDS.map((c, n) => {
              const Icon = c.icon;
              return (
                <button key={c.id} type="button" className={`as-cmd${c.ai ? " is-ai" : ""}`} style={{ ["--n" as string]: n }} onClick={() => runCommand(c.id)}>
                  <span className="as-cmd-ico"><Icon size={17} aria-hidden="true" /></span>
                  <span className="as-cmd-text"><strong>{it ? c.it : c.en}</strong><small>{it ? c.itHint : c.enHint}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {wizardOpen && !readOnly && (
        <AssistantWizard
          lang={lang}
          initial={wizardInitial}
          onCancel={() => setWizardOpen(false)}
          onCompose={(brief) => {
            setWizardOpen(false);
            void send(brief);
          }}
        />
      )}
      {lines.length === 0 && !wizardOpen && (
        <p className="as-hint">
          {readOnly
            ? it
              ? "L'invito è confermato: l'assistente risponde, ma non modifica più nulla."
              : "The invitation is confirmed: the assistant answers but no longer changes anything."
            : it
              ? "Scrivi cosa vuoi cambiare, con parole tue: «sposta il countdown sopra il programma», «metti il dress code salvia e borgogna»."
              : "Write what you want to change, in your own words: “move the countdown above the program”, “set the dress code to sage and burgundy”."}
        </p>
      )}

      <div className="as-log" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={`as-msg${l.role === "user" ? " is-user" : ""}${l.error ? " is-error" : ""}${l.widget ? " is-widget" : ""}${l.command ? " is-command" : ""}`}>
            {l.widget ? (
              <CommandWidget id={l.widget} ctx={{ ...toolCtx, close: () => setLines((all) => all.filter((_, j) => j !== i && !(j === i - 1 && all[j].command))) }} />
            ) : l.role === "user" ? (
              <p>{l.command && <Command size={13} aria-hidden="true" className="as-cmd-mark" />}{l.text}</p>
            ) : (
              <div className="as-md">
                <ReactMarkdown allowedElements={ALLOWED} unwrapDisallowed>
                  {l.text}
                </ReactMarkdown>
              </div>
            )}
            {l.choice?.photos?.some(Boolean) && (
              <fieldset className="as-choice as-photo-choice" disabled={l.choice.answered || busy || out}>
                <legend>{l.choice.question}</legend>
                <div className="as-photo-grid">
                  {l.choice.options.map((o, k) => (
                    <button
                      key={o}
                      type="button"
                      className={`as-photo-opt${picks[i] === o ? " is-on" : ""}`}
                      onClick={() => { setPicks((p) => ({ ...p, [i]: o })); void send(o, i); }}
                    >
                      {l.choice?.photos?.[k] ? <img src={l.choice.photos[k]} alt="" loading="lazy" /> : <span className="as-photo-none" aria-hidden="true" />}
                      <span>{o}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {l.choice && !l.choice.photos?.some(Boolean) && (
              <fieldset className="as-choice" disabled={l.choice.answered || busy || out}>
                <legend>{l.choice.question}</legend>
                {l.choice.options.map((o) => (
                  <label key={o} className="as-radio">
                    <input type="radio" name={`choice-${i}`} value={o} checked={picks[i] === o} disabled={l.choice?.answered || busy || out} onChange={() => setPicks((p) => ({ ...p, [i]: o }))} />
                    <span>{o}</span>
                  </label>
                ))}
                {!l.choice.answered && (
                  <button
                    type="button"
                    className="btn solid as-choice-send"
                    disabled={!picks[i]}
                    onClick={() => {
                      void send(picks[i], i);
                    }}
                  >
                    {it ? "Conferma" : "Confirm"}
                  </button>
                )}
              </fieldset>
            )}
            {l.placeAsk && (
              <fieldset className="as-choice as-choice-place" disabled={l.placeAsk.answered || busy || out}>
                <legend>{l.placeAsk.question}</legend>
                <PlaceSearch lang={lang} disabled={l.placeAsk.answered || busy || out} onPick={(addr) => void send(addr, i)} />
              </fieldset>
            )}
            {l.applied ? <p className="as-applied">{it ? `Modifiche applicate: ${l.applied}. Annulla (Ctrl+Z) le ritira.` : `Changes applied: ${l.applied}. Undo (Ctrl+Z) reverts them.`}</p> : null}
          </div>
        ))}
        <div ref={logEnd} />
        {busy && (
          <div className="as-thinking" role="status">
            <span className="as-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{it ? "L'assistente sta pensando" : "The assistant is thinking"}</span>
          </div>
        )}
      </div>

      </div>

      {showPalette && (
        <div className="as-palette" role="listbox" aria-label={it ? "Comandi" : "Commands"}>
          <p className="as-palette-head"><Command size={13} aria-hidden="true" />{it ? "Comandi · ↑↓ per scegliere, Invio per aprire" : "Commands · ↑↓ to choose, Enter to open"}</p>
          {paletteItems.length === 0 && <p className="as-palette-empty">{it ? "Nessun comando: premi Invio per chiederlo all'AI" : "No command: press Enter to ask the AI"}</p>}
          {paletteItems.map((c, n) => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" role="option" aria-selected={n === paletteIdx} className={`as-palette-item${n === paletteIdx ? " is-on" : ""}`} onMouseEnter={() => setPaletteIdx(n)} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand(c.id)}>
                <span className="as-cmd-ico"><Icon size={15} aria-hidden="true" /></span>
                <span className="as-cmd-text"><strong>{it ? c.it : c.en}</strong><small>{it ? c.itHint : c.enHint}</small></span>
                {c.ai && <span className="as-ai-tag">AI</span>}
              </button>
            );
          })}
        </div>
      )}
      <form
        className="as-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <button type="button" className={`as-slash${showPalette ? " is-on" : ""}`} aria-label={it ? "Comandi" : "Commands"} aria-expanded={showPalette} disabled={readOnly || out} onClick={() => { setPaletteOpen((o) => !o); setPaletteIdx(0); }}>
          <Command size={16} aria-hidden="true" />
        </button>
        <textarea
          className="as-input"
          rows={2}
          maxLength={1000}
          value={draft}
          disabled={busy || out}
          placeholder={out ? (it ? "Richieste esaurite per questo invito" : "No requests left for this invitation") : it ? "Chiedi a BeSpoke AI, o / per i comandi" : "Ask BeSpoke AI, or / for commands"}
          aria-label={it ? "Messaggio per l'assistente" : "Message for the assistant"}
          onChange={(e) => { setDraft(e.target.value); setPaletteIdx(0); }}
          onKeyDown={(e) => {
            if (showPalette && paletteItems.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx((n) => (n + 1) % paletteItems.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIdx((n) => (n - 1 + paletteItems.length) % paletteItems.length); return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runCommand(paletteItems[Math.min(paletteIdx, paletteItems.length - 1)].id); return; }
            }
            if (e.key === "Escape" && showPalette) { e.preventDefault(); setPaletteOpen(false); if (slash) setDraft(""); return; }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="as-send-orb" aria-label={it ? "Invia" : "Send"} disabled={busy || out || draft.trim().length === 0 || slash}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
