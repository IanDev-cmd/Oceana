/* Guardians of the Ocean — install-time SW.
   No Push / Notification / periodicSync APIs: OEM WebAPK scanners treat those
   as sensitive permissions and block a green-light install. */
const CACHE_NAME = 'guardians-ocean-v39';
const CONCURRENCY = 8;

const CORE = [
  './index.html',
  './install.html',
  './i.html',
  './i/index.html',
  './go.html',
  './go/index.html',
  './manifest.webmanifest',
  './css/goo.css',
  './js/goo-core.js',
  './js/goo-news.js',
  './js/goo-compass.js',
  './js/goo-shell.js',
  './js/qr.js',
  './js/pwa-app.js',
  './js/api/config.js',
  './js/api/client.js',
  './js/api/wallet-ui.js',
  './pwa/island-weather-pwa/index.html',
  './pwa/island-weather-pwa/background.jpg',
  './pwa/island-weather-pwa/icons/icon-192.png',
  './pwa/island-weather-pwa/icons/icon-512.png'
];

const REQUIRED = {
  './install.html': 1,
  './manifest.webmanifest': 1,
  './css/goo.css': 1,
  './js/goo-core.js': 1,
  './js/goo-shell.js': 1,
  './js/pwa-app.js': 1,
  './pwa/island-weather-pwa/index.html': 1,
  './pwa/island-weather-pwa/icons/icon-192.png': 1,
  './pwa/island-weather-pwa/icons/icon-512.png': 1
};

const EXTRA = [
  './desktop.html',
  './js/boot.js',
  './js/goo-globe.js',
  './js/goo-cards.js',
  './js/goo-map.js',
  './js/goo-config.js',
  './js/goo-stripe.js',
  './assets/maps/cities.json',
  './assets/3d/earth-preview.webp',
  './assets/images/cards/jungle.webp',
  './assets/images/cards/thirsty.webp',
  './assets/images/cities/jakarta.webp',
  './assets/images/cities/manila.webp',
  './assets/images/cities/hcmc.webp',
  './assets/images/cities/lagos.webp',
  './assets/images/cities/miami.webp',
  './assets/images/cities/mumbai.webp',
  './assets/images/cities/mombasa.webp',
  './assets/images/cities/sydney.webp',
  './assets/images/cities/capetown.webp',
  './assets/images/cities/rotterdam.webp'
];

const LIVE_HOST = /(?:^|\.)(open-meteo\.com|nominatim\.openstreetmap\.org|gdeltproject\.org|rss2json\.com|news\.google\.com|sciencedaily\.com|earthobservatory\.nasa\.gov|google\.com|arcgisonline\.com|tile\.openstreetmap\.org|cloudflare\.com|jsdelivr\.net|googleapis\.com|gstatic\.com|stripe\.com)$/i;

let installState = {
  phase: 'idle',
  filesDone: 0,
  filesTotal: CORE.length,
  loadedBytes: 0,
  totalBytes: 0,
  downloadPct: 0,
  pct: 0,
  label: 'Preparing app files…',
  error: '',
  complete: false
};

let lastBroadcast = 0;

function originOf() {
  return new URL('./', self.registration.scope).origin;
}

function absUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function sameOriginUrl(url) {
  try {
    const u = typeof url === 'string' ? new URL(url, self.registration.scope) : new URL(url);
    return u.origin === originOf() && (u.protocol === 'https:' || u.protocol === 'http:');
  } catch (e) {
    return false;
  }
}

function canCacheResponse(request, response) {
  if (!response || response.status !== 200) return false;
  if (response.type !== 'basic' && response.type !== 'default' && response.type !== 'cors') return false;
  if (!sameOriginUrl(request.url)) return false;
  if (request.method !== 'GET') return false;
  const cc = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cc)) return false;
  try {
    if (new URL(response.url).origin !== originOf()) return false;
  } catch (e) {
    return false;
  }
  return true;
}

