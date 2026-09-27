(() => {
  const cloud = window.IntervalCosmosCloud;
  let relabelQueued = false;

  function realPlayer() {
    return cloud?.getCachedPlayer?.() || null;
  }

  function assignmentRoleView(player) {
    if (!player) return player;
    if (player.is_admin) return { ...player, account_type: 'staff' };
    if (player.account_type === 'staff') return { ...player, account_type: 'student' };
    return player;
  }

  function applyAdminVisualState() {
    const isAdmin = Boolean(realPlayer()?.is_admin);
    document.documentElement.classList.toggle('v205-is-admin', isAdmin);
  }

  function openWithAdminPolicy() {
    const api = window.IntervalCosmosAssignmentsV205;
    if (!api?.open || !cloud?.getCachedPlayer) return false;

    const original = cloud.getCachedPlayer;
    cloud.getCachedPlayer = function (...args) {
      return assignmentRoleView(original.apply(this, args));
    };

    try {
      api.open();
    } finally {
      cloud.getCachedPlayer = original;
    }
    return true;
  }

  function relabelAssignmentButton() {
    applyAdminVisualState();
    const button = document.querySelector('[data-a-open]');
    if (!button) return;
    const player = realPlayer();
    const desired = player?.is_admin ? '▣ ADMIN ASSIGNMENTS' : '▣ ASSIGNMENTS';
    if (button.textContent !== desired) button.textContent = desired;
  }

  function queueRelabel() {
    if (relabelQueued) return;
    relabelQueued = true;
    queueMicrotask(() => {
      relabelQueued = false;
      relabelAssignmentButton();
    });
  }

  // This listener is intentionally registered before phase6-assignments-v205.js.
  // It only replaces the route-opening actions; all gameplay/control actions remain in Phase 6.
  window.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-a-open],[data-a-refresh],[data-a-back]');
    if (!trigger) return;
    if (!window.IntervalCosmosAssignmentsV205?.open) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    openWithAdminPolicy();
  }, true);

  new MutationObserver(queueRelabel).observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('DOMContentLoaded', queueRelabel, { once: true });

  window.IntervalCosmosAssignmentAdminPolicyV205 = {
    assignmentRoleView,
    openWithAdminPolicy,
    applyAdminVisualState,
  };
})();
