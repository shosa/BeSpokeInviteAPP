/* InviteMe — runtime del motore di rendering.
 *
 * Comportamenti riusabili da ogni tema, attivati con attributi data-* nel template (vedi docs/MOTORE.md):
 *   data-anim="fadeinup|fadein|zoomin|fadeinright"  rivelazione allo scroll (classe "in")
 *   data-cover                                       busta/sipario: al tocco si apre e parte la musica
 *     data-cover-video                               filmato di apertura (opzionale, senza audio)
 *   data-base-audio                                  audio che accompagna l'apertura (un solo tocco, poi sfuma)
 *   data-music                                       musica di sottofondo (loop, sale al termine dell'apertura)
 *   data-music-toggle, data-icon="pause|play"        pulsante musica con icone che seguono lo stato reale
 *   data-scratch                                     casella da grattare (canvas dorato)
 *   data-scratch-all                                 pulsante "scopri tutto" (compare dopo 9 s)
 *   data-countdown="AAAA-MM-GGTHH:mm"                conto alla rovescia; figli data-cd="days|hours|minutes|seconds"
 *   data-countdown-before / data-countdown-after     elementi mostrati prima / dopo la data
 *   data-loop-video                                  video muto in loop: parte quando entra nello schermo
 *   data-rsvp-open / data-rsvp-close / data-rsvp-dialog  popup della conferma di presenza
 *   data-faq                                         elenco di <details>: una risposta aperta alla volta
 *   data-rsvp-inline                                 conferma già aperta nella pagina (senza popup)
 *   data-maps-query                                  pulsante «Apri nelle mappe»: Apple Mappe su iPhone/iPad/Mac, Google Maps altrove
 *   data-rsvp-form data-slug                         modulo: campi data-rsvp-field data-id data-type (vedi sotto)
 *   data-rsvp-error, data-rsvp-success               messaggi di esito
 *
 * Niente dipendenze, niente build: un file, ES2017. Ogni comportamento è indipendente e si attiva solo se il DOM lo richiede.
 */
