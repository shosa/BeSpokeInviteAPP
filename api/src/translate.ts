import Anthropic from "@anthropic-ai/sdk";
import { LOCALE_INFO, applyTranslations, translatableTexts, type InviteConfig, type Locale } from "@inviteme/shared";
import { loadAssistantSettings } from "./assistantSettings";

// Traduzione automatica degli inviti con BeSpoke AI (API di Anthropic, modello scelto nella console per l'assistente).
// Si traducono solo i testi che non sono già nella memoria dell'invito: ripubblicando, solo quelli nuovi o cambiati.

export type TranslationMemory = Partial<Record<Locale, Record<string, string>>>;

const CHUNK = 60; // testi per richiesta
const MAX_TEXTS = 400; // tetto per invito (un invito ne ha qualche decina)

const SYSTEM = `You translate wedding and event invitations written by couples, families and companies.
Translate every text you receive from the source language into the target language.
- Keep the tone, warmth and register of the original; write as a native speaker would for an invitation, not word for word.
- Never translate people's names, place names, venue names, addresses, times, dates written as numbers, phone numbers, email addresses, URLs, hashtags or emoji. Keep them exactly as they are.
- Keep line breaks and punctuation structure. Keep it about the same length.
- If a text is already in the target language, or has nothing to translate, return it unchanged.
- Return exactly one translation for each input text, in the same order.`;

export function translationAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_KEY);
}

async function translateChunk(client: Anthropic, model: string, texts: string[], from: Locale, to: Locale): Promise<string[]> {
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { translations: { type: "array", items: { type: "string" } } },
          required: ["translations"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `Source language: ${LOCALE_INFO[from].en}\nTarget language: ${LOCALE_INFO[to].en}\nTexts (JSON array, ${texts.length} items):\n${JSON.stringify(texts)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("traduzione rifiutata dal modello");
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const out = (JSON.parse(text) as { translations?: unknown }).translations;
  if (!Array.isArray(out) || out.length !== texts.length || !out.every((x) => typeof x === "string")) throw new Error("traduzione incompleta");
  return out as string[];
}

// Traduce i testi mancanti dalla memoria; ritorna la memoria aggiornata per quella lingua.
export async function translateTexts(texts: string[], from: Locale, to: Locale, memory: Record<string, string> = {}): Promise<Record<string, string>> {
  const missing = texts.filter((t) => typeof memory[t] !== "string").slice(0, MAX_TEXTS);
  if (missing.length === 0) return memory;
  if (!translationAvailable()) throw new Error("BeSpoke AI non è configurato");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY, timeout: 90_000, maxRetries: 2 });
  const { model } = (await loadAssistantSettings()).settings;
  const next = { ...memory };
  for (let i = 0; i < missing.length; i += CHUNK) {
    const part = missing.slice(i, i + CHUNK);
    const done = await translateChunk(client, model, part, from, to);
    part.forEach((src, j) => { next[src] = done[j]!; });
  }
  return next;
}

// Configurazione tradotta in `to` partendo dalla lingua principale dell'invito, con la memoria aggiornata.
export async function translateConfig(config: InviteConfig, to: Locale, memory: Record<string, string> = {}, opts: { rsvp?: boolean } = {}): Promise<{ config: InviteConfig; memory: Record<string, string> }> {
  const texts = translatableTexts(config, opts);
  const next = await translateTexts(texts, config.locale, to, memory);
  // La memoria tiene solo i testi ancora usati: non cresce all'infinito con le versioni vecchie.
  const kept = Object.fromEntries(texts.filter((t) => typeof next[t] === "string").map((t) => [t, next[t]!]));
  return { config: { ...applyTranslations(config, kept, opts), locale: to }, memory: kept };
}
