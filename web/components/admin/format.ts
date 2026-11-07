// Formattazione per la console: importi in euro, date in italiano.
export const fmtEuro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
export const fmtDate = (iso: string) => new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
