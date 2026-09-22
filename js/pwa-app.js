/* PWA dashboard: clock, tiles, loading into web-app views */
(function () {
  'use strict';
  var Sound = window.GOO && GOO.Sound;
  var Notify = window.GOO && GOO.Notify;
  var Compass = window.GOO && GOO.Compass;
  if (!Sound) return;

  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function updateClock(){
    var timeEl = document.getElementById('timeText');
    var dateEl = document.getElementById('dateText');
    if (!timeEl || !dateEl) return;
    var now = new Date();
    var h = now.getHours();
    var ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12; if (h === 0) h = 12;
    timeEl.innerHTML = pad(h) + ':' + pad(now.getMinutes()) + '<sup id="ampm">' + ampm + '</sup>';
    dateEl.innerHTML = days[now.getDay()] + ', ' + pad(now.getDate()) + '<br>' + months[now.getMonth()] + ' ' + now.getFullYear();
  }
  updateClock();
  setInterval(updateClock, 15000);
  if (typeof window.fitGooPwa === 'function') window.fitGooPwa();

  var ICONS = [
    { id:'globe', label:'3D Earth', svg:'<circle cx="12" cy="12" r="9" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke-width="1.4"/><path d="M3 12h18" stroke-width="1.4"/>', open:'globe' },
    { id:'audit', label:'Verified Audit Trail', svg:'<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
      card:{ rank:'01', title:'VERIFIED AUDIT', sub:'Hedera consensus', badge:'LIVE', kpis:[{n:'100%',l:'IMMUTABLE'},{n:'48.2k',l:'CHECKS'},{n:'3.2s',l:'FINALITY'}], fund:'On-chain state proofs across 8 countries', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'HASHSCAN', cls:'hash', view:'map'}] } },
    { id:'vault', label:'Secure Asset Vault', svg:'<rect x="5" y="11" width="14" height="9" rx="2" stroke-width="1.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-width="1.4"/><circle cx="12" cy="15.5" r="1.2" stroke-width="1.4"/>',
      card:{ rank:'02', title:'SECURE VAULT', sub:'Multi-sig reserve', badge:'DEMO', kpis:[{n:'—',l:'TVL'},{n:'3',l:'VAULTS'},{n:'2/3',l:'SIGNERS'}], fund:'Demo tile — not live Stripe balances', ctas:[{id:'openWallet', label:'WALLET', view:'wallet'},{id:'hash', label:'ACCESS LOG', cls:'hash', view:'wallet'}] } },
    { id:'roadmap', label:'2D Coastal Maps', svg:'<path d="M4 18c3-6 6-2 9-8 2-4 4-4 7-4" stroke-width="1.4" stroke-linecap="round"/><circle cx="4" cy="18" r="1.2" stroke-width="1.4"/><circle cx="20" cy="6" r="1.2" stroke-width="1.4"/>', open:'map' },
    { id:'proof', label:'Proof of Execution', svg:'<path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" stroke-width="1.3" stroke-linecap="round"/>',
      card:{ rank:'04', title:'PROOF OF EXECUTION', sub:'Downloadable records', badge:'PDF', kpis:[{n:'12.4k',l:'RECORDS'},{n:'HCS',l:'HASHED'},{n:'100%',l:'LINKED'}], fund:'Each PDF carries a live Hedera transaction hash', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'RECEIPTS', cls:'hash', view:'map'}] } },
    { id:'trees', label:'Reforestation Hub', svg:'<path d="M12 21c-4-2-7-6-7-10a7 7 0 0 1 14 0c0 4-3 8-7 10Z" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 21V9" stroke-width="1.4" stroke-linecap="round"/>',
      card:{ rank:'05', title:'REFORESTATION HUB', sub:'Canopy restoration', badge:'GROW', kpis:[{n:'450k',l:'TREES'},{n:'9.8kt',l:'CO₂'},{n:'24km',l:'EDGE'}], fund:'Delta sediment & vegetation replanting', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'SITES', cls:'hash', view:'globe'}] } },
    { id:'bio', label:'Biodiversity Guard', svg:'<path d="M2 13c3-3.5 6-3.5 8 0 2-3.5 5-3.5 8 0" stroke-width="1.4" stroke-linecap="round"/><path d="M10 13v6" stroke-width="1.4" stroke-linecap="round"/>',
      card:{ rank:'06', title:'BIODIVERSITY GUARD', sub:'Sanctuary watch', badge:'128', kpis:[{n:'128',l:'SPECIES'},{n:'35k',l:'HA'},{n:'18',l:'DRONE'}], fund:'Protected species across sanctuary land', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'SANCTUARY', cls:'hash', view:'globe'}] } },
    { id:'ocean', label:'Ocean & Basin Care', svg:'<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" stroke-width="1.4" stroke-linejoin="round"/>',
      card:{ rank:'07', title:'OCEAN & BASIN CARE', sub:'Marine restoration', badge:'SEA', kpis:[{n:'85t',l:'WASTE'},{n:'14',l:'SITES'},{n:'310t',l:'PLASTIC'}], fund:'Coastal waste removed across 14 marine sites', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'COASTS', cls:'hash', view:'map'}] } },
    { id:'energy', label:'Clean Energy Grid', svg:'<circle cx="12" cy="12" r="4" stroke-width="1.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2" stroke-width="1.4" stroke-linecap="round"/>',
      card:{ rank:'08', title:'CLEAN ENERGY GRID', sub:'Solar field stations', badge:'3.2', kpis:[{n:'3.2',l:'GWH'},{n:'1.4k',l:'MWH'},{n:'99.2%',l:'UPTIME'}], fund:'Tokenized surplus as energy credits', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'GRID', cls:'hash', view:'globe'}] } },
    { id:'treasury', label:'Fiat & Token Treasury', svg:'<path d="M4 9V7a2 2 0 0 1 2-2h9" stroke-width="1.4" stroke-linecap="round"/><path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16.3" cy="12.5" r="0.9" stroke-width="1.4"/>', pay:true },
    { id:'grants', label:'Grants & Micro-Stipends', svg:'<path d="M3 12l4-4 3 2 3-2 4 4-2 2-2-1-2 2-2-1-2 1-2-2Z" stroke-width="1.3" stroke-linejoin="round"/>',
      card:{ rank:'10', title:'GRANTS & STIPENDS', sub:'Field operators', badge:'DEMO', kpis:[{n:'—',l:'PAID'},{n:'320',l:'OPS'},{n:'85%',l:'FIELD'}], fund:'Demo tile — live payouts are on the treasury card', ctas:[{id:'openWallet', label:'WALLET', view:'wallet'},{id:'hash', label:'MILESTONE', cls:'hash', view:'milestone'}] } },
    { id:'hashscan', label:'On-Chain HashScan', svg:'<path d="M14 4h6v6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4l-9 9" stroke-width="1.4" stroke-linecap="round"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
      card:{ rank:'11', title:'ON-CHAIN HASHSCAN', sub:'Network explorer', badge:'HCS', kpis:[{n:'3.2s',l:'FINALITY'},{n:'#58.2M',l:'BLOCK'},{n:'0.001',l:'HBAR'}], fund:'Average network fee on mirrored proofs', ctas:[{id:'openMap', label:'OPEN MAP', view:'map'},{id:'hash', label:'EXPLORER', cls:'hash', view:'map'}] } }
  ];

  var APP = '../../desktop.html';
  var loadEl = document.getElementById('pwaLoad');
  var frameEl = document.getElementById('pwaFrame');
  var iframe = document.getElementById('pwaIframe');
  var grid = document.getElementById('iconGrid');
  var host = document.getElementById('pwaFeatureCard') || document.getElementById('pwaPayCard');
  if (!grid || !loadEl || !frameEl || !iframe) return;

  function openWebView(view){
    loadEl.classList.add('show');
    Sound.click();
    iframe.src = APP + '?embed=1&from=pwa&view=' + encodeURIComponent(view);
    setTimeout(function(){
      frameEl.classList.add('show');
      loadEl.classList.remove('show');
      if (Notify) Notify.toast({ tone:'blue', title:'Live feed', sub:'Mobile 3D / 2D maps from the web app.', n:'📡' });
    }, 700);
  }
  if (window.GOO) window.GOO.openPwaView = openWebView;

  document.getElementById('pwaCloseView') && document.getElementById('pwaCloseView').addEventListener('click', function(){
    frameEl.classList.remove('show');
    iframe.src = 'about:blank';
  });
  var pwaComp = document.getElementById('pwaCompassBtn');
      if (pwaComp) pwaComp.addEventListener('click', function(){
        if (Compass) Compass.show();
      });

  function bindWalletView() {
    var walletBtn = document.getElementById('pwaWalletView');
    if (!walletBtn || walletBtn.dataset.gooBound) return;
    walletBtn.dataset.gooBound = '1';
    walletBtn.addEventListener('click', function () { openWebView('wallet'); });
  }

  function bindPay(){
    if (!window.GooWallet) return;
    window.GooWallet.bind({
      source: 'pwa',
      onError: function (msg) {
        if (Notify) Notify.toast({ tone: 'amber', title: 'Checkout', sub: msg, n: '$' });
      }
    });
    bindWalletView();
  }

  function payCardHtml(){
    return '' +
      '<article class="pay-card">' +
        '<div class="tpop-h">' +
          '<span class="tpop-rank">F</span>' +
          '<div><b>RESTORATION FUND</b><i>Stripe treasury · database</i></div>' +
          '<span class="tpop-ph" id="pwaPayLive">LIVE</span>' +
        '</div>' +
        '<div class="tpop-kpis">' +
          '<div class="tpop-kpi"><b id="pwaBalOp">—</b><i>AVAILABLE</i></div>' +
          '<div class="tpop-kpi"><b id="pwaBalPaid">—</b><i>SETTLED</i></div>' +
          '<div class="tpop-kpi"><b id="pwaBalSplit">85/15</b><i>SPLIT</i></div>' +
        '</div>' +
        '<div class="tpop-fund" id="pwaBalFund">Field ops 85% · treasury 15%</div>' +
      '</article>' +
      '<article class="pay-card">' +
        '<div class="tpop-h">' +
          '<span class="tpop-rank">P</span>' +
          '<div><b>PERSONAL PAYOUTS</b><i>Your Stripe orders</i></div>' +
          '<span class="tpop-ph" id="pwaPayStatus">EMAIL</span>' +
        '</div>' +
        '<div class="tpop-kpis">' +
          '<div class="tpop-kpi"><b id="pwaBalYou">—</b><i>PAID</i></div>' +
          '<div class="tpop-kpi"><b id="pwaBalPend">—</b><i>PENDING</i></div>' +
          '<div class="tpop-kpi"><b id="pwaBalOrders">0</b><i>ORDERS</i></div>' +
        '</div>' +
        '<div class="tpop-fund" id="pwaPayLine">Enter email to load your payouts</div>' +
      '</article>' +
      '<article class="pay-card">' +
        '<label class="pay-email"><input id="pwaPayEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>' +
        '<div class="tpop-cta">' +
          '<button type="button" class="pow" id="pwaCheckout">CHECKOUT</button>' +
          '<button type="button" class="hash" id="pwaWalletView">WALLET</button>' +
        '</div>' +
      '</article>';
  }

  function featureCardHtml(item){
    var c = item.card;
    var kpis = (c.kpis || []).map(function(k){
      return '<div class="tpop-kpi"><b>' + k.n + '</b><i>' + k.l + '</i></div>';
    }).join('');
    var ctas = (c.ctas || []).map(function(b){
      return '<button type="button" class="' + (b.cls || 'pow') + '" data-view="' + b.view + '">' + b.label + '</button>';
    }).join('');
    return '' +
      '<article class="pay-card">' +
        '<div class="tpop-h">' +
          '<span class="tpop-rank">' + c.rank + '</span>' +
          '<div><b>' + c.title + '</b><i>' + c.sub + '</i></div>' +
          '<span class="tpop-ph">' + c.badge + '</span>' +
        '</div>' +
        '<div class="tpop-kpis">' + kpis + '</div>' +
        '<div class="tpop-fund">' + c.fund + '</div>' +
        '<div class="tpop-cta">' + ctas + '</div>' +
      '</article>';
  }

  function showCard(item){
    if (!host) return;
    if (item.pay) {
      host.innerHTML = payCardHtml();
      bindPay();
      return;
    }
    if (!item.card) return;
    host.innerHTML = featureCardHtml(item);
    host.querySelectorAll('[data-view]').forEach(function(btn){
      btn.addEventListener('click', function(){
        openWebView(btn.getAttribute('data-view'));
      });
    });
  }

  ICONS.forEach(function (item, i) {
    var btn = document.createElement('button');
    btn.className = 'tile' + (item.pay ? ' active' : '');
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none">' + item.svg + '</svg>';
    btn.addEventListener('click', function () {
      grid.querySelectorAll('.tile').forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      if (item.open) {
        openWebView(item.open);
        return;
      }
      showCard(item);
      if (Sound) Sound.click();
    });
    grid.appendChild(btn);
  });

  var satPeek = document.getElementById('satPeek');
  if (satPeek) {
    satPeek.addEventListener('click', function () {
      if (Sound) Sound.click();
      openWebView('world');
    });
    satPeek.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('error', function () { img.style.display = 'none'; });
    });
  }

  bindPay();
})();
