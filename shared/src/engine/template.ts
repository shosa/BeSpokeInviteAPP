// Motore di template di Bespoke Invite: un sottoinsieme di Mustache, sicuro per costruzione.
// Ogni valore viene escapato: dai dati non può arrivare HTML grezzo. Il template invece è del tema, ed è fidato.
//
// Sintassi:
//   {{percorso}}              testo escapato. Percorsi con punti (a.b), oppure "." per l'elemento corrente
//   {{percorso | lines}}      come sopra, con gli a capo trasformati in <br>
//   {{percorso | url}}        come sopra, codificato per un URL (encodeURIComponent)
//   {{#nome}}...{{/nome}}     sezione: con un array ripete per ogni elemento; con un valore vero rende una volta
//   {{^nome}}...{{/nome}}     sezione invertita: rende solo se il valore è falso o vuoto
//   {{! commento }}           non rende nulla

export type TemplateNode =
  | { kind: "text"; value: string }
  | { kind: "var"; path: string; filter?: Filter }
  | { kind: "section"; name: string; inverted: boolean; children: TemplateNode[] };

export type Filter = "lines" | "url";

export type RenderOptions = {
  // Percorsi che non esistono nei dati: servono ai test del tema per trovare refusi nel template.
  missing?: Set<string>;
  // Font scelto per singolo campo: il valore del campo viene avvolto con il suo stack CSS (vedi fonts.ts).
  fonts?: Record<string, string>;
};

const TAG = /\{\{\s*([#^/!]?)\s*([^}]*?)\s*\}\}/g;
const PATH = /^(\.|[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

export function parseTemplate(source: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  const open: Extract<TemplateNode, { kind: "section" }>[] = [];
  let current = root;
  let cursor = 0;

  for (const m of source.matchAll(TAG)) {
    const index = m.index ?? 0;
    if (index > cursor) current.push({ kind: "text", value: source.slice(cursor, index) });
    cursor = index + m[0].length;
    const sigil = m[1];
    const body = m[2];

    if (sigil === "!") continue;

    if (sigil === "#" || sigil === "^") {
      if (!PATH.test(body) || body === ".") throw new Error(`Sezione non valida: {{${sigil}${body}}}`);
      const section: Extract<TemplateNode, { kind: "section" }> = { kind: "section", name: body, inverted: sigil === "^", children: [] };
      current.push(section);
      open.push(section);
      current = section.children;
    } else if (sigil === "/") {
      const last = open.pop();
      if (!last || last.name !== body) throw new Error(`Sezione chiusa senza apertura corrispondente: {{/${body}}}`);
      current = open.length ? open[open.length - 1].children : root;
    } else {
      const [path, filter] = body.split("|").map((s) => s.trim());
      if (!PATH.test(path)) throw new Error(`Segnaposto non valido: {{${body}}}`);
      if (filter !== undefined && filter !== "lines" && filter !== "url") throw new Error(`Filtro non ammesso: ${filter}`);
      current.push({ kind: "var", path, filter: filter as Filter | undefined });
    }
  }

  if (open.length) throw new Error(`Sezione non chiusa: {{#${open[open.length - 1].name}}}`);
  if (cursor < source.length) root.push({ kind: "text", value: source.slice(cursor) });
  return root;
}

export function renderTemplate(nodes: TemplateNode[], data: Record<string, unknown>, options: RenderOptions = {}): string {
  return renderNodes(nodes, [data], options);
}

function renderNodes(nodes: TemplateNode[], scopes: unknown[], options: RenderOptions): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.value;
    } else if (node.kind === "var") {
      const value = lookup(node.path, scopes);
      if (value === undefined) {
        options.missing?.add(node.path);
        continue;
      }
      const text = toText(value);
      let html: string;
      if (node.filter === "lines") html = escapeHtml(text).replace(/\r?\n/g, "<br>");
      else if (node.filter === "url") html = escapeHtml(encodeURIComponent(text));
      else html = escapeHtml(text);
      const stack = options.fonts && Object.prototype.hasOwnProperty.call(options.fonts, node.path) ? options.fonts[node.path] : undefined;
      // Lo stack viene dalla libreria dei font (mai dai dati): le virgolette restano nell'attributo tra doppi apici.
      out += stack && html ? `<span style="font-family:${stack}">${html}</span>` : html;
    } else {
      const value = lookup(node.name, scopes);
      if (value === undefined) options.missing?.add(node.name);
      if (node.inverted) {
        if (!truthy(value)) out += renderNodes(node.children, scopes, options);
      } else if (Array.isArray(value)) {
        for (const item of value) out += renderNodes(node.children, [...scopes, item], options);
      } else if (truthy(value)) {
        out += renderNodes(node.children, [...scopes, value], options);
      }
    }
  }
  return out;
}

function lookup(path: string, scopes: unknown[]): unknown {
  if (path === ".") return scopes[scopes.length - 1];
  const keys = path.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    let cur: unknown = scopes[i];
    for (const key of keys) {
      if (!cur || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, key)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[key];
    }
    if (cur !== undefined) return cur;
  }
  return undefined;
}

function truthy(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
