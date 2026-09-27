(() => {
  'use strict';
  const key = 'interval-cosmos-guest-sessions-v205';
  function read() {
    try { const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows.filter(r => r && typeof r.mode === 'string' && Number.isFinite(r.score)).slice(0,500) : []; }
    catch { return []; }
  }
  function save(row) {
    try { localStorage.setItem(key, JSON.stringify([row, ...read()].slice(0,500))); return true; }
    catch { return false; }
  }
  window.IntervalCosmosGuestSessions = Object.freeze({read,save});
})();
