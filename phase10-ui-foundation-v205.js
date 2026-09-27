(() => {
  let queued = false;
  let arranging = false;
  let settingsCategory = 'game';
  let settingsAnimation = null;
  let headerFitFrame = 0;

  const CATEGORY_ORDER = ['game', 'controls', 'ranking', 'account'];
  const CATEGORY_LABELS = {
    game: ['GAME & AUDIO', '音・再生'],
    controls: ['CONTROLS', '操作・回答'],
    ranking: ['RANKING & PRIVACY', 'ランキング・公開'],
    account: ['ACCOUNT & DEVICE', 'アカウント・端末'],
  };

  function classifySetting(node) {
    const text = String(node?.textContent || '').toLowerCase();
    const cls = String(node?.className || '').toLowerCase();
    if (cls.includes('v205-pc-settings-entry') || /pc key|key config|shortcut|keyboard|回答キー|操作/.test(text)) return 'controls';
    if (cls.includes('v205-ranking-privacy') || /ranking publication|privacy|公開設定|公開方針/.test(text)) return 'ranking';
    if (cls.includes('cloud-setting') || cls.includes('v205-recovery-setting') || /player|profile|account|recovery|復旧|端末|device|学籍|教職員|staff|course|コース|avatar|アバター|名前/.test(text)) return 'account';
    if (/ranking|privacy|公開|殿堂|monthly|hall/.test(text)) return 'ranking';
    return 'game';
  }

  function configurePracticeEntry(panel) {
    const shortcut = panel?.querySelector('.practice-shortcut');
    const largeCard = panel?.querySelector('.mode-card.practice-top');
    if (largeCard) largeCard.classList.add('v205-phase10-practice-source-hidden');
    if (!shortcut) return;

    shortcut.dataset.action = 'practice';
    shortcut.classList.add('v205-practice-entry');
    const html = '<strong><span aria-hidden="true">🔰</span> PRACTICE MODE</strong>';
    if (shortcut.innerHTML !== html) shortcut.innerHTML = html;
  }

  function configureHistoryEntry(panel, topActions, cosmos) {
    const source = panel?.querySelector('.home-footer [data-v205-history-open]');
    if (source) source.classList.add('v205-phase10-history-source-hidden');

    let history = topActions?.querySelector('.v205-home-history-pill');
    if (!history && topActions) {
      history = document.createElement('button');
      history.type = 'button';
      history.className = 'v205-home-history-pill';
      history.dataset.v205HistoryOpen = '1';
      history.title = '学習履歴';
      history.setAttribute('aria-label', '学習履歴');
      history.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M16 7C12 4 7 4 3 5v22c4-1 9-1 13 2 4-3 9-3 13-2V5c-4-1-9-1-13 2Z"/><path d="M16 7v22M7 10l5 1M7 15l5 1M20 11l5-1M20 16l5-1"/></svg></span><strong>学習履歴</strong><small>HISTORY</small>';
    }

    if (history && topActions) {
      const gear = topActions.querySelector('[data-action="settings"]');
      if (cosmos && history.previousElementSibling !== cosmos) cosmos.insertAdjacentElement('afterend', history);
      else if (!cosmos && gear && history.nextElementSibling !== gear) topActions.insertBefore(history, gear);
      else if (!history.parentElement) topActions.appendChild(history);
    }
  }

  function fitHomeHeader(topbar, topActions) {
    if (!topbar || !topActions) return;
    cancelAnimationFrame(headerFitFrame);
    topbar.classList.remove('v205-header-auto-tight');
    if (window.innerWidth <= 700) return;

    headerFitFrame = requestAnimationFrame(() => {
      const barRect = topbar.getBoundingClientRect();
      const titleRect = topbar.querySelector('.topbar-title h1')?.getBoundingClientRect();
      const actionsRect = topActions.getBoundingClientRect();
      const overlap = titleRect ? titleRect.right + 10 > actionsRect.left : false;
      const overflow = actionsRect.right > barRect.right + 1 || actionsRect.left < barRect.left - 1;
      if (overlap || overflow) topbar.classList.add('v205-header-auto-tight');
    });
  }

  function ensureHomeTools() {
    const panel = document.querySelector('.home-panel');
    const topbar = panel?.querySelector('.topbar-home');
    const topActions = topbar?.querySelector('.top-actions');
    if (!panel || !topbar || !topActions) return;

    panel.querySelector('.v205-home-command-deck')?.remove();

    let cosmos = topActions.querySelector('.v205-home-cosmos-pill');
    if (!cosmos) {
      cosmos = document.createElement('button');
      cosmos.type = 'button';
      cosmos.className = 'v205-home-cosmos-pill';
      cosmos.setAttribute('aria-label', 'MY COSMOS プロフィール');
      cosmos.dataset.v205CosmosOpen = '1';
      cosmos.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 1c2.4 9.8 5.2 12.6 15 15-9.8 2.4-12.6 5.2-15 15C13.6 21.2 10.8 18.4 1 16 10.8 13.6 13.6 10.8 16 1Z"/></svg></span><strong>MY COSMOS</strong><small>PROFILE</small>';
      const gear = topActions.querySelector('[data-action="settings"]');
      gear ? topActions.insertBefore(cosmos, gear) : topActions.appendChild(cosmos);
    }

    configureHistoryEntry(panel, topActions, cosmos);

    const ear = panel.querySelector('.earlink-elite');
    if (ear) {
      let ranking = panel.querySelector('.v205-home-ranking-bar');
      if (!ranking) {
        ranking = document.createElement('button');
        ranking.type = 'button';
        ranking.className = 'v205-home-ranking-bar';
        ranking.dataset.action = 'records';
        ranking.innerHTML = '<span aria-hidden="true">◇</span><strong>ONLINE RANKING</strong><small>月間・殿堂・公開プロフィール</small><b>VIEW →</b>';
      }
      if (ranking.previousElementSibling !== ear) ear.insertAdjacentElement('afterend', ranking);
    }

    const footer = panel.querySelector('.home-footer');
    const legacyCosmos = footer?.querySelector('[data-v205-cosmos-open]');
    const legacyRanking = footer?.querySelector('[data-action="records"]');
    if (legacyCosmos) legacyCosmos.classList.add('v205-phase10-source-hidden');
    if (legacyRanking) legacyRanking.classList.add('v205-phase10-source-hidden');

    configurePracticeEntry(panel);
    fitHomeHeader(topbar, topActions);
  }

  function ensureSettingsShell(card) {
    const head = card.querySelector(':scope > .modal-head');
    const title = head?.querySelector('h2');
    const copy = head?.querySelector('p');
    if (title && title.textContent !== 'SETTINGS') title.textContent = 'SETTINGS';
    if (copy && copy.textContent !== 'カテゴリを選んで設定を調整します。') copy.textContent = 'カテゴリを選んで設定を調整します。';

    let legacy = card.querySelector(':scope > .v205-settings-legacy-sources');
    if (!legacy) {
      legacy = document.createElement('div');
      legacy.className = 'v205-settings-legacy-sources';
      legacy.setAttribute('aria-hidden', 'true');
    }

    const cosmosLegacy = card.querySelector('.v205-cosmos-setting');
    if (cosmosLegacy && cosmosLegacy.parentElement !== legacy) legacy.appendChild(cosmosLegacy);

    let nav = card.querySelector(':scope > .v205-settings-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'v205-settings-nav';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', '設定のカテゴリ');
      nav.addEventListener('keydown', handleSettingsTabKey);
      nav.innerHTML = CATEGORY_ORDER.map(id => {
        const [tabTitle, sub] = CATEGORY_LABELS[id];
        return `<button type="button" class="v205-settings-tab" role="tab" id="settings-tab-${id}" aria-controls="settings-panel-${id}" data-v205-settings-category="${id}"><strong>${tabTitle}</strong><small>${sub}</small></button>`;
      }).join('');
    }

    let groups = card.querySelector(':scope > .v205-settings-groups');
    if (!groups) {
      groups = document.createElement('div');
      groups.className = 'v205-settings-groups';
      groups.innerHTML = CATEGORY_ORDER.map(id => {
        const [groupTitle, sub] = CATEGORY_LABELS[id];
        return `<section class="v205-settings-group" role="tabpanel" id="settings-panel-${id}" aria-labelledby="settings-tab-${id}" data-v205-settings-group="${id}"><header><span>${groupTitle}</span><small>${sub}</small></header><div class="v205-settings-group-body"></div></section>`;
      }).join('');
    }

    if (head) {
      if (nav.parentElement !== card) head.insertAdjacentElement('afterend', nav);
      else if (nav.previousElementSibling !== head) head.insertAdjacentElement('afterend', nav);
      if (groups.parentElement !== card) nav.insertAdjacentElement('afterend', groups);
      else if (groups.previousElementSibling !== nav) nav.insertAdjacentElement('afterend', groups);
      if (legacy.parentElement !== card) card.appendChild(legacy);
    }

    return { nav, groups, legacy };
  }

  function arrangeSettings() {
    const card = document.querySelector('.settings-modal .modal-card');
    if (!card) return;
    card.classList.add('v205-settings-card');

    const { nav, groups, legacy } = ensureSettingsShell(card);
    const rows = [...card.querySelectorAll('.setting-row')];
    for (const row of rows) {
      if (row.closest('.v205-settings-legacy-sources')) continue;
      if (row.classList.contains('v205-cosmos-setting')) {
        legacy.appendChild(row);
        continue;
      }
      const category = classifySetting(row);
      const target = groups.querySelector(`[data-v205-settings-group="${category}"] .v205-settings-group-body`);
      if (target && row.parentElement !== target) target.appendChild(row);
    }

    const existingCosmos = card.querySelector('.v205-cosmos-setting');
    if (existingCosmos && existingCosmos.parentElement !== legacy) legacy.appendChild(existingCosmos);

    let active = settingsCategory;
    const activeGroup = groups.querySelector(`[data-v205-settings-group="${active}"]`);
    if (!activeGroup || !activeGroup.querySelector('.setting-row')) {
      active = CATEGORY_ORDER.find(id => groups.querySelector(`[data-v205-settings-group="${id}"] .setting-row`)) || 'game';
      settingsCategory = active;
    }

    for (const tab of nav.querySelectorAll('[data-v205-settings-category]')) {
      const on = tab.dataset.v205SettingsCategory === active;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const group of groups.querySelectorAll('[data-v205-settings-group]')) {
      const hasRows = Boolean(group.querySelector('.setting-row'));
      const on = hasRows && group.dataset.v205SettingsGroup === active;
      group.hidden = !on;
      nav.querySelector(`[data-v205-settings-category="${group.dataset.v205SettingsGroup}"]`)?.classList.toggle('empty', !hasRows);
    }

    const version = card.querySelector(':scope > .settings-version');
    if (version && version.previousElementSibling !== groups) groups.insertAdjacentElement('afterend', version);
  }

  function animateSettingsCategory(next) {
    if (!CATEGORY_ORDER.includes(next)) return;
    const card = document.querySelector('.settings-modal .modal-card.v205-settings-card');
    const groups = card?.querySelector(':scope > .v205-settings-groups');
    if (!card || !groups || next === settingsCategory) return;

    const fromHeight = groups.getBoundingClientRect().height;
    settingsCategory = next;
    arrangeSettings();
    const toHeight = groups.getBoundingClientRect().height;

    settingsAnimation?.cancel?.();
    settingsAnimation = null;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || !groups.animate || Math.abs(toHeight - fromHeight) < 3) return;

    groups.style.height = `${fromHeight}px`;
    groups.style.overflow = 'hidden';
    settingsAnimation = groups.animate([
      { height:`${fromHeight}px`, opacity:.86, transform:'scaleY(.985)' },
      { height:`${toHeight}px`, opacity:1, transform:'scaleY(1)' },
    ], {
      duration:210,
      easing:'cubic-bezier(.18,.78,.22,1.08)',
      fill:'none',
    });
    settingsAnimation.onfinish = settingsAnimation.oncancel = () => {
      groups.style.height = '';
      groups.style.overflow = '';
      settingsAnimation = null;
    };
  }

  function handleSettingsTabKey(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tab = event.target.closest?.('[data-v205-settings-category]');
    if (!tab) return;
    const tabs = [...event.currentTarget.querySelectorAll('[data-v205-settings-category]')].filter(t => !t.classList.contains('empty'));
    const index = tabs.indexOf(tab);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    animateSettingsCategory(tabs[next].dataset.v205SettingsCategory);
    tabs[next].focus();
  }

  function improveUnlockContrast() {
    document.querySelectorAll('.v205-unlock-burst section').forEach(section => section.classList.add('v205-phase10-readable'));
  }

  function arrange() {
    if (arranging) return;
    arranging = true;
    try {
      ensureHomeTools();
      arrangeSettings();
      improveUnlockContrast();
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
    const tab = event.target.closest?.('[data-v205-settings-category]');
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    animateSettingsCategory(tab.dataset.v205SettingsCategory || 'game');
  }, true);

  new MutationObserver(schedule).observe(document.documentElement, { subtree:true, childList:true });
  window.addEventListener('DOMContentLoaded', schedule, { once:true });
  window.addEventListener('resize', schedule, { passive:true });
  schedule();

  window.IntervalCosmosPhase10UIV205 = {
    arrange,
    getSettingsCategory: () => settingsCategory,
    setSettingsCategory: value => {
      if (CATEGORY_ORDER.includes(value)) settingsCategory = value;
      arrangeSettings();
    },
  };
})();
