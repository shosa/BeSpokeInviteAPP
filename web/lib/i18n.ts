import { cookies } from "next/headers";
import type { Lang } from "./ui";

export type { Lang } from "./ui";
export { UI, ui, tr } from "./ui";

// Lingua del sito: cookie `lang` (it di default).
export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get("lang")?.value === "en" ? "en" : "it";
}
