import { BUDGET_CATEGORIES, FOLDER } from "@inviteme/shared";
import type { PremiumData } from "../PremiumPlanner";

// Calcoli del planner (budget, invitati, attività, cartella) e la demo: dati d'esempio che si modificano solo in memoria.

export type Method = "POST" | "PATCH" | "DELETE" | "PUT";
export type Weather = { forecast: { tmaxC: number; tminC: number; precipMm: number; precipProb: number | null; hourly?: { hour: number; tempC: number; precipMm: number }[] } | null; reason?: string; place?: string; sample?: boolean };

export const CATS = [...BUDGET_CATEGORIES.map((c) => ({ key: c.key as string, it: c.it as string, en: c.en as string, share: c.share as number })), { key: "altro", it: "Altro", en: "Other", share: 0 }];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const validIso = (v: string | null | undefined): v is string => !!v && ISO.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00"));
export const loc = (en: boolean) => (en ? "en-GB" : "it-IT");
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const daysUntil = (iso: string) => (validIso(iso) ? Math.round((Date.parse(iso + "T00:00:00") - Date.parse(todayIso() + "T00:00:00")) / 86_400_000) : null);
export const euro = (cents: number, en: boolean) => (cents / 100).toLocaleString(loc(en), { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
export const longDate = (iso: string, en: boolean) => new Date(iso + "T12:00:00").toLocaleDateString(loc(en), { day: "numeric", month: "long", year: "numeric" });
export const shortDate = (iso: string, en: boolean) => new Date(iso + "T12:00:00").toLocaleDateString(loc(en), { day: "numeric", month: "short", year: "numeric" });
export const dayMonth = (iso: string, en: boolean) => new Date(iso + "T12:00:00").toLocaleDateString(loc(en), { day: "numeric", month: "long" });

// Data di un'attività: N giorni prima dell'evento. Il testo dice quanto prima (mesi, settimane o giorni) e la data.
export function taskWhen(eventDate: string, daysBefore: number, en: boolean) {
  const months = Math.round(daysBefore / 30.4);
  const weeks = Math.round(daysBefore / 7);
  const before = daysBefore === 0
    ? (en ? "On the day" : "Il giorno stesso")
    : months >= 2 ? (en ? `${months} months before` : `${months} mesi prima`)
    : weeks >= 2 ? (en ? `${weeks} weeks before` : `${weeks} settimane prima`)
    : daysBefore === 1 ? (en ? "1 day before" : "1 giorno prima") : (en ? `${daysBefore} days before` : `${daysBefore} giorni prima`);
  if (!validIso(eventDate)) return before;
  const d = new Date(eventDate + "T12:00:00");
  d.setDate(d.getDate() - daysBefore);
  return `${before} · ${d.toLocaleDateString(loc(en), { day: "numeric", month: "short", year: "numeric" })}`;
}

// Fasce delle attività, come in un'agenda di matrimonio: dalla più lontana al giorno stesso.
export const TASK_BANDS = [
  { min: 366, it: "Più di un anno prima", en: "More than a year before" },
  { min: 270, it: "Da 12 a 9 mesi prima", en: "12 to 9 months before" },
  { min: 180, it: "Da 8 a 6 mesi prima", en: "8 to 6 months before" },
  { min: 90, it: "Da 5 a 3 mesi prima", en: "5 to 3 months before" },
  { min: 30, it: "Da 2 mesi a 1 mese prima", en: "2 months to 1 month before" },
  { min: 7, it: "Ultimo mese", en: "The last month" },
  { min: 0, it: "Ultima settimana e il giorno", en: "The last week and the day" },
];

export const docFilled = (data: PremiumData, key: string) => {
  const v = data.docs[key];
  if (typeof v === "string") return v.trim().length > 0;
  return ((v as { items?: unknown[] } | undefined)?.items?.length ?? 0) > 0;
};
export const docCount = (data: PremiumData, key: string) => {
  const v = data.docs[key];
  if (typeof v === "string") return v.trim() ? 1 : 0;
  return (v as { items?: unknown[] } | undefined)?.items?.length ?? 0;
};

export function stats(data: PremiumData) {
  const persons = (r: "yes" | "pending" | "no") => data.guests.filter((g) => g.response === r).reduce((n, g) => n + g.party_size, 0);
  const yes = persons("yes");
  const pending = persons("pending");
  const no = persons("no");
  const booked = data.quotes.filter((q) => q.booked);
  const loose = data.budget.filter((b) => !b.quote_id);
  const byCat = CATS.map((c) => {
    const total = booked.filter((q) => q.category === c.key).reduce((n, q) => n + q.amount_cents, 0)
      + loose.filter((p) => p.category === c.key || p.category === c.it || p.category === c.en).reduce((n, p) => n + p.amount_cents, 0);
    return { ...c, total };
  });
  const planned = byCat.reduce((n, c) => n + c.total, 0);
  const paid = data.budget.filter((p) => p.paid).reduce((n, p) => n + p.amount_cents, 0);
  const due = data.budget.filter((p) => !p.paid).reduce((n, p) => n + p.amount_cents, 0);
  const unpaid = data.budget.filter((p) => !p.paid).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const tasksDone = data.tasks.filter((t) => t.done).length;
  const docsDone = FOLDER.filter((s) => docFilled(data, s.key)).length;
  const seats = data.tables.reduce((n, t) => n + t.seats, 0);
  const seated = data.guests.filter((g) => g.table_id && data.tables.some((t) => t.id === g.table_id)).reduce((n, g) => n + g.party_size, 0);
  return { yes, pending, no, total: yes + pending + no, byCat, planned, paid, due, unpaid, tasksDone, docsDone, seats, seated };
}

export const hue = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};
export const initials = (s: string) => s.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

// ---------- demo ----------

let seq = 0;
const nid = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

const COLLECTIONS: Record<string, keyof PremiumData> = { tasks: "tasks", guests: "guests", vendors: "vendors", budget: "budget", quotes: "quotes", tables: "tables" };
const DEFAULTS: Record<string, Record<string, unknown>> = {
  tasks: { title: "", done: false, days_before: 0 },
  guests: { name: "", group_name: "", party_size: 1, response: "pending", table_id: null },
  vendors: { name: "", role: "", contact: "", contract_status: "unsigned" },
  budget: { category: "", label: "", amount_cents: 0, due_date: null, paid: false, quote_id: null },
  quotes: { category: "altro", name: "", amount_cents: 0, rating: 0, notes: "", booked: false, signed: false, arrival: "", contact: "", tip_cents: 0, envelope: false },
  tables: { name: "", seats: 8 },
};

// Applica in memoria una modifica che il planner vero manderebbe all'API (/api/planners/:id/…).
export function demoApply(d: PremiumData, method: Method, path: string, body: unknown): PremiumData {
  const b = (body ?? {}) as Record<string, unknown>;
  if (path === "" || path === "/") {
    if (method !== "PUT") return d;
    const next: PremiumData = { ...d };
    if ("title" in b || "eventDate" in b) next.event = { ...d.event, ...(b as Partial<PremiumData["event"]>) };
    if ("docs" in b) next.docs = b.docs as PremiumData["docs"];
    if ("budgetCents" in b) next.budgetCents = Number(b.budgetCents) || 0;
    if ("guestQuota" in b) next.guestQuota = Number(b.guestQuota) || 0;
    if ("groupQuotas" in b) next.groupQuotas = b.groupQuotas as Record<string, number>;
    if ("notes" in b) next.notes = String(b.notes);
    return next;
  }
  const m = path.match(/^\/(\w+)(?:\/([^/]+))?$/);
  const key = m ? COLLECTIONS[m[1]!] : undefined;
  if (!m || !key) return d;
  const list = d[key] as unknown as { id: string }[];
  const id = m[2];
  let next = list;
  if (method === "POST" && !id) next = [...list, { ...DEFAULTS[m[1]!], ...b, id: nid() }];
  if (method === "PATCH" && id) next = list.map((x) => (x.id === id ? { ...x, ...b } : x));
  if (method === "DELETE" && id) next = list.filter((x) => x.id !== id);
  const out = { ...d, [key]: next } as PremiumData;
  if (m[1] === "tables" && method === "DELETE") out.guests = out.guests.map((g) => (g.table_id === id ? { ...g, table_id: null } : g));
  // Un preventivo prenotato è il fornitore scelto: gli altri della stessa categoria tornano liberi.
  if (m[1] === "quotes" && method === "PATCH" && b.booked === true) {
    const cat = (next as PremiumData["quotes"]).find((q) => q.id === id)?.category;
    out.quotes = out.quotes.map((q) => (q.id !== id && q.category === cat ? { ...q, booked: false } : q));
  }
  return out;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Un matrimonio d'esempio: 328 giorni da oggi, circa 160 persone invitate, budget quasi tutto impegnato.
export function demoData(en: boolean): PremiumData {
  const date = addDays(todayIso(), 328);
  const L = (it: string, eng: string) => (en ? eng : it);
  const tasks: [string, string, number, boolean][] = [
    ["Fissare budget e numero di invitati", "Set the budget and guest count", 400, true],
    ["Scegliere la data", "Choose the date", 390, true],
    ["Prenotare la location", "Book the venue", 380, true],
    ["Scegliere il fotografo", "Choose the photographer", 360, true],
    ["Prenotare il catering", "Book the caterer", 350, true],
    ["Fare la lista degli invitati", "Draw up the guest list", 340, true],
    ["Prenotare la musica", "Book the music", 304, false],
    ["Definire stile, palette e tema", "Define the style, palette and theme", 304, false],
    ["Iniziare a cercare abito e completo", "Start looking for the dress and suit", 273, false],
    ["Inviare i save the date", "Send the save the dates", 242, false],
    ["Prenotare fiorista e allestimenti", "Book the florist and decor", 242, false],
    ["Bloccare le camere per gli invitati", "Block-book hotel rooms for guests", 212, false],
    ["Prenotare trucco e parrucco", "Book hair and make-up", 182, false],
    ["Organizzare il viaggio di nozze", "Plan the honeymoon and check passports", 182, false],
    ["Ordinare la torta", "Order the cake or dessert table", 151, false],
    ["Comprare le fedi", "Buy the rings", 121, false],
    ["Inviare le partecipazioni", "Send the invitations", 100, false],
    ["Scegliere le bomboniere", "Choose the favours", 91, false],
    ["Prova del menu", "Menu tasting", 60, false],
    ["Confermare i fornitori", "Confirm the vendors", 45, false],
    ["Preparare la disposizione dei tavoli", "Prepare the seating plan", 30, false],
    ["Ultima prova dell'abito", "Final dress fitting", 21, false],
    ["Preparare la cartella del giorno", "Prepare the day's binder", 14, false],
    ["Confermare il numero finale al catering", "Give the caterer the final numbers", 10, false],
    ["Controllare il meteo e il piano B", "Check the weather and plan B", 3, false],
    ["Preparare le buste per i fornitori", "Prepare the vendor envelopes", 2, false],
    ["Godersi la giornata", "Enjoy the day", 0, false],
  ];
  const groups = [L("Famiglia di Giulia", "Giulia's family"), L("Famiglia di Marco", "Marco's family"), L("Amici dell'università", "University friends"), L("Colleghi", "Colleagues"), L("Amici di sempre", "Old friends")];
  const first = ["Anna", "Paolo", "Sara", "Luca", "Chiara", "Davide", "Elena", "Matteo", "Irene", "Giorgio", "Marta", "Andrea", "Silvia", "Tommaso", "Beatrice", "Nicola", "Alice", "Filippo", "Laura", "Stefano", "Valeria", "Pietro", "Giada", "Simone", "Federica", "Lorenzo", "Ilaria", "Riccardo", "Camilla", "Enrico", "Martina", "Alberto", "Sofia", "Fabio", "Elisa", "Gabriele", "Noemi", "Michele", "Arianna", "Daniele", "Greta", "Carlo", "Bianca", "Franco", "Roberta", "Emanuele", "Serena", "Alessio", "Nadia", "Bruno", "Lucia", "Marco"];
  const last = ["Rossi", "Bianchi", "Ferrari", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano", "Mancini", "Rizzo", "Lombardi", "Moretti"];
  // Gruppi di persone: 104 vengono, 36 non hanno ancora risposto, 19 non vengono (159 in tutto).
  const yesSizes = [4, 4, 4, 3, 3, 3, ...Array<number>(41).fill(2), 1];
  const pendSizes = [3, 3, ...Array<number>(15).fill(2)];
  const noSizes = [3, ...Array<number>(8).fill(2)];
  const sizes: number[] = [];
  const resp: ("yes" | "pending" | "no")[] = [];
  for (let i = 0; sizes.length < yesSizes.length + pendSizes.length + noSizes.length; i++) {
    if (i < yesSizes.length) { sizes.push(yesSizes[i]!); resp.push("yes"); }
    if (i < pendSizes.length) { sizes.push(pendSizes[i]!); resp.push("pending"); }
    if (i < noSizes.length) { sizes.push(noSizes[i]!); resp.push("no"); }
  }
  const tables: PremiumData["tables"] = [{ id: "t0", name: L("Tavolo degli sposi", "Top table"), seats: 10 }];
  for (let i = 1; i <= 13; i++) tables.push({ id: `t${i}`, name: L(`Tavolo ${i}`, `Table ${i}`), seats: 10 });
  // 11 persone già sedute: 4 al tavolo degli sposi, 4 al tavolo 1, 3 al tavolo 2.
  const seat: Record<number, string> = { 0: "t0", 6: "t1", 9: "t2" };
  const guests = sizes.map((s, i) => ({
    id: `g${i}`,
    name: s > 2 ? L(`Famiglia ${last[i % last.length]}`, `The ${last[i % last.length]} family`) : `${first[i % first.length]} ${last[(i * 7) % last.length]}`,
    group_name: groups[i % groups.length]!,
    party_size: s,
    response: resp[i]!,
    table_id: seat[i] ?? null,
  }));
  // La famiglia dello sposo ha confermato una persona in più di quelle concordate.
  const marco = groups[1]!;
  const groupQuotas = { [marco]: guests.filter((g) => g.group_name === marco && g.response === "yes").reduce((n, g) => n + g.party_size, 0) - 1 };
  const q = (id: string, category: string, name: string, amount: number, booked = true, signed = true) => ({ id, category, name, amount_cents: amount * 100, rating: booked ? 5 : 3, notes: "", booked, signed, arrival: "", contact: "", tip_cents: 0, envelope: false });
  return {
    id: "demo",
    event: { title: "Giulia & Marco", eventType: "wedding", eventDate: date, venue: L("Villa sul lago, Como", "A lakeside villa, Como"), address: "Como" },
    invitation: null,
    linkable: [],
    guests,
    tables,
    budget: [
      { id: "b1", category: "inviti", label: L("Saldo", "Balance"), amount_cents: 26400, due_date: addDays(todayIso(), -40), paid: true, quote_id: "q7" },
      { id: "b2", category: "fedi", label: L("Acconto", "Deposit"), amount_cents: 90000, due_date: addDays(todayIso(), -12), paid: true, quote_id: "q6" },
      { id: "b3", category: "musica", label: L("Acconto", "Deposit"), amount_cents: 45000, due_date: addDays(date, -15), paid: false, quote_id: "q5" },
      { id: "b4", category: "foto", label: L("Saldo", "Balance"), amount_cents: 200000, due_date: addDays(date, -3), paid: false, quote_id: "q3" },
      { id: "b5", category: "musica", label: L("Saldo", "Balance"), amount_cents: 100000, due_date: date, paid: false, quote_id: "q5" },
    ],
    quotes: [
      q("q1", "location", "Villa sul lago", 33750),
      q("q2", "abiti", L("Abito e completo", "Dress and suit"), 3500),
      q("q3", "foto", "Studio Luce", 2900),
      q("q4", "fiori", L("Fiori e allestimenti", "Flowers and decor"), 1900),
      q("q5", "musica", "Note di Sera", 1450, true, false),
      q("q6", "fedi", L("Fedi", "Wedding rings"), 1100),
      q("q7", "inviti", "Bespoke Invite", 264),
      q("q8", "foto", "Foto Lago", 3400, false, false),
    ],
    tasks: tasks.map(([it, eng, d, done], i) => ({ id: `k${i}`, title: en ? eng : it, done, days_before: d })),
    vendors: [
      { id: "v1", name: "Note di Sera", role: L("Musica", "Music"), contact: "+39 333 000 1111", contract_status: "unsigned" },
      { id: "v2", name: "Studio Luce", role: L("Fotografo", "Photographer"), contact: "+39 333 000 2222", contract_status: "signed" },
    ],
    rsvpResponses: 0,
    docs: {
      "programma-generale": { items: [
        { time: "09:00", item: L("Preparativi", "Getting ready") }, { time: "12:30", item: L("Arrivo degli invitati", "Guests arrive") }, { time: "13:00", item: L("Cerimonia", "Ceremony") },
        { time: "14:30", item: L("Aperitivo in giardino", "Drinks in the garden") }, { time: "19:30", item: L("Cena", "Dinner") }, { time: "21:30", item: L("Primo ballo", "First dance") },
        { time: "22:30", item: L("Taglio della torta", "Cutting the cake") }, { time: "00:30", item: L("Saluti", "Farewell") },
      ] },
      "chi-chiamare": { items: [
        { name: "Villa sul lago", role: L("Location", "Venue"), phone: "+39 031 000 000" }, { name: "Studio Luce", role: L("Fotografo", "Photographer"), phone: "+39 333 000 2222" },
        { name: "Note di Sera", role: L("Musica", "Music"), phone: "+39 333 000 1111" }, { name: "Sara", role: L("Testimone", "Witness"), phone: "+39 333 000 3333" },
        { name: "Luca", role: L("Testimone", "Witness"), phone: "+39 333 000 4444" }, { name: L("Taxi", "Taxi"), role: L("Rientro", "Ride home"), phone: "+39 031 000 111" },
      ] },
      "ordine-cerimonia": { items: [{ time: "13:00", item: L("Ingresso dello sposo", "Groom enters") }, { time: "13:05", item: L("Ingresso della sposa", "Bride enters") }, { time: "13:20", item: L("Promesse", "Vows") }, { time: "13:35", item: L("Scambio degli anelli", "Ring exchange") }] },
      palette: L("Salvia, avorio e bordeaux; lino e candele.", "Sage, ivory and burgundy; linen and candles."),
    },
    notes: "",
    budgetCents: 4_800_000,
    guestQuota: 150,
    groupQuotas,
    bannerImage: null,
    archImage: null,
  } as PremiumData;
}

// Previsione d'esempio: un acquazzone a mezzogiorno, proprio intorno alla cerimonia delle 13.
const DEMO_RAIN: Record<number, number> = { 12: 1, 13: 0.4, 14: 0.8 };
const DEMO_TEMP = [18, 18, 18, 18, 18, 18, 18, 19, 20, 21, 23, 24, 24, 25, 25, 25, 24, 23, 22, 21, 20, 19, 19, 18];
export const DEMO_WEATHER: Weather = { forecast: { tmaxC: 25, tminC: 18, precipMm: 2.2, precipProb: 60, hourly: DEMO_TEMP.map((tempC, hour) => ({ hour, tempC, precipMm: DEMO_RAIN[hour] ?? 0 })) }, place: "Como", sample: true };
