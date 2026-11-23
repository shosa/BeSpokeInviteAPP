// Formattazione dell'area Pro, usata anche dai componenti client (niente import solo-server qui).

export const EVENT_LABEL: Record<string, { it: string; en: string }> = {
  wedding: { it: "Matrimonio", en: "Wedding" },
  birthday: { it: "Compleanno", en: "Birthday" },
  baby: { it: "Baby shower", en: "Baby shower" },
  corporate: { it: "Evento aziendale", en: "Corporate event" },
  graduation: { it: "Laurea", en: "Graduation" },
};

export function fmtDate(iso: string, en: boolean, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(en ? "en-GB" : "it-IT", opts).format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso));
}
