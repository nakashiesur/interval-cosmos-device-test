const cloud = window.IntervalCosmosCloud || null;
const appRoot = document.querySelector('#app');

const VERSION = '2.0.5-alpha10.39';
window.IntervalCosmosVersion = VERSION;
const COURSES = [
  { code: 'piano', department: '音楽学科', name: 'ピアノコース' },
  { code: 'orchestral', department: '音楽学科', name: '管弦打楽コース' },
  { code: 'vocal_musical', department: '音楽学科', name: '声楽・ミュージカルコース' },
  { code: 'composition', department: '音楽学科', name: '作曲コース' },
  { code: 'rock_pops', department: '音楽学科', name: 'ロック＆ポップスコース' },
  { code: 'electronic_organ', department: '音楽学科', name: '電子オルガンコース' },
  { code: 'sound_design', department: '音楽学科', name: 'サウンドデザインコース' },
  { code: 'music_education', department: '音楽学科', name: '音楽教育コース' },
  { code: 'music_therapy', department: '音楽学科', name: '音楽療法コース' },
  { code: 'child_culture', department: '未来創造学科', name: 'こども文化コース' },
  { code: 'voice_actor', department: '未来創造学科', name: '声優コース' },
];
const AVATARS = [
  ['nova','NOVA'], ['orbit','ORBIT'], ['pulse','PULSE'], ['prism','PRISM'],
  ['comet','COMET'], ['nebula','NEBULA'], ['vector','VECTOR'], ['echo','ECHO'],
  ['quasar','QUASAR'], ['lumen','LUMEN'], ['wave','WAVE'], ['aster','ASTER'],
  ['luna','LUNA'], ['flora','FLORA'], ['lyra','LYRA'], ['ribbon','RIBBON'], ['aria','ARIA'], ['gem','GEM'], ['charm','CHARM'], ['bloom','BLOOM'], ['sonata','SONATA'], ['parfait','PARFAIT'], ['letter','LETTER'], ['auris','AURIS'],
];

let appStarted = false;
let bootAttempt = 0;
const BOOT_TIMEOUT_MS = 15000;
let linkPollTimer = null;
let sourceLink = null;
let targetLink = null;
let sourceCountdownTimer = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function ensureUiRoot() {
  let root = document.querySelector('#account-ui-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'account-ui-root';
    document.body.appendChild(root);
  }
  return root;
}

function clearUi() {
  if (linkPollTimer) clearInterval(linkPollTimer);
  if (sourceCountdownTimer) clearInterval(sourceCountdownTimer);
  linkPollTimer = null;
  sourceCountdownTimer = null;
  const root = document.querySelector('#account-ui-root');
  if (root) root.innerHTML = '';
}

function panel(content, { modal = false } = {}) {
  const root = ensureUiRoot();
  root.innerHTML = `<div class="ic-account-layer ${modal ? 'is-modal' : ''}">
    <div class="ic-account-stars" aria-hidden="true"></div>
    <section class="ic-account-panel">${content}</section>
    <div class="ic-account-version">ver.${VERSION}</div>
  </div>`;
  return root;
}

function header(kicker, title, text = '') {
  return `<header class="ic-account-head"><span class="ic-account-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</header>`;
}

function avatarTile(id, label, selected = false) {
  return `<button type="button" class="ic-avatar-choice ${selected ? 'active' : ''}" data-v205-avatar="${id}" aria-pressed="${selected}">
    ${window.IntervalCosmosArt?.avatarHTML(id) || `<span class="ic-avatar-art avatar-${id}" aria-hidden="true"><i></i><b></b></span>`}<small>${esc(label)}</small><small class="v205-avatar-caption">${esc(window.IntervalCosmosArt?.avatarLabel(id)||'')}</small>
  </button>`;
}

function loadingScreen(message = 'ONLINE SYSTEM INITIALIZING') {
  panel(`${header('INTERVAL COSMOS', 'CONNECTING', message)}<div class="ic-account-loader"><span></span><span></span><span></span></div>`);
}

