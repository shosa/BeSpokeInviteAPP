"use client";

import { createContext, useContext } from "react";
import type { Lang } from "./ui";

// Lingua del sito per i componenti client: la imposta il layout dal cookie `lang`.
// `t("testo italiano", "English text")` restituisce il testo nella lingua corrente.
const LangContext = createContext<Lang>("it");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT() {
  const lang = useContext(LangContext);
  return (it: string, en: string) => (lang === "en" ? en : it);
}
