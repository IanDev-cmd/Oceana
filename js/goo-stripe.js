/* Compat shim. Prefer js/api/client.js — this file does not call /api/*. */
(function () {
  'use strict';
  if (!window.GooApi) return;
  window.GooStripe = window.GooStripe || {
    apiBase: window.GooApi.apiBase,
    fetchBalance: window.GooApi.fetchLedger,
    fetchLedger: window.GooApi.fetchLedger,
    startCheckout: window.GooApi.startCheckout
  };
})();
