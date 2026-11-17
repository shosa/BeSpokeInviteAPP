import type { Lang } from "@/lib/ui";

// Testi inglesi del catalogo, indicizzati per id. In italiano restano quelli del catalogo.
// Se manca una voce, la pagina mostra il testo del catalogo.
export const MODEL_COPY_EN: Record<string, { name: string; tagline: string; description: string }> = {
  "save-the-date": {
    name: "Save the Date",
    tagline: "Announce the date with a single image",
    description: "An elegant card with photo, names and date. The full details come later.",
  },
  "invitation-rsvp": {
    name: "Invitation with RSVP",
    tagline: "All the details and replies in one link",
    description: "A full invitation with programme and attendance form. Map, music and other features are added separately.",
  },
  custom: {
    name: "Custom",
    tagline: "Build the invitation feature by feature",
    description: "Start from the base and add only what you need. Each feature has a fixed price, visible before payment.",
  },
};

export const ADDON_COPY_EN: Record<string, { label: string; description: string }> = {
  rsvp: { label: "Attendance reply", description: "Reply form with custom questions" },
  program: { label: "Detailed programme", description: "Up to 5 entries: ceremony, dinner, party" },
  map: { label: "Map and directions", description: "Map of the venue with a link to directions" },
  music: { label: "Background music", description: "A track from the library, or your own file" },
  countdown: { label: "Countdown", description: "Days, hours, minutes and seconds to the date" },
  gallery: { label: "Photo gallery", description: "Up to 6 photos instead of 3" },
  image: { label: "Image", description: "A full-width photo, uploaded or from Pixabay, with an optional caption" },
};

// Testi del modello in lingua: in inglese prima quelli salvati dalla console, poi quelli predefiniti, poi l'italiano.
export function modelCopy(m: { id: string; name: string; tagline: string; description: string; en?: { name: string; tagline: string; description: string } }, lang: Lang) {
  const base = { name: m.name, tagline: m.tagline, description: m.description };
  if (lang !== "en") return base;
  const saved = m.en && (m.en.name || m.en.tagline || m.en.description) ? m.en : undefined;
  const fallback = MODEL_COPY_EN[m.id];
  return {
    name: saved?.name || fallback?.name || base.name,
    tagline: saved?.tagline || fallback?.tagline || base.tagline,
    description: saved?.description || fallback?.description || base.description,
  };
}

export function addonCopy(key: string, label: string, description: string, lang: Lang) {
  const en = lang === "en" ? ADDON_COPY_EN[key] : undefined;
  return en ?? { label, description };
}

// Nomi dei blocchi, dei campi (per tipo di blocco o evento) e dei template in inglese.
export const BLOCK_COPY_EN: Record<string, string> = {
  cover: "Envelope",
  hero: "Header",
  scratchdate: "Scratch date",
  date: "Date",
  countdown: "Countdown",
  message: "Message",
  gallery: "Gallery",
  image: "Image",
  program: "Programme",
  venue: "Location",
  map: "Map",
  transfer: "How to get there",
  dresscode: "Dress code",
  video: "Video",
  music: "Music",
  rsvp: "Attendance reply",
  gifts: "Gift list",
  faq: "FAQ",
  footer: "Signature",
};