function broadcast(extra) {
  const now = Date.now();
  if (extra !== true && now - lastBroadcast < 40) return;
  lastBroadcast = now;
  const msg = { type: 'goo-install-progress' };
  Object.keys(installState).forEach(function (k) { msg[k] = installState[k]; });
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
    clients.forEach(function (c) { c.postMessage(msg); });
  }).catch(function () {});
}

function setProgress(patch) {
  Object.keys(patch).forEach(function (k) { installState[k] = patch[k]; });
  const files = installState.filesTotal || 1;
  const byFiles = (installState.filesDone / files) * 100;
  let byBytes = byFiles;
  if (installState.totalBytes > 0) {
    byBytes = (installState.loadedBytes / installState.totalBytes) * 100;
  }
  installState.downloadPct = Math.max(installState.downloadPct || 0, Math.min(100, Math.round(Math.max(byFiles, byBytes))));
  installState.pct = installState.complete ? 100 : Math.min(90, installState.downloadPct);
  broadcast();
}

function fetchOne(cache, path, onBytes) {
  const url = absUrl(path);
  if (!sameOriginUrl(url)) return Promise.reject(new Error('cross-origin'));
  const req = new Request(url, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-cache',
    redirect: 'follow'
  });
  return fetch(req).then(function (res) {
    if (!canCacheResponse(req, res)) {
      const err = new Error('bad-response');
      err.status = res && res.status;
      throw err;
    }
    const declared = Number(res.headers.get('content-length')) || 0;
    if (declared > 0) onBytes(0, declared, false);
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      function pump() {
        return reader.read().then(function (part) {
          if (part.done) {
            const headers = new Headers(res.headers);
            if (!headers.get('content-type')) headers.set('Content-Type', 'application/octet-stream');
            const out = new Response(new Blob(chunks), {
              status: 200,
              statusText: 'OK',
              headers: headers
            });
            return cache.put(req, out).then(function () { return received; });
          }
          chunks.push(part.value);
          received += part.value.byteLength;
          onBytes(part.value.byteLength, declared, false);
          return pump();
        });
      }
      return pump();
    }
    return res.clone().arrayBuffer().then(function (buf) {
      onBytes(buf.byteLength, declared || buf.byteLength, true);
      return cache.put(req, res).then(function () { return buf.byteLength; });
    });
  });
}

function withRetry(cache, path, onBytes) {
  return fetchOne(cache, path, onBytes).catch(function () {
    return new Promise(function (resolve) { setTimeout(resolve, 120); }).then(function () {
      return fetchOne(cache, path, onBytes);
    });
  });
}

function precacheList(cache, list, requiredMap, silent) {
  let index = 0;
  const failed = [];
  const known = list.map(function () { return 0; });
  let loaded = 0;
  let declaredTotal = 0;
  let doneCount = 0;

  if (!silent) {
    setProgress({
      phase: 'download',
      filesDone: 0,
      filesTotal: list.length,
      loadedBytes: 0,
      totalBytes: 0,
      label: 'Downloading the app…'
    });
  }

  function worker() {
    function next() {
      if (index >= list.length) return Promise.resolve();
      const i = index++;
      const path = list[i];
      return withRetry(cache, path, function (delta, declared) {
        if (silent) return;
        if (declared && !known[i]) {
          known[i] = declared;
          declaredTotal += declared;
        }
        loaded += delta;
        setProgress({
          loadedBytes: loaded,
          totalBytes: Math.max(declaredTotal, loaded),
          label: 'Downloading ' + path.replace(/^\.\//, '')
        });
      }).then(function (bytes) {
        doneCount += 1;
        if (silent) return;
        if (known[i] && bytes && bytes !== known[i]) {
          declaredTotal += (bytes - known[i]);
        } else if (!known[i] && bytes) {
          declaredTotal += bytes;
        }
        setProgress({
          filesDone: doneCount,
          loadedBytes: loaded,
          totalBytes: Math.max(declaredTotal, loaded)
        });
      }).catch(function () {
        doneCount += 1;
        if (requiredMap && requiredMap[path]) failed.push(path);
        if (!silent) setProgress({ filesDone: doneCount });
      }).then(next);
    }
    return next();
  }

  const n = Math.min(CONCURRENCY, list.length);
  const jobs = [];
  for (let k = 0; k < n; k++) jobs.push(worker());
  return Promise.all(jobs).then(function () {
    if (failed.length) {
      const err = new Error('Required files missing: ' + failed.join(', '));
      if (!silent) setProgress({ phase: 'error', error: err.message, label: 'Install download failed' });
      throw err;
    }
    if (!silent) {
      setProgress({
        downloadPct: 100,
        filesDone: list.length,
        label: 'App files saved on this device'
      });
    }
  });
}

function cacheExtra() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return precacheList(cache, EXTRA, null, true).catch(function () {});
  });
}

