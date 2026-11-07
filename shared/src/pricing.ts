import { getModel, type Catalog } from "./catalog";

// Prezzo dell'invito: unico, con tutte le sezioni incluse. Calcolato lato server dal catalogo.
export function totalCents(c: Catalog, _model: string, _selected: string[]): number {
  return getModel(c)?.priceCents ?? 0;
}

// Nessuna funzione si paga a parte.
export function addonsCents(_c: Catalog, _model: string, _keys: string[]): number {
  return 0;
}