function showChooser() {
  panel(`${header('FIRST CONTACT', 'PLAYER ACCESS', 'あなたのプレイ方法を選択してください。')}
    <div class="ic-account-choice-grid">
      <button class="ic-account-choice primary" data-v205-action="student">
        <span class="ic-choice-mark">01</span><strong>学生として登録</strong><small>学籍番号・所属コースを登録して、記録をオンライン同期</small>
      </button>
      <button class="ic-account-choice" data-v205-action="existing">
        <span class="ic-choice-mark">02</span><strong>すでにアカウントがある</strong><small>別の端末に表示した6桁PINで、この端末を追加</small>
      </button>
      <button class="ic-account-choice" data-v205-action="staff-info">
        <span class="ic-choice-mark">03</span><strong>教職員</strong><small>教職員専用アカウントを使用</small>
      </button>
      <button class="ic-account-choice guest" data-v205-action="guest">
        <span class="ic-choice-mark">G</span><strong>GUEST MODE</strong><small>登録せず全モードをプレイ。ランキングには掲載されません</small>
      </button>
    </div>
    <p class="ic-account-footnote">学籍番号は管理用です。ランキングや他のプレイヤーには公開されません。</p>`);
}

function showStudentForm({ modal = false } = {}) {
  const courseGroups = ['音楽学科','未来創造学科'].map(dep => `
    <optgroup label="${dep}">${COURSES.filter(c => c.department === dep).map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
  panel(`${header('NEW PLAYER', 'STUDENT REGISTRATION', 'ランキング名・所属コース・アバターを設定します。')}
    <form class="ic-account-form" id="v205StudentForm">
      <label><span>学籍番号 <em>PRIVATE</em></span><input id="v205StudentNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="例：240265" required></label>
      <label><span>プレイヤー名 <em>PUBLIC</em></span><input id="v205PlayerName" type="text" autocomplete="nickname" maxlength="16" placeholder="2〜16文字" required></label>
      <label><span>所属コース <em>PUBLIC BADGE</em></span><select id="v205Course" required><option value="">選択してください</option>${courseGroups}</select></label>
      <fieldset><legend>AVATAR <em>PUBLIC</em></legend><div class="ic-avatar-grid">${AVATARS.map((a,i)=>avatarTile(a[0],a[1],i===0)).join('')}</div><input type="hidden" id="v205Avatar" value="nova"></fieldset>
      <div class="ic-form-message" id="v205FormMessage" aria-live="polite"></div>
      <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-action="chooser">戻る</button><button type="submit" class="ic-btn primary">登録する</button></div>
    </form>`, { modal });
}

function showStaffInfo() {
  panel(`${header('STAFF ACCESS', '教職員アカウント', '学生による教職員アカウントの誤登録を防ぐため、教職員アカウントは管理者から発行します。')}
    <div class="ic-staff-card">${window.IntervalCosmosArt?.avatarHTML('teacher')||'<span class="ic-avatar-art avatar-teacher"><i></i><b></b></span>'}<div><strong>TEACHER IDENTITY</strong><p>教職員は専用アイコン固定。学籍番号・教職員番号の入力は不要です。</p></div></div>
    <p class="ic-account-footnote">管理画面の実装後、ここから発行済み教職員アカウントへ接続できるようにします。</p>
    <div class="ic-account-actions"><button class="ic-btn secondary" data-v205-action="chooser">戻る</button></div>`);
}

function showLinkInput({ modal = false } = {}) {
  panel(`${header('DEVICE LINK', '既存アカウントに接続', 'ログイン済み端末で「別の端末でログイン」を選び、表示された6桁PINを入力してください。')}
    <form class="ic-account-form compact" id="v205LinkForm">
      <label class="ic-pin-field"><span>6 DIGIT PIN</span><input id="v205Pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" autocomplete="one-time-code" required></label>
      <div class="ic-form-message" id="v205LinkMessage" aria-live="polite"></div>
      <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-action="chooser">戻る</button><button type="submit" class="ic-btn primary">この端末を接続</button></div>
    </form>`, { modal });
}

function showTargetWaiting(info) {
  const name = info?.player_name || 'PLAYER';
  panel(`${header('DEVICE LINK', '承認待ち', `${name} の既存端末で接続を承認してください。`)}
    <div class="ic-wait-orbit"><span></span><i></i></div>
    <p class="ic-account-footnote">PINを入力しただけでは接続されません。既存端末側の確認が必要です。</p>
    <div class="ic-form-message" id="v205TargetMessage" aria-live="polite"></div>
    <div class="ic-account-actions"><button class="ic-btn secondary" data-v205-action="cancel-target-link">キャンセル</button></div>`);
}

function showDatabaseRequired(error) {
  const missingSchema = ['PGRST202', '42P01', '42883'].includes(error?.code);
  const title = missingSchema ? 'DATABASE UPDATE REQUIRED' : 'CONNECTION ERROR';
  const message = missingSchema
    ? 'v2.0.5用データベースの準備を確認してください。'
    : 'オンライン機能に接続できませんでした。通信状態を確認して再試行してください。';
  panel(`${header('INTERVAL COSMOS', title, message)}
    <div class="ic-dev-note"><p>${esc(error?.message || '接続を確認できませんでした。')}</p></div>
    <div class="ic-account-actions"><button class="ic-btn secondary" data-v205-action="offline-start">ゲーム本体だけ起動</button><button class="ic-btn primary" data-v205-action="retry-boot">再確認</button></div>`);
}

async function startApp() {
  if (appStarted) return;
  appStarted = true;
  clearUi();
  try {
    await import(`./app.js?v=${encodeURIComponent(VERSION)}`);
    installAppEnhancements();
  } catch (error) {
    appStarted = false;
    throw error;
  }
}

async function boot() {
  const attempt = ++bootAttempt;
  loadingScreen();
  if (!cloud?.configured?.()) {
    await startApp();
    return;
  }
  let timeout;
  try {
    // The browser/SDK can wait for minutes on a stalled network. Keep recovery reachable.
    const data = await Promise.race([
      cloud.init(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('接続に時間がかかっています。再確認するか、ゲーム本体だけ起動してください。')), BOOT_TIMEOUT_MS);
      }),
    ]);
    if (attempt !== bootAttempt || appStarted) return;
    if (data?.profile) {
      await startApp();
    } else {
      showChooser();
    }
  } catch (error) {
    if (attempt !== bootAttempt || appStarted) return;
    console.error('[v2.0.5 boot]', error);
    showDatabaseRequired(error);
  } finally {
    clearTimeout(timeout);
  }
}

function setMessage(id, text, type = '') {
  const node = document.querySelector(id);
  if (!node) return;
  node.textContent = text || '';
  node.className = `ic-form-message ${type}`;
}

async function submitStudentForm(form) {
  const number = document.querySelector('#v205StudentNumber')?.value || '';
  const name = document.querySelector('#v205PlayerName')?.value || '';
  const course = document.querySelector('#v205Course')?.value || '';
  const avatar = document.querySelector('#v205Avatar')?.value || 'nova';
  const normalized = cloud.normalizeStudentNumber(number);
  if (normalized.length < 3 || normalized.length > 20) return setMessage('#v205FormMessage', '学籍番号を確認してください。', 'error');
  if (name.trim().length < 2 || name.trim().length > 16) return setMessage('#v205FormMessage', 'プレイヤー名は2〜16文字で入力してください。', 'error');
  if (!course) return setMessage('#v205FormMessage', '所属コースを選択してください。', 'error');

  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'CREATING...'; }
  setMessage('#v205FormMessage', 'アカウントを作成しています…');
  try {
    await cloud.createStudentAccount({ studentNumber: normalized, playerName: name, courseCode: course, avatarId: avatar });
    setMessage('#v205FormMessage', '登録しました。', 'success');
    setTimeout(() => appStarted ? location.reload() : startApp(), 350);
  } catch (error) {
    console.error(error);
    const raw = String(error?.message || '登録できませんでした。');
    const msg = /already registered|duplicate|unique/i.test(raw) ? 'この学籍番号はすでに登録されています。「すでにアカウントがある方」から接続してください。' : raw;
    setMessage('#v205FormMessage', msg, 'error');
    if (submit) { submit.disabled = false; submit.textContent = '登録する'; }
  }
}

async function submitLinkForm(form) {
  const pin = String(document.querySelector('#v205Pin')?.value || '').replace(/\D/g,'');
  if (pin.length !== 6) return setMessage('#v205LinkMessage', '6桁のPINを入力してください。', 'error');
  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'CHECKING...'; }
  try {
    const result = await cloud.claimDeviceLinkPin(pin);
    targetLink = { id: result?.request_id, ...result };
    showTargetWaiting(result);
    pollTargetLink();
  } catch (error) {
    console.error(error);
    const message = error?.message || '';
    setMessage('#v205LinkMessage', /PIN is invalid or expired/i.test(message)
      ? 'このPINは使用できません。入力内容を確認し、使用済み・期限切れの場合は元の端末で新しいPINを発行してください。'
      : message || 'PINを確認できませんでした。', 'error');
    if (submit) { submit.disabled = false; submit.textContent = 'この端末を接続'; }
  }
}

function pollTargetLink() {
  if (linkPollTimer) clearInterval(linkPollTimer);
  linkPollTimer = setInterval(async () => {
    const request = targetLink;
    if (!request?.id || request.cancelling) return;
    try {
      const status = await cloud.getDeviceLinkTargetStatus(request.id);
      if (!status || targetLink !== request || request.cancelling) return;
      if (status.status === 'confirmed') {
        clearInterval(linkPollTimer); linkPollTimer = null;
        cloud.setGuestMode(false);
        await cloud.getMyPlayer();
        if (targetLink !== request || request.cancelling) return;
        targetLink = null;
        if (appStarted) location.reload();
        else await startApp();
      } else if (['cancelled','expired'].includes(status.status)) {
        clearInterval(linkPollTimer); linkPollTimer = null;
        targetLink = null;
        showLinkInput();
        setMessage('#v205LinkMessage', status.status === 'expired' ? 'PINの有効期限が切れました。新しいPINを発行してください。' : '接続がキャンセルされました。', 'error');
      }
    } catch (error) { console.warn('[device link target poll]', error); }
  }, 1200);
}

async function cancelTargetLink() {
  const request = targetLink;
  if (!request?.id || request.cancelling) return;
  request.cancelling = true;
  const button = document.querySelector('[data-v205-action="cancel-target-link"]');
  if (button) button.disabled = true;
  setMessage('#v205TargetMessage', 'キャンセルしています…');
  try {
    await cloud.cancelDeviceLink(request.id);
    if (targetLink !== request) return;
    targetLink = null;
    if (linkPollTimer) clearInterval(linkPollTimer);
    linkPollTimer = null;
    showLinkInput();
    setMessage('#v205LinkMessage', '接続をキャンセルしました。');
  } catch (error) {
    if (targetLink !== request) return;
    request.cancelling = false;
    if (button) button.disabled = false;
    setMessage('#v205TargetMessage', 'キャンセルできませんでした。接続状態を確認し、もう一度お試しください。', 'error');
    pollTargetLink();
  }
}

async function openSourceLink() {
  try {
    const profile = await cloud.getMyPlayer();
    if (!profile || profile.is_guest) return showLinkInput({ modal: true });
    const result = await cloud.createDeviceLinkPin();
    sourceLink = result;
    renderSourcePin(result);
    pollSourceLink();
  } catch (error) {
    showTransientModal('PINを発行できませんでした', error?.message || '接続エラー');
  }
}

function renderSourcePin(info, status = 'pending') {
  const expiresAt = info?.expires_at ? new Date(info.expires_at) : new Date(Date.now()+5*60*1000);
  const remaining = Math.max(0, Math.ceil((expiresAt.getTime()-Date.now())/1000));
  const waitingCopy = status === 'awaiting_confirmation'
    ? `<div class="ic-confirm-box"><strong>新しい端末から接続要求があります。</strong><p>心当たりがある場合のみ承認してください。</p><div class="ic-account-actions"><button class="ic-btn secondary" data-v205-action="cancel-source-link">拒否</button><button class="ic-btn primary" data-v205-action="confirm-source-link">この端末を追加</button></div></div>`
    : `<div class="ic-pin-display"><span>${esc(info.pin || '------')}</span><small id="v205PinCountdown">有効期限 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}</small></div><p class="ic-account-footnote">新しい端末でこのPINを入力してください。PIN入力後、この端末に最終確認が表示されます。</p>`;
  panel(`${header('DEVICE LINK', '別の端末でログイン', status === 'awaiting_confirmation' ? '新しい端末を確認してください。' : '6桁PINを新しい端末へ入力してください。')}${waitingCopy}
    <div class="ic-account-actions"><button class="ic-btn secondary" data-v205-action="close-account-ui">閉じる</button>${status !== 'awaiting_confirmation' ? '<button class="ic-btn danger" data-v205-action="cancel-source-link">PINを無効にする</button>' : ''}</div>`, { modal: true });

  if (sourceCountdownTimer) clearInterval(sourceCountdownTimer);
  sourceCountdownTimer = setInterval(() => {
    const node = document.querySelector('#v205PinCountdown');
    const sec = Math.max(0, Math.ceil((expiresAt.getTime()-Date.now())/1000));
    if (node) node.textContent = `有効期限 ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    if (sec <= 0) {
      clearInterval(sourceCountdownTimer); sourceCountdownTimer = null;
      if (linkPollTimer) clearInterval(linkPollTimer);
      linkPollTimer = null;
      sourceLink = null;
      showTransientModal('PINの有効期限が切れました', '設定から新しいPINを発行してください。');
    }
  }, 1000);
}

