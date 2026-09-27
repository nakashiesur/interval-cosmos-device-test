(() => {
  const cloud = window.IntervalCosmosCloud;
  const prefix = `intervalCosmos.answers.v205:${window.INTERVAL_COSMOS_CLOUD?.supabaseUrl || ''}:`;
  const legacyKey = 'intervalCosmos.mastery.legacy.v205';
  let syncing = null, timer = null, storageError = false, syncError = false;
  // Freeze the old device-local analysis before the first new answer. Never upload it.
  try {
    if (localStorage.getItem(legacyKey) === null) {
      localStorage.setItem(legacyKey, localStorage.getItem('intervalCosmos.mastery.v2') || '{}');
    }
  } catch { storageError = true; }
  function bounded(request) {
    let timeout;
    return Promise.race([
      Promise.resolve(request),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Learning sync timed out')),15000);}),
    ]).finally(()=>clearTimeout(timeout));
  }
  function owner() {
    const profile = cloud?.getCachedPlayer?.();
    const authId = cloud?.getAuthUser?.()?.id;
    const playerId = profile?.player_id || profile?.id;
    return !profile?.is_guest && authId && playerId ? {authId,playerId} : null;
  }
  function pending(identity = owner()) {
    if (!identity) return [];
    const found=[];
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if (!key?.startsWith(prefix + identity.authId + ':')) continue;
      try {
        const row=JSON.parse(localStorage.getItem(key));
        if (row.playerId===identity.playerId && row.authId===identity.authId) found.push({key,...row});
      } catch {} // Preserve damaged entries rather than replacing them.
    }
    return found;
  }
  function record(intervalKey,chosenKey,responseMs) {
    const identity=owner();
    if (!identity) return; // Guests stay local; never assign guest answers to a later login.
    try {
      const event={event_id:cloud.createClientEventId(),interval_key:intervalKey,chosen_key:chosenKey,
        response_ms:Math.max(0,Math.min(86400000,Math.round(responseMs))),answered_at:new Date().toISOString()};
      localStorage.setItem(prefix+identity.authId+':'+event.event_id,JSON.stringify({...identity,event}));
      if (!timer) timer=setTimeout(()=>{timer=null;flush();},1000);
    } catch { storageError=true; }
  }
  async function flush() {
    if (syncing) return syncing;
    const identity=owner();
    if (!identity || navigator.onLine===false) return;
    syncing=(async()=>{
      try {
        let batch;
        while ((batch=pending(identity).slice(0,100)).length) {
          const current=owner();
          if (!current || current.authId!==identity.authId || current.playerId!==identity.playerId) return;
          await bounded(cloud.submitLearningAnswers(identity,batch.map(row=>row.event)));
          for (const row of batch) localStorage.removeItem(row.key);
        }
        syncError=false;
      } catch { syncError=true; } // Keep original IDs for safe retry after uncertain delivery.
    })();
    try { await syncing; } finally { syncing=null; }
  }
  function legacy() {
    try { return JSON.parse(localStorage.getItem(legacyKey)||'{}'); } catch { return {}; }
  }
  async function fetchAnalysis() {
    await flush();
    const identity=owner();
    if (!identity) return {rows:[],guest:true,pending:0,storageError};
    const rows=await bounded(cloud.fetchLearningAnalysis());
    const current=owner();
    if (!current || current.playerId!==identity.playerId || current.authId!==identity.authId) throw Error('Account changed');
    return {rows,pending:pending(identity).length,storageError,syncError};
  }
  window.IntervalCosmosLearningSync={record,flush,fetchAnalysis,legacy,pending};
  window.addEventListener('online',flush);
  window.addEventListener('visibilitychange',()=>{if(!document.hidden)flush();});
  window.setInterval(flush,30000);
})();
