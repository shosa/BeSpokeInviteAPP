import {
  ADDON_KEYS,
  BLOCK_LABELS,
  blockDef,
  escapeHtml,
  fontStack,
  fontsStylesheetUrl,
  isFontId,
  renderTemplate,
  type AddonKey,
  type BlockType,
  type FontId,
  type InviteConfig,
  type RsvpQuestion,
  type TemplateNode,
  type ThemeManifest,
} from "@inviteme/shared";
import { blockPartials } from "./blocks";
import { labelsFor } from "./i18n";

// Renderer della pagina invito: i blocchi visibili, nell'ordine scelto, più lo stile del tema.
// Ogni blocco è un template (engine/blocks/<tipo>.html) riempito con i dati dell'evento e con le proprie proprietà.
// Il template del blocco è fidato; i valori dei clienti passano sempre da escapeHtml (o dai filtri lines/url).

export type StyleFiles = {
  dir: string;
  manifest: ThemeManifest;
  css: string;
  // Markup proprio dello stile per alcuni blocchi (themes/<id>/blocks/<tipo>.html). Senza, vale il blocco standard.
  blocks?: Map<BlockType, TemplateNode[]>;
};

export type PageInput = {
  theme: StyleFiles;
  config: InviteConfig;
  slug: string;
  features: ReadonlySet<AddonKey>;
  runtime: string;
  preview?: boolean; // anteprima e demo: niente busta, il contenuto è subito visibile
  builder?: boolean; // anteprima del builder: ogni blocco ha un contenitore con il suo id, per evidenziarlo e selezionarlo
  missing?: Set<string>; // validazione: segnaposto che non trovano un dato
};

