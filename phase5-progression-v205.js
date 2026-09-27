(() => {
  const cloud = window.IntervalCosmosCloud;
  const config = window.INTERVAL_COSMOS_CLOUD || {};
  const POINT_FRAMES = new Set(['normal','bronze','silver','gold','platinum','cosmic']);
  const LABELS = {basic:'BASIC',accuracy:'ACCURACY',combo:'COMBO',mode:'MODE',interval:'INTERVAL',streak:'STREAK',ranking:'RANKING',assignment:'ASSIGNMENT',hidden:'SECRET'};
  let client=null, cache=null, opening=false, queued=false, unlockQueue=[], showing=false, unlockTimer=null;
  let cosmosRequest=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent=(v,m)=>m>0?Math.max(0,Math.min(100,Math.round(v/m*100))):0;

  async function progressClient(){
    if(client)return client;
    if(!config.supabaseUrl||!(config.supabasePublishableKey||config.supabaseAnonKey))throw new Error('オンライン設定がありません。');
    await cloud?.init?.();
    if(!window.supabase?.createClient)throw new Error('Supabase SDKを読み込めませんでした。');
    client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey||config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    return client;
  }
  async function rpc(name,args){const c=await progressClient();const {data,error}=await c.rpc(name,args);if(error)throw error;return data;}
  async function evaluate(){const r=await rpc('evaluate_my_progress');try{await cloud?.getMyPlayer?.();}catch{}queueUnlocks(r);return r;}
  async function fetchProgress(){const request=cosmosRequest;const data=await rpc('get_my_cosmos_progress');if(request===cosmosRequest)cache=data;return data;}

  function rankingPresentationBusy(){
    const lastRankedResult=window.IntervalCosmosV205?.getLastSubmitResult?.();
    const awaitingPublication=Boolean(lastRankedResult?.publication_required&&document.querySelector('.result-panel'));
    return Boolean(document.querySelector('.rank-burst,.v205-publication-overlay')||awaitingPublication);
  }
  function scheduleUnlock(delay=320){
    if(showing||!unlockQueue.length||unlockTimer)return;
    unlockTimer=window.setTimeout(()=>{unlockTimer=null;showUnlock();},delay);
  }
  function queueUnlocks(r){
    if(!r)return;
    for(const a of r.new_achievements||[])unlockQueue.push(['ACHIEVEMENT',a.name,`+${a.points||0} PT`]);
    for(const t of r.new_titles||[])unlockQueue.push(['TITLE UNLOCKED',t.name,'称号を獲得']);
    for(const f of r.new_frames||[])unlockQueue.push(['FRAME UNLOCKED',f.name,f.animated?'DYNAMIC FRAME':'NEW FRAME']);
    for(const m of r.new_daily_completions||[])unlockQueue.push(['DAILY COMPLETE',m.name,`+${m.reward_points||0} PT`]);
    // The base RESULT creates its rank cut-in only after submitScore resolves.
    // Give it a moment to mount, then wait until ranking/privacy presentation is fully finished.
    scheduleUnlock(420);
  }
  function showUnlock(){
    if(showing||!unlockQueue.length)return;
    if(rankingPresentationBusy()){scheduleUnlock(180);return;}
    showing=true;
    const [kind,name,sub]=unlockQueue.shift(),n=document.createElement('div');n.className='v205-unlock-burst';
    n.innerHTML=`<div class="v205-unlock-rings"></div><section><p>${esc(kind)}</p><h2>${esc(name)}</h2><span>${esc(sub)}</span></section>`;document.body.appendChild(n);
    window.setTimeout(()=>{n.classList.add('out');window.setTimeout(()=>{n.remove();showing=false;scheduleUnlock(260);},320)},2100);
  }

  function getOverlay(){let n=document.querySelector('.v205-cosmos-overlay');if(!n){n=document.createElement('div');n.className='v205-cosmos-overlay';document.body.appendChild(n)}return n}
  function close(){cosmosRequest++;opening=false;document.querySelector('.v205-cosmos-overlay')?.remove()}
  function loading(){getOverlay().innerHTML='<section class="v205-cosmos-card"><button class="icon-btn v205-cosmos-close" data-v205-cosmos-close>×</button><div class="v205-cosmos-loading"><span class="spinner"></span><strong>CALCULATING COSMOS PROGRESS...</strong><small>実績・フレーム・デイリーミッションを同期しています</small></div></section>'}

  function frameStatus(d){
    const rows=(d.frames||[]).filter(f=>f.id&&POINT_FRAMES.has(f.id)).sort((a,b)=>(a.tier||0)-(b.tier||0)),pt=Number(d.player?.achievement_points||0),owned=rows.filter(f=>f.unlocked),current=owned.at(-1)||rows[0],next=rows.find(f=>!f.unlocked&&Number(f.points_required||0)>pt)||null,from=Number(current?.points_required||0),to=Number(next?.points_required||from||1);
    return{pt,current,next,p:next?percent(pt-from,Math.max(1,to-from)):100};
  }
  function dailyHTML(d){return `<section class="v205-cosmos-section"><div class="v205-cosmos-section-head"><div><p>DAILY MISSIONS</p><h3>今日の3ミッション</h3></div><span>${esc(d.mission_date||'')}</span></div><div class="v205-daily-grid">${(d.daily_missions||[]).map(m=>`<article class="v205-daily-card ${m.completed?'done':''}"><div class="v205-daily-top"><span>0${m.slot}</span><b>${m.completed?'COMPLETE':`+${m.reward_points} PT`}</b></div><h4>${esc(m.name)}</h4><p>${esc(m.description)}</p><div class="v205-progress"><i style="width:${percent(Number(m.progress||0),Number(m.target||1))}%"></i></div><small>${Math.min(Number(m.progress||0),Number(m.target||1))} / ${m.target}${m.completed?'　✓':''}</small></article>`).join('')}</div><p class="v205-cosmos-note">デイリーはゲームスコアを増やしません。獲得PTはプロフィール／フレーム成長にのみ使用されます。</p></section>`}
  function frameHTML(d){return `<section class="v205-cosmos-section"><div class="v205-cosmos-section-head"><div><p>FRAME EVOLUTION</p><h3>フレーム</h3></div><span>段階成長＋複合解放</span></div><div class="v205-frame-grid">${(d.frames||[]).map(f=>{const locked=!f.unlocked,point=f.id&&POINT_FRAMES.has(f.id);let req='???';if(!f.hidden&&point)req=f.id==='normal'?'BASE':`${Number(f.points_required||0).toLocaleString('ja-JP')} PT`;else if(!f.hidden&&f.unlock_rule?.type==='achievement_combo')req='複数実績で解放';else if(f.unlocked)req='UNLOCKED';return `<button class="v205-frame-card v205-frame-${esc(f.id||'secret')} ${f.animated?'animated':''} ${locked?'locked':''} ${f.equipped?'equipped':''}" ${f.unlocked&&f.id?`data-v205-equip-frame="${esc(f.id)}"`:'disabled'}><span class="v205-frame-orb">${locked?'?':'✦'}</span><strong>${esc(f.name||'???')}</strong><small>${esc(req)}</small>${f.equipped?'<em>EQUIPPED</em>':f.unlocked?'<em>SELECT</em>':''}</button>`}).join('')}</div><p class="v205-cosmos-note">NORMAL → BRONZE → SILVER → GOLD → PLATINUM → COSMIC はPTで自動成長。特殊フレームには複数条件があります。</p></section>`}
  function titleHTML(d){const rows=(d.titles||[]).filter(t=>!t.hidden||t.unlocked);return `<section class="v205-cosmos-section"><div class="v205-cosmos-section-head"><div><p>TITLES</p><h3>称号</h3></div><span>ランキング表示はメイン称号1個</span></div><div class="v205-title-grid">${rows.map(t=>`<button class="v205-title-card ${t.unlocked?'unlocked':'locked'} ${t.equipped?'equipped':''}" ${t.unlocked?`data-v205-equip-title="${esc(t.id)}"`:'disabled'}><strong>${esc(t.name)}</strong><span>${esc(t.description||'')}</span><small>${t.equipped?'MAIN TITLE':t.unlocked?'SELECT':'LOCKED'}</small></button>`).join('')}</div></section>`}
  function achievementHTML(d){
    const rows=d.achievements||[],featured=rows.filter(a=>a.featured_order).length,groups={};for(const a of rows)(groups[a.category||'basic']??=[]).push(a);
    const order=['basic','accuracy','combo','mode','interval','streak','ranking','assignment','hidden'];
    return `<section class="v205-cosmos-section"><div class="v205-cosmos-section-head"><div><p>ACHIEVEMENTS</p><h3>実績</h3></div><span>代表実績 ${featured} / 3</span></div>${order.filter(k=>groups[k]).map(k=>`<div class="v205-achievement-group"><h4>${LABELS[k]||k.toUpperCase()}</h4><div class="v205-achievement-list">${groups[k].map(a=>{const secret=a.hidden&&!a.unlocked;return `<article class="v205-achievement-item ${a.unlocked?'unlocked':'locked'} ${secret?'secret':''} ${a.featured_order?'featured':''}"><div class="v205-achievement-mark">${window.IntervalCosmosArt?.achievementHTML(a.id,a)||(a.unlocked?'✓':secret?'?':'·')}</div><div><strong>${esc(secret?'???':a.name||'???')}</strong><p>${esc(secret?'???':a.description||'???')}</p><small>${a.unlocked?`UNLOCKED${a.points!=null?`　+${a.points} PT`:''}`:secret?'CONDITION ???':`${a.points||0} PT`}</small></div>${a.unlocked&&a.id?`<button class="v205-feature-btn ${a.featured_order?'on':''}" data-v205-feature="${esc(a.id)}">${a.featured_order?`★ ${a.featured_order}`:'☆ 代表'}</button>`:''}</article>`}).join('')}</div></div>`).join('')}</section>`
  }
  function render(d){const p=d.player||{},av=cloud?.avatarMark?.(p.avatar_id)||'✦',f=frameStatus(d),title=(d.titles||[]).find(t=>t.equipped)?.name||'NO TITLE';getOverlay().innerHTML=`<section class="v205-cosmos-card"><button class="icon-btn v205-cosmos-close" data-v205-cosmos-close>×</button><header class="v205-cosmos-hero"><div class="v205-cosmos-avatar v205-frame-${esc(p.equipped_frame_id||'normal')}">${window.IntervalCosmosArt?.avatarHTML(p.avatar_id)||esc(av)}</div><div class="v205-cosmos-id"><p>MY COSMOS</p><h2>${esc(p.player_name||'PLAYER')}</h2><span>${esc(title)}</span></div><div class="v205-points"><small>COSMOS PT</small><strong>${Number(p.achievement_points||0).toLocaleString('ja-JP')}</strong><span>${esc(f.current?.name||'NORMAL')} FRAME</span></div></header><div class="v205-evolution"><div><span>${esc(f.current?.name||'NORMAL')}</span><b>${f.next?esc(f.next.name):'MAX POINT TIER'}</b></div><div class="v205-progress big"><i style="width:${f.p}%"></i></div><small>${f.next?`${f.pt.toLocaleString('ja-JP')} / ${Number(f.next.points_required||0).toLocaleString('ja-JP')} PT`:'ポイント成長段階を完遂'}</small></div>${dailyHTML(d)}${frameHTML(d)}${titleHTML(d)}${achievementHTML(d)}</section>`}

  function renderUnavailable(error, guest = false) {
    const title = guest ? 'GUEST MODE' : '読み込みできませんでした';
    const message = guest ? '実績・称号・フレームは正式アカウントで利用できます。' : (error?.message || '進行データを取得できませんでした。');
    const hint = guest ? '設定の「アカウント・端末」から登録できます。' : '接続を確認して、もう一度開いてください。';
    getOverlay().innerHTML = `<section class="v205-cosmos-card"><button class="icon-btn v205-cosmos-close" data-v205-cosmos-close>×</button><div class="v205-cosmos-error"><p>MY COSMOS</p><h2>${esc(title)}</h2><span>${esc(message)}</span><small>${esc(hint)}</small></div></section>`;
  }
  async function open() {
    if (opening) return;
    opening = true;
    const request = ++cosmosRequest;
    try {
      if (cloud?.getCachedPlayer?.()?.is_guest) { renderUnavailable(null, true); return; }
      loading();
      const data = await fetchProgress();
      if (request === cosmosRequest) render(data);
    } catch (error) {
      if (request !== cosmosRequest) return;
      console.error('[progress]', error);
      renderUnavailable(error);
    } finally { if (request === cosmosRequest) opening = false; }
  }
  async function refresh(){
    if(!document.querySelector('.v205-cosmos-overlay'))return;
    const request=++cosmosRequest;
    const data=await fetchProgress();
    if(request===cosmosRequest&&document.querySelector('.v205-cosmos-overlay'))render(data);
  }

  function inject(){
    const footer=document.querySelector('.home-footer');if(footer&&!footer.querySelector('[data-v205-cosmos-open]')){const b=document.createElement('button');b.className='secondary-btn v205-cosmos-launch';b.type='button';b.dataset.v205CosmosOpen='1';b.innerHTML='✦ MY COSMOS';footer.appendChild(b)}
    const settings=document.querySelector('.settings-modal .modal-card');if(settings&&!settings.querySelector('.v205-cosmos-setting')){const r=document.createElement('div');r.className='setting-row v205-cosmos-setting';r.innerHTML='<div class="setting-label"><strong>My Cosmos</strong><span>実績・称号・フレーム・デイリー</span></div><button type="button" class="secondary-btn" data-v205-cosmos-open>開く</button>';const v=settings.querySelector('.settings-version');v?v.insertAdjacentElement('beforebegin',r):settings.appendChild(r)}
  }

  if(cloud?.submitScore&&!cloud.__v205Phase5Wrapped){const submit=cloud.submitScore.bind(cloud);cloud.submitScore=async p=>{const r=await submit(p);if(!r?.guest&&!r?.queued)evaluate().catch(()=>{});return r};if(cloud.publishPlaySession){const pub=cloud.publishPlaySession.bind(cloud);cloud.publishPlaySession=async id=>{const r=await pub(id);evaluate().catch(()=>{});return r}}cloud.__v205Phase5Wrapped=true}
  function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;inject()})}new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('DOMContentLoaded',schedule,{once:true});
  window.addEventListener('click',async e=>{if(e.target.closest?.('[data-v205-cosmos-open]')){open();return}if(e.target.closest?.('[data-v205-cosmos-close]')||e.target===document.querySelector('.v205-cosmos-overlay')){close();return}const t=e.target.closest?.('[data-v205-equip-title]');if(t){await cloud.updateMyProfile({mainTitleId:t.dataset.v205EquipTitle});await refresh();return}const f=e.target.closest?.('[data-v205-equip-frame]');if(f){await cloud.updateMyProfile({equippedFrameId:f.dataset.v205EquipFrame});await refresh();return}const a=e.target.closest?.('[data-v205-feature]');if(a){try{await rpc('toggle_featured_achievement',{p_achievement_id:a.dataset.v205Feature});await refresh()}catch(err){alert(err?.message||'代表実績を変更できませんでした。')}}},true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.v205-cosmos-overlay')){e.preventDefault();e.stopImmediatePropagation();close()}},true);
  window.IntervalCosmosProgressV205={open,fetchProgress,evaluate,getCache:()=>cache};
})();
