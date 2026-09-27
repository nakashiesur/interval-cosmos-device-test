(() => {
  const cloud = window.IntervalCosmosCloud;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const policy = v => ({ask:'毎回確認',always_public:'常に公開',always_private:'常に非公開'}[v] || v);
  const errorText = error => error === 'Assignment is outside the allowed time window'
    ? '課題の受付期間外のため送信できません。課題の開始日時と期限を確認してください。'
    : error || '送信できませんでした。';
  let dialog, busy = false, renderedRows = '';
  function update() {
    const footer = document.querySelector('.home-footer');
    if (footer && !footer.querySelector('[data-sync-open]') && cloud?.getCachedPlayer()?.id) {
      const b = document.createElement('button'); b.className = 'secondary-btn'; b.dataset.syncOpen = '';
      b.textContent = '保存・同期'; footer.append(b);
    }
    const rows = cloud?.getSavedPlays?.() || [];
    const pending = rows.filter(r => r.status !== 'synced').length;
    document.querySelectorAll('[data-sync-open]').forEach(b => {
      const label = `保存・同期${pending ? ` (${pending})` : ''}`;
      if (b.textContent !== label) b.textContent = label;
    });
  }
  function render() {
    if (!dialog) return;
    const rows = cloud.getSavedPlays().slice().reverse();
    renderedRows = JSON.stringify(rows);
    dialog.innerHTML = `<section class="sync-card" role="dialog" aria-modal="true" aria-labelledby="sync-title"><header><h2 id="sync-title">保存・同期</h2><button class="icon-btn" data-sync-close aria-label="閉じる">×</button></header><p>この端末に保存した記録です。送信待ちは接続後に自動で再送します。ブラウザのデータを消去すると、未送信の記録も失われます。</p><button class="secondary-btn" data-sync-refresh>今すぐ同期</button><p data-sync-message role="status"></p><div class="sync-list">${rows.length ? rows.map(r => {
      const changed = r.errorCode === 'IC001';
      const text = r.status === 'synced' ? '送信済み' : r.status === 'blocked' ? '確認が必要' : '送信待ち';
      return `<article><div><strong>${esc(r.payload.mode)} · ${esc(r.payload.score)} pts</strong><small>${esc(new Date(r.payload.playedAt).toLocaleString('ja-JP'))}</small></div><b>${text}</b>${r.status === 'blocked' ? `<p>${changed ? `公開設定が変わったため停止しました。保存時：${esc(policy(r.visibility))}。現在の設定を確認して再送してください。` : `記録は端末に保持しています。${esc(errorText(r.error))}`}</p><button class="secondary-btn" data-sync-retry="${esc(r.payload.clientEventId)}" ${changed ? 'data-sync-policy' : ''}>${changed ? '公開設定を確認' : '再送を試す'}</button>` : ''}${r.result?.publication_required ? `<p>この記録は非公開です。</p><button class="secondary-btn" data-sync-publish="${esc(r.result.session_id)}">この記録を公開する</button>` : ''}</article>`;
    }).join('') : '<p>保存した記録はまだありません。</p>'}</div></section>`;
  }
  document.addEventListener('click', async e => {
    if (e.target.closest('[data-sync-open]')) {
      if (dialog) {dialog.querySelector('[data-sync-close]').focus(); return;}
      dialog = document.createElement('div'); dialog.className = 'sync-overlay'; document.body.append(dialog); render();
      dialog.querySelector('[data-sync-close]').focus(); return;
    }
    if (e.target.closest('[data-sync-close]') || e.target === dialog) {dialog?.remove(); dialog = null; busy = false; document.querySelector('[data-sync-open]')?.focus(); return;}
    const b = e.target.closest('[data-sync-refresh],[data-sync-retry],[data-sync-publish],[data-sync-accept]');
    if (!b || busy || !dialog?.contains(b)) return;
    const requestDialog = dialog;
    busy = true; b.disabled = true;
    try {
      if (b.hasAttribute('data-sync-policy')) {
        const p = await cloud.getMyPlayer();
        if (dialog !== requestDialog) return;
        const message = dialog.querySelector('[data-sync-message]');
        message.textContent = `現在：${policy(p.ranking_visibility)}。この設定で記録を送信します。`;
        const confirm = document.createElement('button'); confirm.className = 'secondary-btn';
        confirm.dataset.syncAccept = b.dataset.syncRetry;
        confirm.textContent = `「${policy(p.ranking_visibility)}」で送信`;
        // Bind consent to this exact policy; recheck immediately before sending.
        confirm.dataset.visibility = p.ranking_visibility;
        message.append(confirm);
      } else {
        if (b.dataset.syncAccept) {
          const p = await cloud.getMyPlayer();
          if (dialog !== requestDialog) return;
          if (p.ranking_visibility !== b.dataset.visibility) throw new Error('公開設定が再び変わりました。もう一度確認してください。');
          await cloud.retrySavedPlay(b.dataset.syncAccept, b.dataset.visibility);
        } else if (b.dataset.syncRetry) await cloud.retrySavedPlay(b.dataset.syncRetry);
        else if (b.dataset.syncPublish) await cloud.publishPlaySession(b.dataset.syncPublish);
        else await cloud.syncSavedPlays();
        if (dialog === requestDialog) render();
      }
    } catch (error) { if (dialog === requestDialog) dialog.querySelector('[data-sync-message]').textContent = errorText(error.message); }
    finally {if (dialog === requestDialog) busy = false; b.disabled = false; update();}
  });
  document.addEventListener('keydown', e => {
    if (!dialog) return;
    if (e.key === 'Escape') {e.stopImmediatePropagation();dialog.remove();dialog=null;busy=false;document.querySelector('[data-sync-open]')?.focus();}
    if (e.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length-1];
      if (e.shiftKey && document.activeElement === first) {e.preventDefault();last?.focus();}
      else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first?.focus();}
    }
  },true);
  window.addEventListener('interval-cosmos-sync', () => {update(); if (!busy && renderedRows !== JSON.stringify(cloud.getSavedPlays().slice().reverse())) render();});
  new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});
})();
