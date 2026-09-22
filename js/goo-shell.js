/* Install, share, tutorial, and page boot */
(function (root) {
  'use strict';
  var GOO = root.GOO;
  if (!GOO) return;
  var Device = GOO.Device;
  var Sound = GOO.Sound;
  var Notify = GOO.Notify;
  var Compass = GOO.Compass;
  var SHARE_URL = (location.origin && location.origin !== 'null') ? location.href : 'https://github.com/IanDev-cmd/Guardians-of-the-Ocean';
  var SHARE_TEXT = 'Guardians of the Ocean — live coastal restoration, 3D globe and 2D maps.';
  var TUTORIAL_KEY = 'goo-tutorial-v3';
  var deferredPrompt = null;
  var PWA_LIVE = 'https://guardians-of-the-ocean1.onrender.com';
  var ICON_APPLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.2c1.1-1.2 1.5-2.4 1.5-2.5-.1 0-2.8-1.1-2.8-4z"/><path d="M14.8 6.7c.6-.8 1.1-1.8.9-2.9-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.8 1.1.1 2.2-.6 2.9-1.4z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.5 2.8v18.4c0 .5.5.8 1 .6l10.2-9.2L4.5 2.2c-.5-.2-1 .1-1 .6zm12.3 7.3 2.2-2-8.3-4.8 6.1 6.8zm2.2 5.8-2.2-2-6.1 6.8 8.3-4.8zM8.4 12 4.8 15.6V8.4L8.4 12z"/></svg>';

  function pwaOrigin() {
    return (location.origin && location.origin !== 'null')
      ? location.origin.replace(/\/$/, '')
      : PWA_LIVE.replace(/\/$/, '');
  }

  function shortInstallPath() {
    return '/i';
  }

  function pwaInstallUrl() {
    return pwaOrigin() + shortInstallPath();
  }

  function shortInstallLabel() {
    return pwaOrigin().replace(/^https?:\/\//, '') + shortInstallPath();
  }

  function qrSrc(url) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&color=0d0f0c&bgcolor=ffffff&data=' + encodeURIComponent(url);
  }

  function paintInstallQr(host, url) {
    if (!host) return;
    var tries = 0;
    function drawLocal() {
      try {
        var svg = GOO.qrSvg && GOO.qrSvg(url, 196);
        if (svg) {
          host.innerHTML = svg;
          if (host.querySelector('svg')) return true;
        }
      } catch (e) {}
      return false;
    }
    function drawRemote() {
      host.innerHTML = '<img alt="Scan to install" width="196" height="196" src="' + qrSrc(url) + '">';
      var img = host.querySelector('img');
      if (!img) return;
      img.addEventListener('error', function () {
        img.src = 'https://quickchart.io/qr?size=196&margin=2&text=' + encodeURIComponent(url);
      });
    }
    function tick() {
      if (drawLocal()) return;
      if (++tries < 12) {
        setTimeout(tick, 50);
        return;
      }
      drawRemote();
    }
    tick();
  }

  function wantAutoInstall() {
    return /(?:^|[?&])install=1(?:&|$)/.test(location.search);
  }

  function setupInstall() {
    var bar = document.getElementById('installApp');
    var pwaBtn = document.getElementById('installBtn');
    var auto = wantAutoInstall();
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (bar) bar.classList.add('ready');
      if (pwaBtn) pwaBtn.style.display = 'block';
      var nowBtn = document.getElementById('tutInstallNow');
      if (nowBtn) nowBtn.classList.add('ready');
      if (auto && Device.pwaShell) {
        setTimeout(function () { promptInstall(true); }, 400);
      }
    });
    function promptInstall(fromScan) {
      if (!fromScan) Sound.click();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (c) {
          Notify.toast({
            tone: c.outcome === 'accepted' ? 'green' : 'amber',
            title: c.outcome === 'accepted' ? 'PWA installed' : 'Install dismissed',
            sub: c.outcome === 'accepted' ? 'Global Impact Ledger is on your home screen.' : 'Tap Install on this device again any time.',
            n: c.outcome === 'accepted' ? 'OK' : '!'
          });
          deferredPrompt = null;
          var nowBtn = document.getElementById('tutInstallNow');
          if (nowBtn) nowBtn.classList.remove('ready');
        });
        return;
      }
      if (Device.standalone) {
        Notify.toast({ tone: 'green', title: 'Already installed', sub: 'The ledger is on your home screen.', n: 'OK' });
        return;
      }
      if (Device.ios) {
        Notify.toast({ tone: 'blue', title: 'Add to Home Screen', sub: 'Share → Add to Home Screen, then open the app icon — not Safari.', n: 'iOS' });
        return;
      }
      Notify.toast({
        tone: 'blue',
        title: 'Install this device',
        sub: 'Chrome or Edge: use the install icon in the address bar, or tap Install on this device when it lights up.',
        n: 'PWA'
      });
    }
    GOO.promptInstall = promptInstall;
    function openInstallCard() {
      Sound.click();
      if (Tutorial.showLaunch) Tutorial.showLaunch({ force: true, fromInstall: true });
    }
    ['installMain', 'installApple', 'installPlay'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', openInstallCard);
    });
    if (pwaBtn) pwaBtn.addEventListener('click', openInstallCard);
    window.addEventListener('appinstalled', function () {
      Notify.toast({ tone: 'green', title: 'Installed', sub: 'Launch Guardians of the Ocean from your home screen.', n: '01' });
    });
    if (auto && Device.pwaShell && Device.ios) {
      setTimeout(function () { promptInstall(true); }, 900);
    }
  }

  function setupShare() {
    var url = encodeURIComponent(SHARE_URL);
    var text = encodeURIComponent(SHARE_TEXT);
    var links = {
      x: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
      fb: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
      wa: 'https://wa.me/?text=' + text + '%20' + url
    };
    document.querySelectorAll('[data-share]').forEach(function (a) {
      var k = a.getAttribute('data-share');
      if (links[k]) a.href = links[k];
      a.addEventListener('click', function (e) {
        Sound.click();
      });
    });
  }

  var Tutorial = {
    steps: [],
    i: 0,
    veil: null,
    card: null,
    pointer: null,
    paused: false,
    _timers: [],
    stored: function (val) {
      try {
        if (arguments.length) localStorage.setItem(TUTORIAL_KEY, val);
        else return localStorage.getItem(TUTORIAL_KEY);
      } catch (e) { return null; }
    },
    ask: function () {
      this.showLaunch();
    },
    showLaunch: function (opts) {
      opts = opts || {};
      if (Device.embed) return;
      if (!opts.force && this.stored()) return;
      var existing = document.querySelector('.tut-ask');
      if (existing) {
        document.body.classList.add('tut-launch-on');
        existing.classList.add('show');
        var nowBtn = existing.querySelector('#tutInstallNow');
        if (nowBtn && deferredPrompt) nowBtn.classList.add('ready');
        paintInstallQr(existing.querySelector('#tutQr'), pwaInstallUrl());
        return;
      }
      var ov = document.createElement('div');
      ov.className = 'tut-ask';
      var url = pwaInstallUrl();
      var closeLabel = opts.fromInstall ? 'CLOSE' : 'SKIP';
      ov.innerHTML =
        '<article class="tpop tut-launch" role="dialog" aria-label="Install and tutorial">' +
          '<div class="tpop-h">' +
            '<span class="tpop-rank">01</span>' +
            '<div><b>INSTALL &amp; TOUR</b><i>This device or scan a phone</i></div>' +
            '<span class="tpop-ph">SCAN ME</span>' +
          '</div>' +
          '<div class="tut-launch-body">' +
            '<div class="tut-qr">' +
              '<div id="tutQr" class="tut-qr-code" role="img" aria-label="QR code to install the PWA"></div>' +
              '<b>SCAN ME</b>' +
              '<i>Install as an app — not the browser</i>' +
              '<a class="tut-tiny" id="tutTiny" href="' + url + '"><span>Type on any phone</span>' + shortInstallLabel() + '</a>' +
            '</div>' +
            '<div class="tut-launch-copy">' +
              '<p>Scan the QR, or type the short link on any phone or browser — it opens the same install page.</p>' +
              '<div class="tpop-kpis">' +
                '<div class="tpop-kpi"><b>PWA</b><i>PHONE</i></div>' +
                '<div class="tpop-kpi"><b>3D / 2D</b><i>MAPS</i></div>' +
                '<div class="tpop-kpi"><b>LIVE</b><i>LEDGER</i></div>' +
              '</div>' +
              '<div class="tut-store">' +
                '<span>This device</span>' +
                '<button type="button" id="tutInstallNow" class="tut-install-now' + (deferredPrompt ? ' ready' : '') + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 21h16"/></svg>' +
                  'INSTALL ON THIS DEVICE' +
                '</button>' +
                '<span>Or another phone</span>' +
                '<div class="tut-store-row">' +
                  '<button type="button" id="tutApple" class="tut-store-btn" aria-label="Install on iPhone">' + ICON_APPLE + '<em>App Store</em></button>' +
                  '<button type="button" id="tutPlay" class="tut-store-btn" aria-label="Install on Android">' + ICON_PLAY + '<em>Google Play</em></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tpop-fund">QR for a phone · Install on this device · then tour the desk</div>' +
          '<div class="tpop-cta">' +
            '<button type="button" id="tutYes">PLAY THE TUTORIAL</button>' +
            '<button type="button" id="tutNo" class="hash">' + closeLabel + '</button>' +
          '</div>' +
        '</article>';
      document.body.appendChild(ov);
      document.body.classList.add('tut-launch-on');
      if (GOO.News && GOO.News.hidePrompt) GOO.News.hidePrompt();
      paintInstallQr(ov.querySelector('#tutQr'), url);
      requestAnimationFrame(function () { ov.classList.add('show'); });
      function bindStore(id) {
        var btn = ov.querySelector('#' + id);
        if (btn) btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (GOO.promptInstall) GOO.promptInstall();
        });
      }
      bindStore('tutApple');
      bindStore('tutPlay');
      var installNow = ov.querySelector('#tutInstallNow');
      if (installNow) installNow.addEventListener('click', function (e) {
        e.stopPropagation();
        if (GOO.promptInstall) GOO.promptInstall();
      });
      ov.querySelector('#tutYes').addEventListener('click', function () {
        Sound.click();
        document.body.classList.remove('tut-launch-on');
        ov.remove();
        Tutorial.start();
      });
      ov.querySelector('#tutNo').addEventListener('click', function () {
        Sound.click();
        document.body.classList.remove('tut-launch-on');
        ov.remove();
        if (!opts.fromInstall) {
          Tutorial.stored('skip');
          setTimeout(function () {
            if (GOO.openWalletCard) GOO.openWalletCard({ first: true });
          }, 240);
        }
        if (GOO.News && GOO.News.schedulePrompt) GOO.News.schedulePrompt(55 * 1000);
      });
    },
    replay: function () {
      var ask = document.querySelector('.tut-ask');
      if (ask) ask.remove();
      document.body.classList.remove('tut-launch-on');
      if (this.card || this.veil) this.end(true);
      this.start();
    },
    q: function (sel) { return sel ? document.querySelector(sel) : null; },
    click: function (selOrEl) {
      var el = typeof selOrEl === 'string' ? this.q(selOrEl) : selOrEl;
      if (!el) return false;
      try { el.click(); } catch (e) {}
      return true;
    },
    later: function (ms, fn) {
      var id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },
    clearTimers: function () {
      this._timers.forEach(function (id) { clearTimeout(id); });
      this._timers = [];
    },
    target: function (step) {
      if (step.selFn) return step.selFn() || this.q(step.sel);
      return this.q(step.sel);
    },
    spotlight: function (el) {
      var r = el && el.getBoundingClientRect
        ? el.getBoundingClientRect()
        : { left: innerWidth / 2 - 80, top: innerHeight / 2 - 80, width: 160, height: 160 };
      var pad = 10;
      if (this.veil) {
        this.veil.style.left = Math.max(8, r.left - pad) + 'px';
        this.veil.style.top = Math.max(8, r.top - pad) + 'px';
        this.veil.style.width = Math.min(innerWidth - 16, r.width + pad * 2) + 'px';
        this.veil.style.height = Math.min(innerHeight - 16, r.height + pad * 2) + 'px';
      }
      if (this.pointer) {
        this.pointer.style.left = (r.left + r.width / 2) + 'px';
        this.pointer.style.top = (r.top + r.height / 2) + 'px';
        this.pointer.classList.remove('tap');
        var self = this;
        requestAnimationFrame(function () { self.pointer.classList.add('tap'); });
      }
    },
    typeInto: function (input, text, done) {
      var self = this;
      if (!input) { if (done) done(); return; }
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      var i = 0;
      function tick() {
        if (self._stop) { if (done) done(); return; }
        if (i >= text.length) {
          input.dispatchEvent(new Event('change', { bubbles: true }));
          if (done) done();
          return;
        }
        input.value += text.charAt(i++);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        self.later(70, tick);
      }
      tick();
    },
    desktopSteps: function () {
      var self = this;
      return [
        {
          sel: '#hero', emoji: '🌊', title: 'Home — Save the Ocean',
          body: 'This is the command desk. We will click every control: profile, news, photo cards, search, wallet, milestone, then the satellite square into 2D maps.',
          hold: 2200
        },
        {
          sel: '.n-avatar-fab', emoji: '👤', title: 'Field crew profile',
          body: 'Your crew photos, ratings and milestone progress live here.',
          hold: 2600,
          run: function (done) {
            self.click('.n-avatar-fab');
            self.later(1600, function () {
              if (Notify.closeCrew) Notify.closeCrew();
              done();
            });
          }
        },
        {
          sel: '.n-bell', emoji: '🔔', title: 'Coastal news',
          body: 'The bell opens live ocean, city and research headlines.',
          hold: 2800,
          run: function (done) {
            self.click('.n-bell');
            self.later(1800, function () {
              if (Notify.panel) Notify.panel.classList.remove('open');
              done();
            });
          }
        },
        {
          sel: '#list', emoji: '🏙️', title: 'Photo cards',
          body: 'City stills on the right. We open Jakarta so the panel flies in.',
          hold: 3200,
          selFn: function () { return self.q('#track .card[data-id="jakarta"]') || self.q('#list'); },
          run: function (done) {
            var card = self.q('#track .card[data-id="jakarta"]') || self.q('#track .card');
            self.click(card);
            self.later(2400, done);
          }
        },
        {
          sel: '#back', emoji: '↩️', title: 'Back to the globe',
          body: 'Close the campaign still and return to Earth.',
          hold: 1600,
          run: function (done) {
            if (window.closePhotoCard) window.closePhotoCard();
            else self.click('#back');
            self.later(700, done);
          }
        },
        {
          sel: '#gsearch', emoji: '🔎', title: 'Search a city',
          body: 'Type Jakarta — the globe turns to that shore.',
          hold: 3600,
          run: function (done) {
            var input = self.q('#gsearchIn');
            self.typeInto(input, 'Jakarta', function () {
              self.later(280, function () {
                var hit = self.q('#gsearchHits [data-id="jakarta"]') || self.q('#gsearchHits button');
                if (hit) self.click(hit);
                else if (window.__globeLook) window.__globeLook(-6.2088, 106.8456);
                self.later(1200, done);
              });
            });
          }
        },
        {
          sel: '#gctrl', emoji: '➕', title: 'Globe size & layers',
          body: 'Plus, minus, then night lights on the 3D Earth.',
          hold: 2800,
          run: function (done) {
            self.click('#gPlus');
            self.later(500, function () {
              self.click('#gLayersBtn');
              self.later(450, function () {
                self.click('#gLayersPanel [data-tex="night"]');
                self.later(900, function () {
                  self.click('#gLayersBtn');
                  self.later(350, function () {
                    self.click('#gLayersPanel [data-tex="default"]');
                    done();
                  });
                });
              });
            });
          }
        },
        {
          sel: '#railWallet', emoji: '💼', title: 'Wallet overview',
          body: 'The rail opens the live Stripe ledger — restoration fund and your payouts.',
          hold: 2600,
          run: function (done) {
            var wrap = self.q('#railWallet') && self.q('#railWallet').closest('.icon-wrap');
            if (wrap) wrap.classList.add('show');
            if (window.openUxCard) window.openUxCard('wallet');
            else self.click('#railWallet');
            self.later(1800, function () {
              if (wrap) wrap.classList.remove('show');
              if (window.closeUxCard) window.closeUxCard();
              done();
            });
          }
        },
        {
          sel: '#railMilestone', emoji: '🚩', title: 'Milestone & phase roadmap',
          body: 'Escrow, field phases, then the Phase Roadmap Visualizer.',
          hold: 2800,
          run: function (done) {
            var wrap = self.q('#railMilestone') && self.q('#railMilestone').closest('.icon-wrap');
            if (wrap) wrap.classList.add('show');
            if (window.openUxCard) window.openUxCard('milestone');
            else self.click('#railMilestone');
            self.later(1400, function () {
              var row = self.q('#uxRows [data-action="roadmap"]');
              if (row) {
                if (window.closeUxCard) window.closeUxCard();
                if (wrap) wrap.classList.remove('show');
                done();
                return;
              }
              if (window.closeUxCard) window.closeUxCard();
              if (wrap) wrap.classList.remove('show');
              done();
            });
          }
        },
        {
          sel: '#satPeek', emoji: '🛰️', title: 'Satellite square',
          body: 'This window is live Earth imagery. Click it to open 2D maps zoomed out over the whole world.',
          hold: 4200,
          run: function (done) {
            if (window.openTerraWorld) window.openTerraWorld();
            else self.click('#satPeek');
            self.later(2800, done);
          }
        },
        {
          sel: '#terraSearch', emoji: '🗺️', title: 'Zoom to a city',
          body: 'From world view we search Lagos and fly the 2D map into that coast.',
          hold: 3800,
          run: function (done) {
            var input = self.q('#terraSearchIn');
            self.typeInto(input, 'Lagos', function () {
              self.later(280, function () {
                var hit = self.q('#terraSearchHits [data-id="lagos"]') || self.q('#terraSearchHits button');
                if (hit) self.click(hit);
                self.later(1800, done);
              });
            });
          }
        },
        {
          sel: '#terraFilters', emoji: '🪸', title: 'Map overlays',
          body: 'Toggle mangroves, coral, traps, walls and schools on the shoreline.',
          hold: 2400,
          run: function (done) {
            self.click('#terraFilters [data-layer="coral"]');
            self.later(700, function () {
              self.click('#terraFilters [data-layer="edu"]');
              self.later(700, function () {
                self.click('#terraFilters [data-layer="coral"]');
                self.click('#terraFilters [data-layer="edu"]');
                done();
              });
            });
          }
        },
        {
          sel: '#terraLayersBtn', emoji: '🗂️', title: 'Base layers',
          body: 'Satellite, streets, topography, heat and climate flood overlays.',
          hold: 2800,
          run: function (done) {
            self.click('#terraLayersBtn');
            self.later(500, function () {
              self.click('#terraLayers [data-layer="street"]');
              self.later(900, function () {
                self.click('#terraLayersBtn');
                self.later(350, function () {
                  self.click('#terraLayers [data-layer="sat"]');
                  done();
                });
              });
            });
          }
        },
        {
          sel: '#terraDock', emoji: '📍', title: 'Phase roadmap',
          body: 'Horizontal path of field ops — we check a phase, then switch to the circular map.',
          hold: 3200,
          selFn: function () { return self.q('#rmPath') || self.q('#terraDock'); },
          run: function (done) {
            var step = self.q('#rmPath [data-i="0"]') || self.q('#rmPath [data-i="3"]');
            if (step) self.click(step);
            self.later(900, function () {
              self.click('#terraViewCycle');
              self.later(1400, function () {
                self.click('#terraViewPath');
                done();
              });
            });
          }
        },
        {
          sel: '#terraZoomIn', emoji: '🔍', title: 'Zoom & compass',
          body: 'Zoom the tiles, then the map compass recenters the chosen city.',
          hold: 2200,
          run: function (done) {
            self.click('#terraZoomIn');
            self.later(400, function () {
              self.click('#terraZoomIn');
              self.later(500, function () {
                self.click('#terraCompass');
                done();
              });
            });
          }
        },
        {
          sel: '#terraClose', emoji: '🌍', title: 'Back to Earth',
          body: 'Close the 2D maps. The 3D globe, cards and ledger stay on the home desk.',
          hold: 1800,
          run: function (done) {
            if (window.closeTerraRoadmap) window.closeTerraRoadmap();
            else self.click('#terraClose');
            self.later(700, done);
          }
        },
        {
          sel: '#compassFab', emoji: '🧭', title: 'GPS compass',
          body: 'True heading, elevation and a satellite ring for field ops.',
          hold: 2400,
          run: function (done) {
            if (Compass && Compass.show) Compass.show();
            else self.click('#compassFab');
            self.later(1600, function () {
              if (Compass && Compass.hide) Compass.hide();
              done();
            });
          }
        },
        {
          sel: '#installApp', emoji: '📲', title: 'Install the ledger',
          body: 'Bottom-left puts the Global Impact Ledger on your home screen.',
          hold: 2000
        }
      ];
    },
    pwaSteps: function () {
      var self = this;
      return [
        {
          sel: '#iconGrid', emoji: '🧭', title: 'Field tools',
          body: 'Each tile is a live feed — 3D Earth, 2D coasts, vault, grants, ledger.',
          hold: 2200
        },
        {
          sel: '.n-avatar-fab', emoji: '👤', title: 'Crew profile',
          body: 'Open field-operator reviews and milestone bars.',
          hold: 2400,
          run: function (done) {
            self.click('.n-avatar-fab');
            self.later(1500, function () {
              if (Notify.closeCrew) Notify.closeCrew();
              done();
            });
          }
        },
        {
          sel: '.n-bell', emoji: '🔔', title: 'News shade',
          body: 'Coastal headlines land on the bell — same feed as the desktop desk.',
          hold: 2400,
          run: function (done) {
            self.click('.n-bell');
            self.later(1500, function () {
              if (Notify.panel) Notify.panel.classList.remove('open');
              done();
            });
          }
        },
        {
          sel: '#satPeek, #iconGrid .tile[aria-label="2D Coastal Maps"]', emoji: '🛰️',
          title: 'Satellite maps',
          body: 'The satellite square (or Maps tile) opens zoomed-out 2D coasts.',
          hold: 3600,
          run: function (done) {
            if (self.q('#satPeek')) self.click('#satPeek');
            else {
              var tiles = document.querySelectorAll('#iconGrid .tile');
              var mapTile = null;
              tiles.forEach(function (t) {
                if ((t.getAttribute('aria-label') || '').indexOf('2D') >= 0) mapTile = t;
              });
              if (mapTile) self.click(mapTile);
              else if (window.GOO && GOO.openPwaView) GOO.openPwaView('world');
            }
            self.later(2400, function () {
              self.click('#pwaCloseView');
              done();
            });
          }
        },
        {
          sel: '#pwaCompassBtn', emoji: '🧭', title: 'GPS compass',
          body: 'Heading, elevation and the map ring — same HUD as the globe desk.',
          hold: 2200,
          run: function (done) {
            self.click('#pwaCompassBtn');
            self.later(1400, function () {
              if (Compass && Compass.hide) Compass.hide();
              done();
            });
          }
        },
        {
          sel: '#pwaFeatureCard', emoji: '💚', title: 'Restoration fund',
          body: 'Live Stripe available / settled, then Checkout when you are ready — we will not charge in the tour.',
          hold: 2400
        }
      ];
    },
    start: function () {
      this.steps = Device.pwaShell ? this.pwaSteps() : this.desktopSteps();
      this.i = 0;
      this.paused = false;
      this._stop = false;
      this.clearTimers();
      this.veil = document.createElement('div');
      this.veil.className = 'tut-veil';
      this.card = document.createElement('div');
      this.card.className = 'tut-step tpop';
      this.pointer = document.createElement('div');
      this.pointer.className = 'tut-pointer';
      this.progress = document.createElement('div');
      this.progress.className = 'tut-progress';
      this.progress.innerHTML = '<i></i>';
      document.body.appendChild(this.progress);
      document.body.appendChild(this.veil);
      document.body.appendChild(this.pointer);
      document.body.appendChild(this.card);
      document.body.classList.add('tut-on');
      this.render();
    },
    paintCard: function (step) {
      var pct = ((this.i + 1) / this.steps.length) * 100;
      var last = this.i === this.steps.length - 1;
      if (this.progress) {
        var fill = this.progress.querySelector('i');
        if (fill) fill.style.width = pct + '%';
      }
      this.card.innerHTML =
        '<div class="tut-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="tpop-h">' +
          '<span class="tpop-rank">' + String(this.i + 1).padStart(2, '0') + '</span>' +
          '<div><b>' + step.title + '</b><i>Step ' + (this.i + 1) + ' of ' + this.steps.length + '</i></div>' +
          '<span class="tpop-ph">' + (step.emoji || '🌊') + '</span>' +
        '</div>' +
        '<p class="tut-step-copy">' + step.body + '</p>' +
        '<div class="tpop-cta tut-nav">' +
          '<button type="button" class="hash" data-act="skip">SKIP</button>' +
          '<button type="button" class="hash" data-act="pause">' + (this.paused ? 'PLAY' : 'PAUSE') + '</button>' +
          '<button type="button" data-act="next">' + (last ? 'FINISH' : 'NEXT') + '</button>' +
        '</div>';
      var self = this;
      this.card.querySelector('[data-act="next"]').addEventListener('click', function () {
        Sound.click();
        self.go(1);
      });
      this.card.querySelector('[data-act="skip"]').addEventListener('click', function () {
        Sound.click();
        self.end();
      });
      this.card.querySelector('[data-act="pause"]').addEventListener('click', function () {
        Sound.click();
        self.paused = !self.paused;
        this.textContent = self.paused ? 'PLAY' : 'PAUSE';
        if (!self.paused) self.armAdvance(step);
      });
    },
    armAdvance: function (step) {
      var self = this;
      this.clearTimers();
      if (this.paused) return;
      var hold = step.hold || 2400;
      this.later(hold, function () {
        if (self.paused || self._stop) return;
        self.go(1);
      });
    },
    go: function (dir) {
      this.clearTimers();
      this.i += dir || 1;
      this.render();
    },
    render: function () {
      var step = this.steps[this.i];
      if (!step) { this.end(); return; }
      var el = this.target(step);
      this.spotlight(el);
      this.paintCard(step);
      Sound.info();
      var self = this;
      var stepIndex = this.i;
      if (step.run) {
        var finished = false;
        function done() {
          if (finished || self._stop || self.i !== stepIndex) return;
          finished = true;
          self.spotlight(self.target(step) || el);
          self.armAdvance(step);
        }
        this.later(280, function () { step.run(done); });
      } else {
        this.armAdvance(step);
      }
    },
    end: function (silent) {
      this._stop = true;
      this.clearTimers();
      this.stored('done');
      document.body.classList.remove('tut-on');
      document.body.classList.remove('tut-launch-on');
      if (Notify.closeCrew) Notify.closeCrew();
      if (Notify.panel) Notify.panel.classList.remove('open');
      if (Compass && Compass.hide) Compass.hide();
      if (window.closeUxCard) window.closeUxCard();
      if (window.closePhotoCard) window.closePhotoCard();
      if (this.veil) this.veil.remove();
      if (this.card) this.card.remove();
      if (this.pointer) this.pointer.remove();
      if (this.progress) this.progress.remove();
      this.veil = this.card = this.pointer = this.progress = null;
      if (!silent) {
        Notify.toast({ tone: 'green', title: 'You are ready', sub: 'Earth, maps, crew and the ledger are live.', n: '🌊' });
        setTimeout(function () {
          if (GOO.openWalletCard) GOO.openWalletCard({ first: true });
        }, 280);
        if (GOO.News && GOO.News.schedulePrompt) GOO.News.schedulePrompt(8 * 1000);
      }
    }
  };

  function bindSounds() {
    var last = null;
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('button, .card, .icon-wrap, .tile, .terra-filter, a.share-link, .n-bell, .n-avatar-fab, .tut-replay');
      if (!t || t === last) return;
      last = t;
      Sound.hover();
    }, true);
    if (Device.pwaShell) return;
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('button, .card, .tile, .terra-filter, a.share-link')) Sound.click();
    }, true);
  }

  function injectReplay() {
    if (Device.embed || document.getElementById('tutReplay')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'tutReplay';
    b.className = 'tut-replay';
    b.setAttribute('aria-label', 'Replay tutorial');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span>TUTORIAL</span>';
    b.addEventListener('click', function () {
      Sound.click();
      Tutorial.replay();
    });
    var dock = document.getElementById('homeDock') || document.getElementById('installApp');
    var bar = document.querySelector('.ledger-bar');
    if (Device.pwaShell && bar) bar.appendChild(b);
    else if (dock && dock.id === 'homeDock') dock.appendChild(b);
    else if (dock && dock.parentNode) dock.parentNode.insertBefore(b, dock.nextSibling);
    else document.body.appendChild(b);
  }

  function injectFab() {
    if (Device.pwaShell || document.getElementById('compassFab')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'compassFab';
    b.className = 'compass-fab';
    b.setAttribute('aria-label', 'Open GPS compass');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><polygon points="12 6 14.2 12 12 18 9.8 12" fill="currentColor" stroke="none"/></svg>';
    b.addEventListener('click', function () { Compass.toggle(); });
    document.body.appendChild(b);
  }

  function waitFor(test, fn, tries) {
    if (test()) { fn(); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitFor(test, fn, tries - 1); }, 200);
  }

  function applyViewQuery() {
    if (Device.view === 'globe' && (Device.embed || Device.fromPwa)) {
      window.__spinBoost = 0.002;
      window.__globeAim = null;
    }
    if (Device.view === 'map' || Device.view === 'roadmap') {
      waitFor(function () { return typeof window.openTerraRoadmap === 'function'; }, function () {
        window.openTerraRoadmap();
      }, 20);
    }
    if (Device.view === 'world') {
      waitFor(function () { return typeof window.openTerraWorld === 'function'; }, function () {
        window.openTerraWorld();
      }, 20);
    }
    if (Device.view === 'wallet' || Device.view === 'milestone') {
      waitFor(function () { return typeof window.openUxCard === 'function'; }, function () {
        window.openUxCard(Device.view);
      }, 25);
    }
    if (Device.fromPwa && !Device.embed && !document.getElementById('pwaBack')) {
      var back = document.createElement('a');
      back.id = 'pwaBack';
      back.className = 'pwa-back';
      back.href = Device.iconBase + 'pwa/island-weather-pwa/index.html?web=1';
      back.textContent = '← Ledger';
      back.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.history.length > 1) {
          history.back();
          return;
        }
        location.replace(back.href);
      });
      document.body.appendChild(back);
    }
  }

  function boot() {
    Device.pwaShell = document.body.getAttribute('data-shell') === 'pwa';
    Notify.listen();
    setupInstall();
    setupShare();
    bindSounds();
    injectFab();
    injectReplay();
    if (Compass) Compass.mount();
    applyViewQuery();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker
        .register(Device.iconBase + 'sw.js', { updateViaCache: 'none' })
        .then(function (reg) {
          function ping() {
            try { reg.update(); } catch (e) {}
          }
          ping();
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') ping();
          });
        })
        .catch(function () {});
      if (hadController) {
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          location.reload();
        });
      }
    }
    setTimeout(function () { Tutorial.ask(); }, 700);
  }

  GOO.Tutorial = Tutorial;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
