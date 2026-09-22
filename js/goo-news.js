/* Live coastal, ocean, and research news for the bell + PWA shade */
(function (root) {
  'use strict';
  var READ_KEY = 'goo-news-read-v1';
  var PUSH_CACHE = 'goo-news-meta';
  var PUSH_PATH = 'pushed';
  var MAX_LIST = 16;
  var MAX_PUSH = 3;
  var SOURCE_HOST = {
    bbc: 'bbc.com', reuters: 'reuters.com', guardian: 'theguardian.com', nytimes: 'nytimes.com',
    washington: 'washingtonpost.com', apnews: 'apnews.com', associated: 'apnews.com', cnn: 'cnn.com',
    npr: 'npr.org', nature: 'nature.com', science: 'science.org', nasa: 'nasa.gov', noaa: 'noaa.gov',
    sciencedaily: 'sciencedaily.com', smithsonian: 'smithsonianmag.com', nationalgeographic: 'nationalgeographic.com',
    aljazeera: 'aljazeera.com', bloomberg: 'bloomberg.com', economist: 'economist.com', time: 'time.com',
    independent: 'independent.co.uk', telegraph: 'telegraph.co.uk', dw: 'dw.com', france24: 'france24.com'
  };
  var CITIES = ['jakarta', 'manila', 'miami', 'lagos', 'mumbai', 'mombasa', 'sydney', 'rotterdam', 'cape town', 'ho chi minh'];
  var OCEAN_W = ['ocean', 'marine', 'coral', 'reef', 'mangrove', 'whale', 'fisher', 'plastic', 'kelp', 'seagrass', 'coastal wetland', 'blue carbon'];
  var RESEARCH_W = ['study', 'research', 'scientist', 'journal', 'university', 'paper', 'findings', 'peer-reviewed', 'nature', 'science daily', 'nasa', 'noaa'];
  var FEEDS = [
    { cat: 'city', rss: 'https://news.google.com/rss/search?q=coastal+city+sea+level+OR+%22coastal+flooding%22&hl=en-US&gl=US&ceid=US:en' },
    { cat: 'ocean', rss: 'https://news.google.com/rss/search?q=ocean+conservation+OR+%22marine+restoration%22+OR+%22coral+reef%22&hl=en-US&gl=US&ceid=US:en' },
    { cat: 'research', rss: 'https://www.sciencedaily.com/rss/earth_climate/oceanography.xml' },
    { cat: 'research', rss: 'https://earthobservatory.nasa.gov/feeds/earth-observatory.rss' }
  ];
  var GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc?query=(ocean%20OR%20coastal%20OR%20%22sea%20level%22%20OR%20coral%20OR%20mangrove%20OR%20oceanography)%20sourcelang:english&mode=ArtList&maxrecords=25&timespan=3d&format=json&sort=DateDesc';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]);
    });
  }
  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function sourceHost(source, url) {
    var d = domainOf(url);
    if (d && d.indexOf('news.google') < 0 && d.indexOf('google.com') < 0) return d;
    var s = String(source || '').toLowerCase().replace(/[^a-z0-9.]+/g, '');
    for (var key in SOURCE_HOST) if (s.indexOf(key) >= 0) return SOURCE_HOST[key];
    if (d) return d;
    return 'news.google.com';
  }
  function favicon(domain) {
    if (!domain) return '';
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
  }
  function hasAny(text, words) {
    var t = text.toLowerCase();
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) >= 0) return true;
    return false;
  }
  function categorize(text, hint) {
    if (hint === 'research' || hasAny(text, RESEARCH_W)) return 'research';
    if (hint === 'ocean' || hasAny(text, OCEAN_W)) return 'ocean';
    if (hint === 'city' || hasAny(text, CITIES) || /coastal|sea level|flood/i.test(text)) return 'city';
    if (hint) return hint;
    return 'ocean';
  }
  function toneOf(cat) {
    if (cat === 'city') return 'blue';
    if (cat === 'research') return 'amber';
    return 'teal';
  }
  function labelOf(cat) {
    if (cat === 'city') return 'Coastal cities';
    if (cat === 'research') return 'Research';
    return 'Oceans';
  }
  function cleanTitle(title, source) {
    var t = String(title || '').replace(/\s+/g, ' ').trim();
    if (source && t.slice(-source.length - 3) === ' - ' + source) t = t.slice(0, -source.length - 3).trim();
    var parts = t.split(' - ');
    if (parts.length > 1 && parts[parts.length - 1].length < 28) {
      return { title: parts.slice(0, -1).join(' - '), source: parts[parts.length - 1] };
    }
    return { title: t, source: source || '' };
  }
  function ago(ms) {
    if (!ms) return 'now';
    var d = Math.max(0, Date.now() - ms);
    if (d < 60000) return 'now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h';
    return Math.floor(d / 86400000) + 'd';
  }
  function idOf(url, title) {
    return String(url || title || '').slice(0, 220);
  }

  function readStore() {
    if (typeof localStorage === 'undefined') {
      return {
        get: function () { return Promise.resolve([]); },
        set: function () { return Promise.resolve(); }
      };
    }
    return {
      get: function () {
        try { return Promise.resolve(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
        catch (e) { return Promise.resolve([]); }
      },
      set: function (arr) {
        try { localStorage.setItem(READ_KEY, JSON.stringify(arr.slice(0, 80))); } catch (e) {}
        return Promise.resolve();
      }
    };
  }
  function pushStore() {
    return {
      get: function () {
        return caches.open(PUSH_CACHE).then(function (c) {
          return c.match(PUSH_PATH).then(function (r) { return r ? r.json() : []; });
        }).catch(function () { return []; });
      },
      set: function (arr) {
        return caches.open(PUSH_CACHE).then(function (c) {
          return c.put(PUSH_PATH, new Response(JSON.stringify(arr.slice(0, 120)), { headers: { 'Content-Type': 'application/json' } }));
        }).catch(function () {});
      }
    };
  }

  function rss2json(rss) {
    return fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss)).then(function (r) {
      if (!r.ok) throw new Error('rss');
      return r.json();
    }).then(function (data) {
      if (!data || data.status !== 'ok' || !data.items) throw new Error('rss');
      var feedName = data.feed && data.feed.title ? data.feed.title : '';
      return data.items.map(function (it) {
        var link = it.link || it.guid || '';
        var parsed = cleanTitle(it.title, it.author || feedName);
        var domain = sourceHost(parsed.source || feedName, link);
        return {
          id: idOf(link, parsed.title),
          title: parsed.title,
          url: link,
          source: parsed.source || feedName || domain,
          domain: domain,
          at: it.pubDate ? Date.parse(it.pubDate) : Date.now(),
          hint: null
        };
      });
    });
  }

  function gdelt() {
    return fetch(GDELT).then(function (r) {
      if (!r.ok) throw new Error('gdelt');
      return r.json();
    }).then(function (data) {
      var arts = (data && data.articles) || [];
      return arts.map(function (a) {
        var link = a.url || '';
        var parsed = cleanTitle(a.title, a.domain);
        return {
          id: idOf(link, parsed.title),
          title: parsed.title,
          url: link,
          source: parsed.source || a.domain || domainOf(link),
          domain: sourceHost(parsed.source || a.domain, link),
          at: a.seendate ? Date.parse(a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')) : Date.now(),
          hint: null
        };
      });
    });
  }

  function loadFeeds() {
    var jobs = [gdelt()].concat(FEEDS.map(function (f) {
      return rss2json(f.rss).then(function (items) {
        return items.map(function (it) { it.hint = f.cat; return it; });
      });
    }));
    return Promise.all(jobs.map(function (p) { return p.then(function (v) { return v; }).catch(function () { return []; }); })).then(function (groups) {
      var seen = {};
      var out = [];
      groups.forEach(function (items) {
        items.forEach(function (it) {
          if (!it || !it.title || !it.url || seen[it.id]) return;
          seen[it.id] = true;
          it.cat = categorize(it.title + ' ' + (it.source || ''), it.hint);
          it.tone = toneOf(it.cat);
          it.icon = favicon(it.domain);
          out.push(it);
        });
      });
      out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      return out.slice(0, MAX_LIST);
    });
  }

  function render(items) {
    var Notify = root.GOO && root.GOO.Notify;
    if (!Notify) return;
    Notify.ensure();
    var header = Notify.panel.querySelector('header');
    if (header) header.textContent = 'Coastal news';
    var list = Notify.panel.querySelector('.n-list');
    if (!list) return;
    list.innerHTML = items.map(function (it) {
      return '<a class="n-row tone-' + it.tone + '" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<img class="n-src" alt="" src="' + esc(it.icon) + '" width="18" height="18">' +
        '<span><b>' + esc(it.title) + '</b><i>' + esc(it.source) + ' · ' + ago(it.at) + ' · ' + labelOf(it.cat) + '</i></span>' +
      '</a>';
    }).join('') || '<div class="n-row"><b>No live headlines</b><i>News feeds will retry shortly.</i></div>';
  }

  function canPush() {
    if (typeof Notification === 'undefined') return false;
    if (typeof document === 'undefined') {
      return typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    }
    var d = root.GOO && root.GOO.Device;
    if (d && d.embed) return false;
    if (document.body && document.body.getAttribute('data-shell') === 'pwa') return true;
    if (d && (d.pwaShell || d.standalone)) return true;
    return !!(d && d.mobile);
  }

  function iconBase() {
    var d = root.GOO && root.GOO.Device;
    return (d && d.iconBase) || './';
  }

  function showNative(items, seen) {
    var fresh = items.filter(function (it) { return seen.indexOf(it.id) < 0; }).slice(0, MAX_PUSH);
    if (!fresh.length) return Promise.resolve(0);
    var badge = iconBase() + 'pwa/island-weather-pwa/icons/icon-192.png';
    function viaReg(reg) {
      return Promise.all(fresh.map(function (it) {
        return reg.showNotification(it.title, {
          body: it.source + ' · ' + labelOf(it.cat),
          icon: it.icon || badge,
          badge: badge,
          tag: 'goo-news-' + it.id.slice(-40),
          data: { url: it.url },
          timestamp: it.at || Date.now(),
          vibrate: [120, 80, 120],
          renotify: true
        });
      })).then(function () { return fresh.length; });
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      return navigator.serviceWorker.ready.then(viaReg).catch(function () {
        if (Notification.permission !== 'granted') return 0;
        fresh.forEach(function (it) {
          try { new Notification(it.title, { body: it.source + ' · ' + labelOf(it.cat), icon: it.icon || badge }); } catch (e) {}
        });
        return fresh.length;
      });
    }
    if (typeof self !== 'undefined' && self.registration && self.registration.showNotification) {
      return viaReg(self.registration);
    }
    return Promise.resolve(0);
  }

  function apply(items, opts) {
    opts = opts || {};
    var reads = readStore();
    var pushed = pushStore();
    return Promise.all([reads.get(), pushed.get()]).then(function (pair) {
      var read = pair[0] || [];
      var done = pair[1] || [];
      if (typeof document !== 'undefined') render(items);
      var Notify = root.GOO && root.GOO.Notify;
      if (Notify) {
        Notify.newsCount = items.filter(function (it) { return read.indexOf(it.id) < 0; }).length;
        Notify.syncBadge();
        if (opts.toast && items[0] && typeof document !== 'undefined') {
          Notify.toast({
            tone: items[0].tone,
            title: items[0].title,
            sub: items[0].source + ' · ' + labelOf(items[0].cat),
            n: 'NEWS',
            icon: items[0].icon
          });
        }
      }
      if (opts.push && canPush() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        return showNative(items, done).then(function (n) {
          if (!n) return 0;
          var next = done.slice();
          items.forEach(function (it) { if (next.indexOf(it.id) < 0) next.push(it.id); });
          return pushed.set(next);
        });
      }
      return 0;
    });
  }

  var News = {
    items: [],
    poll: function (opts) {
      return loadFeeds().then(function (items) {
        News.items = items;
        return apply(items, opts || {});
      }).catch(function () { return apply([], opts || {}); });
    },
    markRead: function () {
      return readStore().set((News.items || []).map(function (it) { return it.id; })).then(function () {
        var Notify = root.GOO && root.GOO.Notify;
        if (Notify) { Notify.newsCount = 0; Notify.syncBadge(); }
      });
    },
    start: function () {
      var Notify = root.GOO && root.GOO.Notify;
      if (Notify) {
        Notify.ensure();
        var header = Notify.panel.querySelector('header');
        if (header) header.textContent = 'Coastal news';
      }
      News.poll({ toast: true, push: canPush() && typeof Notification !== 'undefined' && Notification.permission === 'granted' });
      setInterval(function () { News.poll({ push: canPush() }); }, 12 * 60 * 1000);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', function (ev) {
          if (ev.data && ev.data.type === 'news-refresh') News.poll({ push: false });
        });
      }
      if (canPush()) {
        var tutSeen = false;
        try { tutSeen = !!localStorage.getItem('goo-tutorial-v3'); } catch (e) {}
        if (tutSeen) News.schedulePrompt(55 * 1000);
        navigator.serviceWorker && navigator.serviceWorker.ready.then(function (reg) {
          if (reg.periodicSync && reg.periodicSync.register) {
            reg.periodicSync.register('goo-news', { minInterval: 60 * 60 * 1000 }).catch(function () {});
          }
        }).catch(function () {});
      }
    },
    prompt: function (opts) {
      opts = opts || {};
      if (typeof document === 'undefined' || typeof Notification === 'undefined') return;
      if (!canPush()) return;
      if (Notification.permission === 'granted') {
        hidePrompt();
        return;
      }
      if (Notification.permission === 'denied') return;
      if (!opts.force && tourBusy()) return;
      if (document.getElementById('nPrompt')) return;
      try {
        var until = +localStorage.getItem('goo-news-prompt-later');
        if (until && until > Date.now()) return;
      } catch (e) {}
      var wrap = document.createElement('div');
      wrap.id = 'nPrompt';
      wrap.className = 'n-prompt';
      wrap.innerHTML =
        '<article class="n-prompt-card">' +
          '<div class="tpop-h">' +
            '<span class="tpop-rank">!</span>' +
            '<div><b>ALLOW NEWS ALERTS</b><i>Coastal cities · oceans · research</i></div>' +
          '</div>' +
          '<p>Turn on notifications so live headlines appear in your phone shade — not only inside the app.</p>' +
          '<div class="tpop-cta">' +
            '<button type="button" class="pow" id="nPromptYes">ALLOW</button>' +
            '<button type="button" class="hash" id="nPromptLater">NOT NOW</button>' +
          '</div>' +
        '</article>';
      document.body.appendChild(wrap);
      wrap.querySelector('#nPromptYes').addEventListener('click', function () {
        Notification.requestPermission().then(function (p) {
          hidePrompt();
          if (p === 'granted') {
            try { localStorage.removeItem('goo-news-prompt-later'); } catch (err) {}
            News.poll({ push: true, toast: true });
          }
        });
      });
      wrap.querySelector('#nPromptLater').addEventListener('click', function () {
        try { localStorage.setItem('goo-news-prompt-later', String(Date.now() + 3 * 24 * 60 * 60 * 1000)); } catch (err) {}
        hidePrompt();
      });
    },
    schedulePrompt: function (delay) {
      clearTimeout(News._promptTimer);
      News._promptTimer = setTimeout(function tick() {
        if (tourBusy()) {
          News._promptTimer = setTimeout(tick, 8000);
          return;
        }
        News.prompt();
      }, delay == null ? 55 * 1000 : delay);
    },
    hidePrompt: hidePrompt
  };

  function tourBusy() {
    if (typeof document === 'undefined') return false;
    return !!(document.querySelector('.tut-ask') || document.body.classList.contains('tut-on'));
  }

  function hidePrompt() {
    var el = document.getElementById('nPrompt');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  if (typeof self !== 'undefined') self.GOONews = News;
  root.GOO = root.GOO || {};
  root.GOO.News = News;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { News.start(); });
    else News.start();
  }
})(typeof window !== 'undefined' ? window : self);
