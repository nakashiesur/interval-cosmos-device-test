(() => {
  const cloud = window.IntervalCosmosCloud;
  let client = null;
  let currentPlayerId = null;
  let injectQueued = false;
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  async function ensureClient(){
    if (client) return client;
    await cloud?.init?.();
    client = window.IntervalCosmosSupabaseSingleton?.getClient?.() || null;
    if (!client) throw new Error('オンライン接続を初期化できませんでした。');
    return client;
  }

  function isAdmin(){
    return Boolean(cloud?.getCachedPlayer?.()?.is_admin);
  }

  async function rpc(name,args={}){
    const c = await ensureClient();
    const {data,error} = await c.rpc(name,args);
    if (error) throw error;
    return data;
  }

  function managerOverlay(){
    let node = document.querySelector('.v205-admin-manage-overlay');
    if (!node){
      node = document.createElement('div');
      node.className = 'v205-admin-manage-overlay';
      document.body.appendChild(node);
    }
    return node;
  }

  function closeManager(){
    document.querySelector('.v205-admin-manage-overlay')?.remove();
  }

  function setMessage(text='',error=false){
    const node = document.querySelector('.v205-admin-manage-message');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('error',Boolean(error));
  }

  function renderLoading(){
    managerOverlay().innerHTML = `
      <section class="v205-admin-manage-panel">
        <div class="v205-admin-manage-loading"><span class="spinner"></span><strong>管理情報を読み込んでいます</strong></div>
      </section>`;
  }

  function renderError(error){
    managerOverlay().innerHTML = `
      <section class="v205-admin-manage-panel">
        <header><div><p>ADMIN / PLAYER</p><h2>読み込めませんでした</h2></div><button type="button" data-v205-admin-manage-close>×</button></header>
        <p class="v205-admin-manage-error">${esc(error?.message || '管理情報の取得に失敗しました。')}</p>
      </section>`;
  }

  async function loadCatalogs(){
    const c = await ensureClient();
    const [courseResult,avatarResult] = await Promise.all([
      c.from('courses').select('code,display_name,sort_order').order('sort_order'),
      c.from('avatar_catalog').select('id,display_name,sort_order').eq('is_active',true).eq('staff_only',false).order('sort_order'),
    ]);
    if (courseResult.error) throw courseResult.error;
    if (avatarResult.error) throw avatarResult.error;
    return { courses:courseResult.data || [], avatars:avatarResult.data || [] };
  }

  function renderManager(player,catalogs){
    const courses = catalogs.courses || [];
    const avatars = catalogs.avatars || [];
    const suspended = Boolean(player.is_suspended);
    const rankingRows = Number(player.published_ranking_rows || 0);
    managerOverlay().innerHTML = `
      <section class="v205-admin-manage-panel" data-player-id="${esc(player.player_id)}">
        <header class="v205-admin-manage-head">
          <div><p>ADMIN / PLAYER MANAGEMENT</p><h2>${esc(player.student_number || '—')}　${esc(player.player_name || 'PLAYER')}</h2><span>UUID ${esc(player.player_id)}</span></div>
          <button type="button" class="v205-admin-manage-close" data-v205-admin-manage-close aria-label="閉じる">×</button>
        </header>

        <section class="v205-admin-manage-block">
          <div class="v205-admin-manage-title"><div><h3>PROFILE</h3><span>学生プロフィール</span></div></div>
          <div class="v205-admin-manage-fields">
            <label><span>プレイヤー名</span><input id="v205AdminManageName" maxlength="16" value="${esc(player.player_name || '')}"></label>
            <label><span>所属コース</span><select id="v205AdminManageCourse">${courses.map(row=>`<option value="${esc(row.code)}" ${row.code===player.course_code?'selected':''}>${esc(row.display_name)}</option>`).join('')}</select></label>
            <label><span>アバター</span><select id="v205AdminManageAvatar">${avatars.map(row=>`<option value="${esc(row.id)}" ${row.id===player.avatar_id?'selected':''}>${esc(row.display_name || row.id)}</option>`).join('')}</select></label>
          </div>
          <button type="button" class="primary-btn" data-v205-admin-save-profile>変更を保存</button>
        </section>

        <section class="v205-admin-manage-block">
          <div class="v205-admin-manage-title"><div><h3>ACCOUNT STATE</h3><span>${suspended?'現在：一時停止中':'現在：利用可能'} / 連携端末 ${Number(player.linked_devices||0)}</span></div></div>
          <button type="button" class="secondary-btn ${suspended?'restore':''}" data-v205-admin-toggle-suspend data-next="${suspended?'false':'true'}">${suspended?'アカウント停止を解除':'アカウントを一時停止'}</button>
        </section>

        <section class="v205-admin-manage-block">
          <div class="v205-admin-manage-title"><div><h3>RANKING</h3><span>公開中のランキング行 ${rankingRows}</span></div></div>
          <div class="v205-admin-manage-actions">
            <button type="button" class="secondary-btn" data-v205-admin-unpublish-rankings>公開記録を非公開にする</button>
            <button type="button" class="secondary-btn danger" data-v205-admin-delete-rankings>ランキングBESTを削除</button>
          </div>
          <p class="v205-admin-manage-note">非公開化は学習履歴とBESTを保持します。ランキングBEST削除はランキング用BESTキャッシュのみを削除し、プレイ履歴は保持します。</p>
        </section>

        <section class="v205-admin-manage-block danger-zone">
          <div class="v205-admin-manage-title"><div><h3>DANGER ZONE</h3><span>完全削除は取り消せません</span></div></div>
          <button type="button" class="secondary-btn danger" data-v205-admin-delete-account>アカウントを完全削除</button>
        </section>

        <div class="v205-admin-manage-message" role="status"></div>
      </section>`;
  }

  async function openManager(playerId=currentPlayerId){
    if (!isAdmin() || !playerId) return;
    currentPlayerId = playerId;
    renderLoading();
    try{
      const [player,catalogs] = await Promise.all([
        rpc('admin_get_player_management',{p_player_id:playerId}),
        loadCatalogs(),
      ]);
      renderManager(player,catalogs);
    }catch(error){
      console.error('[admin player management]',error);
      renderError(error);
    }
  }

  function confirmation(title,body,confirmLabel,{typed='',danger=false}={}){
    return new Promise(resolve=>{
      const node = document.createElement('div');
      node.className = 'v205-admin-confirm-overlay';
      node.innerHTML = `<section class="v205-admin-confirm-panel">
        <p>ADMIN CONFIRMATION</p><h3>${esc(title)}</h3><div class="v205-admin-confirm-copy">${esc(body)}</div>
        ${typed?`<label><span>確認のため <b>${esc(typed)}</b> と入力</span><input data-v205-admin-confirm-input autocomplete="off"></label>`:''}
        <div class="v205-admin-confirm-actions"><button type="button" class="secondary-btn" data-v205-admin-confirm-cancel>キャンセル</button><button type="button" class="primary-btn ${danger?'danger':''}" data-v205-admin-confirm-ok ${typed?'disabled':''}>${esc(confirmLabel)}</button></div>
      </section>`;
      document.body.appendChild(node);
      const input=node.querySelector('[data-v205-admin-confirm-input]');
      const ok=node.querySelector('[data-v205-admin-confirm-ok]');
      const finish=value=>{node.remove();resolve(value)};
      node.addEventListener('click',event=>{
        if(event.target.closest('[data-v205-admin-confirm-cancel]')) finish(false);
        if(event.target.closest('[data-v205-admin-confirm-ok]') && !ok.disabled) finish(true);
      });
      input?.addEventListener('input',()=>{ok.disabled=input.value.trim()!==typed});
      input?.focus();
    });
  }

  async function withBusy(action){
    if (busy) return;
    busy=true;
    document.querySelector('.v205-admin-manage-panel')?.classList.add('busy');
    try{ await action(); }
    catch(error){ console.error('[admin player mutation]',error); setMessage(error?.message || '操作に失敗しました。',true); }
    finally{ busy=false; document.querySelector('.v205-admin-manage-panel')?.classList.remove('busy'); }
  }

  async function refreshStudentAndManager(){
    const id=currentPlayerId;
    await openManager(id);
    window.IntervalCosmosAdminDashboardV205?.openStudent?.(id);
  }

  async function saveProfile(){
    const name=document.getElementById('v205AdminManageName')?.value?.trim() || '';
    const course=document.getElementById('v205AdminManageCourse')?.value || '';
    const avatar=document.getElementById('v205AdminManageAvatar')?.value || '';
    await rpc('admin_update_player_profile',{p_player_id:currentPlayerId,p_player_name:name,p_course_code:course,p_avatar_id:avatar});
    setMessage('プロフィールを更新しました。');
    await refreshStudentAndManager();
  }

  async function toggleSuspend(button){
    const next=button.dataset.next==='true';
    const ok=await confirmation(next?'アカウントを一時停止しますか？':'停止を解除しますか？',next?'停止中はゲーム記録の送信や公開ランキング利用が拒否されます。':'この学生アカウントを再び利用可能にします。',next?'一時停止する':'停止を解除する',{danger:next});
    if(!ok)return;
    await rpc('admin_set_player_suspended',{p_player_id:currentPlayerId,p_suspended:next});
    await refreshStudentAndManager();
  }

  async function unpublishRankings(){
    const ok=await confirmation('公開ランキングを取り下げますか？','公開中のランキング記録だけを非公開にします。学習履歴と非公開BESTは残ります。','非公開にする');
    if(!ok)return;
    await rpc('admin_unpublish_player_rankings',{p_player_id:currentPlayerId});
    await refreshStudentAndManager();
  }

  async function deleteRankings(){
    const ok=await confirmation('ランキングBESTを削除しますか？','ランキング用BESTキャッシュを削除します。プレイ履歴は残りますが、次回のランクプレイからBESTが作り直されます。','ランキングBESTを削除',{typed:'RANKING',danger:true});
    if(!ok)return;
    await rpc('admin_delete_player_rankings',{p_player_id:currentPlayerId});
    await refreshStudentAndManager();
  }

  async function deleteAccount(){
    const ok=await confirmation('アカウントを完全削除しますか？','プロフィール、端末リンク、学習履歴、ランキング、実績、課題記録とリンク済み認証ユーザーを削除します。この操作は取り消せません。','完全削除',{typed:'DELETE',danger:true});
    if(!ok)return;
    const c=await ensureClient();
    const {data,error}=await c.functions.invoke('admin-delete-player',{body:{player_id:currentPlayerId,confirmation:'DELETE'}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    closeManager();
    currentPlayerId=null;
    await window.IntervalCosmosAdminDashboardV205?.open?.(true);
  }

  function injectManageButton(){
    if (!isAdmin() || !currentPlayerId) return;
    const detail=document.querySelector('.v205-admin-dashboard .v205-admin-head .idbox');
    if(!detail || detail.querySelector('[data-v205-admin-manage-open]'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='secondary-btn v205-admin-manage-open';
    button.dataset.v205AdminManageOpen='1';
    button.textContent='⚙ MANAGE STUDENT';
    detail.appendChild(button);
  }

  function scheduleInject(){
    if(injectQueued)return;
    injectQueued=true;
    queueMicrotask(()=>{injectQueued=false;injectManageButton()});
  }

  window.addEventListener('click',event=>{
    const student=event.target.closest?.('[data-v205-admin-student]');
    if(student?.dataset?.v205AdminStudent){currentPlayerId=student.dataset.v205AdminStudent;scheduleInject();return}
    if(event.target.closest?.('[data-v205-admin-back]')){currentPlayerId=null;return}
    if(event.target.closest?.('[data-v205-admin-manage-open]')){openManager();return}
    if(event.target.closest?.('[data-v205-admin-manage-close]')){closeManager();return}
    if(event.target.closest?.('[data-v205-admin-save-profile]')){withBusy(saveProfile);return}
    const suspend=event.target.closest?.('[data-v205-admin-toggle-suspend]');
    if(suspend){withBusy(()=>toggleSuspend(suspend));return}
    if(event.target.closest?.('[data-v205-admin-unpublish-rankings]')){withBusy(unpublishRankings);return}
    if(event.target.closest?.('[data-v205-admin-delete-rankings]')){withBusy(deleteRankings);return}
    if(event.target.closest?.('[data-v205-admin-delete-account]')){withBusy(deleteAccount);return}
  },true);

  window.addEventListener('keydown',event=>{
    if(event.key==='Escape' && document.querySelector('.v205-admin-manage-overlay')){
      event.preventDefault();event.stopPropagation();closeManager();
    }
  },true);

  new MutationObserver(scheduleInject).observe(document.documentElement,{subtree:true,childList:true});
  scheduleInject();
})();
