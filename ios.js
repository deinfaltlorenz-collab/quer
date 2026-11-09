(function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  document.documentElement.classList.add(isIOS ? 'zf-ios' : 'zf-web');
  if (standalone) document.documentElement.classList.add('zf-standalone');

  // Service Worker: Offline-Start + schnelleres Laden
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
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

  // Bildschirm wach halten, solange die App offen ist und gefahren wird
  var lock = null;
  window.zfWake = function (on) {
    try {
      if (on && 'wakeLock' in navigator && !lock) {
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l;
          l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
      } else if (!on && lock) { lock.release(); lock = null; }
    } catch (e) {}
  };


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
