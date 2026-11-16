// Formattazione per la console: importi in euro e date nella lingua della pagina (<html lang>, impostata dal layout).
const locale = () => (typeof document !== "undefined" && document.documentElement.lang === "en" ? "en-GB" : "it-IT");
export const fmtEuro = (cents: number) => new Intl.NumberFormat(locale(), { style: "currency", currency: "EUR" }).format(cents / 100);
export const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" });
