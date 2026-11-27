// Lingue degli inviti: una principale (quella in cui il cliente scrive, mostrata nel builder) e lingue in più,
// tradotte da BeSpoke AI alla pubblicazione. Gli ospiti scelgono la lingua dal selettore dell'invito.
export const LOCALES = ["it", "en", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

// Nome della lingua nella lingua stessa (selettore degli ospiti), in italiano e in inglese (builder).
export const LOCALE_INFO: Record<Locale, { native: string; it: string; en: string }> = {
  it: { native: "Italiano", it: "Italiano", en: "Italian" },
  en: { native: "English", it: "Inglese", en: "English" },
  es: { native: "Español", it: "Spagnolo", en: "Spanish" },
  fr: { native: "Français", it: "Francese", en: "French" },
};

// Lingue in più valide: senza la principale, senza doppioni, nell'ordine di LOCALES.
export function cleanExtraLocales(primary: Locale, extra: unknown): Locale[] {
  const wanted = new Set(Array.isArray(extra) ? extra.filter(isLocale) : []);
  return LOCALES.filter((l) => l !== primary && wanted.has(l));
}

// Bandierine disegnate (SVG), uguali ovunque: le emoji delle bandiere su Windows diventano lettere.
// 24×16, angoli arrotondati dal contenitore. L'inglese usa la bandiera britannica semplificata.
export const FLAG_SVG: Record<Locale, string> = {
  it: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  fr: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="2" fill="#002654"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce1126"/></svg>',
  es: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#aa151b"/><rect y="0.5" width="3" height="1" fill="#f1bf00"/></svg>',
  en: '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="3"/><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="12"/><path d="M30 0V40M0 20H60" stroke="#c8102e" stroke-width="7"/></svg>',
};
