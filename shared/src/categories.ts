// Categorie dei template: la vetrina le raggruppa e le filtra, e il contenuto d'esempio segue la categoria.
export const THEME_CATEGORIES_ORDER = ["wedding", "baby", "birthday", "graduation", "anniversary", "corporate"] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES_ORDER)[number];

// Ogni template sta in una sola categoria: il contenuto d'esempio segue quella categoria.
export const THEME_CATEGORIES: Record<string, ThemeCategory[]> = {
  "anniversario-oro": ["anniversary"],
  "argento-anniversario": ["anniversary"],
  "autunno-cena": ["birthday"],
  "avorio-botanico": ["wedding"],
  "baby-shower": ["baby"],
  "battesimo-celeste": ["baby"],
  "compleanno-festa": ["birthday"],
  "festa-spiaggia": ["wedding"],
  "gala-aziendale": ["corporate"],
  "giardino": ["wedding"],
  "invitereference": ["wedding"],
  "laurea-giulia": ["graduation"],
  "lavanda-nozze": ["wedding"],
  "matrimonio-citta": ["wedding"],
  "matrimonio-lago": ["wedding"],
  "minimo": ["wedding"],
  "notturno": ["wedding"],
  "pensionamento": ["corporate"],
  "prima-comunione": ["baby"],
  "redazione": ["corporate"],
  "rivista": ["corporate"],
  "velo": ["wedding"],
};

export function themeCategories(themeId: string): ThemeCategory[] {
  return THEME_CATEGORIES[themeId] ?? ["wedding"];
}
