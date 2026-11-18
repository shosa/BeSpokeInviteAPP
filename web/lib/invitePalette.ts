// Colori dell'invito per le pagine di gestione: fondo nel colore del tema, testo leggibile sopra e accento per le illustrazioni.

// Testo chiaro sui fondi scuri, scuro sui chiari.
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0E1116" : "#FFFFFF";
}

// Colore per le illustrazioni: se il colore dell'invito è chiaro, una versione più scura resta leggibile.
export function accentOf(hex: string): string {
  if (inkOn(hex) === "#0E1116") return hex;
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const d = (c: number) => Math.round(c * 0.45).toString(16).padStart(2, "0");
  return `#${d((n >> 16) & 255)}${d((n >> 8) & 255)}${d(n & 255)}`;
}