function pollSourceLink() {
  if (linkPollTimer) clearInterval(linkPollTimer);
  linkPollTimer = setInterval(async () => {
    const request = sourceLink;
    if (!request?.request_id) return;
    try {
      const status = await cloud.getDeviceLinkSourceStatus(request.request_id);
      if (!status || sourceLink !== request) return;
      if (status.status === 'awaiting_confirmation') {
        if (request.status !== 'awaiting_confirmation') {
          request.status = 'awaiting_confirmation';
          renderSourcePin(request, 'awaiting_confirmation');
        }
      } else if (['expired','cancelled','confirmed'].includes(status.status)) {
        clearInterval(linkPollTimer); linkPollTimer = null;
        sourceLink = null;
        if (sourceCountdownTimer) clearInterval(sourceCountdownTimer);
        sourceCountdownTimer = null;
        if (status.status !== 'confirmed') showTransientModal(status.status === 'expired' ? 'PINの有効期限が切れました' : '接続がキャンセルされました', '設定から新しいPINを発行してください。');
        if (status.status === 'confirmed') showTransientModal('接続完了', '新しい端末でも同じアカウントを使用できます。');
      }
    } catch (error) { console.warn('[device link source poll]', error); }
  }, 1200);
}

async function confirmSourceLink() {
  if (!sourceLink?.request_id) return;
  try {
    await cloud.confirmDeviceLink(sourceLink.request_id);
    sourceLink = null;
    showTransientModal('接続完了', '新しい端末をアカウントへ追加しました。両方の端末をそのまま使用できます。');
  } catch (error) { showTransientModal('承認できませんでした', error?.message || '接続エラー'); }
}

