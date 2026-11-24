// Cartella dell'evento in PDF: l'organizzatore sceglie cosa includere, e il documento è impaginato a mano
// (copertina, indice con numeri di pagina, una sezione per volta, tavoli disegnati, piè di pagina).
import PDFDocument from "pdfkit";
import { BUDGET_CATEGORIES, FOLDER_GROUPS, FOLDER_GROUPS_EN, eventPhrases, folderFor, type FolderSection } from "@inviteme/shared";

export const PDF_CHOICES = [
  "riepilogo",
  "budget",
  "invitati",
  "tavoli",
  "attivita",
  "fornitori",
  ...FOLDER_GROUPS.map((g) => `cartella:${g}`),
] as const;
export type PdfChoice = (typeof PDF_CHOICES)[number];

export type PdfData = {
  title: string;
  eventType?: string; // matrimonio, compleanno…: testi e sezioni della cartella
  eventDate: string;
  venue: string;
  accent: string; // colore del tema, #rrggbb
  budgetCents: number;
  guestQuota: number;
  guests: { name: string; group_name: string; party_size: number; response: string; table_id: string | null }[];
  tables: { id: string; name: string; seats: number }[];
  budget: { label: string; category: string; amount_cents: number; due_date: string | null; paid: boolean; quote_id?: string | null }[];
  // Preventivi del budget: quelli prenotati sono i fornitori scelti, e la loro somma è la spesa prevista.
  quotes?: { id: string; category: string; name: string; amount_cents: number; booked: boolean; signed: boolean }[];
  lang?: "it" | "en";
  tasks: { title: string; done: boolean; days_before: number }[];
  vendors: { name: string; role: string; contact: string; contract_status: string }[];
  docs: Record<string, string | { items: Record<string, string | boolean>[] }>;
};

const INK = "#1f1914";
const SOFT = "#6b5a48";
const LINE = "#d9cdbb";
const MARGIN = 56;
const LABEL: Record<"it" | "en", Record<string, string>> = {
  it: { yes: "Viene", no: "Non viene", pending: "In attesa" },
  en: { yes: "Attending", no: "Not attending", pending: "Pending" },
};
const safeAccent = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#8a6427");