(function () {
  'use strict';

  var reduced = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  var all = function (root, sel) { return [].slice.call((root || document).querySelectorAll(sel)); };
  // Comportamenti con un timer: si fermano quando il loro blocco esce dalla pagina (anteprima del builder).
  var live = [];
  var scratchResizeBound = false;

  /* ---------- 1. Rivelazione allo scroll ---------- */
  var startObserving = (function () {
    var started = false;
    return function () {
      if (started) return;
      started = true;
      var els = all(document, '[data-anim]');
      // Anteprime (carosello, demo): nessuno scorrimento, quindi tutto si mostra subito.
      if (reduced() || !('IntersectionObserver' in window) || document.documentElement.hasAttribute('data-preview')) {
        els.forEach(function (el) { el.classList.add('in'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (el) { io.observe(el); });
      // rete di sicurezza: quello che è già a schermo si mostra comunque
      setTimeout(function () {
        els.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); }
        });
      }, 250);
    };
  })();

  /* ---------- 2. Busta e audio ---------- */
  function initCover() {
    var overlay = document.querySelector('[data-cover]');
    var base = document.querySelector('[data-base-audio]');
    var music = document.querySelector('[data-music]');
    var toggle = document.querySelector('[data-music-toggle]');
    var video = document.querySelector('[data-cover-video]');
    var FADE_MS = 900;
    var VOLUME = 0.85;
    var done = false, closed = false, audioUnlocked = false, userPaused = false, musicaPartita = false;

    // I video del corpo e dell'intestazione restano fermi sul primo fotogramma finché la busta non si apre.
    var zones = Array.prototype.slice.call(document.querySelectorAll('[data-zone-video]'));
    function playZones() {
      zones.forEach(function (z) {
        try { var p = z.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignorato */ }
      });
    }

    if (!overlay) {
      // nessuna busta: l'invito è subito visibile; la musica resta al pulsante
      playZones();
      startObserving();
      return;
    }
    document.body.classList.add('is-locked');

    // Sblocca l'audio dentro il primo tocco (Android). Il "pausa" finale deve controllare
    // musicaPartita: la promessa di play() si risolve dopo il click e spegnerebbe la canzone appena avviata.
    function unlockAudio() {
      if (audioUnlocked || !music) return;
      audioUnlocked = true;
      music.volume = 0;
      var p = music.play();
      if (p && p.then) {
        p.then(function () {
          if (musicaPartita) return;
          music.pause();
          music.currentTime = 0;
        }).catch(function () {});
      }
    }

    // La musica si scarica mentre si guarda la busta, così al tocco parte subito
    setTimeout(function () {
      if (done || !music) return;
      try { music.preload = 'auto'; music.load(); } catch (e) { /* ignorato */ }
    }, 1200);

    function startBase() {
      if (!base) return;
      try { base.currentTime = 0; } catch (e) { /* ignorato */ }
      base.volume = 0.9;
      var p = base.play();
      if (p && p.catch) p.catch(function () {});
    }

    function fadeBaseOut() {
      if (!base) return;
      var v = base.volume;
      var t = setInterval(function () {
        v -= 0.09;
        if (v > 0) { base.volume = v; return; }
        clearInterval(t);
        base.pause();
        try { base.currentTime = 0; } catch (e) { /* ignorato */ }
      }, 60);
    }

    // Quando l'invito compare, la base sfuma e sale la musica.
    function startMusic() {
      if (musicaPartita || !music) return;
      musicaPartita = true;
      fadeBaseOut();
      music.volume = 0;
      var p = music.play();
      if (p && p.catch) p.catch(function () {});
      var v = 0;
      var salita = setInterval(function () {
        v += 0.085;
        music.volume = Math.min(v, VOLUME);
        if (v >= VOLUME) clearInterval(salita);
      }, 70);
      [350, 1200, 2500].forEach(function (ms) {
        setTimeout(function () {
          if (music.paused && !userPaused) {
            var r = music.play();
            if (r && r.catch) r.catch(function () {});
          }
        }, ms);
      });
    }

    // Ultima rete: se il browser ha comunque rifiutato, la musica riparte al primo tocco.
    function armResume() {
      if (!music) return;
      function resume() {
        if (!music.paused || userPaused) return cleanup();
        var r = music.play();
        if (r && r.then) r.then(cleanup).catch(function () {});
        else cleanup();
      }
      function cleanup() {
        ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, resume); });
      }
      ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, resume, { passive: true }); });
    }

    function revealPage() {
      document.body.classList.remove('is-locked');
      playZones();
      window.scrollTo(0, 0);
      if (toggle) { toggle.style.visibility = 'visible'; toggle.style.opacity = '1'; }
      startMusic();
      if (music && music.paused && !userPaused) armResume();
      startObserving();
    }

    // Dissolvenza dalla busta all'invito
    function close() {
      if (closed) return;
      closed = true;
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      setTimeout(function () {
        overlay.style.display = 'none';
        try { if (video) video.pause(); } catch (e) { /* ignorato */ }
      }, FADE_MS + 100);
      setTimeout(revealPage, Math.round(FADE_MS * 0.5));
    }

    function open() {
      if (done) return;
      done = true;
      overlay.classList.add('wei-opening');
      unlockAudio();
      // con "riduci movimento" la busta non si apre: niente base, solo la musica
      if (reduced() || !video) { startBase(); setTimeout(close, reduced() ? 0 : 1200); return; }
      startBase();
      var p = video.play();
      if (p && p.catch) p.catch(close);
      watchEnd();
      // rete di sicurezza: se il filmato non parte o si blocca, si entra lo stesso
      setTimeout(function () {
        if (!closed && (video.paused || !video.currentTime)) close();
      }, 2500);
    }

    // Il filmato finisce con la busta aperta: la dissolvenza parte lì. Controllo a intervalli, non "timeupdate".
    function watchEnd() {
      var timer = setInterval(function () {
        if (closed) return clearInterval(timer);
        if (video.duration && video.currentTime >= video.duration - 0.35) {
          clearInterval(timer);
          close();
        }
      }, 200);
    }

    if (video) {
      video.addEventListener('ended', close);
      video.addEventListener('error', function () { if (done) close(); });
    }
    overlay.addEventListener('touchstart', unlockAudio, { passive: true });
    overlay.addEventListener('click', open);
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlockAudio(); open(); }
    });

    if (toggle && music) {
      toggle.addEventListener('click', function () {
        if (music.paused) {
          userPaused = false;
          var r = music.play();
          if (r && r.catch) r.catch(function () {});
        } else {
          userPaused = true;
          music.pause();
        }
      });
      // le icone seguono lo stato reale: se la musica non parte si vede il "play"
      var syncIcons = function () {
        var playing = !music.paused && !music.ended;
        var pause = toggle.querySelector('[data-icon="pause"]');
        var play = toggle.querySelector('[data-icon="play"]');
        if (pause) pause.style.display = playing ? 'block' : 'none';
        if (play) play.style.display = playing ? 'none' : 'block';
      };
      music.addEventListener('play', syncIcons);
      music.addEventListener('pause', syncIcons);
      syncIcons();
    }

    // Rete di sicurezza: se qualcosa si inceppa, la pagina resta leggibile
    setTimeout(function () { if (!done) startObserving(); }, 20000);
  }

  /* ---------- 3. Gratta e scopri ---------- */
  function initScratch(root) {
    var cards = all(root, '[data-scratch]');
    var revealBtn = (root || document).querySelector('[data-scratch-all]');
    var anyScratched = false;
    if (!cards.length) return;

    cards.forEach(function (card) {
      var canvas = document.createElement('canvas');
      card.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      var drawing = false, revealed = false, last = null;

      function paintFoil() {
        var w = card.clientWidth, h = card.clientHeight;
        if (!w || !h) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        var g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#e8cda2');
        g.addColorStop(0.35, '#d4ae7c');
        g.addColorStop(0.52, '#f0dcb8');
        g.addColorStop(0.72, '#c9a070');
        g.addColorStop(1, '#dfbf90');
        // Colore scelto dal cliente (variabile --bk-cover del blocco), altrimenti la carta dorata del tema.
        ctx.fillStyle = getComputedStyle(card).getPropertyValue('--bk-cover').trim() || g;
        ctx.fillRect(0, 0, w, h);
        // trama diagonale della carta dorata
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.22)';
        for (var i = -h; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(140,100,60,.14)';
        for (var j = -h; j < w; j += 11) { ctx.beginPath(); ctx.moveTo(j + h, 0); ctx.lineTo(j, h); ctx.stroke(); }
        ctx.globalCompositeOperation = 'destination-out';
      }

      function erase(x, y) {
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.fill();
        if (last) {
          ctx.lineWidth = 34;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        last = { x: x, y: y };
      }

      function clearedFraction() {
        var w = canvas.width, h = canvas.height;
        if (!w || !h) return 0;
        var data = ctx.getImageData(0, 0, w, h).data;
        var step = 16 * 4, empty = 0, total = 0;
        for (var i = 3; i < data.length; i += step) { total++; if (data[i] < 40) empty++; }
        return total ? empty / total : 0;
      }

      function reveal() {
        if (revealed) return;
        revealed = true;
        card.classList.add('done');
      }

      function pos(e) {
        var r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      canvas.addEventListener('pointerdown', function (e) {
        if (revealed) return;
        drawing = true; last = null; anyScratched = true;
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        var p = pos(e); erase(p.x, p.y);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drawing || revealed) return;
        var p = pos(e); erase(p.x, p.y);
        if (clearedFraction() > 0.45) reveal();
      });
      function end() {
        if (!drawing) return;
        drawing = false; last = null;
        if (clearedFraction() > 0.4) reveal();
      }
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      card._revealNow = reveal;
      card._repaint = paintFoil;
      paintFoil();
    });

    // ridisegna la patina se cambia la larghezza (un solo ascoltatore, per tutte le carte presenti)
    if (!scratchResizeBound) {
      scratchResizeBound = true;
      var rw = window.innerWidth;
      window.addEventListener('resize', function () {
        if (window.innerWidth === rw) return;
        rw = window.innerWidth;
        all(document, '[data-scratch]').forEach(function (c) { if (!c.classList.contains('done') && c._repaint) c._repaint(); });
      });
    }

    // scorciatoia per chi non se la cava col grattare
    if (revealBtn) {
      revealBtn.addEventListener('click', function () {
        cards.forEach(function (c) { c._revealNow(); });
        revealBtn.style.display = 'none';
      });
      setTimeout(function () { if (!anyScratched) revealBtn.classList.add('show'); }, 9000);
    }
  }

  /* ---------- 4. Conto alla rovescia ---------- */
  function initCountdown(root) {
    var boxes = all(root, '[data-countdown]');
    boxes.forEach(function (box) {
      var target = new Date(box.getAttribute('data-countdown'));
      if (isNaN(target.getTime())) return;
      var el = {};
      ['days', 'hours', 'minutes', 'seconds'].forEach(function (k) { el[k] = box.querySelector('[data-cd="' + k + '"]'); });
      var prev = {};
      var before = all(box, '[data-countdown-before]');
      var after = all(box, '[data-countdown-after]');

      function flip(node, value) {
        if (!node || node.textContent === value) return;
        node.classList.add('flip-out');
        setTimeout(function () {
          node.classList.remove('flip-out');
          node.classList.add('flip-in');
          node.textContent = value;
          void node.offsetHeight;
          node.classList.remove('flip-in');
        }, 520);
      }

      function tick() {
        var dist = target - new Date();
        if (dist < 0) {
          before.forEach(function (n) { n.hidden = true; });
          after.forEach(function (n) { n.hidden = false; });
          return;
        }
        var v = {
          days: String(Math.floor(dist / 86400000)),
          hours: String(Math.floor((dist % 86400000) / 3600000)).padStart(2, '0'),
          minutes: String(Math.floor((dist % 3600000) / 60000)).padStart(2, '0'),
          seconds: String(Math.floor((dist % 60000) / 1000)).padStart(2, '0'),
        };
        Object.keys(v).forEach(function (k) {
          if (prev[k] !== v[k]) { flip(el[k], v[k]); prev[k] = v[k]; }
        });
      }
      tick();
      var clock = setInterval(tick, 1000);
      live.push({ node: box, stop: function () { clearInterval(clock); } });

      // le cifre compaiono quando il blocco entra nello schermo
      var revealed = false;
      function doReveal() {
        if (revealed) return;
        revealed = true;
        box.querySelectorAll('.number, .label, .separator').forEach(function (n) { n.classList.add('revealed'); });
      }
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { doReveal(); observer.disconnect(); }
        }, { threshold: 0.4 });
        observer.observe(box);
      } else {
        doReveal();
      }
      setTimeout(function () {
        var r = box.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) doReveal();
      }, 200);
    });
  }

  /* ---------- 5. Video in loop ---------- */
  function initLoopVideo(root) {
    all(root, '[data-loop-video]').forEach(function (frame) {
      var video = frame.querySelector('video');
      var btn = frame.querySelector('.video-play');
      if (!video) return;
      var loaded = false, userPaused = false;
      video.muted = true; // il filmato è muto: la musica resta quella di sottofondo

      function load() {
        if (loaded) return;
        loaded = true;
        try { video.preload = 'auto'; video.load(); } catch (e) { /* ignorato */ }
      }
      function play() {
        load();
        var p = video.play();
        if (p && p.catch) p.catch(function () { frame.classList.add('is-paused'); });
      }

      video.addEventListener('playing', function () { frame.classList.remove('is-paused'); });
      video.addEventListener('pause', function () { frame.classList.add('is-paused'); });
      if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); userPaused = false; play(); });
      video.addEventListener('click', function () {
        if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
      });

      if (!('IntersectionObserver' in window)) { frame.classList.add('is-paused'); load(); return; }
      // si avvicina: si scarica. Entra nello schermo: parte. Esce: si ferma.
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) load(); });
      }, { rootMargin: '400px 0px' }).observe(frame);
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (reduced()) { frame.classList.add('is-paused'); return; }
            if (!userPaused) play();
          } else if (!video.paused) {
            video.pause();
          }
        });
      }, { threshold: 0.4 }).observe(frame);
    });
  }

  /* ---------- 6. Conferma di presenza ---------- */
  function initRsvp(root) {
    // Il modulo può stare in un popup (data-rsvp-dialog, aperto da data-rsvp-open) oppure già nella pagina
    // (data-rsvp-inline, o semplicemente senza popup): in quel caso niente apertura e chiusura, solo l'invio.
    var popup = (root || document).querySelector('[data-rsvp-dialog]');
    var form = (root || document).querySelector('[data-rsvp-form]');
    if (!form) return;
    var scope = popup || form.closest('[data-rsvp-inline]') || form.parentElement;
    var openers = popup ? all(root, '[data-rsvp-open]') : [];
    var closeBtn = popup ? popup.querySelector('[data-rsvp-close]') : null;
    var success = scope.querySelector('[data-rsvp-success]');
    var errore = scope.querySelector('[data-rsvp-error]');
    var invia = form.querySelector('[type="submit"]');
    var endpoint = form.getAttribute('data-endpoint') || '/api/rsvp';
    var slug = form.getAttribute('data-slug') || '';
    var lastFocus = null;

    function openPopup() {
      lastFocus = document.activeElement;
      popup.classList.add('is-open');
      document.body.classList.add('is-locked');
      setTimeout(function () { if (closeBtn) closeBtn.focus(); }, 60);
    }
    function closePopup() {
      popup.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    }
    if (popup) {
      openers.forEach(function (b) { b.addEventListener('click', openPopup); });
      if (closeBtn) closeBtn.addEventListener('click', closePopup);
      popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });
      // Il focus sta nel popup quando è aperto: l'Esc arriva qui, senza ascoltatori sul documento.
      popup.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && popup.classList.contains('is-open')) closePopup();
      });
    }

    // Legge un campo in base al suo tipo: yes-no → booleano, number → numero, il resto → testo.
    function readField(wrap) {
      var id = wrap.getAttribute('data-id');
      var type = wrap.getAttribute('data-type');
      if (type === 'yes-no' || type === 'choice') {
        var checked = wrap.querySelector('input[type="radio"]:checked');
        if (!checked) return { id: id, empty: true, wrap: wrap };
        return { id: id, value: type === 'yes-no' ? checked.value === 'true' : checked.value, wrap: wrap };
      }
      var input = wrap.querySelector('input, textarea');
      var text = input ? input.value.trim() : '';
      if (!text) return { id: id, empty: true, wrap: wrap };
      return { id: id, value: type === 'number' ? Number(text) : text, wrap: wrap };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var answers = {};
      all(form, '[data-rsvp-field]').forEach(function (wrap) {
        var r = readField(wrap);
        var bad = r.empty && wrap.getAttribute('data-required') === 'true';
        wrap.classList.toggle('has-error', bad);
        if (bad) ok = false;
        if (!r.empty) answers[r.id] = r.value;
      });
      if (!ok) {
        var firstBad = form.querySelector('.has-error');
        if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // il campo trappola non lo compila nessun ospite: se arriva pieno è un bot
      var honey = form.querySelector('[name="website"]');
      var payload = { slug: slug, answers: answers, website: honey ? honey.value : '' };

      function done() {
        form.style.display = 'none';
        if (success) { success.classList.add('is-on'); success.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
      // Se il salvataggio non riesce bisogna dirlo: "grazie" lo stesso farebbe credere che la risposta sia arrivata.
      function fallito() {
        if (errore) { errore.classList.add('is-on'); errore.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        invia.disabled = false;
        invia.textContent = form.getAttribute('data-label-retry') || 'Riprova';
      }

      if (errore) errore.classList.remove('is-on');
      invia.disabled = true;
      invia.textContent = form.getAttribute('data-label-sending') || 'Invio…';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then(function (esito) {
        if (esito && esito.ok) done(); else fallito();
      }).catch(fallito);
    });
  }

  /* ---------- Domande frequenti ---------- */
  // Fisarmonica: aprendo una domanda si chiudono le altre dello stesso elenco.
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    var list = d.closest('[data-faq]');
    if (!list) return;
    all(list, 'details[open]').forEach(function (o) { if (o !== d) o.open = false; });
  }, true);

  /* ---------- Apri nelle mappe ---------- */
  // Su iPhone, iPad e Mac il pulsante apre Apple Mappe (l'app predefinita); altrove resta il link di Google Maps,
  // che sul telefono apre l'app di mappe.
  function initMapsLinks(root) {
    var apple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    if (!apple) return;
    all(root, '[data-maps-query]').forEach(function (a) {
      a.setAttribute('href', 'https://maps.apple.com/?q=' + encodeURIComponent(a.getAttribute('data-maps-query') || ''));
    });
  }

  /* ---------- Avvio ---------- */
  // Galleria con frecce: carosello e slider scorrono di una foto alla volta.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-gal-prev],[data-gal-next]');
    if (!btn) return;
    var box = btn.closest('.bk');
    var first = box && box.querySelector('figure');
    var track = first && first.parentElement;
    if (!track) return;
    var step = first.getBoundingClientRect().width + 12;
    track.scrollBy({ left: btn.hasAttribute('data-gal-next') ? step : -step, behavior: 'smooth' });
  });

  // Gli elementi dentro un contenitore che scorre in orizzontale (carosello, programma a scorrimento) non seguono lo scorrimento
  // verticale della pagina: il motore non applica loro la rivelazione laterale (vedi data-rv="off" in page.ts).
  function markScrollers(root) {
    all(root, '[data-anim]').forEach(function (el) {
      for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        var ov = getComputedStyle(a).overflowX;
        if ((ov === 'auto' || ov === 'scroll') && a.scrollWidth > a.clientWidth + 1) { el.setAttribute('data-rv', 'off'); break; }
      }
    });
  }

  // Reinizializza i comportamenti dentro un solo contenitore (il builder lo usa quando cambia quel blocco).
  function refresh(root) {
    live = live.filter(function (e) {
      if (e.node.isConnected) return true;
      e.stop();
      return false;
    });
    initScratch(root);
    initCountdown(root);
    initLoopVideo(root);
    initRsvp(root);
    initMapsLinks(root);
    markScrollers(root);
  }

  function boot() {
    initCover();
    refresh(document);
    // Nelle anteprime (carosello, demo) il contenuto è subito visibile: niente animazioni che dipendono dallo scorrimento,
    // perché dentro un telefono del carosello le transizioni non avanzano mentre il frame è fuori vista.
    var preview = document.documentElement.hasAttribute('data-preview');
    if (preview) {
      var style = document.createElement('style');
      style.textContent = '[data-anim]{opacity:1!important;transform:none!important;transition:none!important}';
      document.head.appendChild(style);
    }
    if (preview || !document.querySelector('[data-cover]')) startObserving();
  }

  // Il tema può agganciarsi a runtime con InviteMe.startObserving() dopo aver aggiunto nuovi elementi.
  window.InviteMe = { startObserving: startObserving, reducedMotion: reduced, refresh: refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