async function cancelSourceLink() {
  if (sourceLink?.request_id) {
    try { await cloud.cancelDeviceLink(sourceLink.request_id); } catch {}
  }
  sourceLink = null;
  clearUi();
}

function showTransientModal(title, text) {
  clearUi();
  panel(`${header('INTERVAL COSMOS', title, text)}<div class="ic-account-actions"><button class="ic-btn primary" data-v205-action="close-account-ui">OK</button></div>`, { modal: true });
}

async function openProfileEditor() {
  const profile = await cloud.getMyPlayer();
  if (!profile || profile.is_guest) return showStudentForm({ modal: true });
  const course = COURSES.find(c => c.code === profile.course_code);
  const staff = profile.account_type === 'staff';
  const selectedAvatar = staff ? 'teacher' : (profile.avatar_id || 'nova');
  panel(`${header('PLAYER PROFILE', 'PROFILE SETTINGS', '公開プロフィールとランキング公開設定を変更します。')}
    <form class="ic-account-form" id="v205ProfileForm">
      ${profile.student_number ? `<label><span>学籍番号 <em>PRIVATE</em></span><input value="${esc(profile.student_number)}" readonly></label>` : ''}
      ${course ? `<label><span>所属コース</span><input value="${esc(course.name)}" readonly></label>` : ''}
      <label><span>プレイヤー名 <em>PUBLIC</em></span><input id="v205EditName" maxlength="16" value="${esc(profile.player_name)}"></label>
      <label><span>ランキング公開</span><select id="v205RankingVisibility"><option value="ask" ${profile.ranking_visibility==='ask'?'selected':''}>毎回確認する</option><option value="always_public" ${profile.ranking_visibility==='always_public'?'selected':''}>常に公開する</option><option value="always_private" ${profile.ranking_visibility==='always_private'?'selected':''}>常に非公開</option></select></label>
      <fieldset><legend>${staff ? 'TEACHER ICON' : 'AVATAR'}</legend><div class="ic-avatar-grid">${staff ? avatarTile('teacher','TEACHER',true) : AVATARS.map(a=>avatarTile(a[0],a[1],a[0]===selectedAvatar)).join('')}</div><input type="hidden" id="v205EditAvatar" value="${selectedAvatar}"></fieldset>
      <div class="ic-form-message" id="v205EditMessage"></div>
      <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-action="close-account-ui">キャンセル</button><button type="submit" class="ic-btn primary">保存</button></div>
    </form>`, { modal: true });
}

