(function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  document.documentElement.classList.add(isIOS ? 'zf-ios' : 'zf-web');
  if (standalone) document.documentElement.classList.add('zf-standalone');

  // Service Worker: Offline-Start + schnelleres Laden
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (r) { try { r.update(); } catch (e) {} }).catch(function () {});
    });
  }

  // Neue Version: direkt beim Start übernehmen (kein Neuinstallieren nötig)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded || performance.now() > 20000) return;
      reloaded = true; location.reload();
    });
  }

  // iOS: Bewegungssensor (Drift, 0-100) braucht eine Erlaubnis nach einem Tipp
  var askedMotion = false;
  function askMotion() {
    if (askedMotion) return;
    askedMotion = true;
    try {
      if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(function (r) {
          try { localStorage.setItem('zfMotion', r); } catch (e) {}
        }).catch(function () { askedMotion = false; });
      }
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(function () {});
      }
    } catch (e) {}
  }
  document.addEventListener('touchend', askMotion, { passive: true });
  document.addEventListener('click', askMotion, { passive: true });

  // ---- Fahren: Bildschirm wach halten (Wake Lock, sonst stilles Video) ----
  var lock = null, vid = null, hiddenAt = 0;
  window.zfDriving = false;
  function wakeVideo(on) {
    try {
      if (on) {
        if (!vid) {
          vid = document.createElement('video');
          vid.setAttribute('playsinline', ''); vid.setAttribute('muted', ''); vid.muted = true; vid.loop = true;
          vid.src = './wake.mp4';
          vid.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0';
          document.body.appendChild(vid);
        }
        var p = vid.play(); if (p && p.catch) p.catch(function () {});
      } else if (vid) { vid.pause(); }
    } catch (e) {}
  }
  function lockOn() {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l; l.addEventListener('release', function () { lock = null; });
      }).catch(function () { wakeVideo(true); });
    } else wakeVideo(true);
  }
  window.zfWake = function (on) {
    window.zfDriving = !!on;
    try {
      if (on) { askMotion(); if (!lock) lockOn(); }
      else { if (lock) { lock.release(); lock = null; } wakeVideo(false); }
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (window.zfDriving) {
      lockOn();
      var sec = Math.round((Date.now() - hiddenAt) / 1000);
      if (hiddenAt && sec > 4) toast('Die Fahrt war ' + (sec < 90 ? sec + ' Sekunden' : Math.round(sec / 60) + ' Minuten') + ' pausiert. Am iPhone misst QUER nur, solange die App offen ist.');
    }
  });
  function toast(t) {
    var d = document.createElement('div'); d.className = 'zf-ios-toast'; d.textContent = t;
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, 5200);
    setTimeout(function () { d.remove(); }, 5800);
  }
  window.zfToast = toast;

  // ---- Wie eine App: Zurück-Wischen vom linken Rand ----
  if (isIOS) {
    var sx = 0, sy = 0, act = false, arrow = null;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      act = e.touches.length === 1 && t.clientX < 22;
      if (!act) return;
      sx = t.clientX; sy = t.clientY;
      if (!arrow) { arrow = document.createElement('div'); arrow.className = 'zf-back'; arrow.innerHTML = '&#x2039;'; document.body.appendChild(arrow); }
      arrow.style.top = (sy - 22) + 'px'; arrow.style.transform = 'translateX(-60px)'; arrow.style.opacity = '0';
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!act) return;
      var t = e.touches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
      if (dy > 60) { act = false; arrow.style.opacity = '0'; return; }
      var k = Math.max(0, Math.min(1, dx / 90));
      arrow.style.transform = 'translateX(' + (-60 + k * 72) + 'px) scale(' + (0.7 + k * 0.3) + ')';
      arrow.style.opacity = String(k);
      arrow.classList.toggle('ready', k >= 1);
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!act) return; act = false;
      var t = e.changedTouches[0], ok = t.clientX - sx > 90 && Math.abs(t.clientY - sy) < 60;
      if (arrow) { arrow.style.opacity = '0'; arrow.style.transform = 'translateX(-60px)'; }
      if (ok && window.zfBack) window.zfBack();
    }, { passive: true });
    // Kein Doppeltipp-/Pinch-Zoom der Seite (3D-Garage zoomt weiter selbst)
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  }

  // ---- Einladungs-Link (?c=CODE) ----
  var m = location.search.match(/[?&]c=([A-Za-z0-9-]{10,12})/);
  var code = m ? m[1].toUpperCase() : '';
  var isAndroid = /Android/i.test(ua);
  window.zfLaunchUrl = function () {
    if (!code) return '';
    var k = 'zfJoin_' + code;
    try { if (localStorage.getItem(k)) return ''; localStorage.setItem(k, '1'); } catch (e) {}
    if (standalone) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
    return location.href;
  };
  function copy(t, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = 'Kopiert ✓'; setTimeout(function () { btn.textContent = o; }, 1600); } };
    try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); }
  }
  function invite() {
    if (!code || standalone) return;
    try { if (sessionStorage.getItem('zfInvSkip')) return; } catch (e) {}
    var d = document.createElement('div');
    d.className = 'zf-inv';
    var steps;
    if (isIOS) {
      steps =
        '<div class="zf-inv-step"><span>1</span><div>Unten in Safari auf <b>Teilen</b> <i class="zf-a2hs-i">&#x2191;</i> tippen</div></div>' +
        '<div class="zf-inv-step"><span>2</span><div><b>Zum Home-Bildschirm</b> wählen und <b>Hinzufügen</b></div></div>' +
        '<div class="zf-inv-step"><span>3</span><div>QUER am Home-Bildschirm öffnen. Du landest direkt in der Crew.</div></div>' +
        '<div class="zf-inv-note">Wichtig: Nicht in Safari weitermachen, sonst bist du später doppelt in der Crew.</div>';
    } else if (isAndroid) {
      steps =
        '<a class="zf-inv-btn acid" href="./quer.apk" download>QUER für Android laden</a>' +
        '<div class="zf-inv-note">Nach dem Laden die Datei öffnen und installieren (eventuell „Unbekannte Apps erlauben“).</div>' +
        '<a class="zf-inv-btn" href="at.quer.garage://join?c=' + code + '">Hab QUER schon: öffnen</a>' +
        '<button class="zf-inv-btn" id="zfInvCopy">Code kopieren</button>' +
        '<div class="zf-inv-note">Falls die App nicht aufgeht: Code kopieren, QUER öffnen, Crew, Mit Code beitreten. Der Code wird automatisch eingesetzt.</div>';
    } else {
      steps = '<div class="zf-inv-note">Öffne diesen Link am Handy. Am iPhone läuft QUER direkt über Safari, für Android gibt es die App zum Laden.</div>' +
        '<button class="zf-inv-btn" id="zfInvCopy">Code kopieren</button>';
    }
    d.innerHTML =
      '<div class="zf-inv-box">' +
      '<div class="zf-inv-logo">QU<em>E</em>R</div>' +
      '<div class="zf-inv-t">Du wurdest in eine Crew eingeladen</div>' +
      '<div class="zf-inv-code">' + code + '</div>' + steps +
      '<button class="zf-inv-skip">Im Browser weiter</button></div>';
    document.body.appendChild(d);
    var c = d.querySelector('#zfInvCopy'); if (c) c.onclick = function () { copy(code, c); };
    d.querySelector('.zf-inv-skip').onclick = function () { try { sessionStorage.setItem('zfInvSkip', '1'); } catch (e) {} d.remove(); };
    try { localStorage.setItem('zfA2HS', '1'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', invite); else invite();
  // Hinweis: zum Home-Bildschirm hinzufügen
  function hint() {
    if (!isIOS || standalone) return;
    try { if (localStorage.getItem('zfA2HS') === '1') return; } catch (e) {}
    var d = document.createElement('div');
    d.className = 'zf-a2hs';
    d.innerHTML =
      '<div class="zf-a2hs-t">QUER als App installieren</div>' +
      '<div class="zf-a2hs-s">Tippe unten auf <b>Teilen</b> <span class="zf-a2hs-i">&#xfe0e;&#x2191;</span> und dann auf <b>Zum Home-Bildschirm</b>. ' +
      'Erst dann laufen Benachrichtigungen und Vollbild.</div>' +
      '<button class="zf-a2hs-x" aria-label="Schließen">&times;</button>';
    d.querySelector('button').onclick = function () {
      try { localStorage.setItem('zfA2HS', '1'); } catch (e) {}
      d.remove();
    };
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(hint, 2500); });
  else setTimeout(hint, 2500);
})();