const MONTHS = {
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const WEEKDAYS = {
  it: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// Riferimenti "assets/…" nel CSS e nei template dei blocchi: il motore li porta sul percorso pubblico dello stile.
export function themeAssetsBase(themeId: string): string {
  return `/api/themes/${themeId}/assets`;
}

export function renderInvitePage(input: PageInput): string {
  const { theme, config, slug, features, runtime } = input;
  const m = theme.manifest;
  const base = themeAssetsBase(m.id);
  const partials = new Map([...blockPartials().partials, ...(theme.blocks ?? [])]);

  const globals = pageGlobals(input);
  let cover = "";
  // Font scelti dal cliente per i testi: solo quelli della libreria finiscono nel foglio di stile della pagina.
  const usedFonts = new Set<FontId>();
  // Video di sfondo per zona: intestazione e corpo hanno ciascuno il proprio filmato, muto e in ciclo.
  const zoneVideo = (file: string, zone: string) =>
    `<video class="zone-video" data-zone-video="${zone}" muted loop playsinline disablepictureinpicture preload="auto" src="${base}/${escapeHtml(file.replace(/^assets\//, ""))}" aria-hidden="true" tabindex="-1"></video>`;
  // Video del corpo: fisso dietro tutto il contenuto, così i blocchi scorrono sopra di lui.
  const bodyVideo = m.backgroundVideo?.body ? zoneVideo(m.backgroundVideo.body, "body").replace('class="zone-video"', 'class="zone-video zone-fixed"') + "\n" : "";
  let main = "";
  // Blocchi consecutivi della stessa zona stanno in un solo contenitore, con il video di quella zona dietro.
  let zoneOpen: string | null = null;
  // L'intestazione con il suo video sta in un contenitore che scorre via con lei. Il corpo ha un video fisso dietro i contenuti (vedi sotto).
  // Gli altri stili restano con lo stesso markup di prima.
  const closeZone = () => (zoneOpen ? ((zoneOpen = null), "</div>") : "");
  const framedZone = (zone: "hero", framed: string): string => {
    const file = m.backgroundVideo?.[zone];
    if (!file) return closeZone() + framed;
    if (zoneOpen === zone) return framed;
    const pre = closeZone();
    zoneOpen = zone;
    return `${pre}<div class="zone zone-${zone}">${zoneVideo(file, zone)}${framed}`;
  };
  for (const instance of config.blocks) {
    if (instance.hidden || !blockDef(instance.type)) continue;
    // Busta-video del tema: il filmato è dello stile, il blocco Busta non ha proprietà modificabili.
    // Le proprietà della busta scelte dal cliente (scritte, rimbalzo, sfondo) restano; il filmato lo mette lo stile.
    const block = instance.type === "cover" && m.envelope ? { ...instance, props: { ...instance.props, coverVideo: m.envelope.video, ...(m.envelope.poster ? { coverPoster: m.envelope.poster } : {}) } } : instance;
    const template = partials.get(block.type as BlockType);
    if (!template) continue;
    // Un campo vuoto non cancella il valore dell'evento quando la proprietà esiste anche tra i dati dell'evento (nomi, riga sotto i nomi).
    const merged: Record<string, unknown> = { ...globals, ...listFlags(block.props) };
    // Gli interruttori mancanti (inviti salvati prima del campo) prendono il valore predefinito.
    for (const f of blockDef(block.type)?.fields ?? []) {
      if (f.type === "toggle" && merged[f.key] === undefined) merged[f.key] = f.default ?? false;
    }
    for (const [k, v] of Object.entries(block.props)) {
      if (v === "" && k in globals) continue;
      merged[k] = v;
    }
    // Le etichette modificate nel blocco sostituiscono quelle del tema, solo per questo blocco.
    const labelTexts: Record<string, string> = {};
    for (const l of BLOCK_LABELS[block.type as BlockType] ?? []) {
      const v = block.props[l.key];
      if (typeof v === "string" && v.trim()) labelTexts[l.tKey] = v;
    }
    if (Object.keys(labelTexts).length) merged.t = { ...(globals.t as Record<string, string>), ...labelTexts };
    // Il tipo del luogo si mostra con il suo nome (Villa, Chiesa…), nella lingua dell'invito.
    // Sempre definito per il luogo (vuoto se non scelto), così il segnaposto è coperto anche senza tipo.
    if (block.type === "venue") {
      const names: Record<string, Record<string, string>> = {
        it: { villa: "Villa", chiesa: "Chiesa", ristorante: "Ristorante", giardino: "Giardino", hotel: "Hotel", sala: "Sala ricevimenti", spiaggia: "Spiaggia", altro: "Altro" },
        en: { villa: "Villa", chiesa: "Church", ristorante: "Restaurant", giardino: "Garden", hotel: "Hotel", sala: "Function room", spiaggia: "Beach", altro: "Other" },
      };
      const kind = typeof block.props.kind === "string" ? block.props.kind : "";
      merged.kindLabel = names[config.locale]?.[kind] ?? "";
    }
    const fieldFonts = blockFontIds(block.props.fonts);
    for (const id of Object.values(fieldFonts)) usedFonts.add(id);
    const fontStacks = Object.fromEntries(Object.entries(fieldFonts).map(([key, id]) => [key, fontStack(id) ?? ""]));
    let html = renderTemplate(template, merged, { missing: input.missing, fonts: fontStacks });
    // Adattamento e centratura della foto del blocco: applicati al suo tag <img>, qualunque sia il template.
    for (const f of blockDef(block.type)?.fields ?? []) {
      if (f.type !== "photo" || typeof block.props[f.key] !== "string" || !block.props[f.key]) continue;
      html = fitPhoto(html, String(block.props[f.key]), block.props.photoFit, block.props.photoFocus);
    }
    // L'etichetta «Con gioia» dei template diventa il testo sopra i nomi scelto nel blocco.
    if (block.type === "hero" && typeof block.props.kicker === "string" && block.props.kicker) {
      html = html.split(escapeHtml(String((globals.t as { withJoy?: string }).withJoy ?? ""))).join(escapeHtml(block.props.kicker));
    }
    const look = block.type === "cover" ? html : lookWrap(block.props, html);
    // display:contents: il contenitore non cambia l'impaginazione; serve solo a sapere a quale blocco appartiene ciò che c'è dentro.
    // Il marcatore di chiusura serve al builder per ritagliare il blocco dalla pagina e aggiornarlo da solo.
    const framed = input.builder ? `<div data-blk="${escapeHtml(block.id)}" style="display:contents">${look}</div><!--/blk-->` : look;
    if (block.type === "cover") cover += framed;
    else if (block.type === "hero") main += framedZone("hero", framed);
    else main += closeZone() + framed;
  }
  const body = `${cover}<main class="invite">\n${main}${zoneOpen ? "</div>" : ""}</main>`;

  const css = theme.css.replace(/url\((["']?)assets\//g, `url($1${base}/`) + LOOK_CSS;
  const html = body.replace(/(src|poster|srcset|href)=(["'])assets\//g, `$1=$2${base}/`);

  const title = String(config.event.title ?? "");
  const description = String(config.event.hosts ?? "") || title;
  const fonts = m.fonts.map((f) => `<link rel="stylesheet" href="${escapeHtml(f)}">`).join("\n");
  // Nell'anteprima del builder c'è tutta la libreria, così ogni cambio di font si vede senza ricaricare la pagina.
  const fontSheet = input.builder ? fontsStylesheetUrl() : usedFonts.size ? fontsStylesheetUrl([...usedFonts]) : "";
  const fontLink = fontSheet ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${escapeHtml(fontSheet)}">` : "";
  const payload = JSON.stringify({ slug, locale: config.locale, title, rsvp: globals.rsvp }).replace(/</g, "\\u003c");
  // Sfondo animato: scelto dal cliente, oppure quello proposto dallo stile. Il canvas sta dietro i contenuti (runtime.js lo anima).
  const bg = config.background ?? m.background;
  const bgLayer = bg && bg.kind !== "none" ? `<canvas class="bg-fx" data-bg="${bg.kind}"${bg.color ? ` data-bg-color="${bg.color}"` : ""} aria-hidden="true"></canvas>\n` : "";
  const bgCss = bgLayer ? BG_CSS : "";

  return `<!doctype html>
<html lang="${config.locale}" data-theme="${escapeHtml(m.id)}" data-assets="${base}"${input.preview ? " data-preview" : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="icon" href="/icon.png" type="image/png">
<meta name="robots" content="noindex,nofollow">

<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description.slice(0, 160))}">
<meta name="theme-color" content="${escapeHtml(m.themeColor)}">
${fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n${fonts}` : ""}
${fontLink}
<style>
${css}${bgCss}${REVEAL_CSS}${m.envelope ? ENVELOPE_CSS : DRAWN_ENVELOPE_CSS}${m.backgroundVideo ? BGVIDEO_CSS : ""}${input.builder ? "" : SCROLL_CSS}${SCROLL_CUE_CSS}${TAP_CSS}${MOBILE_CSS}
</style>
</head>
<body class="theme-${escapeHtml(m.id)}">
${bodyVideo}${bgLayer}${html}
<script type="application/json" id="inv-data">${payload}</script>
<script>
${runtime}
</script>
${input.builder ? `<script>\n${BUILDER_JS}\n</script>\n` : ""}</body>
</html>
`;
}

// Dati comuni a tutti i blocchi: evento, date, funzioni, domande di conferma, tema.
function pageGlobals(input: PageInput): Record<string, unknown> {
  const { theme, config, slug, features } = input;
  const m = theme.manifest;
  const rsvp = features.has("rsvp") && config.blocks.some((b) => b.type === "rsvp" && !b.hidden);
  return {
    ...config.event,
    features: Object.fromEntries(ADDON_KEYS.map((k) => [k, features.has(k)])),
    rsvp,
    rsvpQuestions: config.rsvpQuestions.map(questionView),
    date: dateView(String(config.event.eventDate ?? ""), config.locale),
    monogram: monogram(String(config.event.title ?? "")),
    theme: { id: m.id, name: m.name, description: m.description, themeColor: m.themeColor },
    slug,
    locale: config.locale,
    t: labelsFor(config.locale),
    preview: !!input.preview,
  };
}

// Font di ogni campo del blocco: solo id della libreria, gli altri valori vengono scartati.
function blockFontIds(v: unknown): Record<string, FontId> {
  const out: Record<string, FontId> = {};
  if (v && typeof v === "object") for (const [key, id] of Object.entries(v)) if (isFontId(id)) out[key] = id;
  return out;
}

// Solo nell'anteprima del builder: evidenzia il blocco sotto il mouse (o quello scelto nella lista) e lo segnala al builder.
// Messaggi: dal builder {type:"highlight", id}, {type:"scrollTo", y}, {type:"restore", id, y}, {type:"viewonly", on}; dall'anteprima {type:"hover", id}, {type:"select", id}, {type:"scroll", y} e {type:"max", max}.
// viewonly: anteprima a tutto schermo su telefono, la pagina si comporta come l'invito vero (niente evidenziazione né selezione).
const BUILDER_JS = `(function () {
  var box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;pointer-events:none;display:none;z-index:2147483000;border:2px solid #14b8a6;border-radius:6px;background:rgba(20,184,166,.10)';
  document.body.appendChild(box);
  var current = null;
  var viewOnly = false;
  // Aggiornamento di un solo blocco: il builder manda solo il suo HTML, la pagina resta com'è (scorrimento compreso).
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'patch' || e.source !== parent) return;
    var wrap = document.querySelector('[data-blk="' + d.id + '"]');
    if (!wrap) return;
    wrap.innerHTML = d.html;
    var anim = wrap.querySelectorAll('[data-anim]');
    for (var a = 0; a < anim.length; a++) anim[a].classList.add('in');
    // Il blocco nuovo riprende i suoi comportamenti (conto alla rovescia, gratta, video, conferma) solo al suo interno.
    if (window.InviteMe && window.InviteMe.refresh) window.InviteMe.refresh(wrap);
    if (current === d.id) paint();
  });
  function owner(el) { return el && el.closest ? el.closest('[data-blk]') : null; }
  function bounds(wrap) {
    var r = null;
    for (var i = 0; i < wrap.children.length; i++) {
      // Le finestre fisse (il popup della conferma copre tutto lo schermo, anche da nascosto) non sono parte del blocco.
      var cs = window.getComputedStyle(wrap.children[i]);
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue;
      var b = wrap.children[i].getBoundingClientRect();
      if (!b.width && !b.height) continue;
      if (!r) r = { l: b.left, t: b.top, r: b.right, b: b.bottom };
      else { r.l = Math.min(r.l, b.left); r.t = Math.min(r.t, b.top); r.r = Math.max(r.r, b.right); r.b = Math.max(r.b, b.bottom); }
    }
    return r;
  }
  function paint() {
    var wrap = current && document.querySelector('[data-blk="' + current + '"]');
    var r = wrap && bounds(wrap);
    if (!r) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.style.left = (r.l - 4) + 'px';
    box.style.top = (r.t - 4) + 'px';
    box.style.width = (r.r - r.l + 8) + 'px';
    box.style.height = (r.b - r.t + 8) + 'px';
  }
  function setCurrent(id, notify) {
    if (viewOnly) return;
    if (id === current) return;
    current = id;
    paint();
    if (notify) parent.postMessage({ type: 'hover', id: id }, '*');
  }
  document.addEventListener('mousemove', function (e) {
    var w = owner(e.target);
    setCurrent(w ? w.getAttribute('data-blk') : null, true);
  });
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) setCurrent(null, true); });
  document.addEventListener('click', function (e) {
    if (viewOnly) return;
    var w = owner(e.target);
    if (w) parent.postMessage({ type: 'select', id: w.getAttribute('data-blk') }, '*');
  }, true);
  // Lo scorrimento resta dentro il telefono, ma la sua barra è nel builder, fuori dalla cornice.
  var hide = document.createElement('style');
  hide.textContent = 'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
  document.head.appendChild(hide);
  function reportMax() {
    parent.postMessage({ type: 'max', max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) }, '*');
  }
  function reportScroll() { parent.postMessage({ type: 'scroll', y: window.scrollY }, '*'); }
  if (window.ResizeObserver) new ResizeObserver(reportMax).observe(document.body);
  window.addEventListener('load', reportMax);
  window.addEventListener('scroll', function () { paint(); reportScroll(); }, { passive: true });
  window.addEventListener('resize', paint);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'viewonly') { viewOnly = !!d.on; if (viewOnly) { current = null; paint(); } }
    if (d && d.type === 'highlight') { if (viewOnly) return; current = d.id || null; paint(); }
    if (d && d.type === 'scrollTo') window.scrollTo(0, d.y);
    if (d && d.type === 'focus' && d.id && !viewOnly) {
      var f = document.querySelector('[data-blk="' + d.id + '"]');
      if (f) (f.firstElementChild || f).scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (d && d.type === 'restore') {
      // Dopo un salvataggio si torna al blocco che si stava modificando, altrimenti alla stessa posizione.
      var target = d.id && document.querySelector('[data-blk="' + d.id + '"]');
      if (target) (target.firstElementChild || target).scrollIntoView({ block: 'center' });
      else window.scrollTo(0, d.y || 0);
    }
  });
})();`;

// Aspetto scelto dal cliente per un blocco (sfondo, testo, forma e copertura del gratta). Senza scelte il blocco non viene toccato.
// I valori sono già validati (esadecimali e opzioni note), quindi possono stare in uno stile inline.
function lookWrap(props: Record<string, unknown>, html: string): string {
  const vars: string[] = [];
  if (typeof props.lookBg === "string" && props.lookBg) vars.push(`--bk-bg:${props.lookBg}`);
  if (typeof props.lookInk === "string" && props.lookInk) vars.push(`--bk-ink:${props.lookInk}`);
  if (typeof props.lookCover === "string" && props.lookCover) vars.push(`--bk-cover:${props.lookCover}`);
  const shape = typeof props.lookShape === "string" ? props.lookShape : "";
  const photo = typeof props.photoShape === "string" ? props.photoShape : "";
  const gallery = typeof props.galleryStyle === "string" ? props.galleryStyle : "";
  const cell = typeof props.cellShape === "string" ? props.cellShape : "";
  if (!vars.length && !shape && !photo && !gallery && !cell) return html;
  const arrows = gallery === "slider"
    ? `<button type="button" class="gal-btn gal-prev" data-gal-prev aria-label="Precedente">&#8249;</button><button type="button" class="gal-btn gal-next" data-gal-next aria-label="Successiva">&#8250;</button>`
    : "";
  return `<div class="bk"${shape ? ` data-shape="${shape}"` : ""}${photo ? ` data-photo-shape="${photo}"` : ""}${gallery ? ` data-gallery="${gallery}"` : ""}${cell ? ` data-cell-shape="${cell}"` : ""} style="${vars.join(";")}">\n${html}${arrows}</div>\n`;
}

