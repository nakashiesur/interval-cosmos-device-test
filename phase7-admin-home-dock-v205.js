(() => {
  const cloud = window.IntervalCosmosCloud;
  let queued = false;
  let arranging = false;

  function isAdmin() {
    return Boolean(cloud?.getCachedPlayer?.()?.is_admin);
  }

  function ensureStyle() {
    if (document.querySelector('#v205AdminHomeDockStyle')) return;
    const style = document.createElement('style');
    style.id = 'v205AdminHomeDockStyle';
    style.textContent = `
      .v205-admin-dock-source{display:none!important}
      .v205-admin-home-row{margin-top:12px;padding-top:12px;border-top:1px solid rgba(116,145,201,.18);display:flex;align-items:center;gap:12px}
      .v205-admin-home-label{flex:0 0 auto;color:#5ee2ff;font-size:10px;font-weight:800;letter-spacing:.16em;white-space:nowrap}
      .v205-admin-home-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;flex:1;min-width:0}
      .v205-admin-home-actions>.secondary-btn{width:100%;min-height:48px;white-space:normal;line-height:1.15;padding:10px 14px}
      @media(max-width:700px){.v205-admin-home-row{align-items:stretch;flex-direction:column}.v205-admin-home-label{align-self:flex-start}.v205-admin-home-actions{width:100%;grid-template-columns:1fr 1fr}}
      @media(max-width:430px){.v205-admin-home-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function restoreSources() {
    document.querySelectorAll('.v205-admin-dock-source').forEach(node => node.classList.remove('v205-admin-dock-source'));
    document.querySelector('.v205-admin-home-row')?.remove();
  }

  function ensureDock(footer) {
    let row = document.querySelector('.v205-admin-home-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'v205-admin-home-row';
      row.setAttribute('aria-label', '管理者専用ツール');
      row.innerHTML = `
        <span class="v205-admin-home-label">ADMIN TOOLS</span>
        <div class="v205-admin-home-actions">
          <button type="button" class="secondary-btn" data-v205-admin-dock-dashboard>◫ ADMIN DASHBOARD</button>
          <button type="button" class="secondary-btn" data-v205-admin-dock-assignments>▣ ADMIN ASSIGNMENTS</button>
        </div>`;
      footer.insertAdjacentElement('afterend', row);
    } else if (row.previousElementSibling !== footer) {
      footer.insertAdjacentElement('afterend', row);
    }
    return row;
  }

  function arrange() {
    if (arranging) return;
    arranging = true;
    try {
      const footer = document.querySelector('.home-footer');
      if (!footer) return;

      if (!isAdmin()) {
        restoreSources();
        return;
      }

      ensureStyle();
      ensureDock(footer);

      // Keep the real controls in their original footer so their own injectors remain satisfied.
      // Only hide them visually for the admin and use stable dock entry buttons above.
      const dashboardSource = footer.querySelector('[data-v205-admin-dashboard-open]');
      const assignmentSource = footer.querySelector('[data-a-open]');
      if (dashboardSource && !dashboardSource.classList.contains('v205-admin-dock-source')) dashboardSource.classList.add('v205-admin-dock-source');
      if (assignmentSource && !assignmentSource.classList.contains('v205-admin-dock-source')) assignmentSource.classList.add('v205-admin-dock-source');
    } finally {
      arranging = false;
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      arrange();
    });
  }

  window.addEventListener('click', event => {
    if (event.target.closest?.('[data-v205-admin-dock-dashboard]')) {
      event.preventDefault();
      window.IntervalCosmosAdminDashboardV205?.open?.();
      return;
    }
    if (event.target.closest?.('[data-v205-admin-dock-assignments]')) {
      event.preventDefault();
      if (window.IntervalCosmosAssignmentAdminPolicyV205?.openWithAdminPolicy) {
        window.IntervalCosmosAssignmentAdminPolicyV205.openWithAdminPolicy();
      } else {
        document.querySelector('.home-footer [data-a-open]')?.click();
      }
    }
  }, true);

  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();

  window.IntervalCosmosAdminHomeDockV205 = { arrange };
})();
