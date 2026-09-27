(() => {
  const cloud = window.IntervalCosmosCloud;
  let queued = false;

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'v205-toast';
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 1800);
  }

  function profile() {
    return cloud?.getCachedPlayer?.() || null;
  }

  function rewritePrivacyCopy() {
    if (profile()?.ranking_visibility !== 'always_private') return;
    const button = document.querySelector('[data-v205-visibility="always_private"]');
    const small = button?.querySelector('small');
    if (small && small.textContent !== '今後の更新を非公開') small.textContent = '今後の更新を非公開';
    const help = document.querySelector('.v205-privacy-help');
    const desired = '今後の自己ベスト更新は自動公開しません。現在公開中の過去記録はそのまま残ります。';
    if (help && help.textContent !== desired) help.textContent = desired;
  }

  function rewriteResultRankLabels() {
    const cards = document.querySelectorAll('.v205-result-rank-grid .v205-result-rank-card');
    if (cards.length >= 4) {
      const monthly = cards[2];
      const hall = cards[3];
      const monthlyLabel = monthly.querySelector('span');
      const hallLabel = hall.querySelector('span');
      const monthlySmall = monthly.querySelector('small');
      const hallSmall = hall.querySelector('small');
      if (monthlyLabel && monthlyLabel.textContent !== '自己ベスト 月間順位') monthlyLabel.textContent = '自己ベスト 月間順位';
      if (hallLabel && hallLabel.textContent !== '自己ベスト 殿堂順位') hallLabel.textContent = '自己ベスト 殿堂順位';
      if (monthlySmall && monthlySmall.textContent !== 'BEST RECORD POSITION') monthlySmall.textContent = 'BEST RECORD POSITION';
      if (hallSmall && hallSmall.textContent !== 'BEST RECORD POSITION') hallSmall.textContent = 'BEST RECORD POSITION';
    }

    const submit = document.querySelector('.ranking-submit.done');
    if (submit) {
      const spans = [...submit.querySelectorAll(':scope > span')];
      for (const span of spans) {
        if (span.textContent.trim().startsWith('月間 ')) {
          const b = span.querySelector('b');
          const value = b?.textContent || '—';
          const desired = `自己ベスト月間 ${value}`;
          if (span.textContent.trim() !== desired) span.innerHTML = `自己ベスト月間 <b>${value}</b>`;
        } else if (span.textContent.trim().startsWith('殿堂 ')) {
          const b = span.querySelector('b');
          const value = b?.textContent || '—';
          const desired = `自己ベスト殿堂 ${value}`;
          if (span.textContent.trim() !== desired) span.innerHTML = `自己ベスト殿堂 <b>${value}</b>`;
        }
      }
    }
  }

  function enhance() {
    rewritePrivacyCopy();
    rewriteResultRankLabels();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      enhance();
    });
  }

  // Loaded before phase3-v205.js so this capture handler can override only the
  // always_private action. Existing public/ask behavior remains untouched.
  window.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-v205-visibility="always_private"]');
    if (!button || !cloud?.updateMyProfile) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const buttons = document.querySelectorAll('[data-v205-visibility]');
    buttons.forEach(b => { b.disabled = true; });
    try {
      // Deliberately do NOT call hideAllMyRankings(). This setting applies to future records only.
      await cloud.updateMyProfile({ rankingVisibility: 'always_private' });
      await cloud.getMyPlayer?.();
      toast('今後の自己ベストは自動公開しません。過去の公開記録は残ります。');
      window.IntervalCosmosV205?.enhance?.();
      schedule();
    } catch (error) {
      console.error('[v2.0.5 ranking privacy hotfix]', error);
      buttons.forEach(b => { b.disabled = false; });
      toast(`公開設定を変更できませんでした：${error?.message || ''}`);
    }
  }, true);

  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
