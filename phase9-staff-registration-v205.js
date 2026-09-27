(() => {
  const cloud = window.IntervalCosmosCloud;
  const singleton = window.IntervalCosmosSupabaseSingleton;
  if (!cloud || !singleton || cloud.__v205StaffRegistrationInstalled) return;
  cloud.__v205StaffRegistrationInstalled = true;

  const STAFF_COURSES = [
    { code:'piano', department:'音楽学科', name:'ピアノコース' },
    { code:'orchestral', department:'音楽学科', name:'管弦打楽コース' },
    { code:'vocal_musical', department:'音楽学科', name:'声楽・ミュージカルコース' },
    { code:'composition', department:'音楽学科', name:'作曲コース' },
    { code:'rock_pops', department:'音楽学科', name:'ロック＆ポップスコース' },
    { code:'electronic_organ', department:'音楽学科', name:'電子オルガンコース' },
    { code:'sound_design', department:'音楽学科', name:'サウンドデザインコース' },
    { code:'music_education', department:'音楽学科', name:'音楽教育コース' },
    { code:'music_therapy', department:'音楽学科', name:'音楽療法コース' },
    { code:'child_culture', department:'未来創造学科', name:'こども文化コース' },
    { code:'voice_actor', department:'未来創造学科', name:'声優コース' },
  ];

  function client() {
    const c = singleton.getClient?.();
    if (!c) throw new Error('オンライン接続の準備ができていません。');
    return c;
  }

  function firstRow(data) {
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;'
    }[c]));
  }

  function courseOptions(selected = '') {
    return ['音楽学科','未来創造学科'].map(dep => `
      <optgroup label="${esc(dep)}">${STAFF_COURSES.filter(c => c.department === dep).map(c =>
        `<option value="${esc(c.code)}" ${c.code === selected ? 'selected' : ''}>${esc(c.name)}</option>`
      ).join('')}</optgroup>`).join('');
  }

  function validCourse(code) {
    return STAFF_COURSES.some(c => c.code === code);
  }

  async function createStaffAccount({ realName, playerName, courseCode }) {
    const real = String(realName || '').trim();
    const name = String(playerName || '').trim();
    const course = String(courseCode || '').trim();
    if (real.length < 2 || real.length > 40) throw new Error('氏名は2〜40文字で入力してください。');
    if (name.length < 2 || name.length > 16) throw new Error('プレイヤー名は2〜16文字で入力してください。');
    if (!validCourse(course)) throw new Error('所属コースを選択してください。');

    const { error } = await client().rpc('create_staff_account', {
      p_real_name: real,
      p_player_name: name,
      p_course_code: course,
    });
    if (error) throw error;
    cloud.setGuestMode?.(false);
    return cloud.getMyPlayer();
  }

  async function getMyPrivateIdentity() {
    const { data, error } = await client().rpc('get_my_private_identity');
    if (error) throw error;
    return firstRow(data);
  }

  async function updateMyStaffIdentity(realName, courseCode) {
    const real = String(realName || '').trim();
    const course = String(courseCode || '').trim();
    if (real.length < 2 || real.length > 40) throw new Error('氏名は2〜40文字で入力してください。');
    if (!validCourse(course)) throw new Error('所属コースを選択してください。');
    const { error } = await client().rpc('update_my_staff_identity', {
      p_real_name: real,
      p_course_code: course,
    });
    if (error) throw error;
  }

  cloud.createStaffAccount = createStaffAccount;
  cloud.getMyPrivateIdentity = getMyPrivateIdentity;
  cloud.updateMyStaffIdentity = updateMyStaffIdentity;

  function root() {
    let node = document.querySelector('#account-ui-root');
    if (!node) {
      node = document.createElement('div');
      node.id = 'account-ui-root';
      document.body.appendChild(node);
    }
    return node;
  }

  function showStaffForm() {
    root().innerHTML = `<div class="ic-account-layer">
      <div class="ic-account-stars" aria-hidden="true"></div>
      <section class="ic-account-panel">
        <header class="ic-account-head">
          <span class="ic-account-kicker">STAFF ACCESS</span>
          <h1>教職員登録</h1>
          <p>氏名は管理用、プレイヤー名と所属コースはランキング等に表示されます。</p>
        </header>
        <form class="ic-account-form" id="v205StaffForm">
          <div class="ic-staff-card">
            <span class="ic-avatar-art avatar-teacher" aria-hidden="true"><i></i><b></b></span>
            <div><strong>TEACHER IDENTITY</strong><p>教職員アイコンは固定です。学籍番号・教職員番号は不要です。</p></div>
          </div>
          <label><span>氏名 <em>PRIVATE</em></span><input id="v205StaffRealName" type="text" autocomplete="name" maxlength="40" placeholder="例：教員 太郎" required></label>
          <label><span>プレイヤー名 <em>PUBLIC</em></span><input id="v205StaffPlayerName" type="text" autocomplete="nickname" maxlength="16" placeholder="2〜16文字" required></label>
          <label><span>所属コース <em>PUBLIC BADGE</em></span><select id="v205StaffCourse" required><option value="">選択してください</option>${courseOptions()}</select></label>
          <p class="ic-account-footnote">氏名はランキング・公開プロフィールには表示されません。所属コースは学生と同様に公開バッジとして表示されます。自己登録した教職員アカウントに管理者権限は付与されません。</p>
          <div class="ic-form-message" id="v205StaffMessage" aria-live="polite"></div>
          <div class="ic-account-actions"><button type="button" class="ic-btn secondary" data-v205-staff-cancel>戻る</button><button type="submit" class="ic-btn primary">教職員として登録</button></div>
        </form>
      </section>
      <div class="ic-account-version">ver.2.0.5</div>
    </div>`;
  }

  function setMessage(text, type = '') {
    const node = document.querySelector('#v205StaffMessage');
    if (!node) return;
    node.textContent = text || '';
    node.className = `ic-form-message ${type}`;
  }

  async function submitStaffForm(form) {
    const realName = String(document.querySelector('#v205StaffRealName')?.value || '').trim();
    const playerName = String(document.querySelector('#v205StaffPlayerName')?.value || '').trim();
    const courseCode = String(document.querySelector('#v205StaffCourse')?.value || '').trim();
    if (realName.length < 2 || realName.length > 40) return setMessage('氏名は2〜40文字で入力してください。', 'error');
    if (playerName.length < 2 || playerName.length > 16) return setMessage('プレイヤー名は2〜16文字で入力してください。', 'error');
    if (!validCourse(courseCode)) return setMessage('所属コースを選択してください。', 'error');

    const submit = form.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'CREATING...'; }
    setMessage('教職員アカウントを作成しています…');
    try {
      await createStaffAccount({ realName, playerName, courseCode });
      setMessage('登録しました。ゲームを起動します。', 'success');
      window.setTimeout(() => location.reload(), 350);
    } catch (error) {
      console.error('[staff registration]', error);
      setMessage(error?.message || '登録できませんでした。', 'error');
      if (submit) { submit.disabled = false; submit.textContent = '教職員として登録'; }
    }
  }

  async function enhanceStaffProfileEditor() {
    const form = document.querySelector('#v205ProfileForm');
    if (!form || form.dataset.v205StaffIdentity === '1') return;
    const profile = cloud.getCachedPlayer?.();
    if (profile?.account_type !== 'staff') return;
    form.dataset.v205StaffIdentity = '1';

    const playerNameLabel = form.querySelector('#v205EditName')?.closest('label');
    if (!playerNameLabel) return;

    // Remove the base read-only course row (if one exists) and replace it with
    // a staff-editable public course selector.
    form.querySelectorAll('label').forEach(label => {
      const span = label.querySelector('span');
      if (span?.textContent?.trim().startsWith('所属コース')) label.remove();
    });

    const realLabel = document.createElement('label');
    realLabel.dataset.v205StaffRealNameRow = '1';
    realLabel.innerHTML = '<span>氏名 <em>PRIVATE</em></span><input id="v205StaffEditRealName" maxlength="40" autocomplete="name" placeholder="管理用の氏名" required><small>ランキング・公開プロフィールには表示されません</small>';
    playerNameLabel.insertAdjacentElement('beforebegin', realLabel);

    const courseLabel = document.createElement('label');
    courseLabel.dataset.v205StaffCourseRow = '1';
    courseLabel.innerHTML = `<span>所属コース <em>PUBLIC BADGE</em></span><select id="v205StaffEditCourse" required><option value="">選択してください</option>${courseOptions(profile.course_code || '')}</select><small>ランキング・公開プロフィールに表示されます</small>`;
    playerNameLabel.insertAdjacentElement('beforebegin', courseLabel);

    try {
      const identity = await getMyPrivateIdentity();
      const input = document.querySelector('#v205StaffEditRealName');
      if (input && identity?.real_name) input.value = identity.real_name;
      const course = document.querySelector('#v205StaffEditCourse');
      if (course && identity?.course_code) course.value = identity.course_code;
    } catch (error) {
      console.warn('[staff private identity]', error);
    }
  }

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceStaffProfileEditor();
    });
  });
  observer.observe(document.documentElement, { subtree:true, childList:true });

  window.addEventListener('click', event => {
    const staffButton = event.target.closest?.('[data-v205-action="staff-info"]');
    if (staffButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showStaffForm();
      return;
    }
    const cancel = event.target.closest?.('[data-v205-staff-cancel]');
    if (cancel) {
      event.preventDefault();
      const ui = window.IntervalCosmosAccountUI;
      if (ui?.showChooser) ui.showChooser();
      else location.reload();
    }
  }, true);

  window.addEventListener('submit', event => {
    if (event.target.id === 'v205StaffForm') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      submitStaffForm(event.target);
      return;
    }

    if (event.target.id !== 'v205ProfileForm') return;
    const profile = cloud.getCachedPlayer?.();
    if (profile?.account_type !== 'staff') return;
    const realInput = document.querySelector('#v205StaffEditRealName');
    const courseInput = document.querySelector('#v205StaffEditCourse');
    if (!realInput || !courseInput) return;

    const realName = String(realInput.value || '').trim();
    const courseCode = String(courseInput.value || '').trim();
    const playerName = String(document.querySelector('#v205EditName')?.value || '').trim();
    const rankingVisibility = document.querySelector('#v205RankingVisibility')?.value || 'ask';

    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const message = document.querySelector('#v205EditMessage');
    if (realName.length < 2 || realName.length > 40) {
      if (message) { message.textContent = '氏名は2〜40文字で入力してください。'; message.className = 'ic-form-message error'; }
      return;
    }
    if (!validCourse(courseCode)) {
      if (message) { message.textContent = '所属コースを選択してください。'; message.className = 'ic-form-message error'; }
      return;
    }
    if (playerName.length < 2 || playerName.length > 16) return;

    const submit = event.target.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'SAVING...'; }
    Promise.resolve()
      .then(() => updateMyStaffIdentity(realName, courseCode))
      .then(() => cloud.updateMyProfile({ playerName, avatarId:'teacher', rankingVisibility }))
      .then(() => {
        if (message) { message.textContent = '保存しました。画面を更新します。'; message.className = 'ic-form-message success'; }
        window.setTimeout(() => location.reload(), 450);
      })
      .catch(error => {
        if (message) { message.textContent = error?.message || '保存できませんでした。'; message.className = 'ic-form-message error'; }
        if (submit) { submit.disabled = false; submit.textContent = '保存'; }
      });
  }, true);

  window.IntervalCosmosStaffRegistrationV205 = {
    showStaffForm,
    createStaffAccount,
  };
})();