// Regole comuni a tutti i temi per l'aspetto dei blocchi. Vincono sul tema solo dove il cliente ha scelto qualcosa.
// Scorrimento laterale legato alla posizione: ogni elemento con data-anim scorre dolcemente da sinistra o da destra
// (alternati). La dissolvenza resta quella dello stile (classe `in`, a tempo): il movimento non la sostituisce. Vale per tutti gli stili, dopo il loro CSS. Solo dove il browser supporta le timeline di
// scorrimento; altrove restano le animazioni dello stile e del runtime. Nell'anteprima e nella demo non c'è movimento.
// Le gallerie a scorrimento orizzontale restano fuori: la loro posizione non segue lo scorrimento verticale.
const REVEAL_CSS = `@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){
html:not([data-preview]) [data-anim]:not([data-rv="off"]){animation:rv-slide linear both;animation-timeline:view();animation-range:entry 0% cover 50%}
html:not([data-preview]) [data-anim]:not([data-rv="off"]):nth-child(even){animation-name:rv-slide-r}
@keyframes rv-slide{from{transform:translateX(-24px)}to{transform:none}}
@keyframes rv-slide-r{from{transform:translateX(24px)}to{transform:none}}
}}`;

// Telefono: nessun contenuto tocca il bordo dello schermo. Vale per tutti gli stili: mappa centrata, tessere del gratta-e-scopri
// dentro la scheda, timeline del programma che non esce dalla scheda.
const MOBILE_CSS = `@media (max-width:600px){
@keyframes rv-slide{from{transform:translateX(-8px)}to{transform:none}}
@keyframes rv-slide-r{from{transform:translateX(8px)}to{transform:none}}
.map-frame{margin-inline:auto!important;max-width:100%;box-sizing:border-box}
.scratch-row,.sc-labels{gap:6px!important;max-width:100%;box-sizing:border-box}
.scratch,.sc-labels span{flex:1 1 0;min-width:0;max-width:none!important}
.timeline{max-width:100%;box-sizing:border-box;padding-right:14px}
.t-cell{min-width:0}
}`;

