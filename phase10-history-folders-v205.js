(() => {
  const VALID = new Set(['overview','analysis','sessions']);
  let activeFolder = 'overview';

  function setActive(card, name, moveToTop = false) {
    const next = VALID.has(name) ? name : 'overview';
    activeFolder = next;

    card.querySelectorAll('[data-v205-history-folder-tab]').forEach(button => {
      const active = button.dataset.v205HistoryFolderTab === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });

    card.querySelectorAll('[data-v205-history-folder-pane]').forEach(pane => {
      pane.classList.toggle('is-active', pane.dataset.v205HistoryFolderPane === next);
    });

    if (moveToTop && window.matchMedia('(max-width:780px)').matches) {
      card.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  function navigate(card, nav, event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const current = event.target.closest('[data-v205-history-folder-tab]');
    if (!current) return;
    const names = [...VALID];
    let index = names.indexOf(current.dataset.v205HistoryFolderTab);
    index = event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length;
    event.preventDefault();
    setActive(card, names[index], true);
    nav.querySelector(`[data-v205-history-folder-tab="${names[index]}"]`).focus();
  }

  function enhance(card) {
    if (!card || card.dataset.v205HistoryFolders === '1') return;

    const head = card.querySelector(':scope > .v205-history-head');
    const summary = card.querySelector(':scope > .v205-history-summary');
    const sections = [...card.querySelectorAll(':scope > .v205-history-section')];
    if (!head || !summary || sections.length < 4) return;

    const nav = document.createElement('nav');
    nav.className = 'v205-history-folder-nav';
    nav.setAttribute('aria-label', '学習履歴の表示');
    nav.setAttribute('role', 'tablist');
    nav.innerHTML = `
      <button type="button" role="tab" data-v205-history-folder-tab="overview">概要</button>
      <button type="button" role="tab" data-v205-history-folder-tab="analysis">音程分析</button>
      <button type="button" role="tab" data-v205-history-folder-tab="sessions">プレイ履歴</button>`;
    head.insertAdjacentElement('afterend', nav);

    const makePane = name => {
      const pane = document.createElement('div');
      pane.className = 'v205-history-folder-pane';
      pane.dataset.v205HistoryFolderPane = name;
      pane.id = `history-pane-${name}`;
      pane.setAttribute('role', 'tabpanel');
      const tab = nav.querySelector(`[data-v205-history-folder-tab="${name}"]`);
      tab.id = `history-tab-${name}`;
      tab.setAttribute('aria-controls', pane.id);
      pane.setAttribute('aria-labelledby', tab.id);
      return pane;
    };

    const overview = makePane('overview');
    const analysis = makePane('analysis');
    const sessions = makePane('sessions');

    nav.insertAdjacentElement('afterend', overview);
    overview.insertAdjacentElement('afterend', analysis);
    analysis.insertAdjacentElement('afterend', sessions);

    overview.append(summary, sections[0], sections[1]);
    analysis.append(sections[2]);
    sessions.append(sections[3]);

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-v205-history-folder-tab]');
      if (!button) return;
      setActive(card, button.dataset.v205HistoryFolderTab, true);
    });
    nav.addEventListener('keydown', event => navigate(card, nav, event));

    card.dataset.v205HistoryFolders = '1';
    setActive(card, activeFolder, false);
  }

  function scan() {
    document.querySelectorAll('.v205-history-card').forEach(enhance);
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-v205-history-close]') ||
        event.target.matches('.v205-history-overlay')) {
      activeFolder = 'overview';
    }
  }, true);

  scan();
})();
