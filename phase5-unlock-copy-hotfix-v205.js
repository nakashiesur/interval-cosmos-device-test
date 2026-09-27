(() => {
  let queued = false;
  const COPY = Object.freeze({
    'ACHIEVEMENT': '実績を解除しました',
    'TITLE UNLOCKED': '称号を獲得しました',
    'FRAME UNLOCKED': 'フレームを解放しました',
    'DAILY COMPLETE': 'デイリーミッション達成',
  });

  function apply() {
    document.querySelectorAll('.v205-unlock-burst section p').forEach(node => {
      const current = node.textContent.trim();
      const desired = COPY[current];
      if (desired && node.textContent !== desired) node.textContent = desired;
    });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; apply(); });
  }

  new MutationObserver(schedule).observe(document.documentElement, { subtree:true, childList:true });
  window.addEventListener('DOMContentLoaded', schedule, { once:true });
  schedule();
})();
