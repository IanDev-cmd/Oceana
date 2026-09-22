/* Device, sound, and notifications — shared by web app and PWA */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]);
    });
  }

  var script = document.currentScript && document.currentScript.src;
  var ICON_BASE = script ? script.replace(/js\/goo-core\.js(\?.*)?$/, '') : '';

  var Device = {
    mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 760,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
    standalone: matchMedia('(display-mode: standalone)').matches || !!navigator.standalone,
    embed: /(?:^|[?&])embed=1/.test(location.search),
    fromPwa: /(?:^|[?&])from=pwa/.test(location.search),
    view: (location.search.match(/[?&]view=([a-z]+)/) || [])[1] || '',
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: !!(navigator.connection && navigator.connection.saveData),
    pwaShell: false,
    iconBase: ICON_BASE
  };

  document.documentElement.classList.toggle('mobile', Device.mobile);
  document.documentElement.classList.toggle('standalone', Device.standalone);
  document.documentElement.classList.toggle('embed', Device.embed);
  document.documentElement.classList.toggle('from-pwa', Device.fromPwa);

  var Sound = {
    ctx: null,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone: function (freq, duration, type, peak, glideTo) {
      var ctx = this.ensure();
      if (!ctx || !freq || !peak) return;
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(duration, 0.02));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    },
    hover: function () { this.tone(1500, 0.05, 'sine', 0.035, 1900); },
    click: function () {
      this.tone(680, 0.09, 'triangle', 0.11, 420);
      this.tone(1360, 0.07, 'sine', 0.05, 1360);
    },
    success: function () {
      this.tone(660, 0.12, 'sine', 0.09, 880);
      this.tone(990, 0.18, 'triangle', 0.06, 1320);
    },
    warn: function () { this.tone(420, 0.16, 'square', 0.045, 280); },
    info: function () { this.tone(880, 0.1, 'sine', 0.05, 1100); },
    unlock: function () { this.ensure(); }
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { Sound.unlock(); }, { once: true, passive: true });
  });

  var CREW = [
    { name: 'Amina Okonkwo', role: 'Lagos · waste traps', initials: 'AO', hue: '#0ba6ff', rating: 4.8, progress: 82, photo: 'https://randomuser.me/api/portraits/women/17.jpg' },
    { name: 'Linh Tran', role: 'Mekong · mangroves', initials: 'LT', hue: '#16a34a', rating: 4.9, progress: 91, photo: 'https://randomuser.me/api/portraits/women/65.jpg' },
    { name: 'Rafael Santos', role: 'Manila · reef line', initials: 'RS', hue: '#dc7519', rating: 4.5, progress: 64, photo: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { name: 'Maya Chen', role: 'Miami · living shore', initials: 'MC', hue: '#7c5cff', rating: 4.2, progress: 48, photo: 'https://randomuser.me/api/portraits/women/47.jpg' },
    { name: 'Juma Mwangi', role: 'Mombasa · estuary', initials: 'JM', hue: '#0f8a78', rating: 4.7, progress: 73, photo: 'https://randomuser.me/api/portraits/men/75.jpg' }
  ];

  function starHtml(n) {
    var html = '';
    var i;
    for (i = 1; i <= 5; i++) {
      var cls = n >= i ? 'on' : (n >= i - 0.5 ? 'half' : '');
      html += '<span class="' + cls + '" aria-hidden="true">★</span>';
    }
    return '<div class="n-crew-stars" aria-label="' + n.toFixed(1) + ' stars">' + html + '<em>' + n.toFixed(1) + '</em></div>';
  }

  function avaHtml(p, extra) {
    var photo = p.photo
      ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" width="80" height="80" decoding="async">'
      : '';
    return '<span class="n-ava' + (p.photo ? ' has-photo' : '') + (extra ? ' ' + extra : '') + '" style="--ava:' + p.hue + '">' +
      '<i class="n-ava-ring" aria-hidden="true"></i>' +
      photo +
      '<b>' + esc(p.initials) + '</b>' +
    '</span>';
  }

  var Notify = {
    newsCount: 0,
    items: [],
    stack: null,
    bell: null,
    badge: null,
    panel: null,
    crewBtn: null,
    crew: null,
    askedNative: false,
    ensure: function () {
      if (this.stack) return;
      this.stack = document.createElement('div');
      this.stack.className = 'n-stack';
      document.body.appendChild(this.stack);

      this.bell = document.createElement('button');
      this.bell.type = 'button';
      this.bell.className = 'n-bell';
      this.bell.setAttribute('aria-label', 'Coastal news');
      this.bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></svg><i class="n-badge" hidden>0</i>';
      document.body.appendChild(this.bell);
      this.badge = this.bell.querySelector('.n-badge');

      this.panel = document.createElement('div');
      this.panel.className = 'n-panel';
      this.panel.innerHTML = '<header>Coastal news</header><div class="n-list"></div>';
      document.body.appendChild(this.panel);

      this.mountCrew();

      var self = this;
      this.bell.addEventListener('click', function (e) {
        e.stopPropagation();
        Sound.click();
        self.closeCrew();
        self.panel.classList.toggle('open');
        self.newsCount = 0;
        self.syncBadge();
        if (root.GOO.News && root.GOO.News.markRead) root.GOO.News.markRead();
        self.requestNative();
      });
      this.panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () {
        self.panel.classList.remove('open');
        self.closeCrew();
      });
    },
    mountCrew: function () {
      if (this.crewBtn) return;
      var lead = CREW[0];
      this.crewBtn = document.createElement('button');
      this.crewBtn.type = 'button';
      this.crewBtn.className = 'n-avatar-fab';
      this.crewBtn.setAttribute('aria-label', 'Field crew reviews');
      this.crewBtn.innerHTML = avaHtml(lead, 'lead');
      document.body.appendChild(this.crewBtn);

      this.crew = document.createElement('div');
      this.crew.className = 'n-crew';
      this.crew.innerHTML =
        '<div class="n-crew-card" role="dialog" aria-label="Field crew">' +
          '<button type="button" class="n-crew-x" aria-label="Close crew">×</button>' +
          '<div class="tpop-h">' +
            '<span class="tpop-rank">C</span>' +
            '<div><b>FIELD CREW</b><i>Reviews · milestone progress</i></div>' +
            '<span class="tpop-ph">' + CREW.length + '</span>' +
          '</div>' +
          '<div class="n-crew-list">' +
            CREW.map(function (p, i) {
              return '<article class="n-crew-row" style="--d:' + (i * 80) + 'ms;--p:' + p.progress + '%">' +
                avaHtml(p) +
                '<div class="n-crew-meta">' +
                  '<b>' + esc(p.name) + '</b>' +
                  '<i>' + esc(p.role) + '</i>' +
                  starHtml(p.rating) +
                  '<div class="n-crew-track" aria-label="' + p.progress + '% complete">' +
                    '<span class="n-crew-bar"><i></i></span>' +
                    '<em>' + p.progress + '%</em>' +
                  '</div>' +
                '</div>' +
              '</article>';
            }).join('') +
          '</div>' +
        '</div>';
      document.body.appendChild(this.crew);

      function bindPhotoFallback(rootEl) {
        if (!rootEl) return;
        rootEl.querySelectorAll('.n-ava.has-photo img').forEach(function (img) {
          img.addEventListener('error', function () {
            var wrap = img.parentNode;
            if (wrap) wrap.classList.remove('has-photo');
            if (img.parentNode) img.remove();
          });
        });
      }
      bindPhotoFallback(this.crewBtn);
      bindPhotoFallback(this.crew);

      var self = this;
      this.crewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        Sound.click();
        self.panel.classList.remove('open');
        self.crew.classList.toggle('open');
      });
      this.crew.addEventListener('click', function (e) {
        if (e.target === self.crew || (e.target.closest && e.target.closest('.n-crew-x'))) {
          self.closeCrew();
          return;
        }
        e.stopPropagation();
      });
    },
    closeCrew: function () {
      if (this.crew) this.crew.classList.remove('open');
    },
    syncBadge: function () {
      if (!this.badge) return;
      if (this.newsCount > 0) {
        this.badge.hidden = false;
        this.badge.textContent = this.newsCount > 9 ? '9+' : String(this.newsCount);
      } else this.badge.hidden = true;
    },
    requestNative: function () {
      if (root.GOO.News && root.GOO.News.prompt) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          root.GOO.News.poll({ push: true });
          return;
        }
        root.GOO.News.prompt({ force: true });
        return;
      }
      if (this.askedNative || !('Notification' in window) || Notification.permission !== 'default') return;
      this.askedNative = true;
      Notification.requestPermission().then(function (p) {
        if (p === 'granted' && root.GOO.News) root.GOO.News.poll({ push: true });
      });
    },
    listen: function () {
      this.ensure();
      addEventListener('online', function () {
        Notify.toast({ tone: 'green', title: 'Network restored', sub: 'Tiles and hashes will sync.', n: 'OK' });
      });
      addEventListener('offline', function () {
        Notify.toast({ tone: 'amber', title: 'Offline', sub: 'Cached maps stay available.', n: '!' });
      });
    },
    toast: function () {
      return;
    }
  };

  var WELCOME_KEY = 'goo-welcome-token-v2';
  var WELCOME_PATH = 'M28 0H232C256 0 252 28 276 28H446A28 28 0 0 1 474 56V248A28 28 0 0 1 446 276H276C252 276 252 248 228 248H28A28 28 0 0 1 0 220V28A28 28 0 0 1 28 0Z';
  var walletTimers = [];
  var walletResize = null;

  function clearWalletTimers() {
    walletTimers.forEach(function (t) { clearTimeout(t); });
    walletTimers = [];
    if (walletResize) {
      removeEventListener('resize', walletResize);
      if (window.visualViewport) visualViewport.removeEventListener('resize', walletResize);
      walletResize = null;
    }
  }

  function walletFlyTarget() {
    var ids = ['terraWallet', 'gWallet'];
    var i, el, r;
    for (i = 0; i < ids.length; i++) {
      el = document.getElementById(ids[i]);
      if (!el) continue;
      r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) return el;
    }
    return document.querySelector('.tile[aria-label="Wallet"]');
  }

  function fitWalletCard(card) {
    var vv = window.visualViewport;
    var vw = vv ? vv.width : innerWidth;
    var vh = vv ? vv.height : innerHeight;
    var padX = vw < 400 ? 16 : 24;
    var padY = vh < 500 ? 16 : 24;
    var s = Math.min(1, (vw - padX) / 474, (vh - padY) / 276);
    if (s < 0.42) s = 0.42;
    card.style.setProperty('--wc-s', String(s));
  }

  function openWalletCard(opts) {
    opts = opts || {};
    var first = !!opts.first;
    var existing = document.getElementById('welcomeToken');
    if (existing) existing.remove();
    clearWalletTimers();

    var wrap = document.createElement('div');
    wrap.id = 'welcomeToken';
    wrap.className = 'welcome-ask';
    var nums = [];
    var i;
    for (i = 0; i <= 100; i += 5) nums.push((i / 10).toFixed(1));
    wrap.innerHTML =
      '<article class="welcome-card" role="dialog" aria-label="Welcome token">' +
        '<div class="welcome-inner">' +
          '<svg class="welcome-geo" viewBox="0 0 474 276" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
            '<path class="welcome-body" d="' + WELCOME_PATH + '"/>' +
            '<g class="welcome-topo">' +
              '<path d="M292 62H428Q446 62 446 80V166"/>' +
              '<path d="M304 74H416Q432 74 432 90V154"/>' +
              '<path d="M316 86H404Q418 86 418 100V142"/>' +
              '<path d="M328 98H392Q404 98 404 110V130"/>' +
            '</g>' +
          '</svg>' +
          '<button type="button" class="welcome-x" id="welcomeClose" aria-label="Close">' +
            '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
          '<div class="welcome-ui">' +
            '<div class="welcome-kicker">Welcome Token</div>' +
            '<div class="welcome-amt"><span class="welcome-cur">$</span><span class="welcome-reel"><span class="welcome-track" id="welcomeTrack">' +
              nums.map(function (n) { return '<b>' + n + '</b>'; }).join('') +
            '</span></span></div>' +
            '<p class="welcome-copy">You have received <b>10.0 $</b> as a welcome token<br>Funding for Ocean Cleaning Activities</p>' +
            '<div class="welcome-meta"><div><i>Funding</i><b>Ocean cleaning</b></div><div><i>Status</i><b class="ok" id="welcomeStatus">Posting</b></div></div>' +
          '</div>' +
          '<button type="button" class="welcome-add" id="welcomeWallet">Wallet</button>' +
        '</div>' +
      '</article>';
    document.body.appendChild(wrap);
    var card = wrap.querySelector('.welcome-card');
    var track = wrap.querySelector('#welcomeTrack');
    var statusEl = wrap.querySelector('#welcomeStatus');
    var closed = false;
    fitWalletCard(card);
    walletResize = function () { if (!closed) fitWalletCard(card); };
    addEventListener('resize', walletResize);
    if (window.visualViewport) visualViewport.addEventListener('resize', walletResize);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!track) return;
        var last = track.querySelector('b:last-child');
        var y = last ? last.offsetTop : 0;
        track.style.transform = 'translateY(-' + y + 'px)';
      });
    });
    walletTimers.push(setTimeout(function () {
      if (closed) return;
      if (statusEl) statusEl.textContent = 'Success';
      Sound.success();
    }, 2400));

    function persistFirst() {
      if (!first) return;
      try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) {}
    }
    function dropHist() {
      if (wrap.dataset.hist === '1') {
        wrap.dataset.hist = '0';
        try { history.back(); } catch (e) {}
      }
    }
    function flyAway() {
      if (closed) return;
      closed = true;
      persistFirst();
      dropHist();
      var target = walletFlyTarget();
      var reduce = Device.reduced;
      if (!card || !target || reduce) {
        wrap.remove();
        clearWalletTimers();
        return;
      }
      var cr = card.getBoundingClientRect();
      var tr = target.getBoundingClientRect();
      var dx = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
      var dy = (tr.top + tr.height / 2) - (cr.top + cr.height / 2);
      var s = Math.max(0.08, Math.min(tr.width / cr.width, tr.height / cr.height));
      wrap.style.pointerEvents = 'none';
      card.classList.add('fly');
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
      card.style.opacity = '0';
      target.classList.add('welcome-catch');
      setTimeout(function () { target.classList.remove('welcome-catch'); }, 800);
      setTimeout(function () {
        wrap.remove();
        clearWalletTimers();
      }, 980);
    }
    function dismissNow(fromPop) {
      if (closed) return;
      closed = true;
      persistFirst();
      wrap.remove();
      clearWalletTimers();
      if (!fromPop) dropHist();
    }
    if (first) walletTimers.push(setTimeout(flyAway, 5000));
    wrap.querySelector('#welcomeClose').addEventListener('click', function () { dismissNow(false); });
    wrap.querySelector('#welcomeWallet').addEventListener('click', function () {
      dismissNow(true);
      try {
        if (history.state && history.state.goo === 'wallet') {
          history.replaceState({ pwa: 'home' }, '');
        }
      } catch (e) {}
      if (window.openUxCard) window.openUxCard('wallet');
      else if (window.GOO && typeof GOO.openPwaView === 'function') GOO.openPwaView('wallet');
    });
    wrap._gooClose = dismissNow;
    if (!opts.fromPop) {
      try {
        history.pushState({ goo: 'wallet' }, '');
        wrap.dataset.hist = '1';
      } catch (e) {}
    }
  }

  function dismissWalletCard(fromPop) {
    var wrap = document.getElementById('welcomeToken');
    if (wrap && typeof wrap._gooClose === 'function') wrap._gooClose(!!fromPop);
  }

  addEventListener('popstate', function () {
    var wrap = document.getElementById('welcomeToken');
    if (wrap && typeof wrap._gooClose === 'function') wrap._gooClose(true);
  });

  function bindDollarButtons() {
    function hook(el) {
      if (!el || el.dataset.gooWallet) return;
      el.dataset.gooWallet = '1';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        Sound.click();
        openWalletCard();
      });
    }
    hook(document.getElementById('gWallet'));
    hook(document.getElementById('terraWallet'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindDollarButtons);
  else bindDollarButtons();

  root.GOO = root.GOO || {};
  root.GOO.Device = Device;
  root.GOO.Sound = Sound;
  root.GOO.Notify = Notify;
  root.GOO.esc = esc;
  root.GOO.openWalletCard = openWalletCard;
  root.GOO.closeWalletCard = dismissWalletCard;
  root.GOO.maybeWelcomeToken = function () {
    if (document.body.classList.contains('tut-on')) return;
    try { if (localStorage.getItem(WELCOME_KEY) === '1') return; } catch (e) {}
    openWalletCard({ first: true });
  };
})(window);
