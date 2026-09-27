(() => {
  const VERSION = 'ver.2.0.5-alpha4.2.1';
  const cloud = window.IntervalCosmosCloud;
  const config = window.INTERVAL_COSMOS_CLOUD || {};
  let client = null;
  let injectQueued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));

  function normalizeRecoveryCode(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function validRecoveryCode(value) {
    const code = normalizeRecoveryCode(value);
    return /^[A-Z0-9]{8,20}$/.test(code) && /[A-Z]/.test(code) && /[0-9]/.test(code);
  }

  async function ensureRecoveryClient() {
    if (!config.supabaseUrl || !(config.supabasePublishableKey || config.supabaseAnonKey)) {
      throw new Error('オンライン設定がありません。');
    }
    await cloud?.init?.();
    if (client) return client;
    if (!window.supabase?.createClient) throw new Error('Supabase SDKを読み込めませんでした。');
    client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey || config.supabaseAnonKey,
      { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
    );
    return client;
  }

  async function rpc(name, args) {
    const c = await ensureRecoveryClient();
    const { data, error } = await c.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function setMyRecoveryCode(recoveryCode) {
    const code = normalizeRecoveryCode(recoveryCode);
    if (!validRecoveryCode(code)) {
      throw new Error('復旧コードは8〜20文字の英数字で、英字と数字を両方含めてください。');
    }
    return rpc('set_my_recovery_code', { p_recovery_code:code });
  }

  async function getMyRecoveryStatus() {
    const result = await rpc('get_my_recovery_status');
    return result || { configured:false };
  }

  async function recoverStudentAccount({ studentNumber, recoveryCode }) {
    const normalizedStudent = cloud?.normalizeStudentNumber?.(studentNumber) || String(studentNumber || '').replace(/[^0-9]/g,'');
    const code = normalizeRecoveryCode(recoveryCode);
    if (normalizedStudent.length < 3 || normalizedStudent.length > 20 || !validRecoveryCode(code)) {
      throw new Error('学籍番号または復旧コードを確認してください。');
    }

    await cloud.ensureAccountAuth();
    const result = await rpc('recover_student_account', {
      p_student_number: normalizedStudent,
      p_recovery_code: code,
    });
    if (!result?.ok) {
      const error = new Error(result?.message || 'アカウントを復旧できませんでした。');
      error.code = result?.code || 'recovery_failed';
      error.remainingAttempts = result?.remaining_attempts;
      throw error;
    }

    cloud?.setGuestMode?.(false);
    await cloud?.getMyPlayer?.();
    return result;
  }

  if (cloud?.createStudentAccount && !cloud.__v205RecoveryCreateWrapped) {
    cloud.createStudentAccount = async ({
      studentNumber,
      playerName,
      courseCode,
      avatarId = 'nova',
      recoveryCode = null,
    }) => {
      const normalized = cloud.normalizeStudentNumber(studentNumber);
      const code = normalizeRecoveryCode(
        recoveryCode || document.querySelector('#v205RecoveryCode')?.value || ''
      );
      const confirmation = normalizeRecoveryCode(
        document.querySelector('#v205RecoveryCodeConfirm')?.value || code
      );

      if (normalized.length < 3 || normalized.length > 20) throw new Error('学籍番号を確認してください。');
      if (String(playerName || '').trim().length < 2 || String(playerName || '').trim().length > 16) throw new Error('プレイヤー名は2〜16文字で入力してください。');
      if (!courseCode) throw new Error('所属コースを選択してください。');
      if (!validRecoveryCode(code)) throw new Error('復旧コードは8〜20文字の英数字で、英字と数字を両方含めてください。');
      if (code !== confirmation) throw new Error('復旧コードの確認入力が一致していません。');
      if (code === normalized.toUpperCase()) throw new Error('復旧コードに学籍番号そのものは使用できません。');

      await cloud.ensureAccountAuth();
      const data = await rpc('create_player_account', {
        p_account_type:'student',
        p_student_number:normalized,
        p_player_name:String(playerName).trim(),
        p_course_code:courseCode,
        p_recovery_code:code,
        p_avatar_id:avatarId || 'nova',
      });
      cloud.setGuestMode(false);
      await cloud.getMyPlayer();
      return Array.isArray(data) ? (data[0] || null) : data;
    };
    cloud.__v205RecoveryCreateWrapped = true;
  }

  if (cloud) {
    cloud.normalizeRecoveryCode = normalizeRecoveryCode;
    cloud.validRecoveryCode = validRecoveryCode;
    cloud.setMyRecoveryCode = setMyRecoveryCode;
    cloud.getMyRecoveryStatus = getMyRecoveryStatus;
    cloud.recoverStudentAccount = recoverStudentAccount;
  }

  function uiRoot() {
    let root = document.querySelector('#account-ui-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'account-ui-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function header(kicker, title, text='') {
    return `<header class="ic-account-head"><span class="ic-account-kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</header>`;
  }

  function setMessage(id, text, type='') {
    const node = document.querySelector(id);
    if (!node) return;
    node.textContent = text || '';
    node.className = `ic-form-message ${type}`;
  }

  function showRecoveryForm() {
    uiRoot().innerHTML = `<div class="ic-account-layer">
      <div class="ic-account-stars" aria-hidden="true"></div>
      <section class="ic-account-panel">
        ${header('ACCOUNT RECOVERY','アカウントを復旧','Cookieの削除・端末の紛失などでログイン済み端末が残っていない場合に使用します。')}
        <form class="ic-account-form compact" id="v205RecoveryForm">
          <label><span>学籍番号 <em>PRIVATE</em></span><input id="v205RecoveryStudentNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="例：240265" required></label>
          <label><span>復旧コード <em>PRIVATE</em></span><input id="v205RecoveryInput" type="password" autocomplete="current-password" maxlength="20" placeholder="登録時に自分で決めた8〜20文字" required></label>
          <div class="ic-recovery-info"><strong>この操作でデータは作り直しません。</strong><span>既存の学習履歴・ランキング・COSMOS PT・フレームを、この端末へ再接続します。</span></div>
          <div class="ic-form-message" id="v205RecoveryMessage" aria-live="polite"></div>
          <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-recovery-back>戻る</button><button type="submit" class="ic-btn primary">復旧する</button></div>
        </form>
      </section>
      <div class="ic-account-version">${esc(window.IntervalCosmosVersion ? `ver.${window.IntervalCosmosVersion}` : VERSION)}</div>
    </div>`;
  }

  function showRecoverySettings() {
    uiRoot().innerHTML = `<div class="ic-account-layer is-modal">
      <div class="ic-account-stars" aria-hidden="true"></div>
      <section class="ic-account-panel">
        ${header('RECOVERY CODE','復旧コードを設定・変更','Cookieやサイトデータを削除した場合に、自分でアカウントを復旧するためのコードです。')}
        <form class="ic-account-form compact" id="v205RecoverySettingsForm">
          <label><span>新しい復旧コード <em>PRIVATE</em></span><input id="v205RecoverySettingsCode" type="password" autocomplete="new-password" maxlength="20" placeholder="8〜20文字の英数字" required></label>
          <label><span>もう一度入力 <em>CONFIRM</em></span><input id="v205RecoverySettingsConfirm" type="password" autocomplete="new-password" maxlength="20" placeholder="同じコードを入力" required></label>
          <div class="ic-recovery-info"><strong>英字と数字を両方含めてください。</strong><span>大文字・小文字は区別しません。学籍番号そのものは使用できません。忘れないコードを設定してください。</span></div>
          <div class="ic-form-message" id="v205RecoverySettingsMessage" aria-live="polite"></div>
          <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-recovery-close>キャンセル</button><button type="submit" class="ic-btn primary">保存する</button></div>
        </form>
      </section>
      <div class="ic-account-version">${esc(window.IntervalCosmosVersion ? `ver.${window.IntervalCosmosVersion}` : VERSION)}</div>
    </div>`;
  }

  async function submitRecovery(form) {
    const studentNumber = document.querySelector('#v205RecoveryStudentNumber')?.value || '';
    const recoveryCode = document.querySelector('#v205RecoveryInput')?.value || '';
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled=true; button.textContent='RECOVERING...'; }
    setMessage('#v205RecoveryMessage','既存アカウントを確認しています…');
    try {
      await recoverStudentAccount({ studentNumber, recoveryCode });
      setMessage('#v205RecoveryMessage','復旧しました。ゲームを再接続します。','success');
      window.setTimeout(() => window.location.reload(), 550);
    } catch (error) {
      console.error('[recovery]',error);
      const remaining = Number.isFinite(error?.remainingAttempts) && error.remainingAttempts > 0 ? `（残り${error.remainingAttempts}回）` : '';
      setMessage('#v205RecoveryMessage',`${error?.message || '復旧できませんでした。'}${remaining}`,'error');
      if (button) { button.disabled=false; button.textContent='復旧する'; }
    }
  }

  async function submitRecoverySettings(form) {
    const code = normalizeRecoveryCode(document.querySelector('#v205RecoverySettingsCode')?.value || '');
    const confirm = normalizeRecoveryCode(document.querySelector('#v205RecoverySettingsConfirm')?.value || '');
    if (!validRecoveryCode(code)) return setMessage('#v205RecoverySettingsMessage','8〜20文字の英数字で、英字と数字を両方含めてください。','error');
    if (code !== confirm) return setMessage('#v205RecoverySettingsMessage','確認入力が一致していません。','error');
    const student = cloud?.getCachedPlayer?.()?.student_number;
    if (student && code === String(student).toUpperCase()) return setMessage('#v205RecoverySettingsMessage','学籍番号そのものは使用できません。','error');

    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled=true; button.textContent='SAVING...'; }
    try {
      await setMyRecoveryCode(code);
      setMessage('#v205RecoverySettingsMessage','復旧コードを保存しました。','success');
      window.setTimeout(() => {
        document.querySelector('#account-ui-root')?.replaceChildren();
        const row = document.querySelector('.v205-recovery-setting');
        if (row) {
          row.dataset.statusLoaded='';
          refreshRecoverySettingStatus();
        }
      },650);
    } catch (error) {
      console.error('[recovery settings]',error);
      setMessage('#v205RecoverySettingsMessage',error?.message || '保存できませんでした。','error');
      if (button) { button.disabled=false; button.textContent='保存する'; }
    }
  }

  function injectStudentFields() {
    const form = document.querySelector('#v205StudentForm');
    if (!form || form.querySelector('#v205RecoveryCode')) return;
    const course = form.querySelector('#v205Course')?.closest('label');
    if (!course) return;
    const wrap = document.createElement('div');
    wrap.className='ic-recovery-registration';
    wrap.innerHTML=`<label><span>復旧コード <em>PRIVATE</em></span><input id="v205RecoveryCode" type="password" autocomplete="new-password" maxlength="20" placeholder="8〜20文字の英数字" required></label>
      <label><span>復旧コード確認 <em>PRIVATE</em></span><input id="v205RecoveryCodeConfirm" type="password" autocomplete="new-password" maxlength="20" placeholder="同じコードを入力" required></label>
      <div class="ic-recovery-info compact"><strong>Cookieを消しても自分で復旧できます。</strong><span>英字と数字を両方含めてください。大文字・小文字は区別しません。</span></div>`;
    course.insertAdjacentElement('afterend',wrap);
  }

  function injectRecoveryLink() {
    const form = document.querySelector('#v205LinkForm');
    if (!form || form.querySelector('[data-v205-recovery-open]')) return;
    const actions = form.querySelector('.ic-account-actions');
    if (!actions) return;
    const box = document.createElement('div');
    box.className='ic-recovery-alternative';
    box.innerHTML='<span>ログイン済み端末が1台も残っていない場合</span><button type="button" class="ic-btn secondary" data-v205-recovery-open>学籍番号＋復旧コードで復旧</button>';
    actions.insertAdjacentElement('beforebegin',box);
  }

  async function refreshRecoverySettingStatus() {
    const row = document.querySelector('.v205-recovery-setting');
    if (!row || row.dataset.statusLoaded === '1') return;
    const profile = cloud?.getCachedPlayer?.();
    if (!profile || profile.is_guest || profile.account_type !== 'student') return;

    row.dataset.statusLoaded='1';
    const status = row.querySelector('[data-v205-recovery-status]');
    try {
      const result = await getMyRecoveryStatus();
      if (status) {
        const next = result?.configured ? '設定済み' : '未設定';
        if (status.textContent !== next) status.textContent = next;
        status.classList.toggle('ready',Boolean(result?.configured));
        status.classList.toggle('missing',!result?.configured);
      }
      const button=row.querySelector('[data-v205-recovery-settings-open]');
      if (button) {
        const next = result?.configured ? '変更する' : '設定する';
        if (button.textContent !== next) button.textContent = next;
      }
    } catch {
      if (status && status.textContent !== '確認できません') status.textContent='確認できません';
    }
  }

  function injectRecoverySetting() {
    const settings = document.querySelector('.settings-modal .modal-card');
    const profile = cloud?.getCachedPlayer?.();
    if (!settings || !profile || profile.is_guest || profile.account_type !== 'student') return;

    if (!settings.querySelector('.v205-recovery-setting')) {
      const row=document.createElement('div');
      row.className='setting-row v205-recovery-setting';
      row.innerHTML='<div class="setting-label"><strong>Account recovery</strong><span>Cookie削除・端末紛失時の復旧</span></div><div class="v205-recovery-setting-actions"><em data-v205-recovery-status>確認中…</em><button type="button" class="secondary-btn" data-v205-recovery-settings-open>設定する</button></div>';
      const anchor = settings.querySelector('.settings-version');
      anchor ? anchor.insertAdjacentElement('beforebegin',row) : settings.appendChild(row);
    }
    refreshRecoverySettingStatus();
  }

  function inject() {
    injectStudentFields();
    injectRecoveryLink();
    injectRecoverySetting();
  }

  function queueInject() {
    if (injectQueued) return;
    injectQueued = true;
    const run = () => {
      injectQueued = false;
      inject();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else queueMicrotask(run);
  }

  const observer = new MutationObserver(queueInject);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('DOMContentLoaded',queueInject,{once:true});

  window.addEventListener('click', event => {
    if (event.target.closest?.('[data-v205-recovery-open]')) { event.preventDefault(); event.stopImmediatePropagation(); showRecoveryForm(); return; }
    if (event.target.closest?.('[data-v205-recovery-back]')) { event.preventDefault(); window.IntervalCosmosAccountUI?.showChooser?.(); return; }
    if (event.target.closest?.('[data-v205-recovery-settings-open]')) { event.preventDefault(); showRecoverySettings(); return; }
    if (event.target.closest?.('[data-v205-recovery-close]')) { event.preventDefault(); document.querySelector('#account-ui-root')?.replaceChildren(); return; }
  },true);

  window.addEventListener('submit',event=>{
    if(event.target.id==='v205RecoveryForm'){event.preventDefault();event.stopImmediatePropagation();submitRecovery(event.target);return;}
    if(event.target.id==='v205RecoverySettingsForm'){event.preventDefault();event.stopImmediatePropagation();submitRecoverySettings(event.target);}
  },true);

  window.IntervalCosmosRecoveryV205={
    version:VERSION,
    normalizeRecoveryCode,
    validRecoveryCode,
    recoverStudentAccount,
    setMyRecoveryCode,
    getMyRecoveryStatus,
    showRecoveryForm,
  };
})();
