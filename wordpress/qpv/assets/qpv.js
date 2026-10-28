/* Qué Pasa Vallarta — interacción del sitio (equivale a los componentes "use client" de Next.js). */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Aviso flotante */
  var toastEl = $('[data-qpv-toast]'), toastT;
  window.qpvToast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  };

  /* Menú "Más" */
  var menu = $('[data-qpv-menu]'), compact = $('[data-qpv-compact]');
  function abrir() {
    if (!menu) return;
    menu.hidden = false;
    document.body.style.overflow = 'hidden';
    $$('[data-qpv-menu-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    var c = $('[data-qpv-menu-close]', menu); if (c) c.focus();
    barra();
  }
  function cerrar() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    document.body.style.overflow = '';
    $$('[data-qpv-menu-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    barra();
  }
  $$('[data-qpv-menu-open]').forEach(function (b) { b.addEventListener('click', abrir); });
  $$('[data-qpv-menu-close]').forEach(function (b) { b.addEventListener('click', cerrar); });
  if (menu) $$('a', menu).forEach(function (a) { a.addEventListener('click', cerrar); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });

  /* Barra compacta al bajar */
  function barra() {
    if (!compact) return;
    var ver = window.scrollY > 240 && (!menu || menu.hidden);
    compact.classList.toggle('is-visible', ver);
    if (ver) compact.removeAttribute('inert'); else compact.setAttribute('inert', '');
  }
  window.addEventListener('scroll', barra, { passive: true });
  barra();

  /* Tema claro / oscuro */
  $$('[data-qpv-tema]').forEach(function (b) {
    b.addEventListener('click', function () {
      var claro = document.documentElement.getAttribute('data-theme') === 'light';
      if (claro) { document.documentElement.removeAttribute('data-theme'); try { localStorage.setItem('vc_theme', ''); } catch (e) {} }
      else { document.documentElement.setAttribute('data-theme', 'light'); try { localStorage.setItem('vc_theme', 'light'); } catch (e) {} }
    });
  });

  /* Carruseles */
  $$('.carousel-wrap').forEach(function (w) {
    var row = $('.carousel-row', w);
    $$('.carousel-nav', w).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = b.classList.contains('prev') ? -1 : 1;
        row.scrollBy({ left: dir * Math.min(row.clientWidth * 0.85, 640), behavior: 'smooth' });
      });
    });
  });

  /* Reels: se ven aquí mismo con el reproductor de Facebook */
  $$('[data-reel]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-reel');
      var m = document.createElement('div');
      m.className = 'reel-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      m.innerHTML = '<div class="reel-modal-box"><button type="button" class="reel-modal-close" aria-label="Cerrar">×</button>' +
        '<iframe src="https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&width=360" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>' +
        '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="reel-modal-link">Ver en Facebook</a></div>';
      function fuera() { m.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); }
      function esc(e) { if (e.key === 'Escape') fuera(); }
      m.addEventListener('click', function (e) { if (e.target === m) fuera(); });
      $('.reel-modal-close', m).addEventListener('click', fuera);
      document.addEventListener('keydown', esc);
      document.body.style.overflow = 'hidden';
      document.body.appendChild(m);
    });
  });

  /* Franja de clima (Open-Meteo, sin llave) */
  var wb = $('[data-qpv-clima]');
  if (wb) {
    var LAT = 20.6534, LON = -105.2253, TZ = 'America%2FMexico_City';
    var COD = { 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa', 80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes', 95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo' };
    var j = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    j('https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON + '&current=temperature_2m,weather_code&timezone=' + TZ).then(function (d) {
      if (!d || typeof d.current.temperature_2m !== 'number') return;
      $('[data-t]', wb).textContent = Math.round(d.current.temperature_2m) + '°';
      $('[data-desc]', wb).textContent = COD[d.current.weather_code] || '—';
    });
    j('https://marine-api.open-meteo.com/v1/marine?latitude=' + LAT + '&longitude=' + LON + '&current=wave_height&timezone=' + TZ).then(function (d) {
      if (d && typeof d.current.wave_height === 'number') $('[data-ola]', wb).textContent = 'Oleaje ' + (Math.round(d.current.wave_height * 10) / 10) + ' m';
    });
    j('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + LAT + '&longitude=' + LON + '&current=us_aqi&timezone=' + TZ).then(function (d) {
      if (!d || typeof d.current.us_aqi !== 'number') return;
      var a = Math.round(d.current.us_aqi);
      var lab = a <= 50 ? 'Buena' : a <= 100 ? 'Moderada' : a <= 150 ? 'Dañina (sensibles)' : a <= 200 ? 'Dañina' : 'Muy dañina';
      $('[data-aqi]', wb).innerHTML = '<b>' + a + '</b><span class="aqi-pill' + (a <= 50 ? '' : a <= 100 ? ' mid' : ' bad') + '">' + lab + '</span>';
    });
  }

  /* Boletín */
  $$('[data-qpv-newsletter]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      fetch(f.action, { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (r) {
        qpvToast(r && r.ok ? '¡Listo! Te llegará el boletín cada mañana.' : 'No pudimos registrarte, intenta de nuevo.');
        if (r && r.ok) f.reset();
      }).catch(function () { qpvToast('No pudimos registrarte, intenta de nuevo.'); });
    });
  });

  /* Conteo de visitas (privado) */
  try {
    if (window.QPV && QPV.track && location.pathname.indexOf('/wp-') !== 0) {
      var vid = localStorage.getItem('qpv_vid');
      if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('qpv_vid', vid); }
      var body = JSON.stringify({ path: location.pathname, vid: vid });
      if (navigator.sendBeacon) navigator.sendBeacon(QPV.track, new Blob([body], { type: 'text/plain' }));
    }
  } catch (e) {}
})();

