import { FLAG_SVG, type Locale } from "@inviteme/shared";

// Bandierina della lingua (SVG fisso del codice, uguale a quella del selettore dell'invito).
export function Flag({ locale, className = "" }: { locale: Locale; className?: string }) {
  return <span className={`flag ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: FLAG_SVG[locale] }} />;
}