// Il colore del tema può essere troppo chiaro per una pagina bianca: lo si scurisce finché il contrasto
// sul foglio non arriva a 4,5:1 (WCAG). Così bordi, filetti e titoli restano leggibili su ogni tema.
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const readableAccent = (hex: string): string => {
  const base = safeAccent(hex);
  let rgb = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  for (let step = 0; step < 20; step++) {
    const contrast = 1.05 / (luminance(rgb) + 0.05);
    if (contrast >= 4.5) break;
    rgb = rgb.map((v) => Math.round(v * 0.92));
  }
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

export function isPdfChoice(v: string): v is PdfChoice {
  return (PDF_CHOICES as readonly string[]).includes(v);
}

export async function buildPlannerPdf(data: PdfData, choices: PdfChoice[]): Promise<Buffer> {
  const en = data.lang === "en";
  const t = (it: string, eng: string) => (en ? eng : it);
  const loc = en ? "en-GB" : "it-IT";
  const euro = (cents: number) => (cents / 100).toLocaleString(loc, { style: "currency", currency: "EUR" });
  const dateLabel = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso + "T00:00:00")) ? new Date(iso + "T12:00:00").toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" }) : "");
  const groupName = (g: string) => (en ? FOLDER_GROUPS_EN[g as keyof typeof FOLDER_GROUPS_EN] ?? g : g);
  const catName = (k: string) => { const c = BUDGET_CATEGORIES.find((x) => x.key === k); return c ? (en ? c.en : c.it) : t("Altro", "Other"); };
  const quotes = data.quotes ?? [];
  const booked = quotes.filter((q) => q.booked);
  // Spesa prevista: fornitori prenotati più le voci senza fornitore (come nella sezione Budget del planner).
  const spent = booked.reduce((n, q) => n + q.amount_cents, 0) + data.budget.filter((b) => !b.quote_id).reduce((n, b) => n + b.amount_cents, 0);
  const paidTotal = data.budget.filter((b) => b.paid).reduce((n, b) => n + b.amount_cents, 0);
  const doc = new PDFDocument({ size: "A4", margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 0 }, bufferPages: true, info: { Title: `${t(`La cartella ${eventPhrases(data.eventType, "it").of}`, `The ${eventPhrases(data.eventType, "en").of} folder`)}: ${data.title}`, Author: "Bespoke Invite" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const accent = readableAccent(data.accent);
  const width = doc.page.width - MARGIN * 2;
  const bottom = () => doc.page.height - MARGIN - 20;

  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const title = (text: string, size = 22) => {
    doc.font("Times-Roman").fontSize(size).fillColor(INK).text(text, MARGIN, doc.y, { width });
    doc.moveDown(0.3);
  };
  const kicker = (text: string) => {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(accent).text(text.toUpperCase(), MARGIN, doc.y, { width, characterSpacing: 1.4 });
    doc.moveDown(0.4);
  };
  const rule = () => {
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).strokeColor(LINE).lineWidth(0.6).stroke();
    doc.moveDown(0.8);
  };
  const para = (text: string, size = 10.5, color = INK) => {
    doc.font("Helvetica").fontSize(size).fillColor(color).text(text, MARGIN, doc.y, { width, lineGap: 2 });
    doc.moveDown(0.5);
  };
  // Tabella semplice: colonne con larghezze in proporzione, intestazione in maiuscolo, righe con filetto.
  const table = (head: string[], rows: string[][], ratios: number[]) => {
    const total = ratios.reduce((a, b) => a + b, 0);
    const cols = ratios.map((r) => (r / total) * width);
    const rowH = (cells: string[]) => Math.max(16, ...cells.map((c, i) => doc.heightOfString(c, { width: cols[i] - 8 }) + 8));
    ensure(22);
    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(SOFT);
    head.forEach((h, i) => { doc.text(h.toUpperCase(), x + 4, doc.y, { width: cols[i] - 8, characterSpacing: 0.8, lineBreak: false }); x += cols[i]; });
    doc.moveDown(1.1);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).strokeColor(accent).lineWidth(0.8).stroke();
    doc.moveDown(0.3);
    for (const r of rows) {
      const h = rowH(r);
      ensure(h + 4);
      let cx = MARGIN;
      const top = doc.y;
      doc.font("Helvetica").fontSize(9.5).fillColor(INK);
      r.forEach((cell, i) => { doc.text(cell, cx + 4, top + 3, { width: cols[i] - 8 }); cx += cols[i]; });
      doc.y = top + h;
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).strokeColor(LINE).lineWidth(0.4).stroke();
      doc.moveDown(0.1);
    }
    doc.moveDown(0.6);
  };
  const sectionStart = (group: string, name: string) => {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 6).fill(accent);
    doc.y = MARGIN;
    kicker(group);
    title(name, 26);
    rule();
  };

  // Copertina.
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#fdfbf7");
  doc.rect(MARGIN, 200, 60, 3).fill(accent);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(accent).text(t(`LA CARTELLA ${eventPhrases(data.eventType, "it").of.toUpperCase()}`, `THE ${eventPhrases(data.eventType, "en").of.toUpperCase()} FOLDER`), MARGIN, 220, { characterSpacing: 2 });
  doc.font("Times-Roman").fontSize(44).fillColor(INK).text(data.title || t(eventPhrases(data.eventType, "it").your, eventPhrases(data.eventType, "en").your), MARGIN, 250, { width });
  doc.font("Helvetica").fontSize(13).fillColor(SOFT).text([dateLabel(data.eventDate), data.venue].filter(Boolean).join("  ·  "), MARGIN, doc.y + 14, { width });
  doc.font("Helvetica").fontSize(8.5).fillColor(SOFT).text("Bespoke Invite", MARGIN, doc.page.height - MARGIN - 10);

  // Indice: pagina riservata, compilata alla fine con i numeri di pagina.
  doc.addPage();
  const indexPage = doc.bufferedPageRange().count - 1;
  const entries: { label: string; page: number }[] = [];

  const want = (c: PdfChoice) => choices.includes(c);
  const attendingPersons = data.guests.filter((g) => g.response === "yes").reduce((n, g) => n + g.party_size, 0);

  if (want("riepilogo")) {
    sectionStart(t("Riepilogo", "Overview"), t("Il colpo d'occhio", "At a glance"));
    entries.push({ label: t("Riepilogo", "Overview"), page: doc.bufferedPageRange().count - 1 });
    const done = data.tasks.filter((x) => x.done).length;
    table([t("Voce", "Item"), t("Valore", "Value")], [
      [t("Persone confermate", "Confirmed people"), String(attendingPersons)],
      [t("Gruppi di invitati", "Guest groups"), String(data.guests.length)],
      [t("Spesa prevista", "Planned spend"), euro(spent)],
      [t("Budget totale", "Total budget"), data.budgetCents ? euro(data.budgetCents) : t("non impostato", "not set")],
      [t("Attività completate", "Tasks done"), `${done} ${t("di", "of")} ${data.tasks.length}`],
      [t("Fornitori", "Vendors"), String(data.vendors.length + booked.length)],
      [t("Posti nei tavoli", "Table seats"), `${data.tables.reduce((n, x) => n + x.seats, 0)}`],
    ], [2, 1]);
  }

  if (want("budget")) {
    sectionStart("Budget", t("Spese e pagamenti", "Costs and payments"));
    entries.push({ label: "Budget", page: doc.bufferedPageRange().count - 1 });
    para(en
      ? `Planned ${euro(spent)}, paid ${euro(paidTotal)}${data.budgetCents ? `, on a budget of ${euro(data.budgetCents)}: ${euro(Math.max(0, data.budgetCents - spent))} still available` : ""}.`
      : `Previsti ${euro(spent)}, pagati ${euro(paidTotal)}${data.budgetCents ? `, su un budget di ${euro(data.budgetCents)}: restano liberi ${euro(Math.max(0, data.budgetCents - spent))}` : ""}.`);
    if (booked.length) {
      kicker(t("Fornitori prenotati", "Booked vendors"));
      table([t("Fornitore", "Vendor"), t("Categoria", "Category"), t("Contratto", "Contract"), t("Importo", "Amount")], booked.map((q) => [
        q.name, catName(q.category), q.signed ? t("Firmato", "Signed") : t("Da firmare", "To sign"), euro(q.amount_cents),
      ]), [3, 3, 2, 2]);
    }
    if (data.budget.length) {
      kicker(t("Pagamenti", "Payments"));
      const vendorOf = (id: string | null | undefined) => quotes.find((q) => q.id === id)?.name ?? "";
      table([t("Voce", "Item"), t("Fornitore", "Vendor"), t("Scadenza", "Due"), t("Importo", "Amount"), t("Stato", "Status")], data.budget.map((b) => [
        b.label, vendorOf(b.quote_id) || b.category, b.due_date ? dateLabel(b.due_date) : "—", euro(b.amount_cents), b.paid ? t("Pagato", "Paid") : t("Da pagare", "To pay"),
      ]), [3, 2.5, 2, 2, 1.8]);
    }
  }

  if (want("invitati")) {
    sectionStart(t("Invitati", "Guests"), t("Chi viene", "Who's coming"));
    entries.push({ label: t("Invitati", "Guests"), page: doc.bufferedPageRange().count - 1 });
    para(en ? `${attendingPersons} confirmed people${data.guestQuota ? ` out of a limit of ${data.guestQuota}` : ""}.` : `${attendingPersons} persone confermate${data.guestQuota ? ` su una quota di ${data.guestQuota}` : ""}.`);
    const noGroup = t("Senza gruppo", "No group");
    const groups = [...new Set(data.guests.map((g) => g.group_name || noGroup))];
    for (const gname of groups) {
      kicker(gname);
      table([t("Nome", "Name"), t("Persone", "People"), t("Risposta", "Reply")], data.guests.filter((g) => (g.group_name || noGroup) === gname).map((g) => [g.name, String(g.party_size), LABEL[en ? "en" : "it"][g.response] ?? g.response]), [4, 1.5, 2]);
    }
  }

  if (want("tavoli")) {
    sectionStart(t("Organizza tavoli", "Seating"), t("Piano dei tavoli", "Seating plan"));
    entries.push({ label: t("Piano dei tavoli", "Seating plan"), page: doc.bufferedPageRange().count - 1 });
    for (const t of data.tables) {
      const seated = data.guests.filter((g) => g.table_id === t.id);
      const taken = seated.reduce((n, g) => n + g.party_size, 0);
      ensure(150);
      const cx = MARGIN + 75;
      const cy = doc.y + 75;
      const r = 52;
      doc.circle(cx, cy, r).fillColor("#f5efe4").fill();
      doc.circle(cx, cy, r).strokeColor(accent).lineWidth(0.8).stroke();
      for (let i = 0; i < t.seats; i++) {
        const a = (i / t.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(a) * (r + 12);
        const sy = cy + Math.sin(a) * (r + 12);
        doc.circle(sx, sy, 4).fillColor(i < taken ? accent : "#ffffff").fill();
        doc.circle(sx, sy, 4).strokeColor(accent).lineWidth(0.5).stroke();
      }
      doc.font("Times-Roman").fontSize(15).fillColor(INK).text(t.name, cx - 50, cy - 16, { width: 100, align: "center" });
      doc.font("Helvetica").fontSize(9).fillColor(SOFT).text(`${taken} / ${t.seats} posti`, cx - 50, cy + 4, { width: 100, align: "center" });
      const listX = MARGIN + 170;
      const listTop = cy - 50;
      doc.font("Helvetica").fontSize(10.5).fillColor(INK);
      let ly = listTop;
      if (seated.length === 0) doc.fillColor(SOFT).text("Nessuno ancora seduto.", listX, ly, { width: width - 170 });
      for (const g of seated) {
        doc.fillColor(INK).text(`${g.name}${g.party_size > 1 ? `  (+${g.party_size - 1})` : ""}`, listX, ly, { width: width - 170 });
        ly = doc.y + 3;
      }
      doc.y = Math.max(ly, cy + r + 20);
      doc.moveDown(0.5);
    }
    const unseated = data.guests.filter((g) => !g.table_id && g.response !== "no");
    if (unseated.length) {
      kicker(t("Ancora senza posto", "Still without a seat"));
      para(unseated.map((g) => g.name).join(" · "), 10, SOFT);
    }
  }

  if (want("attivita")) {
    sectionStart(t("Attività", "To-do"), t("Cosa resta da fare", "What's left to do"));
    entries.push({ label: t("Attività", "To-do"), page: doc.bufferedPageRange().count - 1 });
    for (const task of data.tasks) {
      ensure(20);
      const y = doc.y + 2;
      doc.rect(MARGIN, y, 9, 9).strokeColor(accent).lineWidth(0.8).stroke();
      if (task.done) doc.moveTo(MARGIN + 2, y + 4.5).lineTo(MARGIN + 4, y + 7).lineTo(MARGIN + 7.5, y + 1.5).strokeColor(accent).lineWidth(1.2).stroke();
      doc.font("Helvetica").fontSize(10.5).fillColor(task.done ? SOFT : INK).text(task.title, MARGIN + 18, doc.y, { width: width - 180, continued: false });
      doc.y = Math.max(doc.y, y + 12);
      doc.font("Helvetica").fontSize(9).fillColor(SOFT).text(t(`${task.days_before} giorni prima`, `${task.days_before} days before`), MARGIN + width - 150, y + 1, { width: 150, align: "right" });
      doc.moveDown(0.4);
    }
  }

  if (want("fornitori")) {
    sectionStart(t("Fornitori", "Vendors"), t("Chi ci aiuta", "Who's helping us"));
    entries.push({ label: t("Fornitori", "Vendors"), page: doc.bufferedPageRange().count - 1 });
    table([t("Nome", "Name"), t("Ruolo", "Role"), t("Contatto", "Contact"), t("Contratto", "Contract")], data.vendors.map((v) => [v.name, v.role, v.contact, v.contract_status === "signed" ? t("Firmato", "Signed") : t("Da firmare", "To sign")]), [3, 2.5, 3, 2]);
  }

  const groups = choices.filter((c) => c.startsWith("cartella:")).map((c) => c.slice(9));
  for (const group of FOLDER_GROUPS.filter((g) => groups.includes(g))) {
    const sections = folderFor(data.eventType).filter((s) => s.group === group);
    sectionStart(t("La cartella", "The folder"), groupName(group));
    entries.push({ label: groupName(group), page: doc.bufferedPageRange().count - 1 });
    for (const s of sections) renderFolderSection(s);
  }

  function renderFolderSection(s: FolderSection) {
    const v = data.docs[s.key];
    const items = v && typeof v === "object" ? v.items : [];
    const sTitle = en ? s.titleEn : s.title;
    if (s.key === "fornitori") {
      if (data.vendors.length === 0) return;
      kicker(sTitle);
      table([t("Nome", "Name"), t("Ruolo", "Role"), t("Contatto", "Contact")], data.vendors.map((x) => [x.name, x.role, x.contact]), [3, 2.5, 3]);
      return;
    }
    if (s.kind === "text") {
      const text = typeof v === "string" ? v.trim() : "";
      if (!text) return;
      kicker(sTitle);
      para(text);
      return;
    }
    if (!items || items.length === 0) return;
    kicker(sTitle);
    if (s.kind === "timeline") table([t("Ore", "Time"), t("Momento", "Moment")], items.map((r) => [String(r.time ?? ""), String(r.item ?? "")]), [1, 4]);
    if (s.kind === "contacts") table([t("Nome", "Name"), t("Ruolo", "Role"), t("Telefono", "Phone")], items.map((r) => [String(r.name ?? ""), String(r.role ?? ""), String(r.phone ?? "")]), [3, 2.5, 2]);
    if (s.kind === "checklist") {
      for (const r of items) {
        ensure(18);
        const y = doc.y + 2;
        doc.rect(MARGIN, y, 9, 9).strokeColor(accent).lineWidth(0.8).stroke();
        if (r.done) doc.moveTo(MARGIN + 2, y + 4.5).lineTo(MARGIN + 4, y + 7).lineTo(MARGIN + 7.5, y + 1.5).strokeColor(accent).lineWidth(1.2).stroke();
        doc.font("Helvetica").fontSize(10.5).fillColor(r.done ? SOFT : INK).text(String(r.text ?? ""), MARGIN + 18, doc.y, { width: width - 18 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.4);
    }
  }

  // Indice con numeri di pagina, nella pagina riservata.
  doc.switchToPage(indexPage);
  doc.y = MARGIN;
  kicker(t("Indice", "Contents"));
  title(t("Cosa c'è dentro", "What's inside"), 26);
  rule();
  doc.font("Helvetica").fontSize(11).fillColor(INK);
  for (const e of entries) {
    ensure(20);
    const y = doc.y;
    doc.text(e.label, MARGIN, y, { width: width - 60, lineBreak: false });
    doc.text(String(e.page + 1), MARGIN + width - 50, y, { width: 50, align: "right", lineBreak: false });
    doc.moveTo(MARGIN + doc.widthOfString(e.label) + 6, y + 8).lineTo(MARGIN + width - 56, y + 8).strokeColor(LINE).lineWidth(0.4).dash(1, { space: 2 }).stroke().undash();
    doc.y = y + 22;
  }

  // Piè di pagina su tutte le pagine (esclusa la copertina).
  // Il piè di pagina sta nel margine inferiore, che qui è zero: pdfkit non aggiunge pagine.
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(SOFT).text(`${data.title || t("La cartella", "The folder")}  ·  ${i + 1}`, MARGIN, doc.page.height - MARGIN + 6, { width, align: "right", lineBreak: false });
  }

  doc.end();
  return done;
}