/* Escuchar nota */
(function () {
  var box = document.querySelector('[data-qpv-escuchar]');
  if (!box) return;
  var btn = box.querySelector('.escuchar-boton'), stop = box.querySelector('.escuchar-detener');
  var icon = box.querySelector('.escuchar-icono'), lab = box.querySelector('[data-l]');
  var texto = box.querySelector('template').innerHTML.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  var mp3 = box.getAttribute('data-mp3'), audio = null, estado = 'listo', cola = [];
  function pintar() {
    icon.textContent = estado === 'leyendo' ? '❚❚' : '▶';
    lab.textContent = estado === 'leyendo' ? 'Pausar' : estado === 'pausa' ? 'Continuar' : 'Escuchar nota';
    btn.setAttribute('aria-pressed', estado === 'leyendo' ? 'true' : 'false');
    stop.hidden = estado === 'listo';
  }
  function voz() {
    var v = speechSynthesis.getVoices().filter(function (x) { return x.lang.toLowerCase().indexOf('es') === 0; });
    return v.find(function (x) { return x.lang.toLowerCase() === 'es-mx' && /natural|premium|enhanced|google/i.test(x.name); }) ||
      v.find(function (x) { return x.lang.toLowerCase() === 'es-mx'; }) || v.find(function (x) { return x.lang.toLowerCase() === 'es-us'; }) || v[0];
  }
  function trozos(t) {
    var f = t.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*/g) || [t], out = [], a = '';
    f.forEach(function (x) { if ((a + x).length > 220 && a) { out.push(a.trim()); a = ''; } a += x; });
    if (a.trim()) out.push(a.trim());
    return out;
  }
  function siguiente() {
    var t = cola.shift();
    if (!t) { estado = 'listo'; pintar(); return; }
    var u = new SpeechSynthesisUtterance(t), v = voz();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'es-MX';
    u.onend = siguiente; u.onerror = function () { estado = 'listo'; pintar(); };
    speechSynthesis.speak(u);
  }
  btn.addEventListener('click', function () {
    if (mp3) {
      if (!audio) { audio = new Audio(mp3); audio.onended = function () { estado = 'listo'; pintar(); }; }
      if (estado === 'leyendo') { audio.pause(); estado = 'pausa'; } else { audio.play(); estado = 'leyendo'; }
      return pintar();
    }
    if (estado === 'leyendo') { speechSynthesis.pause(); estado = 'pausa'; return pintar(); }
    if (estado === 'pausa') { speechSynthesis.resume(); estado = 'leyendo'; return pintar(); }
    speechSynthesis.cancel(); cola = trozos(texto); estado = 'leyendo'; pintar(); siguiente();
  });
  stop.addEventListener('click', function () {
    if (audio) { audio.pause(); audio.currentTime = 0; } else { speechSynthesis.cancel(); cola = []; }
    estado = 'listo'; pintar();
  });
  if (mp3) { box.hidden = false; return; }
  if (!('speechSynthesis' in window)) return;
  function revisar() { if (speechSynthesis.getVoices().some(function (v) { return v.lang.toLowerCase().indexOf('es') === 0; })) box.hidden = false; }
  setTimeout(revisar, 0);
  speechSynthesis.addEventListener('voiceschanged', revisar);
})();

