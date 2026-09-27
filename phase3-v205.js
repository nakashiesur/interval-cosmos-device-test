(() => {
  const VERSION = 'ver.2.0.5-alpha2.1';
  const cloud = window.IntervalCosmosCloud;

  const COURSE_LABELS = Object.freeze({
    piano: 'ピアノコース',
    orchestral: '管弦打楽コース',
    vocal_musical: '声楽・ミュージカルコース',
    composition: '作曲コース',
    rock_pops: 'ロック＆ポップスコース',
    electronic_organ: '電子オルガンコース',
    sound_design: 'サウンドデザインコース',
    music_education: '音楽教育コース',
    music_therapy: '音楽療法コース',
    child_culture: 'こども文化コース',
    voice_actor: '声優コース',
  });
  const FRAME_LABELS = Object.freeze({
    normal: 'NORMAL', bronze: 'BRONZE', silver: 'SILVER',
    gold: 'GOLD', platinum: 'PLATINUM', cosmic: 'COSMIC',
  });
  const MODE_LABELS = Object.freeze({
    TEXT: 'TEXT', KEYS: 'KEYS', HD_TEXT: 'HD TEXT',
    HD_KEYS: 'HD KEYS', EAR_LINK: 'EAR',
  });

  let lastSubmitResult = null;
  let rankingCache = [];
  let rankingCacheScope = null;
  let promptScheduledFor = null;
  let enhanceQueued = false;
  let publicationPending = false;
  const publishedSessions = new Set();

  const esc = value => String(value ?? '').replace(/[&<>'\"]/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' }[c]
  ));
  const formatNumber = value => Math.round(Number(value || 0)).toLocaleString('ja-JP');
  const courseLabel = code => COURSE_LABELS[code] || 'COURSE';
  const frameLabel = id => FRAME_LABELS[id] || String(id || 'normal').replaceAll('_',' ').toUpperCase();
  const titleLabel = id => id ? String(id).replaceAll('_',' ').toUpperCase() : 'NO TITLE';
  const modeLabel = key => MODE_LABELS[key] || key || 'MODE';
  const improved = result => Boolean(result?.monthly_best_improved ?? result?.monthly_improved)
    || Boolean(result?.hall_best_improved ?? result?.hall_improved);

  function currentProfile() {
    return cloud?.getCachedPlayer?.() || null;
  }

  function currentSessionPublished() {
    if (!lastSubmitResult?.session_id) return false;
    if (publishedSessions.has(lastSubmitResult.session_id)) return true;
    return currentProfile()?.ranking_visibility === 'always_public';
  }

  function createOverlay(className) {
    let node = document.querySelector(`.${className}`);
    if (node) return node;
    node = document.createElement('div');
    node.className = className;
    document.body.appendChild(node);
    return node;
  }

  function closeOverlay(className) {
    document.querySelector(`.${className}`)?.remove();
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'v205-toast';
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 1800);
  }

  function writeHTML(node, html, signature) {
    if (!node) return false;
    if (signature && node.dataset.v205Signature === signature) return false;
    if (!signature && node.innerHTML === html) return false;
    node.innerHTML = html;
    if (signature) node.dataset.v205Signature = signature;
    return true;
  }

  if (cloud?.submitScore && !cloud.__v205Phase3SubmitWrapped) {
    const originalSubmit = cloud.submitScore.bind(cloud);
    cloud.submitScore = async payload => {
      const result = await originalSubmit(payload);
      lastSubmitResult = result || null;
      if (currentProfile()?.ranking_visibility === 'always_public' && result?.session_id) {
        publishedSessions.add(result.session_id);
      }
      schedulePublicationPrompt(result);
      queueEnhance();
      return result;
    };
    cloud.__v205Phase3SubmitWrapped = true;
  }

  if (cloud?.publishPlaySession && !cloud.__v205Phase3PublishWrapped) {
    const originalPublish = cloud.publishPlaySession.bind(cloud);
    cloud.publishPlaySession = async sessionId => {
      const result = await originalPublish(sessionId);
      if (sessionId) publishedSessions.add(sessionId);
      queueEnhance();
      return result;
    };
    cloud.__v205Phase3PublishWrapped = true;
  }

  if (cloud?.fetchRankings && !cloud.__v205Phase3RankingWrapped) {
    const originalFetch = cloud.fetchRankings.bind(cloud);
    cloud.fetchRankings = async args => {
      const result = await originalFetch(args);
      rankingCache = Array.isArray(result?.rows) ? result.rows : [];
      rankingCacheScope = `${args?.mode || ''}:${args?.scope || ''}`;
      queueEnhance();
      return result;
    };
    cloud.__v205Phase3RankingWrapped = true;
  }

  function schedulePublicationPrompt(result) {
    if (!result?.publication_required || !result?.session_id || !improved(result)) return;
    if (promptScheduledFor === result.session_id) return;
    promptScheduledFor = result.session_id;

    const bestRank = Math.min(
      Number(result.monthly_rank || 9999),
      Number(result.hall_rank || 9999)
    );
    const delay = bestRank <= 50 ? 2300 : 180;

    window.setTimeout(() => {
      if (lastSubmitResult?.session_id !== result.session_id || !lastSubmitResult.publication_required) return;
      if (!document.querySelector('.result-panel')) return;
      if (document.querySelector('.rank-burst.v205-rank-privacy-burst')) return;
      showPublicationPrompt(result);
    }, delay);
  }

  function mountPublicationInRankBurst(node, result) {
    if (!node || !result?.publication_required || !result?.session_id || !improved(result)) return false;
    if (lastSubmitResult?.session_id !== result.session_id) return false;
    node.classList.add('v205-rank-privacy-burst');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', 'ランキング公開設定');
    node.innerHTML += `<section class="v205-rank-privacy-panel" aria-label="ランキング公開設定">
      <h2>この記録を公開しますか？</h2>
      <p class="v205-publication-copy">自己ベストを更新しました。公開しなくても順位相当は自分に表示されます。</p>
      <div class="v205-publication-positions">
        <div><span>月間</span><strong>${result.monthly_rank || '-'}${result.monthly_rank ? '位相当' : ''}</strong></div>
        <div><span>殿堂</span><strong>${result.hall_rank || '-'}${result.hall_rank ? '位相当' : ''}</strong></div>
      </div>
      <p class="v205-publication-note">公開されるのはプレイヤー名・コースバッジ・アバター・称号・フレーム・スコア・正答率・最大コンボです。学籍番号は公開されません。</p>
      <div class="v205-publication-actions">
        <button type="button" class="secondary-btn" data-v205-publication="private">非公開のまま続ける</button>
        <button type="button" class="primary-btn" data-v205-publication="public">このランキングを公開する</button>
      </div>
    </section>`;
    node.querySelector('[data-v205-publication="private"]')?.focus();
    return true;
  }

  window.IntervalCosmosRankingPrivacy = { mountBurst: mountPublicationInRankBurst };

  function closePublicationPresentation() {
    closeOverlay('v205-publication-overlay');
    document.querySelector('.rank-burst.v205-rank-privacy-burst')?.remove();
  }

  function showPublicationPrompt(result) {
    const overlay = createOverlay('v205-publication-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'ランキング公開設定');
    const signature = `publish:${result.session_id}:${result.monthly_rank}:${result.hall_rank}`;
    const html = `<section class="v205-publication-card">
      <p class="v205-kicker">RANKING PRIVACY</p>
      <h2>この記録を公開しますか？</h2>
      <p class="v205-publication-copy">自己ベストを更新しました。公開しなくても、あなた自身には順位相当が表示されます。</p>
      <div class="v205-publication-positions">
        <div><span>月間</span><strong>${result.monthly_rank || '-'}${result.monthly_rank ? '位相当' : ''}</strong></div>
        <div><span>殿堂</span><strong>${result.hall_rank || '-'}${result.hall_rank ? '位相当' : ''}</strong></div>
      </div>
      <p class="v205-publication-note">公開されるのはプレイヤー名・コースバッジ・アバター・称号・フレーム・スコア・正答率・最大コンボです。学籍番号は公開されません。</p>
      <div class="v205-publication-actions">
        <button type="button" class="secondary-btn" data-v205-publication="private">非公開のまま続ける</button>
        <button type="button" class="primary-btn" data-v205-publication="public">このランキングを公開する</button>
      </div>
    </section>`;
    writeHTML(overlay, html, signature);
    overlay.querySelector('[data-v205-publication="private"]')?.focus();
  }

  async function publishCurrentScore(button) {
    const sessionId = lastSubmitResult?.session_id;
    if (!sessionId || !cloud?.publishPlaySession || publicationPending) return;
    publicationPending = true;
    document.querySelectorAll('[data-v205-publication]').forEach(control => { control.disabled = true; });
    button.disabled = true;
    button.textContent = 'PUBLISHING...';
    try {
      const published = await cloud.publishPlaySession(sessionId);
      publishedSessions.add(sessionId);
      lastSubmitResult = {
        ...(lastSubmitResult || {}),
        publication_required: false,
        monthly_rank: published?.monthly_rank ?? lastSubmitResult?.monthly_rank,
        hall_rank: published?.hall_rank ?? lastSubmitResult?.hall_rank,
      };
      closePublicationPresentation();
      toast('ランキングを公開しました。');
      queueEnhance();
    } catch (error) {
      console.error('[v2.0.5 publish]', error);
      button.disabled = false;
      button.textContent = 'このランキングを公開する';
      document.querySelectorAll('[data-v205-publication]').forEach(control => { control.disabled = false; });
      toast(`公開できませんでした：${error?.message || ''}`);
    } finally {
      publicationPending = false;
    }
  }

  function keepCurrentScorePrivate() {
    // An already dispatched publication cannot be cancelled by a local close.
    if (publicationPending) return;
    if (lastSubmitResult) lastSubmitResult.publication_required = false;
    closePublicationPresentation();
    toast('この記録は非公開のまま保存しました。');
    queueEnhance();
  }

  function enhanceResult() {
    const panel = document.querySelector('.result-panel');
    if (!panel) return;

    const homeButton = panel.querySelector('[data-action="home"]');
    if (homeButton && !homeButton.dataset.v205Labelled) {
      homeButton.dataset.v205Labelled = '1';
      homeButton.innerHTML = 'MODE SELECT <span class="v205-key-hint">ESC</span>';
    }
    const retryButton = panel.querySelector('[data-action="retry"]');
    if (retryButton && !retryButton.dataset.v205Labelled) {
      retryButton.dataset.v205Labelled = '1';
      retryButton.innerHTML = 'RETRY <span class="v205-key-hint">R</span>';
    }

    const score = Number(String(document.querySelector('#resultScore')?.textContent || '0').replace(/[^0-9.-]/g,''));
    const head = panel.querySelector('.result-head');
    if (!head || !lastSubmitResult?.session_id) return;

    let grid = head.querySelector('.v205-result-rank-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'v205-result-rank-grid';
      const submitBox = head.querySelector('.ranking-submit');
      if (submitBox) head.insertBefore(grid, submitBox);
      else head.appendChild(grid);
    }

    const best = lastSubmitResult.hall_best_score ?? score;
    const resultSignature = [
      lastSubmitResult.session_id, score, best,
      lastSubmitResult.monthly_rank || '', lastSubmitResult.hall_rank || ''
    ].join('|');
    const gridHTML = `
      <div class="v205-result-rank-card current"><span>今回</span><strong>${formatNumber(score)}</strong><small>pts</small></div>
      <div class="v205-result-rank-card"><span>自己ベスト</span><strong>${formatNumber(best)}</strong><small>pts</small></div>
      <div class="v205-result-rank-card"><span>月間順位</span><strong>${lastSubmitResult.monthly_rank ? `${lastSubmitResult.monthly_rank}位相当` : '—'}</strong><small>BEST POSITION</small></div>
      <div class="v205-result-rank-card"><span>殿堂順位</span><strong>${lastSubmitResult.hall_rank ? `${lastSubmitResult.hall_rank}位相当` : '—'}</strong><small>BEST POSITION</small></div>`;
    writeHTML(grid, gridHTML, resultSignature);

    const submit = head.querySelector('.ranking-submit.done');
    if (submit) {
      const isPublic = currentSessionPublished();
      const submitSignature = `${resultSignature}|${isPublic ? 'public' : 'private'}|${improved(lastSubmitResult)}`;
      const submitHTML = `<div class="v205-ranking-submit-head"><strong>ONLINE RECORD</strong><em class="v205-public-state ${isPublic ? 'public' : 'private'}">${isPublic ? 'PUBLIC' : 'PRIVATE'}</em></div>
        <span>月間 <b>${lastSubmitResult.monthly_rank || '-'}${lastSubmitResult.monthly_rank ? '位相当' : ''}</b></span>
        <span>殿堂 <b>${lastSubmitResult.hall_rank || '-'}${lastSubmitResult.hall_rank ? '位相当' : ''}</b></span>
        <span class="v205-ranking-update-note ${improved(lastSubmitResult) ? '' : 'muted'}">${improved(lastSubmitResult) ? 'PERSONAL BEST UPDATED' : '自己ベストを維持'}</span>`;
      writeHTML(submit, submitHTML, submitSignature);
    }
  }

  function enhanceRankBurst() {
    document.querySelectorAll('.rank-burst').forEach(node => {
      if (lastSubmitResult && !improved(lastSubmitResult)) {
        node.remove();
        return;
      }
      if (!node.dataset.v205Kicker && !currentSessionPublished()) {
        const kicker = node.querySelector('.rank-burst-kicker');
        if (kicker && kicker.textContent !== 'RANK POSITION') kicker.textContent = 'RANK POSITION';
        node.dataset.v205Kicker = '1';
      }
    });
  }

  function enhanceSettings() {
    const cloudBox = document.querySelector('.cloud-setting');
    if (!cloudBox) return;
    const profile = currentProfile();
    if (!profile || profile.is_guest) {
      document.querySelector('.v205-ranking-privacy')?.remove();
      return;
    }

    let box = document.querySelector('.v205-ranking-privacy');
    if (!box) {
      box = document.createElement('div');
      box.className = 'setting-row v205-ranking-privacy';
      cloudBox.insertAdjacentElement('afterend', box);
    }

    const visibility = profile.ranking_visibility || 'ask';
    const help = visibility === 'always_public'
      ? '今後の自己ベスト更新を自動で公開します。'
      : visibility === 'always_private'
        ? '今後の自己ベスト更新は自動公開しません。現在公開中の過去記録はそのまま残ります。'
        : '自己ベスト更新時に、公開するか毎回確認します。';

    const html = `<div class="setting-label"><strong>Ranking publication</strong><span>公開設定</span></div>
      <div class="v205-privacy-tabs">
        <button type="button" class="v205-privacy-btn ${visibility === 'ask' ? 'active' : ''}" data-v205-visibility="ask"><strong>毎回確認</strong><small>ベスト更新時に選択</small></button>
        <button type="button" class="v205-privacy-btn ${visibility === 'always_public' ? 'active' : ''}" data-v205-visibility="always_public"><strong>常に公開</strong><small>今後の更新を自動公開</small></button>
        <button type="button" class="v205-privacy-btn ${visibility === 'always_private' ? 'active' : ''}" data-v205-visibility="always_private"><strong>常に非公開</strong><small>今後の更新を非公開</small></button>
      </div>
      <p class="v205-privacy-help">${help}</p>`;

    writeHTML(box, html, `visibility:${visibility}`);
  }

  async function setVisibility(value, button) {
    if (!['ask','always_public','always_private'].includes(value) || !cloud?.updateMyProfile) return;
    const buttons = document.querySelectorAll('[data-v205-visibility]');
    buttons.forEach(b => b.disabled = true);
    try {
      await cloud.updateMyProfile({ rankingVisibility: value });
      await cloud.getMyPlayer?.();
      toast(value === 'always_public'
        ? '今後の自己ベスト更新を自動公開します。'
        : value === 'always_private'
          ? '今後の更新を非公開にしました。過去の公開記録は残ります。'
          : '自己ベスト更新時に公開確認を表示します。');
      queueEnhance();
    } catch (error) {
      console.error('[v2.0.5 visibility]', error);
      toast(`公開設定を変更できませんでした：${error?.message || ''}`);
      buttons.forEach(b => b.disabled = false);
      if (button) button.focus();
    }
  }

  function enhanceRanking() {
    const rows = [...document.querySelectorAll('.ranking-list .ranking-row')];
    if (!rows.length || !rankingCache.length) return;

    rows.forEach((node, index) => {
      const row = rankingCache[index];
      if (!row) return;
      const rank = Number(row.rank || index + 1);
      const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
      const rankNode = node.querySelector('.rank-number');
      if (rankNode && rankNode.textContent !== rankLabel) rankNode.textContent = rankLabel;

      node.dataset.v205PlayerId = row.player_id || row.user_id || '';
      node.classList.add(`v205-frame-${row.equipped_frame_id || 'normal'}`);

      const avatar = node.querySelector('.rank-avatar');
      if (avatar) {
        avatar.classList.add('v205-profile-frame', `v205-frame-${row.equipped_frame_id || 'normal'}`);
        if (window.IntervalCosmosArt && avatar.dataset.artAvatar !== (row.avatar_id || 'nova')) {
          avatar.innerHTML = window.IntervalCosmosArt.avatarHTML(row.avatar_id);
          avatar.dataset.artAvatar = row.avatar_id || 'nova';
        }
      }

      const player = node.querySelector('.rank-player');
      if (player && !player.querySelector('.v205-rank-meta')) {
        const meta = document.createElement('div');
        meta.className = 'v205-rank-meta';
        meta.innerHTML = `<span class="v205-course-badge">${window.IntervalCosmosArt?.courseHTML(row.course_code)||''}${esc(courseLabel(row.course_code))}</span><small>${esc(titleLabel(row.main_title_id))}</small>`;
        player.appendChild(meta);
      }

      if (node.getAttribute('role') !== 'button') node.setAttribute('role','button');
      if (node.getAttribute('tabindex') !== '0') node.setAttribute('tabindex','0');
      const label = `${row.player_name || 'PLAYER'} の公開プロフィール`;
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
    });

    const modal = document.querySelector('.ranking-modal');
    if (modal && !modal.querySelector('.v205-profile-hint')) {
      const hint = document.createElement('p');
      hint.className = 'v205-profile-hint';
      hint.textContent = 'プレイヤーを選択すると公開プロフィールを表示します。';
      modal.appendChild(hint);
    }
  }

  async function openProfileCard(playerId) {
    if (!playerId || !cloud?.fetchPublicProfileCard) return;
    const overlay = createOverlay('v205-profile-overlay');
    writeHTML(
      overlay,
      `<section class="v205-profile-card"><button class="icon-btn v205-profile-close" data-v205-close-profile>×</button><div class="v205-profile-loading"><span class="spinner"></span>LOADING PROFILE...</div></section>`,
      `loading:${playerId}`
    );
    try {
      const card = await cloud.fetchPublicProfileCard(playerId);
      if (!card) throw new Error('公開プロフィールを取得できませんでした。');
      renderProfileCard(card, overlay);
    } catch (error) {
      console.error('[v2.0.5 profile card]', error);
      const target = overlay.querySelector('.v205-profile-card');
      if (target) target.innerHTML = `<button class="icon-btn v205-profile-close" data-v205-close-profile>×</button><div class="empty-state">${esc(error?.message || '公開プロフィールを取得できませんでした。')}</div>`;
    }
  }

  function renderProfileCard(card, overlay) {
    const records = Array.isArray(card.records) ? card.records : [];
    const achievements = Array.isArray(card.featured_achievements) ? card.featured_achievements : [];
    const frame = card.equipped_frame_id || 'normal';
    const overall = records.length ? Math.max(...records.map(r => Number(r.score || 0))) : 0;
    const mark = cloud?.avatarMark?.(card.avatar_id) || card.avatar || '✦';
    const target = overlay.querySelector('.v205-profile-card');
    if (!target) return;

    const signature = `profile:${card.player_id}:${card.updated_at || ''}:${records.length}:${achievements.length}`;
    const html = `<button class="icon-btn v205-profile-close" data-v205-close-profile>×</button>
      <div class="v205-profile-hero">
        <div class="v205-profile-avatar v205-profile-frame v205-frame-${esc(frame)}">${window.IntervalCosmosArt?.avatarHTML(card.avatar_id)||esc(mark)}</div>
        <div class="v205-profile-identity">
          <span class="v205-course-badge">${window.IntervalCosmosArt?.courseHTML(card.course_code)||''}${esc(courseLabel(card.course_code))}</span>
          <h2>${esc(card.player_name || 'PLAYER')}</h2>
          <div class="v205-profile-title">${esc(titleLabel(card.main_title_id))}</div>
          <div class="v205-profile-frame-name">${esc(frameLabel(frame))} FRAME</div>
        </div>
      </div>
      <div class="v205-profile-summary">
        <div><span>PUBLIC BEST</span><strong>${overall ? formatNumber(overall) : '—'}</strong></div>
        <div><span>ACHIEVEMENT PT</span><strong>${formatNumber(card.achievement_points || 0)}</strong></div>
        <div><span>FEATURED</span><strong>${achievements.length}</strong></div>
      </div>
      <section class="v205-profile-section">
        <div class="v205-section-head"><h3>PUBLIC RECORDS</h3><span>公開中の殿堂記録</span></div>
        ${records.length ? `<div class="v205-record-grid">${records.map(r => `<div class="v205-record"><span>${esc(modeLabel(r.mode))}</span><strong>${formatNumber(r.score)}</strong><small>正答率 ${Math.round(Number(r.accuracy || 0))}%　MAX ${r.max_combo || 0}</small></div>`).join('')}</div>` : '<div class="empty-state">公開中の記録はありません。</div>'}
      </section>
      <section class="v205-profile-section">
        <div class="v205-section-head"><h3>FEATURED ACHIEVEMENTS</h3><span>代表実績</span></div>
        ${achievements.length ? `<div class="v205-achievement-grid">${achievements.map(a => `<div class="v205-achievement">${window.IntervalCosmosArt?.achievementHTML(a.id,{unlocked:true})||''}<strong>${esc(a.name || a.id || 'ACHIEVEMENT')}</strong><span>+${Number(a.points || 0)} pt</span><small>${esc(a.description || '')}</small></div>`).join('')}</div>` : '<div class="empty-state">代表実績はまだ設定されていません。</div>'}
      </section>`;
    writeHTML(target, html, signature);
  }

  function enhance() {
    enhanceRankBurst();
    enhanceResult();
    enhanceSettings();
    enhanceRanking();
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    const run = () => {
      enhanceQueued = false;
      enhance();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.documentElement, { subtree:true, childList:true });

  window.addEventListener('click', event => {
    const publication = event.target.closest?.('[data-v205-publication]');
    if (publication) {
      if (publication.dataset.v205Publication === 'public') publishCurrentScore(publication);
      else keepCurrentScorePrivate();
      return;
    }

    const visibility = event.target.closest?.('[data-v205-visibility]');
    if (visibility) {
      setVisibility(visibility.dataset.v205Visibility, visibility);
      return;
    }

    const row = event.target.closest?.('.ranking-row[data-v205-player-id]');
    if (row?.dataset.v205PlayerId) {
      openProfileCard(row.dataset.v205PlayerId);
      return;
    }

    if (event.target.closest?.('[data-v205-close-profile]')) closeOverlay('v205-profile-overlay');
  }, true);

  window.addEventListener('keydown', event => {
    if (event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;

    const focusedRow = event.target?.closest?.('.ranking-row[data-v205-player-id]');
    if (focusedRow && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openProfileCard(focusedRow.dataset.v205PlayerId);
      return;
    }

    if (event.key === 'Escape' && document.querySelector('.v205-publication-overlay,.rank-burst.v205-rank-privacy-burst')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      keepCurrentScorePrivate();
      return;
    }
    if (event.key === 'Escape' && document.querySelector('.v205-profile-overlay')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeOverlay('v205-profile-overlay');
      return;
    }

    // A foreground privacy choice must not trigger retry behind the dialog.
    if (event.key.toLowerCase() === 'r' && document.querySelector('.v205-publication-overlay,.rank-burst.v205-rank-privacy-burst,.v205-profile-overlay')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const result = document.querySelector('.result-panel');
    if (!result || document.querySelector('.settings-modal,.records-modal,.player-modal')) return;

    if (event.key.toLowerCase() === 'r') {
      const button = result.querySelector('[data-action="retry"]');
      if (button) {
        event.preventDefault();
        event.stopImmediatePropagation();
        button.click();
      }
      return;
    }

    if (event.key === 'Escape') {
      const button = result.querySelector('[data-action="home"]');
      if (button) {
        event.preventDefault();
        event.stopImmediatePropagation();
        button.click();
      }
    }
  }, true);

  window.addEventListener('DOMContentLoaded', queueEnhance, { once:true });
  window.IntervalCosmosV205 = {
    version: VERSION,
    getLastSubmitResult: () => lastSubmitResult,
    getRankingCache: () => rankingCache,
    getRankingCacheScope: () => rankingCacheScope,
    enhance: queueEnhance,
  };
})();
