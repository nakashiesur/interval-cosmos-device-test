(() => {
  let pendingGuideFocus = null;
  const INTERVALS = new Set(['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7','P8']);

  function later(fn, ms = 40) {
    window.setTimeout(fn, ms);
  }

  function showFocusVeil() {
    let veil = document.querySelector('.v205-focus-transition-veil');
    if (veil) return veil;
    veil = document.createElement('div');
    veil.className = 'v205-focus-transition-veil';
    veil.innerHTML = '<div><small>FOCUS PRACTICE</small><strong>練習範囲を準備しています</strong></div>';
    Object.assign(veil.style, {
      position:'fixed', inset:'0', zIndex:'2600', display:'grid', placeItems:'center',
      background:'#070b18', color:'#eef4ff', textAlign:'center', pointerEvents:'all'
    });
    const inner = veil.firstElementChild;
    if (inner) inner.style.cssText = 'display:grid;gap:8px;letter-spacing:.08em';
    const small = veil.querySelector('small');
    if (small) small.style.cssText = 'color:#5ee2ff;font-weight:800;letter-spacing:.2em';
    document.body.appendChild(veil);
    window.setTimeout(() => veil?.remove(), 1400); // fail-safe only
    return veil;
  }

  function hideFocusVeil() {
    document.querySelector('.v205-focus-transition-veil')?.remove();
  }

  function chooseOnly(intervalKey) {
    document.querySelector('[data-action="clear-all"]')?.click();
    later(() => {
      document.querySelector(`[data-interval="${intervalKey}"]`)?.click();
      later(hideFocusVeil, 90);
    }, 25);
  }

  function enterFocus(intervalKey, preferredView) {
    const finishFromPractice = () => {
      if (document.querySelector('[data-action="guide-complete"]')) {
        pendingGuideFocus = { intervalKey, preferredView };
        hideFocusVeil();
        return;
      }
      document.querySelector(`[data-view="${preferredView}"]`)?.click();
      const manual = document.querySelector('[data-practice="manual"]');
      if (manual) {
        manual.click();
        later(() => chooseOnly(intervalKey), 40);
        return;
      }
      if (document.querySelector('[data-action="clear-all"]')) {
        chooseOnly(intervalKey);
        return;
      }
      hideFocusVeil();
    };

    const go = () => {
      const practiceButton = document.querySelector('[data-action="practice"]');
      if (practiceButton) {
        practiceButton.click();
        later(finishFromPractice, 50);
        return;
      }
      finishFromPractice();
    };

    if (document.querySelector('.result-panel')) {
      document.querySelector('[data-action="home"]')?.click();
      later(go, 55);
    } else {
      go();
    }
  }

  function start(intervalKey, preferredView) {
    if (!INTERVALS.has(intervalKey)) return;

    pendingGuideFocus = null;
    showFocusVeil();
    document.querySelector('.v205-practice-choice')?.remove();
    document.querySelector('.v205-history-overlay')?.remove();

    const closeSettings = document.querySelector('[data-action="close-settings"]');
    if (closeSettings) {
      closeSettings.click();
      later(() => enterFocus(intervalKey, preferredView), 60);
      return;
    }

    enterFocus(intervalKey, preferredView);
  }

  // Loaded before phase4-v205.js so this capture handler can consume the
  // focus-choice click before the older Phase 4 navigation handler runs.
  window.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (action === 'guide-back') pendingGuideFocus = null;
    if (action === 'guide-complete' && pendingGuideFocus) {
      const { intervalKey, preferredView } = pendingGuideFocus;
      pendingGuideFocus = null;
      showFocusVeil();
      // Let the normal guide handler open PRACTICE before resuming the selection.
      later(() => enterFocus(intervalKey, preferredView), 0);
      return;
    }
    const view = event.target.closest?.('[data-v205-focus-view]');
    if (!view) return;

    const intervalKey = view.dataset.interval;
    const preferredView = view.dataset.v205FocusView === 'keys' ? 'keys' : 'text';
    event.preventDefault();
    event.stopImmediatePropagation();
    start(intervalKey, preferredView);
  }, true);
})();
