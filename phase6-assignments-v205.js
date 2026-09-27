(() => {
  const cloud = window.IntervalCosmosCloud;
  const config = window.INTERVAL_COSMOS_CLOUD || {};
  const MODE_MAP = Object.freeze({
    TEXT:{label:'STANDARD / TEXT',duration:60,view:'text',hyper:false},
    KEYS:{label:'STANDARD / KEYS',duration:60,view:'keys',hyper:false},
    HD_TEXT:{label:'HYPER DRIVE / TEXT',duration:75,view:'text',hyper:true},
    HD_KEYS:{label:'HYPER DRIVE / KEYS',duration:75,view:'keys',hyper:true},
    EAR_LINK:{label:'EAR LINK',duration:60,view:'ear',hyper:false},
  });
  const COURSE_LABELS = Object.freeze({
    piano:'ピアノコース', orchestral:'管弦打楽コース', vocal_musical:'声楽・ミュージカルコース',
    composition:'作曲コース', rock_pops:'ロック＆ポップスコース', electronic_organ:'電子オルガンコース',
    sound_design:'サウンドデザインコース', music_education:'音楽教育コース', music_therapy:'音楽療法コース',
    child_culture:'こども文化コース', voice_actor:'声優コース',
  });
  const INTERVALS = Object.freeze([
    {key:'P1',n:1,semitones:0,jp:'完全1度',formula:'0半音'},
    {key:'m2',n:2,semitones:1,jp:'短2度',formula:'1半音'},
    {key:'M2',n:2,semitones:2,jp:'長2度',formula:'2半音'},
    {key:'m3',n:3,semitones:3,jp:'短3度',formula:'3半音'},
    {key:'M3',n:3,semitones:4,jp:'長3度',formula:'4半音'},
    {key:'P4',n:4,semitones:5,jp:'完全4度',formula:'5半音'},
    {key:'TT',n:4,semitones:6,jp:'三全音',formula:'6半音'},
    {key:'P5',n:5,semitones:7,jp:'完全5度',formula:'7半音'},
    {key:'m6',n:6,semitones:8,jp:'短6度',formula:'8半音'},
    {key:'M6',n:6,semitones:9,jp:'長6度',formula:'9半音'},
    {key:'m7',n:7,semitones:10,jp:'短7度',formula:'10半音'},
    {key:'M7',n:7,semitones:11,jp:'長7度',formula:'11半音'},
    {key:'P8',n:8,semitones:12,jp:'完全8度',formula:'12半音'},
  ]);
  const IV = Object.fromEntries(INTERVALS.map(x=>[x.key,x]));
  const LETTERS=['C','D','E','F','G','A','B'];
  const NAT={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const MASTERY_KEY='intervalCosmos.mastery.v2';
  let client=null;
  let currentList=[];
  const archiveBreakpoint=matchMedia('(min-width:781px)');
  archiveBreakpoint.addEventListener('change',()=>{
    const archive=document.querySelector('.v205-assignment-panel.student .v205-a-closed');
    if(archive)archive.open=archiveBreakpoint.matches;
  });
  let currentAssignment=null;
  let game=null;
  let raf=0;
  let audio=null;
  let injectQueued=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mod=(n,m)=>((n%m)+m)%m;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const fmt=n=>Math.round(Number(n||0)).toLocaleString('ja-JP');
  const accuracy=(c,t)=>t?Math.round(c/t*100):0;
  const nowIsoLocal=(d=new Date())=>{
    const z=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  };
  const dateText=value=>{
    if(!value)return'-';
    const d=new Date(value);
    return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  };
  const statusOf=a=>{
    const n=Date.now(),s=new Date(a.start_at).getTime(),e=new Date(a.deadline_at).getTime();
    return n<s?'upcoming':n>e?'closed':'active';
  };
  const intervalText=a=>{
    const keys=Array.isArray(a.interval_keys)&&a.interval_keys.length?a.interval_keys:INTERVALS.map(x=>x.key);
    return keys.length===13?'全13音程':keys.join(' / ');
  };
  const targetText=a=>{
    const p=[];
    if(a.target_score!=null)p.push(`SCORE ${fmt(a.target_score)}+`);
    if(a.target_accuracy!=null)p.push(`正答率 ${Number(a.target_accuracy)}%+`);
    return p.length?p.join(' ・ '):'到達条件なし';
  };

  async function ensureClient(){
    if(!cloud?.configured?.())throw new Error('オンライン設定がありません。');
    await cloud.init();
    client=window.IntervalCosmosSupabaseSingleton?.getClient?.()||client;
    if(client)return client;
    if(!window.supabase?.createClient)throw new Error('Supabase SDKを読み込めませんでした。');
    client=window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey||config.supabaseAnonKey,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
    );
    return client;
  }
  async function rpc(name,args={}){
    const c=await ensureClient();
    const {data,error}=await c.rpc(name,args);
    if(error)throw error;
    return data;
  }

  function overlay(){
    let n=document.querySelector('.v205-assignment-overlay');
    if(!n){n=document.createElement('div');n.className='v205-assignment-overlay';document.body.appendChild(n)}
    return n;
  }
  function closeOverlay(){
    cancelAnimationFrame(raf);raf=0;audio?.stop?.();
    document.querySelector('.v205-assignment-overlay')?.remove();
    currentAssignment=null;game=null;
  }
  function head(kicker,title,sub=''){
    return `<header class="v205-assignment-head"><div><p>${esc(kicker)}</p><h2>${esc(title)}</h2>${sub?`<span>${esc(sub)}</span>`:''}</div><button class="icon-btn" data-a-close>×</button></header>`;
  }
  function loading(label='ASSIGNMENTSを同期しています'){
    overlay().innerHTML=`<section class="v205-assignment-panel">${head('ASSIGNMENTS','LOADING')}<div class="v205-a-loading"><span class="spinner"></span><strong>${esc(label)}</strong></div></section>`;
  }
  function errorView(err){
    overlay().innerHTML=`<section class="v205-assignment-panel">${head('ASSIGNMENTS','読み込めませんでした')}<div class="v205-a-empty">${esc(err?.message||'データを取得できませんでした。')}</div></section>`;
  }

  async function openAssignments(){
    cancelAnimationFrame(raf);raf=0;audio?.stop?.();game=null;currentAssignment=null;
    loading();
    try{
      const p=cloud?.getCachedPlayer?.()||await cloud?.getMyPlayer?.();
      if(!p||p.is_guest)throw new Error('正式アカウントが必要です。');
      if(p.is_admin)await renderTeacher();
      else await renderStudent();
    }catch(e){console.error('[assignments]',e);errorView(e)}
  }

  async function renderStudent(){
    currentList=await rpc('get_my_assignments');
    const rows=Array.isArray(currentList)?currentList:[];
    const active=rows.filter(a=>statusOf(a)==='active').length;
    const available=rows.filter(a=>statusOf(a)!=='closed');
    const closed=rows.filter(a=>statusOf(a)==='closed');
    overlay().innerHTML=`<section class="v205-assignment-panel student">
      ${head('STUDENT MISSIONS','ASSIGNMENTS',active?`挑戦可能 ${active}件`:'現在挑戦できる課題はありません')}
      <div class="v205-a-toolbar"><span>何度でも挑戦できます。採用記録は最高スコアです。</span><button class="secondary-btn" data-a-refresh>↻ 更新</button></div>
      <div class="v205-a-list">${available.map(studentCard).join('')}${closed.length?`<details class="v205-a-closed" ${archiveBreakpoint.matches?'open':''}><summary>終了した課題 <span>${closed.length}件</span></summary><div class="v205-a-list">${closed.map(studentCard).join('')}</div></details>`:''}${rows.length?'':'<div class="v205-a-empty">現在公開されている課題はありません。</div>'}</div>
    </section>`;
  }
  function studentCard(a){
    const st=statusOf(a),best=a.best_score==null?'—':fmt(a.best_score),acc=a.best_accuracy==null?'—':`${Number(a.best_accuracy).toFixed(1).replace('.0','')}%`;
    const badge=a.achieved?'ACHIEVED':st==='active'?'OPEN':st==='upcoming'?'COMING':'CLOSED';
    return `<article class="v205-a-card ${st} ${a.achieved?'achieved':''}">
      <div class="v205-a-card-top"><span>${esc(MODE_MAP[a.mode]?.label||a.mode)}</span><b>${badge}</b></div>
      <h3>${esc(a.title)}</h3>${a.description?`<p>${esc(a.description)}</p>`:''}
      <div class="v205-a-meta"><span>音程 <strong>${esc(intervalText(a))}</strong></span><span>期限 <strong>${esc(dateText(a.deadline_at))}</strong></span><span>目標 <strong>${esc(targetText(a))}</strong></span></div>
      <div class="v205-a-best"><div><small>BEST SCORE</small><strong>${best}</strong></div><div><small>BEST ACC.</small><strong>${acc}</strong></div><div><small>ATTEMPTS</small><strong>${Number(a.attempts||0)}</strong></div></div>
      <button class="primary-btn v205-a-play" data-a-play="${esc(a.id)}" ${st==='active'?'':'disabled'}>${st==='active'?'PLAY ASSIGNMENT':st==='upcoming'?`開始 ${esc(dateText(a.start_at))}`:'受付終了'}</button>
    </article>`;
  }

  async function renderTeacher(){
    currentList=await rpc('get_teacher_assignments');
    const rows=Array.isArray(currentList)?currentList:[];
    overlay().innerHTML=`<section class="v205-assignment-panel teacher">
      ${head('TEACHER CONTROL','ASSIGNMENTS','全学生共通課題を作成・公開')}
      <div class="v205-a-toolbar"><button class="primary-btn" data-a-new>＋ NEW ASSIGNMENT</button><button class="secondary-btn" data-a-refresh>↻ 更新</button></div>
      <div class="v205-a-list">${rows.length?rows.map(teacherCard).join(''):'<div class="v205-a-empty">課題はまだありません。</div>'}</div>
    </section>`;
  }
  function teacherCard(a){
    const st=statusOf(a),total=Number(a.total_students||0),done=Number(a.achieved_students||0);
    return `<article class="v205-a-card teacher ${a.is_published?'published':'draft'}">
      <div class="v205-a-card-top"><span>${esc(MODE_MAP[a.mode]?.label||a.mode)}</span><b>${a.is_published?'PUBLISHED':'DRAFT'}</b></div>
      <h3>${esc(a.title)}</h3>${a.description?`<p>${esc(a.description)}</p>`:''}
      <div class="v205-a-meta"><span>${esc(intervalText(a))}</span><span>期限 <strong>${esc(dateText(a.deadline_at))}</strong></span><span>目標 <strong>${esc(targetText(a))}</strong></span></div>
      <div class="v205-a-best"><div><small>挑戦学生</small><strong>${Number(a.attempted_students||0)} / ${total}</strong></div><div><small>達成</small><strong>${done} / ${total}</strong></div><div><small>総挑戦</small><strong>${Number(a.total_attempts||0)}</strong></div></div>
      <div class="v205-a-actions"><button class="secondary-btn" data-a-results="${esc(a.id)}">RESULTS</button><button class="secondary-btn ${a.is_published?'danger':''}" data-a-publish="${esc(a.id)}" data-published="${a.is_published?'1':'0'}">${a.is_published?'公開停止':'公開する'}</button></div>
      <small class="v205-a-state">${st==='active'?'受付中':st==='upcoming'?'開始前':'期限終了'}</small>
    </article>`;
  }

  function createForm(){
    const start=new Date(),end=new Date(start.getTime()+7*86400000);
    overlay().innerHTML=`<section class="v205-assignment-panel form">
      ${head('TEACHER CONTROL','NEW ASSIGNMENT','全学生に同じ課題を配信します')}
      <form id="v205AssignmentCreate" class="v205-a-form">
        <label><span>課題名</span><input id="aTitle" maxlength="80" required placeholder="例：第1回 音程トレーニング"></label>
        <label><span>説明</span><textarea id="aDesc" maxlength="500" rows="3" placeholder="学生への補足（任意）"></textarea></label>
        <label><span>モード</span><select id="aMode">${Object.entries(MODE_MAP).map(([k,v])=>`<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
        <fieldset><legend>出題音程 <small>1つ以上</small></legend><div class="v205-a-intervals">${INTERVALS.map(i=>`<button type="button" class="v205-a-chip selected" data-a-interval="${i.key}">${i.key}<small>${i.jp}</small></button>`).join('')}</div><div class="v205-a-mini-actions"><button type="button" class="secondary-btn" data-a-iall>ALL</button><button type="button" class="secondary-btn" data-a-icore>CORE 7</button></div></fieldset>
        <div class="v205-a-two"><label><span>開始</span><input id="aStart" type="datetime-local" value="${nowIsoLocal(start)}" required></label><label><span>期限</span><input id="aDeadline" type="datetime-local" value="${nowIsoLocal(end)}" required></label></div>
        <div class="v205-a-two"><label><span>目標スコア <small>任意</small></span><input id="aScore" type="number" min="0" step="1" placeholder="例：1500"></label><label><span>目標正答率 % <small>任意</small></span><input id="aAccuracy" type="number" min="0" max="100" step="0.1" placeholder="例：90"></label></div>
        <label class="v205-a-check"><input id="aPublish" type="checkbox" checked><span>作成と同時に学生へ公開する</span></label>
        <div id="aFormMsg" class="v205-a-message"></div>
        <div class="v205-a-form-actions"><button type="button" class="secondary-btn" data-a-back>戻る</button><button type="submit" class="primary-btn">CREATE</button></div>
      </form>
    </section>`;
  }

  async function submitCreate(form){
    const title=document.querySelector('#aTitle')?.value.trim()||'',desc=document.querySelector('#aDesc')?.value.trim()||'',mode=document.querySelector('#aMode')?.value||'TEXT';
    const keys=[...document.querySelectorAll('[data-a-interval].selected')].map(x=>x.dataset.aInterval),start=document.querySelector('#aStart')?.value,deadline=document.querySelector('#aDeadline')?.value;
    const scoreRaw=document.querySelector('#aScore')?.value,accRaw=document.querySelector('#aAccuracy')?.value,publish=Boolean(document.querySelector('#aPublish')?.checked),msg=document.querySelector('#aFormMsg');
    if(!title)return msg&&(msg.textContent='課題名を入力してください。');
    if(!keys.length)return msg&&(msg.textContent='音程を1つ以上選択してください。');
    if(!start||!deadline||new Date(deadline)<=new Date(start))return msg&&(msg.textContent='開始と期限を確認してください。');
    const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='CREATING...';
    try{
      await rpc('create_assignment',{p_title:title,p_description:desc,p_mode:mode,p_interval_keys:keys,p_start_at:new Date(start).toISOString(),p_deadline_at:new Date(deadline).toISOString(),p_target_score:scoreRaw===''?null:Number(scoreRaw),p_target_accuracy:accRaw===''?null:Number(accRaw),p_publish:publish});
      await renderTeacher();
    }catch(e){console.error('[create assignment]',e);if(msg)msg.textContent=e?.message||'作成できませんでした。';submit.disabled=false;submit.textContent='CREATE'}
  }

  async function togglePublish(id,published){
    try{await rpc('set_assignment_published',{p_assignment_id:id,p_published:!published});await renderTeacher()}
    catch(e){alert(e?.message||'公開設定を変更できませんでした。')}
  }
  async function showResults(id){
    const a=currentList.find(x=>x.id===id);loading('学生の提出状況を取得しています');
    try{
      const rows=await rpc('get_assignment_results',{p_assignment_id:id});
      overlay().innerHTML=`<section class="v205-assignment-panel results">
        ${head('TEACHER RESULTS',a?.title||'ASSIGNMENT',`${Array.isArray(rows)?rows.length:0} students`)}
        <div class="v205-a-toolbar"><button class="secondary-btn" data-a-back-teacher>← 課題一覧</button></div>
        <div class="v205-a-results">${(rows||[]).map(r=>`<div class="v205-a-result-row ${r.achieved?'achieved':''}">
          <div><strong>${esc(r.student_number||'—')}　${esc(r.player_name||'PLAYER')}</strong><span>${esc(COURSE_LABELS[r.course_code]||r.course_code||'所属未設定')}</span></div>
          <div><small>ATTEMPTS</small><b>${Number(r.attempts||0)}</b></div><div><small>BEST</small><b>${r.best_score==null?'—':fmt(r.best_score)}</b></div><div><small>ACC.</small><b>${r.best_accuracy==null?'—':`${Number(r.best_accuracy).toFixed(1).replace('.0','')}%`}</b></div>
          <em>${r.achieved?'ACHIEVED':r.attempts?'IN PROGRESS':'NOT STARTED'}</em>
        </div>`).join('')}</div>
      </section>`;
    }catch(e){errorView(e)}
  }

  class AssignmentAudio{
    constructor(){this.ctx=null;this.master=null;this.token=0;window.addEventListener('pagehide',()=>this.release());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release()})}
    release(){this.stop();const old=this.ctx;this.ctx=null;this.master=null;if(old&&old.state!=='closed')old.close().catch(()=>{})}
    settings(){try{return JSON.parse(localStorage.getItem('intervalCosmos.settings.v2')||'{}')}catch{return{}}}
    async unlock(){if(document.hidden)return false;if(!this.ctx||this.ctx.state==='closed'){this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination)}if(this.ctx.state!=='running')await this.ctx.resume();this.master.gain.setTargetAtTime(Number(this.settings().volume??.72),this.ctx.currentTime,.02)}
    tone(midi,when,d=.62,strength=1){const f=440*Math.pow(2,(midi-69)/12);[{r:1,t:'sine',g:.24},{r:2,t:'sine',g:.065},{r:3,t:'triangle',g:.025}].forEach((p,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=p.t;o.frequency.value=f*p.r;if(i===0)o.detune.value=-1.5;const peak=p.g*strength;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),when+.018);g.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*.32),when+.2);g.gain.exponentialRampToValueAtTime(.0001,when+d);o.connect(g).connect(this.master);o.start(when);o.stop(when+d+.05)})}
    async play(q){const s=this.settings();if(s.sound===false||!q)return;if(await this.unlock()===false)return;const now=this.ctx.currentTime+.035,style=s.audioStyle||'melodic',token=++this.token;const melodic=t=>{this.tone(q.baseMidi,t,.58,.92);this.tone(q.targetMidi,t+.48,.70,.98)},harmonic=t=>{this.tone(q.baseMidi,t,.90,.82);this.tone(q.targetMidi,t,.90,.82)};if(style==='melodic')return melodic(now);if(style==='harmonic')return harmonic(now);if(s.bothOrder==='melodicFirst'){melodic(now);setTimeout(()=>{if(token===this.token)harmonic(this.ctx.currentTime+.02)},1120)}else{harmonic(now);setTimeout(()=>{if(token===this.token)melodic(this.ctx.currentTime+.02)},980)}}
    stop(){this.token++}
  }
  function accidental(a){return a===1?'♯':a===-1?'♭':''}
  const octaveNumber=midi=>Math.floor(Number(midi||0)/12)-1;
  function displayQuestionNote(q,side){
    const note=side==='base'?q.base:q.target,midi=side==='base'?q.baseMidi:q.targetMidi;
    const register=q.intervalKey==='P1'||q.intervalKey==='P8'?`<sub class="v205-a-note-register">${octaveNumber(midi)}</sub>`:'';
    return `<span class="v205-a-note-name">${esc(note)}</span>${register}`;
  }
  function realize(base,acc,iv){const ti=mod(LETTERS.indexOf(base)+iv.n-1,7),letter=LETTERS[ti],basePc=mod(NAT[base]+acc,12),wanted=mod(basePc+iv.semitones,12);let ta=wanted-NAT[letter];if(ta>6)ta-=12;if(ta<-6)ta+=12;if(Math.abs(ta)>1)return null;return{letter,acc:ta}}
  function midiFor(pc){const c=[];for(let m=54;m<=69;m++)if(mod(m,12)===pc)c.push(m);return pick(c.length?c:[60+pc])}
  function makeQuestion(keys,previous){
    const list=keys.map(k=>IV[k]).filter(Boolean),pool=list.length>1&&previous?list.filter(x=>x.key!==previous):list,iv=pick(pool.length?pool:list);
    for(let n=0;n<200;n++){const base=pick(LETTERS),acc=pick([0,0,0,0,-1,1]),r=realize(base,acc,iv);if(!r)continue;let bm=midiFor(mod(NAT[base]+acc,12)),tm=bm+iv.semitones;if(tm>81){bm-=12;tm-=12}return{id:crypto.randomUUID?.()||String(Date.now()),intervalKey:iv.key,base:`${base}${accidental(acc)}`,target:`${r.letter}${accidental(r.acc)}`,baseMidi:bm,targetMidi:tm}}
    return{id:String(Date.now()),intervalKey:'M3',base:'C',target:'E',baseMidi:60,targetMidi:64};
  }
  function readMastery(){try{return JSON.parse(localStorage.getItem(MASTERY_KEY)||'{}')}catch{return{}}}
  function updateMastery(key,chosen,ok,ms){const m=readMastery(),row=m[key]||{seen:0,correct:0,wrong:0,emaMs:0,streak:0,lastSeen:0,confusions:{}};row.seen=(row.seen||0)+1;row.lastSeen=Date.now();row.emaMs=row.emaMs?Math.round(row.emaMs*.72+ms*.28):Math.round(ms);row.confusions=row.confusions||{};if(ok){row.correct=(row.correct||0)+1;row.streak=(row.streak||0)+1}else{row.wrong=(row.wrong||0)+1;row.streak=0;row.confusions[chosen]=(row.confusions[chosen]||0)+1}m[key]=row;localStorage.setItem(MASTERY_KEY,JSON.stringify(m));window.IntervalCosmosLearningSync?.record(key,chosen,ms)}
  function calcPoints(sec,ok,combo){if(!ok)return-50;const base=sec<=1?150:sec<=2?130:sec<=3?120:sec<=4?110:sec<=5?100:sec<=8?80:sec<=10?60:50;return base+Math.min(combo*5,150)}
  function accBonus(a){return a===100?3000:a>=95?1000:a>=90?500:a>=85?300:a>=80?200:0}
  function finalScore(){const a=accuracy(game.correct,game.total);return Math.max(0,Math.round(game.score+(game.def.hyper?game.maxCombo*50+accBonus(a):0)))}
  function keyboard(q){
    const whiteW=44,margin=12,width=margin*2+whiteW*14,pcWhite={0:0,2:1,4:2,5:3,7:4,9:5,11:6},black={1:[0,1],3:[1,2],6:[3,4],8:[4,5],10:[5,6]},centers=Array.from({length:14},(_,i)=>margin+whiteW/2+i*whiteW),low=Math.floor(Math.min(q.baseMidi,q.targetMidi)/12)*12;
    const x=m=>{const idx=m-low,oct=clamp(Math.floor(idx/12),0,1),pc=mod(m,12);if(pc in pcWhite)return centers[pcWhite[pc]+oct*7];const [l,r]=black[pc];return(centers[l+oct*7]+centers[r+oct*7])/2+1},white=m=>mod(m,12) in pcWhite,marker=(m,dx=0)=>`<circle cx="${x(m)+dx}" cy="${white(m)?104:69}" r="10" class="v205-a-keymark"/>`;
    const whites=Array.from({length:14},(_,i)=>`<rect x="${margin+i*whiteW}" y="8" width="${whiteW-2}" height="120" rx="5" class="v205-a-white"/>`).join('');let blacks='';for(let o=0;o<2;o++)for(const pc of[1,3,6,8,10])blacks+=`<rect x="${x(low+o*12+pc)-12}" y="8" width="24" height="74" rx="4" class="v205-a-black"/>`;
    return `<div class="v205-a-keyboard"><svg viewBox="0 0 ${width} 136">${whites}${blacks}${q.baseMidi===q.targetMidi?marker(q.baseMidi,-8)+marker(q.targetMidi,8):marker(q.baseMidi)+marker(q.targetMidi)}</svg></div>`;
  }
  function answerGrid(){
    const groups=[['P1'],['m2','M2'],['m3','M3'],['P4','TT','P5'],['m6','M6'],['m7','M7'],['P8']],symbol=game.labelSymbol;
    return `<div class="answer-rows">${groups.map(g=>`<div class="answer-row cols-${g.length}">${g.map(k=>{
      let flash='';
      if(game.feedbackType){
        if(k===game.question?.intervalKey)flash='correct';
        else if(game.feedbackType==='wrong'&&k===game.chosenKey)flash='wrong';
      }
      return `<button class="answer-btn answer-btn-large ${flash}" data-a-answer="${k}" ${game.locked?'disabled':''}><span class="answer-main">${symbol?k:IV[k].jp}</span></button>`;
    }).join('')}</div>`).join('')}</div>`;
  }
  function renderGame(){
    if(!game)return;const remain=Math.max(0,(game.wallDeadline-Date.now())/1000),q=game.question,def=game.def;
    const notePair=`<div class="note-question note-pair"><span>${displayQuestionNote(q,'base')}</span><span class="note-gap"></span><span>${displayQuestionNote(q,'target')}</span></div>`;
    const main=def.view==='keys'?keyboard(q):def.view==='ear'?`<div class="ear-prompt"><span class="ear-wave"><i></i><i></i><i></i><i></i><i></i></span><strong>LISTEN</strong><small>音だけで判定</small></div>${game.reveal?notePair:''}`:notePair;
    const feedbackBanner=game.feedbackType?`<div class="v205-a-feedback-banner ${game.feedbackType}"><span>${game.feedbackType==='correct'?'✓':'✕'}</span><div><strong>${game.feedbackType==='correct'?'CORRECT':'WRONG'}</strong><small>${game.feedbackType==='correct'?IV[q.intervalKey].jp:`正解：${IV[q.intervalKey].jp}`}</small></div></div>`:'';
    overlay().innerHTML=`<section class="v205-a-game ${def.hyper?'hyper':''} ${game.feedbackType?`feedback-${game.feedbackType}`:''}">
      <header class="play-hud"><div class="hud-left"><span class="mode-mini">ASSIGNMENT</span><small>${esc(currentAssignment.title)}</small></div><div class="hud-center"><div class="v205-a-timer">${Math.ceil(remain)}</div></div><div class="hud-right">${def.hyper?`<div class="metric combo"><span class="metric-label">COMBO</span><span class="metric-value">${game.combo}</span></div>`:''}<div class="metric"><span class="metric-label">SCORE</span><span class="metric-value">${fmt(game.score)}</span></div></div></header>
      <section class="question-zone"><div class="question-card glass"><p class="question-label">${def.view==='ear'?'AUDIO IDENTIFICATION':'INTERVAL IDENTIFICATION'}</p>${main}${feedbackBanner}<div class="sound-controls"><button class="secondary-btn" data-a-replay>▶ REPLAY</button></div></div></section>
      <section class="answer-area">${answerGrid()}</section><footer class="v205-a-game-foot"><div>${game.feedback||`${esc(def.label)} ・ ${esc(intervalText(currentAssignment))}`}</div><button class="secondary-btn danger" data-a-abort>課題を中断</button></footer>
    </section>`;
  }
  function gameTick(){if(!game||game.finished)return;if(Date.now()>=game.wallDeadline){finishGame();return}const t=document.querySelector('.v205-a-timer');if(t)t.textContent=String(Math.ceil((game.wallDeadline-Date.now())/1000));raf=requestAnimationFrame(gameTick)}
  async function startGame(a){
    const st=statusOf(a);if(st!=='active')return openAssignments();currentAssignment=a;const def=MODE_MAP[a.mode];if(!def)return alert('未対応モードです。');const keys=(a.interval_keys||[]).filter(k=>IV[k]);if(!keys.length)keys.push(...INTERVALS.map(x=>x.key));audio ||= new AssignmentAudio();try{await audio.unlock()}catch{}
    game={def,keys,score:0,combo:0,maxCombo:0,total:0,correct:0,response:[],previous:null,locked:true,reveal:false,flash:null,feedback:'',feedbackType:null,chosenKey:null,finished:false,labelSymbol:Math.random()<.5,wallDeadline:Date.now()+def.duration*1000,question:null,questionAt:0};
    let c=3;overlay().innerHTML=`<div class="v205-a-countdown"><small>${esc(a.title)}</small><strong id="v205ACount">3</strong></div>`;
    const tick=()=>{const el=document.querySelector('#v205ACount');if(!game)return;if(c>0){if(el)el.textContent=String(c--);setTimeout(tick,650)}else{if(el)el.textContent='START';setTimeout(()=>{if(!game)return;game.locked=false;game.question=makeQuestion(keys,null);game.questionAt=performance.now();renderGame();audio.play(game.question).catch(()=>{});gameTick()},450)}};tick();
  }
  function answer(k){
    if(!game||game.finished||game.locked||!game.question)return;const q=game.question,ms=Math.max(80,performance.now()-game.questionAt),sec=ms/1000,ok=k===q.intervalKey,delta=calcPoints(sec,ok,ok?game.combo:0);
    game.total++;if(ok)game.correct++;game.combo=ok?game.combo+1:0;game.maxCombo=Math.max(game.maxCombo,game.combo);game.response.push(sec);game.score=Math.max(-9999,game.score+delta);updateMastery(q.intervalKey,k,ok,ms);if(game.def.hyper&&ok&&game.combo>0&&game.combo%10===0)game.wallDeadline+=3000;
    game.flash={key:k,type:ok?'correct':'wrong'};game.chosenKey=k;game.feedbackType=ok?'correct':'wrong';game.feedback=ok?`<strong class="ok">✓ CORRECT</strong>　${IV[q.intervalKey].jp}　${sec.toFixed(2)}s`:`<strong class="ng">✕ ${IV[k].jp}</strong>　→　正解 <strong class="ok">${IV[q.intervalKey].jp}</strong>`;game.locked=true;game.reveal=true;renderGame();if(!ok)audio.play(q).catch(()=>{});
    setTimeout(()=>{if(!game||game.finished)return;game.previous=q.intervalKey;game.question=makeQuestion(game.keys,game.previous);game.questionAt=performance.now();game.locked=false;game.reveal=false;game.flash=null;game.feedback='';game.feedbackType=null;game.chosenKey=null;game.labelSymbol=Math.random()<.5;renderGame();audio.play(game.question).catch(()=>{})},ok?620:1050);
  }
  async function finishGame(){
    if(!game||game.finished)return;game.finished=true;cancelAnimationFrame(raf);audio?.stop?.();const score=finalScore(),acc=accuracy(game.correct,game.total),avg=game.response.length?game.response.reduce((a,b)=>a+b,0)/game.response.length:0;
    overlay().innerHTML=`<section class="v205-assignment-panel result">${head('ASSIGNMENT','SUBMITTING',currentAssignment.title)}<div class="v205-a-loading"><span class="spinner"></span><strong>最高記録を更新しています…</strong></div></section>`;
    try{const result=await cloud.submitScore({source:'assignment',assignmentId:currentAssignment.id,mode:currentAssignment.mode,score,totalAnswers:game.total,correctAnswers:game.correct,maxCombo:game.maxCombo,avgResponse:avg});if(result?.queued){overlay().innerHTML=`<section class="v205-assignment-panel result">${head('ASSIGNMENT','端末に保存しました',currentAssignment.title)}<div class="v205-a-current"><strong>${fmt(score)}</strong><span>正答率 ${acc}%</span></div><p>接続後に再送します。達成状況は送信完了後に更新されます。「保存・同期」で確認できます。</p><button class="secondary-btn" data-a-back>課題一覧</button></section>`;return}const st=await rpc('get_my_assignment_status',{p_assignment_id:currentAssignment.id});renderAssignmentResult(score,acc,st)}
    catch(e){console.error('[assignment submit]',e);overlay().innerHTML=`<section class="v205-assignment-panel result">${head('ASSIGNMENT','送信エラー',currentAssignment.title)}<div class="v205-a-empty">${esc(e?.message||'記録を保存できませんでした。')}</div><div class="v205-a-form-actions"><button class="secondary-btn" data-a-back>課題一覧</button></div></section>`}
  }
  function renderAssignmentResult(score,acc,st){
    const achieved=Boolean(st?.achieved);
    overlay().innerHTML=`<section class="v205-assignment-panel result">${head('ASSIGNMENT COMPLETE',achieved?'TARGET ACHIEVED':'RESULT SAVED',currentAssignment.title)}
      <div class="v205-a-current"><small>THIS RUN</small><strong>${fmt(score)}</strong><span>正答率 ${acc}%　MAX COMBO ${game.maxCombo}</span></div>
      <div class="v205-a-best result"><div><small>BEST SCORE</small><strong>${st?.best_score==null?'—':fmt(st.best_score)}</strong></div><div><small>BEST ACC.</small><strong>${st?.best_accuracy==null?'—':`${Number(st.best_accuracy).toFixed(1).replace('.0','')}%`}</strong></div><div><small>ATTEMPTS</small><strong>${Number(st?.attempts||0)}</strong></div></div>
      <div class="v205-a-target ${achieved?'done':''}"><strong>${achieved?'✓ 課題目標を達成しました':'目標：'+targetText(currentAssignment)}</strong><span>何度でも挑戦可能。最高スコアの記録が採用されます。</span></div>
      <div class="v205-a-form-actions"><button class="primary-btn" data-a-retry>RETRY</button><button class="secondary-btn" data-a-back>ASSIGNMENTS</button></div></section>`;
  }

  function inject(){
    const footer=document.querySelector('.home-footer'),p=cloud?.getCachedPlayer?.();
    if(!footer||!p||p.is_guest||footer.querySelector('[data-a-open]'))return;
    const b=document.createElement('button');b.type='button';b.className='secondary-btn v205-assignment-launch';b.dataset.aOpen='1';b.innerHTML=p.account_type==='staff'?'▣ TEACHER ASSIGNMENTS':'▣ ASSIGNMENTS';footer.prepend(b);
  }
  function schedule(){if(injectQueued)return;injectQueued=true;queueMicrotask(()=>{injectQueued=false;inject()})}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('DOMContentLoaded',schedule,{once:true});
  window.addEventListener('click',e=>{
    if(e.target.closest?.('[data-a-open]')){openAssignments();return}if(e.target.closest?.('[data-a-close]')){closeOverlay();return}if(e.target.closest?.('[data-a-refresh]')){openAssignments();return}if(e.target.closest?.('[data-a-new]')){createForm();return}if(e.target.closest?.('[data-a-back]')){openAssignments();return}if(e.target.closest?.('[data-a-back-teacher]')){renderTeacher();return}
    const play=e.target.closest?.('[data-a-play]');if(play){const a=currentList.find(x=>x.id===play.dataset.aPlay);if(a)startGame(a);return}const pub=e.target.closest?.('[data-a-publish]');if(pub){togglePublish(pub.dataset.aPublish,pub.dataset.published==='1');return}const res=e.target.closest?.('[data-a-results]');if(res){showResults(res.dataset.aResults);return}const chip=e.target.closest?.('[data-a-interval]');if(chip){chip.classList.toggle('selected');return}
    if(e.target.closest?.('[data-a-iall]')){document.querySelectorAll('[data-a-interval]').forEach(x=>x.classList.add('selected'));return}if(e.target.closest?.('[data-a-icore]')){const core=new Set(['m3','M3','P4','TT','P5','m6','M6']);document.querySelectorAll('[data-a-interval]').forEach(x=>x.classList.toggle('selected',core.has(x.dataset.aInterval)));return}
    const ans=e.target.closest?.('[data-a-answer]');if(ans){audio?.unlock?.().catch(()=>{});answer(ans.dataset.aAnswer);return}if(e.target.closest?.('[data-a-replay]')){audio?.play?.(game?.question).catch(()=>{});return}if(e.target.closest?.('[data-a-abort]')){if(confirm('この挑戦を中断しますか？ 中断した記録は提出されません。'))openAssignments();return}if(e.target.closest?.('[data-a-retry]')){const a=currentAssignment;startGame(a);return}
  },true);
  window.addEventListener('submit',e=>{if(e.target.id==='v205AssignmentCreate'){e.preventDefault();submitCreate(e.target)}},true);
  window.addEventListener('keydown',e=>{if(!document.querySelector('.v205-assignment-overlay'))return;if(e.key==='Escape'&&!game){e.preventDefault();closeOverlay();return}if(game&&!game.finished&&!game.locked){const keys=['1','2','3','4','5','6','7','8','9','0','q','w','e'],i=keys.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();answer(INTERVALS[i].key)}if(e.code==='Space'){e.preventDefault();audio?.play?.(game.question).catch(()=>{})}}},true);
  window.addEventListener('visibilitychange',()=>{if(game&&!game.finished&&document.visibilityState==='visible'&&Date.now()>=game.wallDeadline)finishGame()});

  window.IntervalCosmosAssignmentsV205={open:openAssignments,refresh:openAssignments,startGame};
})();
