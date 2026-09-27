(() => {
  let splashStartedAt = null;
  let lastSubmitResult = null;
  const cloud = window.IntervalCosmosCloud;

  if (cloud?.submitScore && !cloud.__v205SubmitWrapped) {
    const originalSubmit = cloud.submitScore.bind(cloud);
    cloud.submitScore = async payload => {
      const result = await originalSubmit(payload);
      lastSubmitResult = result || null;
      return result;
    };
    cloud.__v205SubmitWrapped = true;
  }

  function improveFlag(result) {
    return Boolean(result?.monthly_best_improved ?? result?.monthly_improved)
      || Boolean(result?.hall_best_improved ?? result?.hall_improved);
  }

  function enhance() {
    const splash = document.querySelector('.splash');
    if (splash) {
      const now = performance.now();
      if (splashStartedAt == null) splashStartedAt = now;
      const elapsed = Math.max(0, Math.min(3350, now - splashStartedAt));
      splash.style.animationDelay = `-${elapsed}ms`;
    }

    const profile = cloud?.getCachedPlayer?.();
    if (profile?.is_guest) {
      document.querySelectorAll('.ranking-submit.done,.ranking-submit.pending').forEach(node => {
        if (node.dataset.v205Guest === '1') return;
        node.dataset.v205Guest = '1';
        node.className = 'ranking-submit muted';
        node.innerHTML = '<strong>GUEST MODE</strong><span>ランキング対象外</span>';
      });
    }

    document.querySelectorAll('.rank-burst').forEach(node => {
      if (lastSubmitResult && !improveFlag(lastSubmitResult)) node.remove();
    });
  }

  let queued = false;
  function queueEnhance() {
    if (queued) return;
    queued = true;
    const run = () => { queued = false; enhance(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  }

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('DOMContentLoaded', queueEnhance, { once: true });
})();
