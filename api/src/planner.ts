// Planner premium: raccolte dell'organizzatore (invitati, budget, attività, fornitori), cartella del matrimonio e meteo.
// Qui sta la validazione dei dati, senza accesso al database: così è testabile da sola.
import { CONTRACT_STATUSES, FOLDER, FOLDER_KEYS, ROW_FIELDS, ROW_LIMIT, RSVP_STATUSES, TEXT_LIMIT } from "@inviteme/shared";

export type CollectionKind = "guests" | "budget" | "tasks" | "vendors" | "tables";

type Field = { column: string; type: "text" | "int" | "bool" | "date" | "enum" | "ref"; max?: number; values?: readonly string[] };

// Colonne ammesse per ogni raccolta: il client non può scrivere altro.
export const COLLECTIONS: Record<CollectionKind, { table: string; fields: Record<string, Field> }> = {
  tables: {
    table: "planner_tables",
    fields: {
      name: { column: "name", type: "text", max: 80 },
      seats: { column: "seats", type: "int", max: 30 },
    },
  },
  guests: {
    table: "planner_guests",
    fields: {
      name: { column: "name", type: "text", max: 120 },
      group_name: { column: "group_name", type: "text", max: 80 },
      party_size: { column: "party_size", type: "int", max: 20 },
      response: { column: "response", type: "enum", values: RSVP_STATUSES },
      table_id: { column: "table_id", type: "ref" },
    },
  },
  budget: {
    table: "planner_budget_items",
    fields: {
      category: { column: "category", type: "text", max: 60 },
      label: { column: "label", type: "text", max: 120 },
      amount_cents: { column: "amount_cents", type: "int", max: 100_000_000 },
      due_date: { column: "due_date", type: "date" },
      paid: { column: "paid", type: "bool" },
    },
  },
  tasks: {
    table: "planner_tasks",
    fields: {
      title: { column: "title", type: "text", max: 160 },
      done: { column: "done", type: "bool" },
      days_before: { column: "days_before", type: "int", max: 1000 },
    },
  },
  vendors: {
    table: "planner_vendors",
    fields: {
      name: { column: "name", type: "text", max: 120 },
      role: { column: "role", type: "text", max: 80 },
      contact: { column: "contact", type: "text", max: 160 },
      contract_status: { column: "contract_status", type: "enum", values: CONTRACT_STATUSES },
    },
  },
};

export const isCollectionKind = (v: string): v is CollectionKind => Object.prototype.hasOwnProperty.call(COLLECTIONS, v);

// Valida solo i campi noti: quelli sconosciuti si ignorano, quelli sbagliati danno errore.
export function sanitizeItem(kind: CollectionKind, body: unknown, partial: boolean): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(COLLECTIONS[kind].fields)) {
    if (!(key in input)) {
      if (!partial && def.type === "text" && key === primaryField(kind)) return { ok: false, error: "Campo obbligatorio mancante" };
      continue;
    }
    const v = input[key];
    switch (def.type) {
      case "text": {
        if (typeof v !== "string") return { ok: false, error: `Campo non valido: ${key}` };
        const t = v.trim().slice(0, def.max ?? 200);
        if (!t && key === primaryField(kind)) return { ok: false, error: "Campo obbligatorio mancante" };
        values[def.column] = t;
        break;
      }
      case "int": {
        const n = typeof v === "string" ? Number(v) : v;
        if (typeof n !== "number" || !Number.isFinite(n)) return { ok: false, error: `Numero non valido: ${key}` };
        const max = def.max ?? 1_000_000;
        values[def.column] = Math.max(0, Math.min(max, Math.round(n)));
        break;
      }
      case "bool":
        if (typeof v !== "boolean") return { ok: false, error: `Valore non valido: ${key}` };
        values[def.column] = v;
        break;
      case "date": {
        if (v === null || v === "") {
          values[def.column] = null;
          break;
        }
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `Data non valida: ${key}` };
        values[def.column] = v;
        break;
      }
      case "ref":
        if (v === null || v === "") {
          values[def.column] = null;
          break;
        }
        if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) return { ok: false, error: `Tavolo non valido: ${key}` };
        values[def.column] = v;
        break;
      case "enum":
        if (typeof v !== "string" || !def.values?.includes(v)) return { ok: false, error: `Valore non ammesso: ${key}` };
        values[def.column] = v;
        break;
    }
  }
  if (Object.keys(values).length === 0) return { ok: false, error: "Nessun dato da salvare" };
  return { ok: true, values };
}

function primaryField(kind: CollectionKind): string {
  return kind === "guests" ? "name" : kind === "budget" ? "label" : kind === "tasks" ? "title" : "name";
}

// Cartella del matrimonio: ogni sezione è un testo oppure un elenco di righe tipizzate (orari, contatti, spunte).
// Il catalogo delle sezioni sta in shared: chiavi sconosciute si scartano.
export const DOC_LIMIT = FOLDER_KEYS.size;
export type FolderValue = string | { items: Record<string, string | boolean>[] };

export function sanitizeDocs(input: unknown): Record<string, FolderValue> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<string, FolderValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!FOLDER_KEYS.has(key)) continue;
    const section = FOLDER.find((x) => x.key === key)!;
    if (section.kind === "text") {
      if (typeof value === "string") out[key] = value.slice(0, TEXT_LIMIT);
      continue;
    }
    const rawItems = (value as { items?: unknown })?.items;
    if (!Array.isArray(rawItems)) continue;
    const fields = ROW_FIELDS[section.kind];
    const items: Record<string, string | boolean>[] = [];
    for (const row of rawItems.slice(0, ROW_LIMIT)) {
      if (!row || typeof row !== "object") continue;
      const clean: Record<string, string | boolean> = {};
      for (const [field, type] of Object.entries(fields)) {
        const v = (row as Record<string, unknown>)[field];
        if (type === "bool" && typeof v === "boolean") clean[field] = v;
        if (type === "text" && typeof v === "string") clean[field] = v.trim().slice(0, 200);
      }
      // Una riga vuota non conta: si scarta.
      if (Object.values(clean).some((v) => v === true || (typeof v === "string" && v))) items.push(clean);
    }
    out[key] = { items };
  }
  return out;
}

// Meteo del giorno dell'evento (Open-Meteo, senza chiave). Le previsioni arrivano a circa 16 giorni.
export type Forecast = { date: string; tmaxC: number; tminC: number; precipMm: number; precipProb: number | null };
const FORECAST_MS = 6 * 3600_000;
const forecastCache = new Map<string, { at: number; value: Forecast | null }>();

export async function forecastFor(lat: number, lon: number, date: string): Promise<Forecast | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${date}`;
  const hit = forecastCache.get(key);
  if (hit && Date.now() - hit.at < FORECAST_MS) return hit.value;
  let value: Forecast | null = null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { headers: { "User-Agent": "InviteMe/1.0 (https://demo.shosa.me)" } });
    const d = (await res.json()) as { daily?: Record<string, (number | null)[]> };
    const day = d.daily;
    if (day?.time && day.temperature_2m_max?.[0] != null) {
      value = {
        date,
        tmaxC: Math.round(day.temperature_2m_max[0] as number),
        tminC: Math.round(day.temperature_2m_min?.[0] ?? 0),
        precipMm: Math.round(((day.precipitation_sum?.[0] as number) ?? 0) * 10) / 10,
        precipProb: day.precipitation_probability_max?.[0] ?? null,
      };
    }
  } catch {
    value = null;
  }
  forecastCache.set(key, { at: Date.now(), value });
  return value;
}