const FIELD_COPY_EN: Record<string, string> = {
  title: "Names or title",
  hosts: "Line under the names",
  eventDate: "Date",
  eventTime: "Start time",
  venue: "Venue",
  address: "Address",
  time: "Time",
  label: "What",
  coverVideo: "Envelope video (silent, max 90 s)",
  transparent: "Transparent",
  occasion: "Subtitle",
  couplePhoto: "Main photo",
  heading: "Title",
  body: "Text",
  photos: "Photos",
  items: "Entries",
  photo: "Venue photo",
  dress: "Dress code",
  video: "Video (silent, max 90 s)",
  music: "Track (mp3, max 6 MB)",
  intro: "Intro text",
  signature: "Signature",
  "transfer.body": "Directions",
  "lookBg": "Background colour",
  "lookInk": "Text colour",
  "lookCover": "Cover colour",
  "lookShape": "Shape",
  "photoShape": "Photo shape",
  "photoFit": "Photo fit",
  "photoFocus": "Photo focus",
  "cover.topText": "Text above the envelope",
  "cover.sealText": "Seal text",
  "cover.envelopeColor": "Envelope colour",
  "cover.sealColor": "Seal colour",
  "cover.tapLabel": "Text to open the envelope",
  "hero.kicker": "Text above the names",
  "hero.scrollLabel": "Scroll text",
  "scratchdate.dateTitle": "Date title",
  "scratchdate.dayLabel": "Day label",
  "scratchdate.monthLabel": "Month label",
  "scratchdate.yearLabel": "Year label",
  "scratchdate.revealLabel": "Reveal text",
  "date.dateTitle": "Date title",
  "date.cellShape": "Cell shape",
  "date.showLabels": "Show labels",
  "gallery.galleryStyle": "Gallery style",
  "image.caption": "Caption",
  "venue.kind": "Type",
  "dresscode.dress": "Dress code",
  "dresscode.colors": "Colours",
  "rsvp.openLabel": "Button to open",
  "rsvp.submitLabel": "Send button",
  "rsvp.thanksLabel": "Thank-you message",
  "mapShape": "Map shape",
  "mapShape.theme": "As the style",
  "mapShape.square": "Square",
  "mapShape.arch": "Arch",
  "mapShape.circle": "Circle",
  "mapShape.rounded": "Rounded corners",
  "mapMode": "How to show it",
  "mapMode.map": "Map on the page",
  "mapMode.button": "«Open in maps» button",
  "map.buttonLabel": "Button text",
  "gifts.body": "Text",
  "gifts.buttonLabel": "Button text",
  "gifts.url": "List link (https://…)",
  "faq.items": "Questions",
  "q": "Question",
  "a": "Answer",
  "rsvpMode": "How to show the form",
  "rsvpMode.popup": "In a popup, with a tap",
  "rsvpMode.inline": "Already open on the page",
  "photoShape.arch": "Arch",
  "photoShape.circle": "Circle",
  "photoShape.oval": "Oval",
  "photoShape.rounded": "Rounded corners",
  "photoShape.diamond": "Diamond",
  "photoShape.hexagon": "Hexagon",
  "photoFit.contain": "Whole photo, no crop",
  "photoFit.cover": "Fill, crop the edges",
  "photoFocus.center": "Centre",
  "photoFocus.top": "Top",
  "photoFocus.bottom": "Bottom",
  "photoFocus.left": "Left",
  "photoFocus.right": "Right",
  "galleryStyle.slider": "Slider",
  "galleryStyle.mosaic": "Mosaic",
  "galleryStyle.grid": "Grid",
};

export function blockCopy(type: string, label: string, lang: Lang) {
  return lang === "en" ? (BLOCK_COPY_EN[type] ?? label) : label;
}

// Chiave del campo: `tipo.chiave` se esiste una traduzione specifica, altrimenti solo la chiave.
export function fieldCopy(type: string, key: string, label: string, lang: Lang) {
  if (lang !== "en") return label;
  return FIELD_COPY_EN[`${type}.${key}`] ?? FIELD_COPY_EN[key] ?? label;
}

// Nome e descrizione di un tema nella lingua del sito: in inglese quelli del manifest (nameEn, descriptionEn), se ci sono.
export function themeCopy(m: { name: string; nameEn?: string }, lang: Lang) {
  return lang === "en" ? m.nameEn || m.name : m.name;
}

// Descrizioni in inglese dei blocchi e degli stili (quelle in italiano sono nel catalogo).
const BLOCK_DESC_EN: Record<string, string> = {
  "cover": "An envelope that opens with a tap, with optional video and sound.",
  "hero": "Names, date and time of the event, subtitle and main photo.",
  "scratchdate": "Day, month and year to reveal with your finger.",
  "date": "Day, month and year in plain sight, always visible.",
  "countdown": "Days, hours, minutes and seconds to the date.",
  "message": "A free text with a title.",
  "gallery": "Up to six photos in a grid.",
  "image": "A full-width photo, uploaded or chosen from Pixabay, with an optional caption.",
  "program": "The day's timings on a timeline.",
  "venue": "Name and type of the place; the address is set in the Map.",
  "map": "Map of the place, or a button that opens it in the phone's maps app.",
  "transfer": "Shuttle, parking, directions.",
  "dresscode": "A dress code, highlighted.",
  "video": "A silent looping video that plays when it enters the screen.",
  "music": "Background music: it starts when the envelope opens, with a button to stop it.",
  "rsvp": "Reply form with the questions you set up: in a popup or already open on the page.",
  "gifts": "A text and a button that opens the gift list on an online shop.",
  "faq": "Questions and answers as an accordion: one answer opens at a time.",
  "footer": "Sign-off at the bottom of the page.",
};

export function blockDescCopy(type: string, description: string, lang: Lang) {
  return lang === "en" ? (BLOCK_DESC_EN[type] ?? description) : description;
}

export function themeDescCopy(m: { description: string; descriptionEn?: string }, lang: Lang) {
  return lang === "en" ? m.descriptionEn || m.description : m.description;
}
