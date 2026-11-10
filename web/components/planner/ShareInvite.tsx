"use client";

import { useState } from "react";
import { Check, Copy, Pencil, Share2 } from "lucide-react";

// Condivisione dell'invito dal planner premium: «Condividi» apre il pannello di condivisione del sistema
// (navigator.share); dove non c'è, copia il link. «Copia link» copia sempre.
// Senza link pubblico (invito non ancora pubblicato) rimanda al builder.
const COPY = {
  it: { label: "Il tuo invito", share: "Condividi", copy: "Copia link", copied: "Link copiato", text: "Vi invitiamo! Trovate tutti i dettagli qui", unpublished: "Pubblica l'invito per avere il link", publish: "Pubblica" },
  en: { label: "Your invitation", share: "Share", copy: "Copy link", copied: "Link copied", text: "You're invited! All the details here", unpublished: "Publish the invitation to get its link", publish: "Publish" },
};

export function ShareInvite({ path, title, editHref, lang = "it" }: { path: string | null; title: string; editHref: string; lang?: "it" | "en" }) {
  const T = COPY[lang];
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(T.copy, url());
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: T.text, url: url() });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return; // chiuso dall'utente
      }
    }
    await copy();
  }

  return (
    <div className="pp-share" role="group" aria-label={T.label}>
      {path ? (
        <>
          <button type="button" className="pp-share-btn is-primary" onClick={share}>
            <Share2 size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>{T.share}</span>
          </button>
          <button type="button" className="pp-share-btn" onClick={copy}>
            {copied ? <Check size={17} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={17} strokeWidth={1.8} aria-hidden="true" />}
            <span>{copied ? T.copied : T.copy}</span>
          </button>
        </>
      ) : (
        <a className="pp-share-btn is-primary" href={editHref} title={T.unpublished}>
          <Pencil size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>{T.publish}</span>
        </a>
      )}
      <span className="visually-hidden" role="status">{copied ? T.copied : ""}</span>
    </div>
  );
}