// Scorrimento morbido per tutti gli stili. Il builder non lo usa: il suo scorrimento è sincronizzato dal codice. «Riduci movimento» lo spegne.
const SCROLL_CSS = `html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;

// Invito a scorrere: testo e freccia oscillano piano, insieme. Si usa la proprietà `translate`, così la rotazione della freccia dello stile resta.
const SCROLL_CUE_CSS = `@media (prefers-reduced-motion:no-preference){
.scroll-cue span,.scroll-cue .arrow{animation:scroll-cue-bob 2.8s ease-in-out infinite}
}
@keyframes scroll-cue-bob{0%,100%{translate:0 0}50%{translate:0 8px}}`;

// «Tocca per aprire» della busta: rimbalza se lo sceglie il cliente (data-tap-bounce), senza sfondo se lo sceglie (data-tap-plain).
// Il rimbalzo usa `translate`, così il centraggio dello stile resta.
const TAP_CSS = `@media (prefers-reduced-motion:no-preference){
[data-cover] [data-cover-tap][data-tap-bounce]{animation:tap-bob 2.4s ease-in-out infinite}
}
@keyframes tap-bob{0%,100%{translate:0 0}50%{translate:0 -10px}}
[data-cover] [data-cover-tap][data-tap-plain]{background:none;box-shadow:none;border:0}`;

// Busta disegnata a schermo intero: la busta esce dai bordi dello schermo e si vedono solo i lembi a V, come la busta-filmato.
// Il lembo si apre al tocco e l'invito sfuma (vedi runtime). Vale per gli stili senza busta-filmato.
const DRAWN_ENVELOPE_CSS = `[data-cover] .env-card{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;max-width:none;overflow:hidden;perspective:none}
[data-cover] .env{position:absolute;left:-40vw;right:-40vw;top:-18vh;bottom:-18vh;height:auto;border-radius:0;box-shadow:none}
[data-cover] .env-flap{inset:0}
[data-cover] .env-seal{top:56%;width:min(38vw,150px);height:min(38vw,150px)}`;

// Video di sfondo per zona: la zona è il contenitore del suo blocco, il video sta dietro i suoi contenuti.
// Con «riduci movimento» il video non parte e resta il colore dello stile.
const BGVIDEO_CSS = `.zone{position:relative;isolation:isolate}
.zone-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none}
.zone-video.zone-fixed{position:fixed}
@media (prefers-reduced-motion:reduce){.zone-video{display:none}}`;

// Busta-video: il filmato è parte dell'invito, senza controlli del browser. Dove sta «Tocca per aprire» lo decide lo stile.
const ENVELOPE_CSS = `[data-cover-video]{pointer-events:none}
[data-cover-video]::-webkit-media-controls,[data-cover-video]::-webkit-media-controls-enclosure{display:none!important}
[data-cover-video]::-webkit-media-controls-start-playback-button{display:none!important}`;

// Sfondo animato: un livello fisso dietro tutto il contenuto, senza interazione. Il movimento ridotto lo ferma nel runtime.
const BG_CSS = `.bg-fx{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block}`;

const LOOK_CSS = `
.bk{background:var(--bk-bg,transparent)}
.bk[style*="--bk-ink"] :is(h1,h2,h3,h4,p,span,li,div,label,a,button){color:var(--bk-ink)!important}
.bk [data-scratch]{position:relative;overflow:hidden}
.bk [data-scratch] canvas{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit}
.bk[data-shape="square"] [data-scratch]{border-radius:0!important}
.bk[data-shape="round"] [data-scratch]{border-radius:50%!important}
.bk[data-shape="pill"] [data-scratch]{border-radius:999px!important}
[data-cover]{display:flex;flex-direction:column;align-items:center;justify-content:center}
.dt-sec{text-align:center}
.dt-row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:18px}
.dt-col{display:grid;justify-items:center;gap:8px;flex:none}
.dt-cell{display:grid;gap:6px;min-width:110px;padding:14px 8px;border:1px solid currentColor;border-radius:14px;opacity:.95}
.dt-num{font-size:26cqi;line-height:1;font-weight:600;white-space:nowrap}
.dt-row[data-shape="round"] .dt-cell,.bk[data-cell-shape="round"] .dt-cell{width:96px;height:96px;min-width:0;padding:0;border-radius:50%;align-content:center;justify-items:center}
.dt-row[data-shape="pill"] .dt-cell,.bk[data-cell-shape="pill"] .dt-cell{width:108px;height:64px;min-width:0;padding:0;border-radius:999px;align-content:center;justify-items:center}
.dt-row[data-shape="plain"] .dt-cell{border:0;padding:6px 12px}
.dt-lab{font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.75}
.scratch,.dt-cell{container-type:inline-size}
.scratch:nth-child(2) .sc-val{font-size:clamp(12px,17cqi,28px)!important;white-space:nowrap}
[data-cover] .env-card{perspective:900px;transition:transform .9s cubic-bezier(.3,.7,.3,1)}
[data-cover] .env-flap{transform-origin:50% 0;transition:transform .9s cubic-bezier(.3,.7,.3,1)}
[data-cover] .env-seal{transition:opacity .4s ease,transform .6s ease}
[data-cover].wei-opening .env-flap{transform:rotateX(180deg)}
[data-cover].wei-opening .env-seal{opacity:0;transform:translate(-50%,-50%) scale(.6)}
[data-cover].wei-opening .env-card{transform:translateY(-8%)}
/* Stile della galleria: si applica alle figure della galleria, qualunque sia il markup del tema. */
.bk[data-gallery] :has(> figure){display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding-bottom:8px;grid-template-columns:none!important}
.bk[data-gallery] :has(> figure) > figure{margin:0;flex:0 0 auto}
.bk[data-gallery] :has(> figure) > figure img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;display:block}
.bk[data-gallery="slider"] :has(> figure) > figure{flex:0 0 100%;scroll-snap-align:center}
.bk[data-gallery="slider"] :has(> figure) > figure img{aspect-ratio:3/2}
.bk[data-gallery="mosaic"] :has(> figure){display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-auto-rows:110px;grid-auto-flow:dense;overflow:visible;scroll-snap-type:none;gap:8px}
.bk[data-gallery="mosaic"] :has(> figure) > figure{flex:none;scroll-snap-align:none;min-width:0}
.bk[data-gallery="mosaic"] :has(> figure) > figure:first-child{grid-column:span 2;grid-row:span 2}
.bk[data-gallery="mosaic"] :has(> figure) > figure img{aspect-ratio:auto;height:100%}
.bk[data-gallery="grid"] :has(> figure){display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;overflow:visible;scroll-snap-type:none;gap:8px}
.bk[data-gallery="grid"] :has(> figure) > figure{flex:none;min-width:0}
.bk[data-gallery="grid"] :has(> figure) > figure img{aspect-ratio:1/1}
@media (max-width:600px){.bk[data-gallery="mosaic"] :has(> figure),.bk[data-gallery="grid"] :has(> figure){grid-template-columns:repeat(2,minmax(0,1fr))!important}.bk[data-gallery="mosaic"] :has(> figure) > figure:first-child{grid-column:span 2;grid-row:span 1}}
/* Forma dei campi della data: vale anche per i template con una data propria (campi .scratch). */
.bk[data-cell-shape="round"] .scratch{border-radius:50%!important;aspect-ratio:1/1;display:grid;place-items:center;min-width:0}
.bk[data-cell-shape="pill"] .scratch{border-radius:999px!important}
.bk[data-cell-shape="plain"] :is(.dt-cell,.scratch){background:none!important;border:0!important;box-shadow:none!important}
/* Scorrimenti dell'invito senza barra di sistema: il bordo sfumato indica che c'è altro. */
main.invite *{scrollbar-width:none}
main.invite *::-webkit-scrollbar{display:none}
.bk[data-gallery]{position:relative}
.bk[data-gallery] :has(> figure){-webkit-mask-image:linear-gradient(to right,#000 86%,transparent);mask-image:linear-gradient(to right,#000 86%,transparent)}
.bk[data-gallery="mosaic"] :has(> figure),.bk[data-gallery="grid"] :has(> figure){-webkit-mask-image:none;mask-image:none}
.gal-btn{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#0E1116;box-shadow:0 6px 16px -8px rgba(0,0,0,.5);font-size:26px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}
.gal-prev{left:6px}
.gal-next{right:6px}
.gal-btn:focus-visible{outline:2px solid #0B6E65;outline-offset:2px}
html[data-preview]{scrollbar-width:none}html[data-preview]::-webkit-scrollbar{display:none}
[data-cover] .env-top{margin:0 0 22px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;text-align:center;color:inherit}
[data-cover] .env-card{position:relative;width:min(78vw,420px);aspect-ratio:1.45;margin:0 auto;flex:none;filter:drop-shadow(0 26px 30px rgba(0,0,0,.28))}
[data-cover] .env{position:absolute;inset:0;overflow:visible;border-radius:6px;background:linear-gradient(to top right,transparent 49.6%,rgba(0,0,0,.07) 50%,transparent 50.4%),linear-gradient(to top left,transparent 49.6%,rgba(0,0,0,.07) 50%,transparent 50.4%),var(--env,#f7f1e6)}
[data-cover] .env-flap{position:absolute;left:0;right:0;top:0;height:58%;background:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.09)),var(--env,#f7f1e6);clip-path:polygon(0 0,100% 0,50% 100%)}
[data-cover] .env-seal{position:absolute;left:50%;top:58%;width:24%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.35),transparent 42%),var(--seal,#8e2a22);box-shadow:0 4px 10px rgba(0,0,0,.3);color:#fff;font-size:clamp(13px,3.2vw,20px);font-weight:600;letter-spacing:.04em;text-transform:uppercase;text-align:center;line-height:1.1;padding:0 6px;box-sizing:border-box}
.bk[data-photo-shape] img:not(.fl):not(.orn){object-fit:cover}
.bk[data-photo-shape="arch"] img:not(.fl):not(.orn){border-radius:999px 999px 0 0!important}
.bk[data-photo-shape="circle"] img:not(.fl):not(.orn){border-radius:50%!important;aspect-ratio:1/1}
.bk[data-photo-shape="oval"] img:not(.fl):not(.orn){border-radius:50%!important;aspect-ratio:4/5}
.bk[data-photo-shape="rounded"] img:not(.fl):not(.orn){border-radius:28px!important}
.bk[data-photo-shape="diamond"] img:not(.fl):not(.orn){clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.bk[data-photo-shape="hexagon"] img:not(.fl):not(.orn){clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}
/* Mappa: la forma scelta nel builder vince sul contorno dello stile (anche ad arco), così il contenitore non viene tagliato. */
.map-frame[data-map-shape]:not([data-map-shape="theme"]) { padding:0!important; overflow:hidden }
.map-frame[data-map-shape]:not([data-map-shape="theme"]) iframe { width:100%!important; height:100%!important; position:absolute; inset:0 }
.map-frame[data-map-shape="square"] { aspect-ratio:1/1; position:relative }
.map-frame[data-map-shape="arch"] { aspect-ratio:4/5; position:relative; border-radius:999px 999px 0 0!important }
.map-frame[data-map-shape="arch"] iframe { border-radius:999px 999px 0 0!important }
.map-frame[data-map-shape="circle"] { aspect-ratio:1/1; position:relative; border-radius:50%!important }
.map-frame[data-map-shape="circle"] iframe { border-radius:50%!important }
.map-frame[data-map-shape="rounded"] { aspect-ratio:1/1; position:relative; border-radius:28px!important }
.map-frame[data-map-shape="rounded"] iframe { border-radius:28px!important }
.map-frame[data-map-shape] .map-fl { display:none }
[data-music-toggle]{position:fixed!important;right:18px!important;bottom:18px!important;top:auto!important;left:auto!important;z-index:9000!important;width:52px!important;height:52px!important;border-radius:50%!important;border:0!important;background:#0E1116!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;box-shadow:0 10px 28px rgba(0,0,0,.25)!important;cursor:pointer}
[data-music-toggle] svg{width:20px!important;height:20px!important;fill:#FFFFFF!important}
`;

// Per ogni lista del blocco, un flag "has<Nome>" vero se ha almeno una voce: la sezione si mostra una volta sola.
// Posizione della foto per ogni scelta di centratura (object-position).
const FOCUS_CSS: Record<string, string> = { center: "center", top: "center top", bottom: "center bottom", left: "left center", right: "right center" };
const FIT_VALUES = ["contain", "cover"];

// Applica adattamento e centratura al tag <img> che mostra la foto. Senza scelte il tema resta com'è.
function fitPhoto(html: string, url: string, fit: unknown, focus: unknown): string {
  const decls: string[] = [];
  if (typeof fit === "string" && FIT_VALUES.includes(fit)) decls.push(`object-fit:${fit}`);
  if (typeof focus === "string" && FOCUS_CSS[focus]) decls.push(`object-position:${FOCUS_CSS[focus]}`);
  if (!decls.length) return html;
  const css = decls.join(";");
  const needle = `src="${escapeHtml(url)}"`;
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    if (!tag.includes(needle)) return tag;
    const existing = /\sstyle="([^"]*)"/.exec(tag);
    // Lo stile della scelta viene dopo quello del template, così vince sul tema.
    if (existing) return tag.replace(existing[0], ` style="${existing[1]};${css}"`);
    return tag.replace("<img", `<img style="${css}"`);
  });
}

function listFlags(props: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (Array.isArray(v)) out[`has${k.charAt(0).toUpperCase()}${k.slice(1)}`] = v.length > 0;
  }
  return out;
}

// Monogramma dalle iniziali del titolo: "Sara & Luca" → "S·L".
export function monogram(title: string): string {
  const words = title.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w && !["e", "and", "the", "il", "la"].includes(w.toLowerCase()));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("·") || "IM";
}

// Vista di una domanda per il template: flag per tipo, così il template sceglie l'input giusto con una sezione.
function questionView(q: RsvpQuestion) {
  return {
    qid: q.id,
    label: q.label,
    type: q.type,
    requiredAttr: q.required ? "true" : "false",
    required: !!q.required,
    isYesNo: q.type === "yes-no",
    isText: q.type === "text",
    isNumber: q.type === "number",
    isChoice: q.type === "choice",
    yes: q.yes ?? "Sì",
    no: q.no ?? "No",
    options: (q.options ?? []).map((o, i) => ({ value: o, label: o, optionId: `${q.id}-${i}` })),
  };
}

function dateView(iso: string, locale: "it" | "en") {
  const d = new Date(`${iso}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(d.getTime())) {
    return { day: "", month: "", monthShort: "", year: "", weekday: "", long: "", iso: "" };
  }
  const day = String(d.getDate());
  const month = MONTHS[locale][d.getMonth()];
  const year = String(d.getFullYear());
  const weekday = WEEKDAYS[locale][d.getDay()];
  // Il mese abbreviato (tre lettere) entra nei riquadri della data senza uscirne.
  const monthShort = month.slice(0, 3).replace(/^./, (c) => c.toUpperCase());
  return { day, month, monthShort, year, weekday, long: `${day} ${month} ${year}`, iso };
}