async function saveProfileEditor(form) {
  const name = String(document.querySelector('#v205EditName')?.value || '').trim();
  const avatarId = document.querySelector('#v205EditAvatar')?.value || null;
  const rankingVisibility = document.querySelector('#v205RankingVisibility')?.value || 'ask';
  if (name.length < 2 || name.length > 16) return setMessage('#v205EditMessage', 'プレイヤー名は2〜16文字で入力してください。', 'error');
  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'SAVING...'; }
  try {
    await cloud.updateMyProfile({ playerName: name, avatarId, rankingVisibility });
    setMessage('#v205EditMessage', '保存しました。画面を更新します。', 'success');
    setTimeout(() => location.reload(), 450);
  } catch (error) {
    setMessage('#v205EditMessage', error?.message || '保存できませんでした。', 'error');
    if (submit) { submit.disabled = false; submit.textContent = '保存'; }
  }
}

function installAppEnhancements() {
  const enhanceSettings = () => {
    const cloudBox = document.querySelector('.cloud-setting');
    if (!cloudBox || cloudBox.querySelector('[data-v205-injected]')) return;
    const profile = cloud.getCachedPlayer?.();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.v205Injected = '1';
    btn.className = 'secondary-btn ic-v205-settings-btn';
    if (profile?.is_guest) {
      btn.textContent = '正式アカウントを作成';
      btn.dataset.v205Action = 'guest-convert';
      const existing = document.createElement('button');
      existing.type = 'button';
      existing.className = 'secondary-btn ic-v205-settings-btn';
      existing.textContent = 'すでにアカウントがある';
      existing.dataset.v205Action = 'existing';
      cloudBox.appendChild(existing);
    } else {
      btn.textContent = '別の端末でログイン';
      btn.dataset.v205Action = 'source-link';
    }
    cloudBox.appendChild(btn);
  };
  const observer = new MutationObserver(enhanceSettings);
  observer.observe(document.body, { subtree: true, childList: true });
  enhanceSettings();
}

