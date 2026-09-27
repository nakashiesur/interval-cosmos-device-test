(() => {
  const cloud = window.IntervalCosmosCloud;
  const MODE_MAP = Object.freeze({
    TEXT:{label:'STANDARD / TEXT',short:'TEXT',family:'standard'},
    KEYS:{label:'STANDARD / KEYS',short:'KEYS',family:'standard'},
    HD_TEXT:{label:'HYPER DRIVE / TEXT',short:'HD TEXT',family:'hyper'},
    HD_KEYS:{label:'HYPER DRIVE / KEYS',short:'HD KEYS',family:'hyper'},
    EAR_LINK:{label:'EAR LINK',short:'EAR LINK',family:'standard'},
  });
  const CORE7 = new Set(['m3','M3','P4','TT','P5','m6','M6']);
  const INTERVALS = [
    ['P1','完全1度'],['m2','短2度'],['M2','長2度'],['m3','短3度'],['M3','長3度'],
    ['P4','完全4度'],['TT','三全音'],['P5','完全5度'],['m6','短6度'],['M6','長6度'],
    ['m7','短7度'],['M7','長7度'],['P8','完全8度'],
  ];
  let client = null;
  let lastSubmission = null;
  let lastResultsAssignmentId = null;
  let enhanceQueued = false;
  let enhanceBusy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
  const fmt = value => Math.round(Number(value || 0)).toLocaleString('ja-JP');
  const nowIsoLocal = (d = new Date()) => {
    const z = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  };
  const allowedModes = a => {
    const rows = Array.isArray(a?.allowed_modes) && a.allowed_modes.length ? a.allowed_modes : [a?.mode];
    return [...new Set(rows.filter(m => MODE_MAP[m]))];
  };
  const modeBest = (a, mode) => (Array.isArray(a?.mode_bests) ? a.mode_bests : []).find(x => x.mode === mode) || null;
  const mixedScoreFamilies = modes => {
    const f = new Set(modes.map(m => MODE_MAP[m]?.family).filter(Boolean));
    return f.size > 1;
  };

  async function ensureClient() {
    if (client) return client;
    await cloud?.init?.();
    client = window.IntervalCosmosSupabaseSingleton?.getClient?.() || null;
    if (!client) throw new Error('オンライン接続を初期化できませんでした。');
    return client;
  }
  async function rpc(name, args = {}) {
    const c = await ensureClient();
    const { data, error } = await c.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function eventId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function assignmentOverlay() {
    let n = document.querySelector('.v205-assignment-overlay');
    if (!n) {
      n = document.createElement('div');
      n.className = 'v205-assignment-overlay';
      document.body.appendChild(n);
    }
    return n;
  }
  function head(kicker, title, sub = '') {
    return `<header class="v205-assignment-head"><div><p>${esc(kicker)}</p><h2>${esc(title)}</h2>${sub?`<span>${esc(sub)}</span>`:''}</div><button class="icon-btn" data-a-close>×</button></header>`;
  }
  function routeBack() {
    if (window.IntervalCosmosAssignmentAdminPolicyV205?.openWithAdminPolicy) {
      window.IntervalCosmosAssignmentAdminPolicyV205.openWithAdminPolicy();
    } else {
      window.IntervalCosmosAssignmentsV205?.open?.();
    }
  }

  if (cloud?.submitScore && !cloud.__v205AssignmentMultiModeSubmitWrapped) {
    const originalSubmit = cloud.submitScore.bind(cloud);
    cloud.submitScore = async payload => {
      if (payload?.source !== 'assignment') return originalSubmit(payload);

      const clientEventId = payload.clientEventId || eventId();
      const playedAt = payload.playedAt || new Date().toISOString();
      const result = await originalSubmit({...payload, clientEventId, playedAt});
      lastSubmission = { ...(result || {}), client_event_id: clientEventId, played_at: playedAt };
      window.IntervalCosmosAssignmentMultiModeV205.lastSubmission = lastSubmission;
      if (!result?.queued) try { window.IntervalCosmosProgressV205?.evaluate?.(); } catch {}
      scheduleEnhance();
      return {
        ...(result || {}),
        guest: false,
        publication_required: false,
        monthly_rank: null,
        hall_rank: null,
        monthly_best_improved: false,
        hall_best_improved: false,
        client_event_id: clientEventId,
        played_at: playedAt,
      };
    };
    cloud.__v205AssignmentMultiModeSubmitWrapped = true;
  }

  function renderCreateForm() {
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 86400000);
    assignmentOverlay().innerHTML = `<section class="v205-assignment-panel form v205-a-v2-form">
      ${head('ADMIN CONTROL','NEW ASSIGNMENT','許可したモードの中から学生が挑戦方法を選べます')}
      <form id="v205AssignmentCreateV2" class="v205-a-form">
        <label><span>課題名</span><input id="aTitleV2" maxlength="80" required placeholder="例：第1回 音程トレーニング"></label>
        <label><span>説明</span><textarea id="aDescV2" maxlength="500" rows="3" placeholder="学生への補足（任意）"></textarea></label>
        <fieldset><legend>許可するモード <small>複数選択可／学生が選択</small></legend>
          <div class="v205-a-mode-grid">${Object.entries(MODE_MAP).map(([id,m],i)=>`<button type="button" class="v205-a-mode-option ${i===0?'selected':''}" data-a-mode-option="${id}"><strong>${esc(m.label)}</strong><small>${m.family==='hyper'?'HYPER SCORE':'STANDARD SCORE'}</small></button>`).join('')}</div>
          <div class="v205-a-score-family-note" id="aScoreFamilyNote">同じスコア体系のモード同士なら、共通の目標スコアを設定できます。</div>
        </fieldset>
        <fieldset><legend>出題音程 <small>1つ以上</small></legend><div class="v205-a-intervals">${INTERVALS.map(([id,jp])=>`<button type="button" class="v205-a-chip selected" data-a-interval="${id}">${id}<small>${jp}</small></button>`).join('')}</div><div class="v205-a-mini-actions"><button type="button" class="secondary-btn" data-a-iall>ALL</button><button type="button" class="secondary-btn" data-a-icore>CORE 7</button></div></fieldset>
        <div class="v205-a-two"><label><span>開始</span><input id="aStartV2" type="datetime-local" value="${nowIsoLocal(start)}" required></label><label><span>期限</span><input id="aDeadlineV2" type="datetime-local" value="${nowIsoLocal(end)}" required></label></div>
        <div class="v205-a-two"><label><span>目標スコア <small>任意</small></span><input id="aScoreV2" type="number" min="0" step="1" placeholder="例：1500"></label><label><span>目標正答率 % <small>任意</small></span><input id="aAccuracyV2" type="number" min="0" max="100" step="0.1" placeholder="例：90"></label></div>
        <label class="v205-a-check"><input id="aPublishV2" type="checkbox" checked><span>作成と同時に学生へ公開する</span></label>
        <div id="aFormMsgV2" class="v205-a-message"></div>
        <div class="v205-a-form-actions"><button type="button" class="secondary-btn" data-a-v2-back>戻る</button><button type="submit" class="primary-btn">CREATE</button></div>
      </form>
    </section>`;
  }

  function selectedModesFromForm() {
    return [...document.querySelectorAll('[data-a-mode-option].selected')].map(x => x.dataset.aModeOption).filter(Boolean);
  }
  function updateScoreFamilyUi() {
    const modes = selectedModesFromForm();
    const score = document.querySelector('#aScoreV2');
    const note = document.querySelector('#aScoreFamilyNote');
    if (!score || !note) return;
    const mixed = mixedScoreFamilies(modes);
    score.disabled = mixed;
    if (mixed) {
      score.value = '';
      note.textContent = 'STANDARDとHYPER DRIVEはスコア体系が異なるため、この組み合わせでは共通の目標スコアを設定できません。目標正答率は設定できます。';
      note.classList.add('warn');
    } else {
      note.textContent = '同じスコア体系のモード同士なら、共通の目標スコアを設定できます。';
      note.classList.remove('warn');
    }
  }
  async function submitCreateV2(form) {
    const msg = document.querySelector('#aFormMsgV2');
    const title = document.querySelector('#aTitleV2')?.value.trim() || '';
    const description = document.querySelector('#aDescV2')?.value.trim() || '';
    const modes = selectedModesFromForm();
    const intervals = [...document.querySelectorAll('#v205AssignmentCreateV2 [data-a-interval].selected')].map(x => x.dataset.aInterval);
    const start = document.querySelector('#aStartV2')?.value;
    const deadline = document.querySelector('#aDeadlineV2')?.value;
    const scoreRaw = document.querySelector('#aScoreV2')?.value ?? '';
    const accRaw = document.querySelector('#aAccuracyV2')?.value ?? '';
    const publish = Boolean(document.querySelector('#aPublishV2')?.checked);
    if (!title) return msg && (msg.textContent = '課題名を入力してください。');
    if (!modes.length) return msg && (msg.textContent = 'モードを1つ以上選択してください。');
    if (!intervals.length) return msg && (msg.textContent = '音程を1つ以上選択してください。');
    if (!start || !deadline || new Date(deadline) <= new Date(start)) return msg && (msg.textContent = '開始と期限を確認してください。');
    if (mixedScoreFamilies(modes) && scoreRaw !== '') return msg && (msg.textContent = 'STANDARDとHYPERを混在させる場合、目標スコアは設定できません。');

    const submit = form.querySelector('button[type=submit]');
    submit.disabled = true;
    submit.textContent = 'CREATING...';
    if (msg) msg.textContent = '';
    try {
      await rpc('create_assignment_v2', {
        p_title: title,
        p_description: description,
        p_allowed_modes: modes,
        p_interval_keys: intervals,
        p_start_at: new Date(start).toISOString(),
        p_deadline_at: new Date(deadline).toISOString(),
        p_target_score: scoreRaw === '' ? null : Number(scoreRaw),
        p_target_accuracy: accRaw === '' ? null : Number(accRaw),
        p_publish: publish,
      });
      routeBack();
    } catch (error) {
      console.error('[assignment v2 create]', error);
      if (msg) msg.textContent = error?.message || '課題を作成できませんでした。';
      submit.disabled = false;
      submit.textContent = 'CREATE';
    }
  }

  async function fetchStudentAssignment(id) {
    const rows = await rpc('get_my_assignments');
    return (Array.isArray(rows) ? rows : []).find(a => a.id === id) || null;
  }
  function renderModeChooser(a) {
    const modes = allowedModes(a);
    assignmentOverlay().innerHTML = `<section class="v205-assignment-panel v205-a-mode-select-panel">
      ${head('SELECT MODE','CHOOSE YOUR ROUTE',a.title)}
      <p class="v205-a-mode-select-copy">この課題では複数のモードが許可されています。得意なモード、または練習したいモードを選んで挑戦してください。</p>
      <div class="v205-a-mode-select-grid">${modes.map(mode => {
        const best = modeBest(a,mode);
        return `<button type="button" class="v205-a-mode-route ${best?.achieved?'achieved':''}" data-a-mode-start="${mode}" data-a-assignment-id="${esc(a.id)}">
          <span>${best?.achieved?'ACHIEVED':'AVAILABLE'}</span><strong>${esc(MODE_MAP[mode].label)}</strong>
          <small>${best?`BEST ${fmt(best.best_score)} / ${Number(best.best_accuracy).toFixed(1).replace('.0','')}% / ${best.attempts}回`:'まだ挑戦していません'}</small>
        </button>`;
      }).join('')}</div>
      <div class="v205-a-form-actions"><button type="button" class="secondary-btn" data-a-mode-back>ASSIGNMENTS</button></div>
    </section>`;
  }
  function startWithMode(a, mode) {
    const api = window.IntervalCosmosAssignmentsV205;
    if (!api?.startGame) return alert('課題ゲームをまだ起動できません。再読み込みしてください。');
    api.startGame({ ...a, mode, selected_mode: mode });
  }
  async function handlePlay(id) {
    try {
      const a = await fetchStudentAssignment(id);
      if (!a) throw new Error('課題が見つかりません。');
      const now = Date.now();
      if (now < new Date(a.start_at).getTime() || now > new Date(a.deadline_at).getTime()) {
        return window.IntervalCosmosAssignmentsV205?.open?.();
      }
      const modes = allowedModes(a);
      if (modes.length > 1) renderModeChooser(a);
      else startWithMode(a, modes[0]);
    } catch (error) {
      console.error('[assignment play route]', error);
      alert(error?.message || '課題を開始できませんでした。');
    }
  }

  function modeBestGrid(a) {
    const modes = allowedModes(a);
    return `<div class="v205-a-mode-best-grid">${modes.map(mode => {
      const best = modeBest(a,mode);
      return `<div class="v205-a-mode-best ${best?.achieved?'achieved':''}"><small>${esc(MODE_MAP[mode].short)}</small><strong>${best?fmt(best.best_score):'—'}</strong><span>${best?`${Number(best.best_accuracy).toFixed(1).replace('.0','')}% · ${best.attempts}回`:'未挑戦'}</span></div>`;
    }).join('')}</div>`;
  }
  async function enhanceStudentCards() {
    const panel = document.querySelector('.v205-assignment-panel.student');
    if (!panel) return;
    const rows = await rpc('get_my_assignments');
    const map = new Map((Array.isArray(rows)?rows:[]).map(a=>[a.id,a]));
    panel.querySelectorAll('[data-a-play]').forEach(button => {
      const a = map.get(button.dataset.aPlay);
      const card = button.closest('.v205-a-card');
      if (!a || !card) return;
      const modes = allowedModes(a);
      const sig = `${a.id}:${modes.join(',')}:${JSON.stringify(a.mode_bests||[])}`;
      if (card.dataset.v205MultiSig === sig) return;
      card.dataset.v205MultiSig = sig;
      const top = card.querySelector('.v205-a-card-top span');
      if (top) top.textContent = modes.length > 1 ? `${modes.length} MODES / SELECTABLE` : MODE_MAP[modes[0]]?.label || modes[0];
      card.querySelector('.v205-a-mode-tags')?.remove();
      const tags = document.createElement('div');
      tags.className = 'v205-a-mode-tags';
      tags.innerHTML = modes.map(m=>`<span>${esc(MODE_MAP[m].short)}</span>`).join('');
      card.querySelector('h3')?.insertAdjacentElement('afterend',tags);
      if (modes.length > 1) {
        const best = card.querySelector('.v205-a-best');
        if (best) best.outerHTML = modeBestGrid(a);
      }
    });
  }
  async function enhanceTeacherCards() {
    const panel = document.querySelector('.v205-assignment-panel.teacher');
    if (!panel) return;
    const kicker = panel.querySelector('.v205-assignment-head p');
    if (kicker && kicker.textContent === 'TEACHER CONTROL') kicker.textContent = 'ADMIN CONTROL';
    const rows = await rpc('get_teacher_assignments');
    const map = new Map((Array.isArray(rows)?rows:[]).map(a=>[a.id,a]));
    panel.querySelectorAll('[data-a-results]').forEach(button => {
      const a = map.get(button.dataset.aResults);
      const card = button.closest('.v205-a-card');
      if (!a || !card) return;
      const modes = allowedModes(a);
      const sig = `${a.id}:${modes.join(',')}`;
      if (card.dataset.v205MultiSig === sig) return;
      card.dataset.v205MultiSig = sig;
      const top = card.querySelector('.v205-a-card-top span');
      if (top) top.textContent = modes.length > 1 ? `${modes.length} MODES / STUDENT SELECT` : MODE_MAP[modes[0]]?.label || modes[0];
      card.querySelector('.v205-a-mode-tags')?.remove();
      const tags = document.createElement('div');
      tags.className = 'v205-a-mode-tags';
      tags.innerHTML = modes.map(m=>`<span>${esc(MODE_MAP[m].short)}</span>`).join('');
      card.querySelector('h3')?.insertAdjacentElement('afterend',tags);
    });
  }
  async function enhanceAdminResults() {
    if (!lastResultsAssignmentId) return;
    const container = document.querySelector('.v205-a-results');
    if (!container || container.dataset.v205ModeEnhanced === lastResultsAssignmentId) return;
    const assignments = await rpc('get_teacher_assignments');
    const a = (Array.isArray(assignments)?assignments:[]).find(x=>x.id===lastResultsAssignmentId);
    if (!a || allowedModes(a).length < 2) return;
    const rows = await rpc('get_assignment_results',{p_assignment_id:lastResultsAssignmentId});
    const domRows = [...container.querySelectorAll('.v205-a-result-row')];
    (Array.isArray(rows)?rows:[]).forEach((r,i) => {
      const node = domRows[i];
      if (!node) return;
      const detail = document.createElement('div');
      detail.className = 'v205-a-result-mode-bests';
      detail.innerHTML = allowedModes(a).map(mode => {
        const mb = (r.mode_bests||[]).find(x=>x.mode===mode);
        return `<span class="${mb?.achieved?'achieved':''}"><b>${esc(MODE_MAP[mode].short)}</b>${mb?`${fmt(mb.best_score)} / ${Number(mb.best_accuracy).toFixed(1).replace('.0','')}% / ${mb.attempts}回`:'未挑戦'}</span>`;
      }).join('');
      node.appendChild(detail);
    });
    container.dataset.v205ModeEnhanced = lastResultsAssignmentId;
  }
  function correctResultState() {
    if (!lastSubmission) return;
    const panel = document.querySelector('.v205-assignment-panel.result');
    if (!panel || !panel.querySelector('.v205-a-current')) return;
    const thisRun = Boolean(lastSubmission.this_run_achieved);
    const overall = Boolean(lastSubmission.achieved);
    const playedMode = lastSubmission.played_mode;
    const mb = (lastSubmission.mode_bests||[]).find(x=>x.mode===playedMode);
    const signature = `${lastSubmission.session_id}:${thisRun}:${overall}:${playedMode||''}:${mb?.best_score??''}:${mb?.attempts??''}`;
    if (panel.dataset.v205ResultCorrected === signature) return;

    const title = panel.querySelector('.v205-assignment-head h2');
    const kicker = panel.querySelector('.v205-assignment-head p');
    const target = panel.querySelector('.v205-a-target');
    const strong = target?.querySelector('strong');
    const span = target?.querySelector('span');
    const runLabel = panel.querySelector('.v205-a-current small');
    if (runLabel && playedMode) runLabel.textContent = `THIS RUN · ${MODE_MAP[playedMode]?.short || playedMode}`;
    const best = panel.querySelector('.v205-a-best.result');
    if (best && mb) {
      best.innerHTML = `<div><small>MODE BEST SCORE</small><strong>${fmt(mb.best_score)}</strong></div><div><small>MODE BEST ACC.</small><strong>${Number(mb.best_accuracy).toFixed(1).replace('.0','')}%</strong></div><div><small>MODE ATTEMPTS</small><strong>${Number(mb.attempts||0)}</strong></div>`;
    }

    if (kicker) kicker.textContent = 'ASSIGNMENT COMPLETE';
    if (thisRun) {
      if (title) title.textContent = 'TARGET ACHIEVED';
      target?.classList.add('done');
      if (strong) strong.textContent = '✓ 今回の挑戦で課題目標を達成しました';
      if (span) span.textContent = '何度でも挑戦可能。各モードごとに最高スコアが保存されます。';
    } else if (overall) {
      if (title) title.textContent = 'TARGET ALREADY ACHIEVED';
      target?.classList.add('done');
      if (strong) strong.textContent = '✓ 課題はすでに達成済みです';
      if (span) span.textContent = '今回の記録は目標未達でした。これまでのBEST記録は維持されています。';
    } else {
      if (title) title.textContent = 'TARGET NOT REACHED';
      target?.classList.remove('done');
      if (strong) strong.textContent = '今回は目標未達でした';
      if (span) span.textContent = '何度でも挑戦できます。条件を満たす記録を目指してください。';
    }
    panel.dataset.v205ResultCorrected = signature;
  }

  async function enhance() {
    if (enhanceBusy) return;
    enhanceBusy = true;
    try {
      correctResultState();
      await enhanceStudentCards();
      await enhanceTeacherCards();
      await enhanceAdminResults();
    } catch (error) {
      if (!/function|relation|column|does not exist/i.test(String(error?.message||''))) console.warn('[assignment multimode enhance]',error);
    } finally {
      enhanceBusy = false;
    }
  }
  function scheduleEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    setTimeout(() => { enhanceQueued = false; enhance(); }, 40);
  }

  window.addEventListener('click', event => {
    const newButton = event.target.closest?.('[data-a-new]');
    if (newButton) {
      event.preventDefault(); event.stopImmediatePropagation(); renderCreateForm(); return;
    }
    const modeOption = event.target.closest?.('[data-a-mode-option]');
    if (modeOption) {
      event.preventDefault(); event.stopImmediatePropagation();
      const selected = document.querySelectorAll('[data-a-mode-option].selected');
      if (modeOption.classList.contains('selected') && selected.length === 1) return;
      modeOption.classList.toggle('selected'); updateScoreFamilyUi(); return;
    }
    if (event.target.closest?.('[data-a-v2-back]')) {
      event.preventDefault(); event.stopImmediatePropagation(); routeBack(); return;
    }
    const formInterval = event.target.closest?.('#v205AssignmentCreateV2 [data-a-interval]');
    if (formInterval) {
      event.preventDefault(); event.stopImmediatePropagation(); formInterval.classList.toggle('selected'); return;
    }
    if (event.target.closest?.('#v205AssignmentCreateV2 [data-a-iall]')) {
      event.preventDefault(); event.stopImmediatePropagation(); document.querySelectorAll('#v205AssignmentCreateV2 [data-a-interval]').forEach(x=>x.classList.add('selected')); return;
    }
    if (event.target.closest?.('#v205AssignmentCreateV2 [data-a-icore]')) {
      event.preventDefault(); event.stopImmediatePropagation(); document.querySelectorAll('#v205AssignmentCreateV2 [data-a-interval]').forEach(x=>x.classList.toggle('selected',CORE7.has(x.dataset.aInterval))); return;
    }
    const play = event.target.closest?.('[data-a-play]');
    if (play) {
      event.preventDefault(); event.stopImmediatePropagation(); handlePlay(play.dataset.aPlay); return;
    }
    const modeStart = event.target.closest?.('[data-a-mode-start]');
    if (modeStart) {
      event.preventDefault(); event.stopImmediatePropagation();
      fetchStudentAssignment(modeStart.dataset.aAssignmentId).then(a=>a&&startWithMode(a,modeStart.dataset.aModeStart)).catch(err=>alert(err?.message||'開始できませんでした。'));
      return;
    }
    if (event.target.closest?.('[data-a-mode-back]')) {
      event.preventDefault(); event.stopImmediatePropagation(); routeBack(); return;
    }
    const results = event.target.closest?.('[data-a-results]');
    if (results) {
      lastResultsAssignmentId = results.dataset.aResults;
      scheduleEnhance();
    }
  }, true);

  window.addEventListener('submit', event => {
    if (event.target.id !== 'v205AssignmentCreateV2') return;
    event.preventDefault(); event.stopImmediatePropagation(); submitCreateV2(event.target);
  }, true);

  new MutationObserver(scheduleEnhance).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('DOMContentLoaded',scheduleEnhance,{once:true});

  window.IntervalCosmosAssignmentMultiModeV205 = {
    get lastSubmission(){ return lastSubmission; },
    set lastSubmission(v){ lastSubmission = v; },
    renderCreateForm,
    renderModeChooser,
    handlePlay,
  };
})();