/* Vallarta Ahora: mosaicos en vivo y pestañas */
(function () {
  var a = document.querySelector('[data-qpv-ahora]');
  if (a) {
    var LAT = 20.6534, LON = -105.2253, TZ = 'America%2FMexico_City';
    var COD = { 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina', 51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa', 80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes', 95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo' };
    var j = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    j('https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON + '&current=temperature_2m,weather_code&timezone=' + TZ).then(function (d) {
      if (d && typeof d.current.temperature_2m === 'number') a.querySelector('[data-clima]').textContent = Math.round(d.current.temperature_2m) + '°C · ' + (COD[d.current.weather_code] || '—');
    });
    j('https://marine-api.open-meteo.com/v1/marine?latitude=' + LAT + '&longitude=' + LON + '&current=wave_height&timezone=' + TZ).then(function (d) {
      if (d && typeof d.current.wave_height === 'number') a.querySelector('[data-oleaje]').textContent = (Math.round(d.current.wave_height * 10) / 10) + ' m de oleaje';
    });
    j('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + LAT + '&longitude=' + LON + '&current=us_aqi&timezone=' + TZ).then(function (d) {
      if (!d || typeof d.current.us_aqi !== 'number') return;
      var v = Math.round(d.current.us_aqi);
      a.querySelector('[data-aire]').textContent = v + ' · ' + (v <= 50 ? 'Buena' : v <= 100 ? 'Moderada' : v <= 150 ? 'Dañina (sensibles)' : v <= 200 ? 'Dañina' : 'Muy dañina');
    });
  }
  var t = document.querySelector('[data-qpv-tabs]');
  if (t) {
    var filas = Array.prototype.slice.call(t.querySelectorAll('[data-c]'));
    function mostrar(cat) {
      var n = 0;
      filas.forEach(function (f) { var ok = (cat === 'todas' || f.getAttribute('data-c') === cat) && n < 10; f.hidden = !ok; if (ok) n++; });
      t.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-cat') === cat); });
    }
    t.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { mostrar(b.getAttribute('data-cat')); }); });
    mostrar('todas');
  }
})();

/* Reporte ciudadano y Vallarta Conecta */
(function () {
  var f = document.querySelector('[data-qpv-reporte]');
  if (f) {
    var foto = f.querySelector('#d-foto'), vista = f.querySelector('[data-vista]');
    foto.addEventListener('change', function () { var x = foto.files && foto.files[0]; if (x) { vista.src = URL.createObjectURL(x); vista.hidden = false; } else vista.hidden = true; });
    var ub = f.querySelector('[data-ubic]'), um = f.querySelector('[data-ubic-msg]');
    ub.addEventListener('click', function () {
      um.hidden = false;
      if (!navigator.geolocation) { um.textContent = 'Tu teléfono no permite compartir ubicación.'; return; }
      um.textContent = 'Buscando tu ubicación…';
      navigator.geolocation.getCurrentPosition(function (p) {
        f.lat.value = p.coords.latitude; f.lon.value = p.coords.longitude;
        um.textContent = 'Ubicación agregada ✓ (solo la ve nuestro equipo)';
      }, function () { um.textContent = 'No se pudo obtener la ubicación. Escribe la dirección arriba.'; }, { enableHighAccuracy: true, timeout: 10000 });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = f.querySelector('[data-err]'), btn = f.querySelector('button[type=submit]');
      err.hidden = true; btn.disabled = true; btn.textContent = 'Enviando…';
      fetch(f.action, { method: 'POST', body: new FormData(f) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && (x.j.error || x.j.message)) || 'No se pudo enviar.');
          document.querySelector('[data-qpv-reporte-box]').innerHTML = '<div class="denuncia-ok" role="status"><strong>Recibimos tu reporte.</strong><p>Nuestro equipo lo revisa antes de publicarlo. Si dejaste un contacto, podríamos escribirte para confirmar algún dato. Gracias por ayudar a que Vallarta esté mejor informada.</p></div>';
        })
        .catch(function (e2) { err.textContent = e2.message || 'No se pudo enviar.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Enviar reporte'; });
    });
  }
  var l = document.querySelector('[data-qpv-lead]');
  if (l) {
    l.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = l.querySelector('button'); btn.disabled = true; btn.textContent = 'Enviando…';
      fetch(l.action, { method: 'POST', body: new FormData(l) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.error) || 'No se pudo enviar.');
          l.outerHTML = '<p style="font-size:15px;margin:10px 0 0"><strong>¡Gracias!</strong> Recibimos tus datos; te contactamos muy pronto con las opciones para tu negocio.</p>';
        })
        .catch(function (e2) { window.qpvToast && qpvToast(e2.message); btn.disabled = false; btn.textContent = 'Solicitar información'; });
    });
  }
})();
