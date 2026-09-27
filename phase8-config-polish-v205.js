(() => {
  let queued = false;
  let lastLearningTarget = null;
  let captureFlashTimer = 0;
  let captureFlashButton = null;
  let scrollOverlay = null;
  let panelScrollTop = 0;
  let overlayScrollTop = 0;

  const DEFAULT_HELP = '予備キーは任意、決定キーは必須です。変更したい枠をクリックしてください。';
  const LEARNING_HELP = '希望するキーを押してください。';

  function setHelp(help, learning) {
    if (!help) return;
    help.classList.toggle('learning', learning);
    if (learning) {
      const html = `${LEARNING_HELP}<span class="v205-pc-config-cancel-hint"><kbd>ESC</kbd>でキャンセル</span>`;
      if (help.innerHTML !== html) help.innerHTML = html;
      return;
    }
    if (help.textContent !== DEFAULT_HELP) help.textContent = DEFAULT_HELP;
  }

  function flashCaptured(overlay, target) {
    if (!overlay || !target) return;
    const button = overlay.querySelector(`[data-pc-record="${target.slot}"][data-pc-id="${target.id}"]`);
    if (!button) return;
    clearTimeout(captureFlashTimer);
    captureFlashButton?.classList.remove('captured');
    captureFlashButton = button;
    button.classList.remove('captured');
    void button.offsetWidth;
    button.classList.add('captured');
    captureFlashTimer = setTimeout(() => {
      button.classList.remove('captured');
      if (captureFlashButton === button) captureFlashButton = null;
    }, 380);
  }

  function bindAndRestoreScroll(overlay) {
    if (scrollOverlay !== overlay) {
      scrollOverlay = overlay;
      panelScrollTop = 0;
      overlayScrollTop = 0;
      overlay.addEventListener('scroll', event => {
        const target = event.target;
        if (target === overlay) {
          overlayScrollTop = overlay.scrollTop;
          return;
        }
        if (target instanceof Element && target.classList.contains('v205-pc-config-panel')) {
          panelScrollTop = target.scrollTop;
        }
      }, true);
    }

    const panel = overlay.querySelector('.v205-pc-config-panel');
    if (overlay.scrollTop !== overlayScrollTop) overlay.scrollTop = overlayScrollTop;
    if (panel && panel.scrollTop !== panelScrollTop) panel.scrollTop = panelScrollTop;
  }

  function polishConfig() {
    const overlay = document.querySelector('.v205-pc-config-overlay');
    if (!overlay) {
      lastLearningTarget = null;
      scrollOverlay = null;
      panelScrollTop = 0;
      overlayScrollTop = 0;
      return;
    }

    bindAndRestoreScroll(overlay);

    const help = overlay.querySelector('.v205-pc-config-head > div > span');
    const note = overlay.querySelector('.v205-pc-config-note');
    if (note) {
      const chord = overlay.querySelector('[data-pc-input-mode="chord"].selected');
      const html = chord
        ? '同時押し：予備キーを押しながら決定キーを押します。例：短3度は <b>M + 3</b>。予備キーを消すには、予備キーの枠を選択中に Delete / Backspace。'
        : '2段階入力：予備キーを押してから決定キーを押します。例：短3度は <b>M → 3</b>。予備キーを消すには、予備キーの枠を選択中に Delete / Backspace。';
      if (note.innerHTML !== html) note.innerHTML = html;
    }

    for (const button of overlay.querySelectorAll('.v205-pc-keybox.aux')) {
      if (!button.classList.contains('recording') && button.textContent.trim() === '—') {
        button.textContent = '';
        button.classList.add('empty');
        button.setAttribute('aria-label', '予備キー：未設定');
      }
    }

    const recording = overlay.querySelector('.v205-pc-keybox.recording');
    const message = overlay.querySelector('.v205-pc-config-message');
    const rawMessage = message?.textContent.trim() || '';
    const cancelled = rawMessage === 'RECをキャンセルしました。' || rawMessage === 'キー入力をキャンセルしました。';
    const cleared = rawMessage === '予備キーを解除しました。';

    if (recording) {
      lastLearningTarget = {
        id: recording.dataset.pcId,
        slot: recording.dataset.pcRecord,
      };
      if (recording.textContent.trim() !== '入力待ち…') recording.textContent = '入力待ち…';
      recording.setAttribute('aria-label', 'キー入力待ち');
      recording.title = '希望するキーを押してください';
      setHelp(help, true);
    } else {
      setHelp(help, false);
      if (lastLearningTarget && !cancelled && !cleared && !message?.classList.contains('error')) {
        flashCaptured(overlay, lastLearningTarget);
      }
      lastLearningTarget = null;
    }

    if (message) {
      if (cancelled && message.textContent !== 'キー入力をキャンセルしました。') {
        message.textContent = 'キー入力をキャンセルしました。';
      }
      if (recording) {
        message.classList.add('learning');
        if (/REC中です|希望のキーを1つ押してください|希望するキーを押してください/.test(rawMessage)) {
          message.textContent = '';
        }
        if (/予約されています|別のキーを選んでください|同じキー操作|設定してください/.test(message.textContent)) {
          message.classList.add('error');
        }
      } else {
        message.classList.remove('learning');
      }
    }

    bindAndRestoreScroll(overlay);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      polishConfig();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-pc-record], [data-pc-input-mode]')) schedule();
  }, true);
  window.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
