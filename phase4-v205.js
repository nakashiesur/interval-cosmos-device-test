(() => {
  const VERSION = 'ver.2.0.5-alpha3';
  const cloud = window.IntervalCosmosCloud;
  const MASTERY_KEY = 'intervalCosmos.mastery.v2';
  const INTERVAL_ORDER = ['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7','P8'];
  const INTERVAL_NAMES = Object.freeze({
    P1:'完全1度', m2:'短2度', M2:'長2度', m3:'短3度', M3:'長3度',
    P4:'完全4度', TT:'三全音', P5:'完全5度', m6:'短6度', M6:'長6度',
    m7:'短7度', M7:'長7度', P8:'完全8度',
  });
  const MODE_LABELS = Object.freeze({
    TEXT:'TEXT', KEYS:'KEYS', HD_TEXT:'HD TEXT', HD_KEYS:'HD KEYS', EAR_LINK:'EAR LINK',
  });

  let historyCache = [];
  let analysisRowsCache = [];
  let opening = false;
  let historyRequest = 0;
  let queued = false;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]
  ));
  const pct = (a,b) => b ? Math.round((a / b) * 100) : 0;
  const nfmt = value => Math.round(Number(value || 0)).toLocaleString('ja-JP');

  function readMastery() {
    try {
      const raw = JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  function masterySnapshot() {
    const mastery = readMastery();
    const intervals = {};
    for (const key of INTERVAL_ORDER) {
      const row = mastery[key] || {};
      intervals[key] = {
        seen: Number(row.seen || 0),
        correct: Number(row.correct || 0),
        wrong: Number(row.wrong || 0),
        ema_ms: Math.round(Number(row.emaMs || 0)),
        streak: Number(row.streak || 0),
        confusions: row.confusions && typeof row.confusions === 'object' ? row.confusions : {},
      };
    }
    return { schema:'mastery-v1', captured_at:new Date().toISOString(), intervals };
  }

  if (cloud?.submitScore && !cloud.__v205Phase4SnapshotWrapped) {
    const original = cloud.submitScore.bind(cloud);
    cloud.submitScore = payload => original({
      ...(payload || {}),
      intervalStats: payload?.intervalStats || masterySnapshot(),
    });
    cloud.__v205Phase4SnapshotWrapped = true;
  }

  function summarize(sessions) {
    const rows = Array.isArray(sessions) ? sessions : [];
    const total = rows.reduce((sum,r) => sum + Number(r.total_answers || 0), 0);
    const correct = rows.reduce((sum,r) => sum + Number(r.correct_answers || 0), 0);
    const best = rows.reduce((m,r) => Math.max(m, Number(r.score || 0)), 0);
    const combo = rows.reduce((m,r) => Math.max(m, Number(r.max_combo || 0)), 0);
    const ranked = rows.filter(r => r.source === 'ranked').length;
    const modes = {};
    for (const r of rows) {
      const key = r.mode || 'OTHER';
      modes[key] ||= { plays:0, total:0, correct:0, best:0, combo:0 };
      modes[key].plays += 1;
      modes[key].total += Number(r.total_answers || 0);
      modes[key].correct += Number(r.correct_answers || 0);
      modes[key].best = Math.max(modes[key].best, Number(r.score || 0));
      modes[key].combo = Math.max(modes[key].combo, Number(r.max_combo || 0));
    }
    return { plays:rows.length, ranked, total, correct, accuracy:pct(correct,total), best, combo, modes };
  }

  function intervalRows(mastery = readMastery()) {
    return INTERVAL_ORDER.map(key => {
      const row = mastery[key] || {};
      const seen = Number(row.seen || 0);
      const correct = Number(row.correct || 0);
      const wrong = Number(row.wrong || 0);
      const accuracy = pct(correct, seen);
      const confusions = Object.entries(row.confusions || {}).sort((a,b) => Number(b[1])-Number(a[1]));
      return {
        key, seen, correct, wrong, accuracy,
        ema: Number(row.emaMs || 0),
        confusion: confusions[0] || null,
      };
    });
  }

  function sharedRows(groups) {
    const mastery = {};
    for (const group of groups || []) {
      if (!INTERVAL_ORDER.includes(group.interval_key) || !INTERVAL_ORDER.includes(group.chosen_key)) continue;
      const row = mastery[group.interval_key] ||= {seen:0,correct:0,wrong:0,ms:0,confusions:{}};
      const count = Number(group.answers || 0);
      row.seen += count;
      row.ms += Number(group.response_ms || 0);
      if (group.interval_key === group.chosen_key) row.correct += count;
      else { row.wrong += count; row.confusions[group.chosen_key] = (row.confusions[group.chosen_key] || 0) + count; }
    }
    for (const row of Object.values(mastery)) row.emaMs = row.seen ? row.ms / row.seen : 0;
    return intervalRows(mastery);
  }

  function weakest(rows) {
    const practiced = rows.filter(r => r.seen > 0);
    if (!practiced.length) return null;
    return practiced.sort((a,b) =>
      a.accuracy - b.accuracy ||
      b.wrong - a.wrong ||
      b.ema - a.ema
    )[0];
  }

  function strongest(rows) {
    const practiced = rows.filter(r => r.seen >= 3);
    if (!practiced.length) return null;
    return practiced.sort((a,b) =>
      b.accuracy - a.accuracy ||
      b.seen - a.seen ||
      a.ema - b.ema
    )[0];
  }

  function dailyRows(sessions, days=14) {
    const now = new Date();
    const map = new Map();
    for (let i=days-1;i>=0;i--) {
      const d = new Date(now);
      d.setHours(0,0,0,0);
      d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      map.set(key,{ key, label:`${d.getMonth()+1}/${d.getDate()}`, plays:0,total:0,correct:0 });
    }
    for (const r of sessions) {
      const d = new Date(r.played_at || r.received_at || 0);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const day = map.get(key);
      if (!day) continue;
      day.plays += 1;
      day.total += Number(r.total_answers || 0);
      day.correct += Number(r.correct_answers || 0);
    }
    return [...map.values()].map(d => ({...d, accuracy:pct(d.correct,d.total)}));
  }

  function createOverlay() {
    let node = document.querySelector('.v205-history-overlay');
    if (node) return node;
    node = document.createElement('div');
    node.className = 'v205-history-overlay';
    document.body.appendChild(node);
    return node;
  }

  function closeHistory() {
    historyRequest++;
    opening = false;
    document.querySelector('.v205-history-overlay')?.remove();
  }

  function renderLoading() {
    const overlay = createOverlay();
    overlay.innerHTML = `<section class="v205-history-card">
      <button class="icon-btn v205-history-close" data-v205-history-close>×</button>
      <div class="v205-history-loading"><span class="spinner"></span><strong>ANALYZING LEARNING HISTORY...</strong><small>学習履歴を集計しています</small></div>
    </section>`;
  }

  function renderHistory(sessions, shared = {}) {
    const overlay = createOverlay();
    const summary = summarize(sessions);
    const intervals = shared.guest ? intervalRows() : sharedRows(shared.rows);
    analysisRowsCache = intervals;
    const deviceRows = intervalRows();
    const legacyRows = intervalRows(window.IntervalCosmosLearningSync?.legacy?.() || {});
    const weak = weakest([...intervals]);
    const strong = strongest([...intervals]);
    const daily = dailyRows(sessions);
    const maxDaily = Math.max(1, ...daily.map(d => d.plays));
    const profile = cloud?.getCachedPlayer?.();
    const modeCards = Object.entries(summary.modes)
      .sort((a,b) => b[1].plays-a[1].plays)
      .map(([mode,row]) => `<article class="v205-history-mode">
        <span>${esc(MODE_LABELS[mode] || mode)}</span>
        <strong>${row.plays}<small> PLAY</small></strong>
        <div>正答率 <b>${pct(row.correct,row.total)}%</b></div>
        <div>BEST <b>${nfmt(row.best)}</b>　MAX <b>${row.combo}</b></div>
      </article>`).join('');

    const intervalCards = intervals.map(r => {
      const level = !r.seen ? 'none' : r.accuracy >= 90 ? 'high' : r.accuracy >= 75 ? 'mid' : 'low';
      return `<button class="v205-history-interval ${level}" data-v205-practice-interval="${r.key}" title="${esc(INTERVAL_NAMES[r.key])}">
        <strong>${r.key}</strong><span>${r.seen ? `${r.accuracy}%` : '—'}</span><small>${r.seen} answers</small>
      </button>`;
    }).join('');

    const recent = sessions.slice(0,12).map(r => {
      const date = new Date(r.played_at || r.received_at || 0);
      const dateText = Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ja-JP',{
        month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
      }).format(date);
      const acc = pct(Number(r.correct_answers||0),Number(r.total_answers||0));
      return `<div class="v205-history-log">
        <span class="mode">${esc(MODE_LABELS[r.mode] || r.mode || 'MODE')}</span>
        <span>${esc(dateText)}</span>
        <strong>${nfmt(r.score)}</strong>
        <span>正答率 ${acc}%</span>
        <span>MAX ${Number(r.max_combo||0)}</span>
      </div>`;
    }).join('');

    overlay.innerHTML = `<section class="v205-history-card">
      <button class="icon-btn v205-history-close" data-v205-history-close>×</button>
      <header class="v205-history-head">
        <p class="v205-history-kicker">LEARNING TELEMETRY</p>
        <h2>学習履歴</h2>
        <p>${esc(profile?.player_name || 'PLAYER')} のプレイ記録と、現在の習熟傾向です。</p>
      </header>

      <div class="v205-history-summary">
        <div><span>PLAY SESSIONS</span><strong>${summary.plays}</strong><small>${shared.guest ? 'この端末に保存' : 'オンライン保存'}</small></div>
        <div><span>ACCURACY</span><strong>${summary.accuracy}%</strong><small>${summary.correct}/${summary.total}</small></div>
        <div><span>BEST SCORE</span><strong>${nfmt(summary.best)}</strong><small>全モード</small></div>
        <div><span>MAX COMBO</span><strong>${summary.combo}</strong><small>全期間</small></div>
      </div>

      <section class="v205-history-section">
        <div class="v205-history-title"><div><h3>14 DAY ACTIVITY</h3><span>直近14日</span></div></div>
        <div class="v205-daily-chart">${daily.map(d => `<div class="v205-day">
          <div class="v205-day-bar"><i style="height:${Math.max(d.plays ? 12 : 2,(d.plays/maxDaily)*100)}%"></i></div>
          <strong>${d.plays || ''}</strong><span>${d.label}</span>
        </div>`).join('')}</div>
      </section>

      <section class="v205-history-section">
        <div class="v205-history-title"><div><h3>MODE ANALYSIS</h3><span>モード別</span></div></div>
        <div class="v205-history-modes">${modeCards || '<div class="empty-state">まだプレイ履歴がありません。</div>'}</div>
      </section>

      <section class="v205-history-section">
        <div class="v205-history-title">
          <div><h3>INTERVAL ANALYSIS</h3><span>${shared.guest ? 'ゲストの音程分析（この端末のみ）' : '共通の音程分析（同期開始後の回答）'}</span></div>
          ${weak ? `<button class="secondary-btn v205-weak-button" data-v205-practice-interval="${weak.key}">この苦手を練習</button>` : ''}
        </div>
        <p class="v205-history-note">${shared.error ? '共通分析を取得できませんでした。接続後に開き直してください。' : shared.guest ? '登録前の回答は共通分析へ送信されません。' : 'すべての端末から同期済みの回答を集計します。過去の端末内分析は下に別枠で保存されています。'}${shared.pending ? ` 未同期 ${shared.pending}回答。接続後に再送します。` : ''}${shared.storageError ? ' 一部の回答を端末に保存できませんでした。ブラウザの保存領域を確認してください。' : ''}</p>
        <div class="v205-history-insights">
          <article class="weak"><span>WEAK POINT</span><strong>${weak ? `${weak.key} / ${INTERVAL_NAMES[weak.key]}` : 'データ不足'}</strong><small>${weak ? `正答率 ${weak.accuracy}%・${weak.seen}回答` : 'まず数問プレイしてください'}</small></article>
          <article class="strong"><span>STRONG POINT</span><strong>${strong ? `${strong.key} / ${INTERVAL_NAMES[strong.key]}` : 'データ不足'}</strong><small>${strong ? `正答率 ${strong.accuracy}%・${strong.seen}回答` : '3回答以上で判定'}</small></article>
          <article><span>CONFUSION</span><strong>${weak?.confusion ? `${weak.key} → ${weak.confusion[0]}` : '—'}</strong><small>${weak?.confusion ? `${weak.confusion[1]}回混同` : '明確な混同は未検出'}</small></article>
        </div>
        <div class="v205-history-intervals">${intervalCards}</div>
        ${!shared.guest && deviceRows.some(r => r.seen) ? `<details class="v205-legacy-analysis v205-device-analysis"><summary>この端末の学習（ゲストの回答を含む）</summary>
          <p class="v205-history-note">登録前のゲストプレイを含む、このブラウザの回答です。共通分析と重なる回答もあります。アカウント別の成績ではなく、共通集計には加算しません。</p>
          <div class="v205-history-intervals">${deviceRows.map(r => `<button class="v205-history-interval" data-v205-practice-interval="${r.key}" title="${esc(INTERVAL_NAMES[r.key])}"><strong>${r.key}</strong><span>${r.seen ? `${r.accuracy}%` : '—'}</span><small>${r.seen} answers</small></button>`).join('')}</div>
        </details>` : ''}
        <details class="v205-legacy-analysis"><summary>過去の端末内分析（共通集計には含めません）</summary>
          <p class="v205-history-note">この端末で同期機能を導入する前の記録です。他の端末とは合算しません。</p>
          <div class="v205-history-intervals">${legacyRows.map(r => `<button class="v205-history-interval" data-v205-practice-interval="${r.key}" title="${esc(INTERVAL_NAMES[r.key])}"><strong>${r.key}</strong><span>${r.seen ? `${r.accuracy}%` : '—'}</span><small>${r.seen} answers</small></button>`).join('')}</div>
        </details>
        <p class="v205-history-note">音程カードを選ぶと、その音程だけのFOCUS練習へ移動できます。回答方法はTEXT / KEYSを選択できます。</p>
      </section>

      <section class="v205-history-section">
        <div class="v205-history-title"><div><h3>RECENT SESSIONS</h3><span>最近のプレイ</span></div></div>
        <div class="v205-history-logs">${recent || '<div class="empty-state">履歴はまだありません。</div>'}</div>
      </section>
    </section>`;
  }

  async function openHistory() {
    if (opening) return;
    opening = true;
    const request = ++historyRequest;
    renderLoading();
    try {
      const profile = cloud?.getCachedPlayer?.();
      let sessions;
      if (profile?.is_guest || !cloud?.fetchLearningHistory) {
        sessions = window.IntervalCosmosGuestSessions?.read() || [];
      } else {
        sessions = await cloud.fetchLearningHistory({limit:500});
      }
      if (request !== historyRequest) return;
      let shared;
      try { shared = await window.IntervalCosmosLearningSync.fetchAnalysis(); }
      catch { shared = {error:true}; }
      if (request !== historyRequest) return;
      historyCache = sessions;
      renderHistory(historyCache, shared);
    } catch (error) {
      if (request !== historyRequest) return;
      console.error('[v2.0.5 history]', error);
      const overlay = createOverlay();
      overlay.innerHTML = `<section class="v205-history-card">
        <button class="icon-btn v205-history-close" data-v205-history-close>×</button>
        <div class="empty-state">学習履歴を取得できませんでした。<br><small>${esc(error?.message || '')}</small></div>
      </section>`;
    } finally {
      if (request === historyRequest) opening = false;
    }
  }

  function injectButtons() {
    const footer = document.querySelector('.home-footer');
    if (footer && !footer.querySelector('[data-v205-history-open]')) {
      const button = document.createElement('button');
      button.className = 'secondary-btn v205-history-launch';
      button.type = 'button';
      button.dataset.v205HistoryOpen = '1';
      button.innerHTML = '◫ 学習履歴';
      footer.appendChild(button);
    }

    const cloudBox = document.querySelector('.cloud-setting');
    if (cloudBox && !document.querySelector('.v205-history-setting')) {
      const row = document.createElement('div');
      row.className = 'setting-row v205-history-setting';
      row.innerHTML = `<div class="setting-label"><strong>Learning history</strong><span>成績・苦手分析</span></div>
        <button type="button" class="secondary-btn" data-v205-history-open>学習履歴を開く</button>`;
      const privacy = document.querySelector('.v205-ranking-privacy');
      (privacy || cloudBox).insertAdjacentElement('afterend', row);
    }
  }

  function startFocusedPractice(intervalKey, preferredView='text') {
    if (!INTERVAL_ORDER.includes(intervalKey)) return;
    closeHistory();

    const go = () => {
      const practiceButton = document.querySelector('[data-action="practice"]');
      if (practiceButton) {
        practiceButton.click();
        window.setTimeout(() => {
          document.querySelector(`[data-view="${preferredView}"]`)?.click();
          document.querySelector('[data-practice="manual"]')?.click();
          window.setTimeout(() => {
            document.querySelector('[data-action="clear-all"]')?.click();
            window.setTimeout(() => document.querySelector(`[data-interval="${intervalKey}"]`)?.click(), 20);
          }, 30);
        }, 30);
        return;
      }

      const manual = document.querySelector('[data-practice="manual"]');
      if (manual) {
        document.querySelector(`[data-view="${preferredView}"]`)?.click();
        manual.click();
        window.setTimeout(() => {
          document.querySelector('[data-action="clear-all"]')?.click();
          window.setTimeout(() => document.querySelector(`[data-interval="${intervalKey}"]`)?.click(), 20);
        }, 30);
      }
    };

    if (document.querySelector('.result-panel')) {
      document.querySelector('[data-action="home"]')?.click();
      window.setTimeout(go, 40);
    } else {
      go();
    }
  }

  function choosePracticeView(intervalKey) {
    let overlay = document.querySelector('.v205-practice-choice');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'v205-practice-choice';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<section>
      <p>FOCUS PRACTICE</p>
      <h3>${esc(intervalKey)} / ${esc(INTERVAL_NAMES[intervalKey])}</h3>
      <span>回答方法を選択してください。</span>
      <div><button class="secondary-btn" data-v205-focus-view="text" data-interval="${intervalKey}">TEXT</button>
      <button class="primary-btn" data-v205-focus-view="keys" data-interval="${intervalKey}">KEYS</button></div>
      <button class="v205-choice-cancel" data-v205-choice-cancel>キャンセル</button>
    </section>`;
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      injectButtons();
    });
  }

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('DOMContentLoaded',queueEnhance,{once:true});

  window.addEventListener('click', event => {
    if (event.target.closest?.('[data-v205-history-open]')) {
      openHistory();
      return;
    }
    if (event.target.closest?.('[data-v205-history-close]') || event.target === document.querySelector('.v205-history-overlay')) {
      closeHistory();
      return;
    }
    const interval = event.target.closest?.('[data-v205-practice-interval]');
    if (interval) {
      choosePracticeView(interval.dataset.v205PracticeInterval);
      return;
    }
    const view = event.target.closest?.('[data-v205-focus-view]');
    if (view) {
      const key = view.dataset.interval;
      const preferred = view.dataset.v205FocusView === 'keys' ? 'keys' : 'text';
      document.querySelector('.v205-practice-choice')?.remove();
      startFocusedPractice(key,preferred);
      return;
    }
    if (event.target.closest?.('[data-v205-choice-cancel]') || event.target === document.querySelector('.v205-practice-choice')) {
      document.querySelector('.v205-practice-choice')?.remove();
    }
  },true);

  window.IntervalCosmosHistoryV205 = {
    version: VERSION,
    open: openHistory,
    getCache: () => historyCache,
    summarize,
    masterySnapshot,
    sharedRows,
    getAnalysisRows: () => analysisRowsCache,
  };
})();
