(() => {
  // One storage key per event avoids read/modify/write loss between browser tabs.
  // Entries are scoped to the configured backend and the originating auth identity.
  const prefix = `intervalCosmos.outbox.v205:${window.INTERVAL_COSMOS_CLOUD?.supabaseUrl || ''}:`;
  function create(storage) {
    const key = row => `${prefix}${row.authId}:${row.payload.clientEventId}`;
    function save(row) {
      storage.setItem(key(row), JSON.stringify(row)); // Quota/denied storage must not report success.
      return row;
    }
    function list(authId, playerId) {
      const rows = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k?.startsWith(prefix)) continue;
        try {
          const row = JSON.parse(storage.getItem(k));
          if (row.authId === authId && row.playerId === playerId && row.payload?.clientEventId) rows.push(row);
        } catch {} // Preserve unreadable entries for recovery; never overwrite the store.
      }
      return rows.sort((a,b) => a.payload.playedAt.localeCompare(b.payload.playedAt));
    }
    return {save, list, get: row => {
      const raw = storage.getItem(key(row));
      return raw ? JSON.parse(raw) : null;
    }};
  }
  window.IntervalCosmosOutboxStore = {create};
})();