self.addEventListener('install', function (event) {
  installState.phase = 'download';
  installState.complete = false;
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return precacheList(cache, CORE, REQUIRED);
    }).then(function () {
      setProgress({ phase: 'activate', label: 'Finishing install…', downloadPct: 100 });
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      installState.complete = true;
      setProgress({ phase: 'done', pct: 100, downloadPct: 100, complete: true, label: 'App ready', error: '' });
      broadcast(true);
      return cacheExtra();
    })
  );
});

function markCompleteIfCached() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(absUrl('./manifest.webmanifest'));
  }).then(function (hit) {
    if (hit && (installState.phase === 'idle' || installState.phase === 'done')) {
      installState.complete = true;
      installState.phase = 'done';
      installState.downloadPct = 100;
      installState.pct = 100;
      installState.filesDone = CORE.length;
      installState.filesTotal = CORE.length;
      installState.label = 'App files saved on this device';
      installState.error = '';
    }
  }).catch(function () {});
}

self.addEventListener('message', function (event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  const type = data.type;
  if (type === 'goo-skip-wait') {
    self.skipWaiting();
    return;
  }
  if (type === 'goo-install-status') {
    event.waitUntil(markCompleteIfCached().then(function () { broadcast(true); }));
    return;
  }
  if (type === 'goo-cache-extra') {
    event.waitUntil(cacheExtra());
  }
});

markCompleteIfCached();

function matchCached(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      const u = new URL(request.url);
      if (u.search) return cache.match(u.origin + u.pathname);
      return undefined;
    });
  });
}

function networkFirst(request) {
  return fetch(request).then(function (res) {
    if (canCacheResponse(request, res)) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return matchCached(request).then(function (hit) {
      return hit || Response.error();
    });
  });
}

function cacheFirst(request) {
  return matchCached(request).then(function (cached) {
    const fetched = fetch(request).then(function (res) {
      if (canCacheResponse(request, res)) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () { return cached; });
    return cached || fetched;
  });
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.endsWith('/sw.js')) return;

  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/i' || path === '/go' || path === '/i.html' || path === '/go.html') {
    event.respondWith(
      fetch(absUrl('./install.html'), { cache: 'no-store', credentials: 'same-origin' })
        .then(function (res) { return (res && res.ok) ? res : matchCached(new Request(absUrl('./install.html'))); })
        .catch(function () { return matchCached(new Request(absUrl('./install.html'))); })
    );
    return;
  }

  if (url.origin !== originOf()) {
    if (LIVE_HOST.test(url.hostname)) {
      event.respondWith(fetch(event.request));
    }
    return;
  }

  const navigate = event.request.mode === 'navigate';
  const staticFile = /\.(js|css|webmanifest|json|png|webp|jpg|jpeg|svg|ico|woff2?)$/i.test(path);
  if (navigate) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (staticFile) {
    event.respondWith(cacheFirst(event.request));
  }
});