window.addEventListener('click', event => {
  const oldEdit = event.target.closest?.('[data-action="edit-profile"]');
  if (oldEdit && appStarted) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openProfileEditor();
    return;
  }

  const node = event.target.closest?.('[data-v205-action]');
  if (!node) return;
  const action = node.dataset.v205Action;
  if (action === 'student') showStudentForm();
  else if (action === 'existing') showLinkInput({ modal: appStarted });
  else if (action === 'staff-info') showStaffInfo();
  else if (action === 'chooser') appStarted ? clearUi() : showChooser();
  else if (action === 'guest') { cloud.setGuestMode(true); startApp(); }
  else if (action === 'guest-convert') showStudentForm({ modal: true });
  else if (action === 'source-link') openSourceLink();
  else if (action === 'confirm-source-link') confirmSourceLink();
  else if (action === 'cancel-source-link') cancelSourceLink();
  else if (action === 'cancel-target-link') cancelTargetLink();
  else if (action === 'close-account-ui') clearUi();
  else if (action === 'offline-start') startApp();
  else if (action === 'retry-boot') { appStarted = false; boot(); }
}, true);

window.addEventListener('click', event => {
  const avatar = event.target.closest?.('[data-v205-avatar]');
  if (!avatar) return;
  const scope = avatar.closest('form') || avatar.closest('.ic-account-panel');
  scope?.querySelectorAll('[data-v205-avatar]').forEach(btn => { btn.classList.toggle('active', btn === avatar); btn.setAttribute('aria-pressed', String(btn === avatar)); });
  const input = scope?.querySelector('#v205Avatar, #v205EditAvatar');
  if (input) input.value = avatar.dataset.v205Avatar;
});

window.addEventListener('submit', event => {
  if (event.target.id === 'v205StudentForm') { event.preventDefault(); submitStudentForm(event.target); }
  else if (event.target.id === 'v205LinkForm') { event.preventDefault(); submitLinkForm(event.target); }
  else if (event.target.id === 'v205ProfileForm') { event.preventDefault(); saveProfileEditor(event.target); }
});

window.IntervalCosmosAccountUI = { openProfileEditor, openSourceLink, showChooser };
boot();
