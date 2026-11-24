// Cella CSV sicura: tra virgolette, con le virgolette raddoppiate. I valori che un foglio di calcolo leggerebbe come
// formula (iniziano con = + - @, tabulazione o a capo) prendono un apostrofo davanti, così restano testo.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const csvRow = (values: unknown[], sep = ","): string => values.map(csvCell).join(sep);
