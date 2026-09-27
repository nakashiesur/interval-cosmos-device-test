(() => {
  const cloud = window.IntervalCosmosCloud;
  const MODE_LABELS = Object.freeze({
    TEXT:'TEXT', KEYS:'KEYS', HD_TEXT:'HD TEXT', HD_KEYS:'HD KEYS', EAR_LINK:'EAR LINK',
  });
  const INTERVAL_ORDER = ['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7','P8'];
  const INTERVAL_NAMES = Object.freeze({
    P1:'完全1度',m2:'短2度',M2:'長2度',m3:'短3度',M3:'長3度',P4:'完全4度',TT:'三全音',P5:'完全5度',m6:'短6度',M6:'長6度',m7:'短7度',M7:'長7度',P8:'完全8度',
  });
  let client = null;
  let overview = null;
  let filter = { search:'', course:'all' };
  let injectQueued = false;
  let opening = false;

  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nfmt = v => Math.round(Number(v || 0)).toLocaleString('ja-JP');
  const pct = (correct,total) => Number(total||0) ? Math.round(Number(correct||0) * 1000 / Number(total)) / 10 : 0;
  const dateText = value => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  };
  const dayText = value => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}).format(d);
  };

  async function ensureClient(){
    if (client) return client;
    await cloud?.init?.();
    client = window.IntervalCosmosSupabaseSingleton?.getClient?.() || null;
    if (!client) throw new Error('オンライン接続を初期化できませんでした。');
    return client;
  }
  async function rpc(name,args={}){
    const c = await ensureClient();
    const {data,error} = await c.rpc(name,args);
    if (error) throw error;
    return data;
  }
  function isAdmin(){ return Boolean(cloud?.getCachedPlayer?.()?.is_admin); }

  function overlay(){
    let node = document.querySelector('.v205-admin-dashboard-overlay');
    if (!node){
      node = document.createElement('div');
      node.className = 'v205-admin-dashboard-overlay';
      document.body.appendChild(node);
    }
    return node;
  }
  function close(){ document.querySelector('.v205-admin-dashboard-overlay')?.remove(); }
  function closeButton(){ return '<button type="button" class="icon-btn v205-admin-close" data-v205-admin-close>×</button>'; }
  function loading(label='学生データを集計しています'){
    overlay().innerHTML = `<section class="v205-admin-dashboard"><div class="v205-admin-loading"><div><span class="spinner"></span><strong>${esc(label)}</strong></div></div></section>`;
  }
  function errorView(error){
    overlay().innerHTML = `<section class="v205-admin-dashboard"><div class="v205-admin-head"><div><p>ADMIN DASHBOARD</p><h2>読み込めませんでした</h2><span>${esc(error?.message||'データ取得に失敗しました。')}</span></div>${closeButton()}</div></section>`;
  }

  function summaryCard(label,value,note=''){
    return `<article class="v205-admin-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</article>`;
  }
  function assignmentProgress(row){
    const total = Number(row.active_assignments||0), done = Number(row.active_assignments_achieved||0);
    const ratio = total ? Math.min(100,Math.round(done/total*100)) : 0;
    return `<div class="metric"><small>ACTIVE TASKS</small><b>${done}/${total}</b><div class="v205-admin-progress"><i style="width:${ratio}%"></i></div></div>`;
  }
  function studentRow(row){
    return `<button type="button" class="v205-admin-student" data-v205-admin-student="${esc(row.player_id)}" data-course="${esc(row.course_code||'')}">
      <div class="identity"><strong>${esc(row.student_number||'—')}　${esc(row.player_name||'PLAYER')}</strong><small>${esc(row.course_name||row.course_code||'所属未設定')}</small></div>
      <div class="metric"><small>30D PLAY</small><b>${Number(row.sessions_30d||0)}</b></div>
      <div class="metric"><small>30D ACC.</small><b>${pct(row.correct_30d,row.answers_30d)}%</b></div>
      <div class="metric"><small>ALL PLAY</small><b>${Number(row.sessions_all||0)}</b></div>
      <div class="metric"><small>LAST ACTIVE</small><b>${esc(dateText(row.last_play_at))}</b></div>
      ${assignmentProgress(row)}
    </button>`;
  }
  function filteredStudents(){
    const rows = Array.isArray(overview?.students) ? overview.students : [];
    const q = filter.search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter.course !== 'all' && r.course_code !== filter.course) return false;
      if (!q) return true;
      return [r.student_number,r.player_name,r.course_name,r.course_code].some(v=>String(v||'').toLowerCase().includes(q));
    });
  }
  function renderStudentListOnly(){
    const holder = document.querySelector('.v205-admin-students');
    if (!holder) return;
    const rows = filteredStudents();
    holder.innerHTML = rows.length ? rows.map(studentRow).join('') : '<div class="v205-admin-empty">条件に一致する学生はいません。</div>';
    const count = document.querySelector('[data-v205-admin-visible-count]');
    if (count) count.textContent = `${rows.length} students`;
  }
  function renderOverview(data){
    overview = data || {summary:{},students:[]};
    const s = overview.summary || {};
    const rows = Array.isArray(overview.students) ? overview.students : [];
    const courses = [...new Map(rows.filter(r=>r.course_code).map(r=>[r.course_code,r.course_name||r.course_code])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'ja'));
    const allAcc = pct(s.correct_all,s.answers_all), acc30 = pct(s.correct_30d,s.answers_30d);
    overlay().innerHTML = `<section class="v205-admin-dashboard">
      <header class="v205-admin-head"><div><p>ADMIN CONTROL</p><h2>LEARNING DASHBOARD</h2><span>全学生の学習状況を俯瞰します。</span></div>${closeButton()}</header>
      <div class="v205-admin-summary">
        ${summaryCard('STUDENTS',nfmt(s.students),'登録学生')}
        ${summaryCard('ACTIVE 30D',nfmt(s.active_30d),'直近30日')}
        ${summaryCard('PLAY SESSIONS',`${nfmt(s.sessions_30d)} / ${nfmt(s.sessions_all)}`,'30日 / 全期間')}
        ${summaryCard('ACCURACY',`${acc30}% / ${allAcc}%`,'30日 / 全期間')}
        ${summaryCard('ACTIVE ASSIGNMENTS',nfmt(s.active_assignments),'現在受付中')}
      </div>
      <div class="v205-admin-toolbar">
        <input type="search" id="v205AdminSearch" value="${esc(filter.search)}" placeholder="学籍番号・名前・コースで検索">
        <select id="v205AdminCourse"><option value="all">全コース</option>${courses.map(([code,name])=>`<option value="${esc(code)}" ${filter.course===code?'selected':''}>${esc(name)}</option>`).join('')}</select>
        <button type="button" class="secondary-btn" data-v205-admin-refresh>↻ 更新</button>
      </div>
      <div class="v205-admin-section-title"><div><h3>STUDENTS</h3><span data-v205-admin-visible-count>${rows.length} students</span></div></div>
      <div class="v205-admin-table-head"><span>STUDENT</span><span>30D PLAY</span><span>30D ACC.</span><span>ALL PLAY</span><span>LAST ACTIVE</span><span>ACTIVE TASKS</span></div>
      <div class="v205-admin-students">${rows.length?rows.map(studentRow).join(''):'<div class="v205-admin-empty">学生アカウントはまだありません。</div>'}</div>
    </section>`;
  }

  function modeCard(row){
    return `<article class="v205-admin-mode"><span>${esc(MODE_LABELS[row.mode]||row.mode)}</span><strong>${Number(row.sessions_30d||0)}<small> / ${Number(row.sessions_all||0)}</small></strong><div><span>ACC. 30D</span><b>${pct(row.correct_30d,row.answers_30d)}%</b></div><div><span>ACC. ALL</span><b>${pct(row.correct_all,row.answers_all)}%</b></div><div><span>BEST</span><b>${nfmt(row.best_score)}</b></div><div><span>MAX COMBO</span><b>${Number(row.max_combo||0)}</b></div></article>`;
  }
  function activityChart(rows){
    const data = Array.isArray(rows)?rows:[];
    const max = Math.max(1,...data.map(r=>Number(r.sessions||0)));
    return `<div class="v205-admin-activity">${data.map((r,i)=>{
      const h = Number(r.sessions||0) ? Math.max(8,Math.round(Number(r.sessions||0)/max*100)) : 2;
      return `<div class="v205-admin-day" title="${esc(r.day)}: ${Number(r.sessions||0)} play"><i style="height:${h}%"></i><span>${i%5===0?esc(dayText(r.day)):''}</span></div>`;
    }).join('')}</div>`;
  }
  function hourChart(rows){
    const data=Array.isArray(rows)?rows:[];
    const max=Math.max(1,...data.map(r=>Number(r.sessions||0)));
    return `<div class="v205-admin-hours">${data.map(r=>{
      const h=Number(r.sessions||0)?Math.max(8,Math.round(Number(r.sessions||0)/max*100)):2;
      return `<div class="v205-admin-hour" title="${r.hour}時: ${Number(r.sessions||0)} play"><i style="height:${h}%"></i><span>${Number(r.hour)%3===0?r.hour:''}</span></div>`;
    }).join('')}</div>`;
  }
  function intervalGrid(snapshot){
    const rows = snapshot?.intervals && typeof snapshot.intervals==='object' ? snapshot.intervals : {};
    return `<div class="v205-admin-interval-grid">${INTERVAL_ORDER.map(key=>{
      const r=rows[key]||{},seen=Number(r.seen||0),correct=Number(r.correct||0),a=seen?Math.round(correct/seen*100):0;
      const level=!seen?'':a>=90?'good':a>=75?'mid':'low';
      return `<div class="v205-admin-interval ${level}" title="${esc(INTERVAL_NAMES[key])}"><strong>${key}</strong><b>${seen?`${a}%`:'—'}</b><small>${seen} answers</small></div>`;
    }).join('')}</div>`;
  }
  function assignmentRow(a){
    const now=Date.now(),start=new Date(a.start_at).getTime(),end=new Date(a.deadline_at).getTime();
    const state=a.achieved?'ACHIEVED':Number(a.attempts||0)>0?'IN PROGRESS':now<start?'UPCOMING':now>end?'CLOSED':'NOT STARTED';
    const cls=a.achieved?'done':'pending';
    const modes=(a.allowed_modes||[]).map(m=>MODE_LABELS[m]||m).join(' / ');
    return `<div class="v205-admin-assignment"><div><strong>${esc(a.title)}</strong><span>${esc(modes||'—')}</span></div><div><span>ATTEMPTS</span><strong>${Number(a.attempts||0)}</strong></div><div><span>BEST</span><strong>${a.best_score==null?'—':nfmt(a.best_score)} / ${a.best_accuracy==null?'—':`${Number(a.best_accuracy).toFixed(1).replace('.0','')}%`}</strong></div><div class="${cls}"><strong>${state}</strong><span>${esc(dateText(a.deadline_at))}</span></div></div>`;
  }
  function sessionRow(r){
    const a=pct(r.correct_answers,r.total_answers);
    return `<div class="v205-admin-session"><strong>${esc(MODE_LABELS[r.mode]||r.mode)}</strong><span>${esc(String(r.source||'').toUpperCase())}</span><strong>${nfmt(r.score)}</strong><span>${a}%</span><span>MAX ${Number(r.max_combo||0)}</span><span>${esc(dateText(r.played_at))}</span></div>`;
  }
  function renderStudentDetail(data){
    const st=data?.student||{},s=data?.summary||{},modes=Array.isArray(data?.modes)?data.modes:[];
    const assignments=Array.isArray(data?.assignments)?data.assignments:[],recent=Array.isArray(data?.recent_sessions)?data.recent_sessions:[];
    overlay().innerHTML=`<section class="v205-admin-dashboard">
      <button type="button" class="secondary-btn v205-admin-back" data-v205-admin-back>← STUDENTS</button>
      <header class="v205-admin-head"><div class="idbox"><p>STUDENT DETAIL</p><h2>${esc(st.student_number||'—')}　${esc(st.player_name||'PLAYER')}</h2><span class="meta">${esc(st.course_name||st.course_code||'所属未設定')}　/　登録 ${esc(dayText(st.created_at))}</span></div>${closeButton()}</header>
      <div class="v205-admin-summary">
        ${summaryCard('PLAY SESSIONS',`${nfmt(s.sessions_30d)} / ${nfmt(s.sessions_all)}`,'30日 / 全期間')}
        ${summaryCard('ACCURACY',`${pct(s.correct_30d,s.answers_30d)}% / ${pct(s.correct_all,s.answers_all)}%`,'30日 / 全期間')}
        ${summaryCard('BEST SCORE',nfmt(s.best_score),'全モード')}
        ${summaryCard('MAX COMBO',nfmt(s.max_combo),'全期間')}
        ${summaryCard('LAST ACTIVE',dateText(s.last_play_at),'最終プレイ')}
      </div>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>MODE ANALYSIS</h3><span>30日 / 全期間</span></div></div><div class="v205-admin-mode-grid">${modes.length?modes.map(modeCard).join(''):'<div class="v205-admin-empty">プレイ履歴がありません。</div>'}</div></section>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>30 DAY ACTIVITY</h3><span>日別プレイ数</span></div></div>${activityChart(data?.daily_30d)}</section>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>PLAY HOURS</h3><span>直近30日・日本時間</span></div></div>${hourChart(data?.hours_30d)}</section>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>INTERVAL SNAPSHOT</h3><span>最新の習熟スナップショット</span></div></div>${intervalGrid(data?.interval_snapshot)}<p class="v205-admin-note">音程別の値は最新の端末スナップショットです。複数端末の回答を完全合算したサーバー集計ではありません。</p></section>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>ASSIGNMENTS</h3><span>公開課題と挑戦履歴</span></div></div><div class="v205-admin-assignment-list">${assignments.length?assignments.map(assignmentRow).join(''):'<div class="v205-admin-empty">課題データがありません。</div>'}</div></section>
      <section class="v205-admin-section"><div class="v205-admin-section-title"><div><h3>RECENT SESSIONS</h3><span>最近20件</span></div></div><div class="v205-admin-recent">${recent.length?recent.map(sessionRow).join(''):'<div class="v205-admin-empty">プレイ履歴がありません。</div>'}</div></section>
    </section>`;
  }

  async function openDashboard(force=false){
    if (opening) return;
    if (!isAdmin()) return;
    opening=true;
    loading();
    try{
      if (!overview || force) overview=await rpc('get_admin_dashboard_overview');
      renderOverview(overview);
    }catch(error){console.error('[admin dashboard]',error);errorView(error)}finally{opening=false}
  }
  async function openStudent(playerId){
    if (!isAdmin() || !playerId) return;
    loading('学生の詳細データを集計しています');
    try{renderStudentDetail(await rpc('get_admin_student_dashboard',{p_player_id:playerId}))}
    catch(error){console.error('[admin student dashboard]',error);errorView(error)}
  }

  function inject(){
    const footer=document.querySelector('.home-footer');
    const p=cloud?.getCachedPlayer?.();
    // The admin home dock moves this button outside .home-footer. Check the whole document
    // so moving it cannot trigger an inject -> move -> inject MutationObserver loop.
    if(!footer||!p?.is_admin||document.querySelector('[data-v205-admin-dashboard-open]'))return;
    const b=document.createElement('button');
    b.type='button';b.className='secondary-btn v205-admin-launch';b.dataset.v205AdminDashboardOpen='1';b.textContent='◫ ADMIN DASHBOARD';
    footer.prepend(b);
  }
  function scheduleInject(){
    if(injectQueued)return;injectQueued=true;queueMicrotask(()=>{injectQueued=false;inject()});
  }

  window.addEventListener('click',event=>{
    if(event.target.closest?.('[data-v205-admin-dashboard-open]')){openDashboard();return}
    if(event.target.closest?.('[data-v205-admin-close]')){close();return}
    if(event.target.closest?.('[data-v205-admin-refresh]')){openDashboard(true);return}
    if(event.target.closest?.('[data-v205-admin-back]')){renderOverview(overview);return}
    const student=event.target.closest?.('[data-v205-admin-student]');
    if(student){openStudent(student.dataset.v205AdminStudent);return}
  },true);
  window.addEventListener('input',event=>{
    if(event.target.id!=='v205AdminSearch')return;
    filter.search=event.target.value||'';renderStudentListOnly();
  },true);
  window.addEventListener('change',event=>{
    if(event.target.id!=='v205AdminCourse')return;
    filter.course=event.target.value||'all';renderStudentListOnly();
  },true);
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.querySelector('.v205-admin-dashboard-overlay')){event.preventDefault();close()}
  },true);
  new MutationObserver(scheduleInject).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('DOMContentLoaded',scheduleInject,{once:true});

  window.IntervalCosmosAdminDashboardV205={open:openDashboard,openStudent};
})();
