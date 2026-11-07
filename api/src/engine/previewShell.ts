// Pagina dell'anteprima di uno stile: telefono di default, passaggio a desktop contenuto, schermo intero da telefono.
// Mostra la pagina demo dello stile dentro una cornice; la pagina demo resta quella usata dalle miniature.
const LABEL = {
  it: { phone: "Telefono", desktop: "Desktop", title: "Anteprima", envelope: "Mostra la busta" },
  en: { phone: "Phone", desktop: "Desktop", title: "Preview", envelope: "Show the envelope" },
};

export function previewShell(themeId: string, name: string, lang: "it" | "en", seed: string): string {
  const l = LABEL[lang];
  // La busta è visibile di default: la pagina demo la mostra con cover=1; l'interruttore passa a cover=0.
  const src = `/api/themes/${themeId}/demo?lang=${lang}&s=${seed}&cover=1`;
  const safeName = name.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<title>${l.title} · ${safeName}</title>
<style>
  html, body { margin: 0; height: 100%; background: #E8EBEF; font-family: Inter, system-ui, sans-serif; }
  .bar { display: flex; justify-content: center; gap: 8px; padding: 14px; }
  .bar button { font: inherit; font-size: 14px; font-weight: 600; border: 1px solid #C9CED6; background: #fff; color: #0E1116; border-radius: 999px; padding: 8px 16px; cursor: pointer; }
  .bar button[aria-pressed="true"] { background: #0E1116; color: #fff; border-color: #0E1116; }
  .stage { height: calc(100% - 62px); display: flex; align-items: center; justify-content: center; padding: 0 16px 24px; box-sizing: border-box; }
  .device { position: relative; background: #0E1116; border-radius: 48px; padding: 10px; box-sizing: border-box; width: 390px; height: min(844px, 100%); box-shadow: 0 30px 60px -30px rgba(0,0,0,0.5); }
  .device iframe { width: 100%; height: 100%; border: 0; border-radius: 38px; background: #fff; display: block; }
  .stage[data-mode="desktop"] .device { width: min(1040px, 100%); height: min(680px, 100%); border-radius: 14px; padding: 0; background: #fff; overflow: hidden; border: 1px solid #C9CED6; box-shadow: 0 24px 50px -28px rgba(0,0,0,0.35); }
  .stage[data-mode="desktop"] .device iframe { border-radius: 0; }
  @media (max-width: 720px) {
    .bar { display: none; }
    .stage { height: 100%; padding: 0; }
    .device, .stage[data-mode="desktop"] .device { width: 100%; height: 100%; border-radius: 0; padding: 0; border: 0; box-shadow: none; }
    .device iframe, .stage[data-mode="desktop"] .device iframe { border-radius: 0; }
  }
</style>
</head>
<body>
<div class="bar" role="group" aria-label="${l.title}">
  <button type="button" data-mode="phone" aria-pressed="true">${l.phone}</button>
  <button type="button" data-mode="desktop" aria-pressed="false">${l.desktop}</button>
  <button type="button" data-cover="on" aria-pressed="true">${l.envelope}</button>
</div>
<main class="stage" data-mode="phone">
  <div class="device"><iframe title="${safeName}" src="${src}" sandbox="allow-scripts"></iframe></div>
</main>
<script>
  (function () {
    var stage = document.querySelector('.stage');
    var frame = document.querySelector('.device iframe');
    var cover = document.querySelector('[data-cover]');
    cover.addEventListener('click', function () {
      var on = cover.getAttribute('aria-pressed') !== 'true';
      cover.setAttribute('aria-pressed', String(on));
      frame.src = frame.src.replace(/cover=[01]/, 'cover=' + (on ? '1' : '0'));
    });
    document.querySelectorAll('.bar button[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        stage.setAttribute('data-mode', mode);
        document.querySelectorAll('.bar button[data-mode]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
  })();
</script>
</body>
</html>`;
}
