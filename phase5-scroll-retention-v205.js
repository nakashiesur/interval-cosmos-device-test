(() => {
  const ACTION_SELECTOR = '[data-v205-feature],[data-v205-equip-title],[data-v205-equip-frame]';
  let observer = null;
  let timeoutId = 0;
  let pending = null;

  function clearPending() {
    observer?.disconnect();
    observer = null;
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = 0;
    pending = null;
  }

  function restoreScroll(overlay) {
    if (!pending) return;
    const card = overlay.querySelector('.v205-cosmos-card');
    if (!card) return;
    const maxTop = Math.max(0, card.scrollHeight - card.clientHeight);
    const top = Math.min(pending.top, maxTop);
    const left = pending.left;
    card.scrollTop = top;
    card.scrollLeft = left;
    window.requestAnimationFrame(() => {
      if (document.contains(card)) {
        card.scrollTop = top;
        card.scrollLeft = left;
      }
      clearPending();
    });
  }

  function rememberScroll(target) {
    const card = target.closest('.v205-cosmos-card');
    const overlay = card?.closest('.v205-cosmos-overlay');
    if (!card || !overlay) return;

    clearPending();
    pending = { top: card.scrollTop, left: card.scrollLeft };
    observer = new MutationObserver(() => queueMicrotask(() => restoreScroll(overlay)));
    observer.observe(overlay, { childList: true });
    timeoutId = window.setTimeout(clearPending, 8000);
  }

  window.addEventListener('click', event => {
    const target = event.target.closest?.(ACTION_SELECTOR);
    if (target) rememberScroll(target);
  }, true);
})();
