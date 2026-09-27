(() => {
  const MASTERY_KEY = 'intervalCosmos.mastery.v2';
  const ORDER = ['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7','P8'];
  const NAMES = Object.freeze({
    P1:'完全1度',m2:'短2度',M2:'長2度',m3:'短3度',M3:'長3度',P4:'完全4度',TT:'三全音',P5:'完全5度',
    m6:'短6度',M6:'長6度',m7:'短7度',M7:'長7度',P8:'完全8度',
  });
  const MIN_SAMPLE = 3;
  let queued = false;

  function rows() {
    const shared = window.IntervalCosmosHistoryV205?.getAnalysisRows?.();
    if (shared) return shared;
    let mastery = {};
    try { mastery = JSON.parse(localStorage.getItem(MASTERY_KEY) || '{}') || {}; } catch {}
    return ORDER.map(key => {
      const row = mastery[key] || {};
      const seen = Number(row.seen || 0);
      const correct = Number(row.correct || 0);
      const wrong = Number(row.wrong || 0);
      const accuracy = seen ? Math.round(correct / seen * 100) : 0;
      const confusions = Object.entries(row.confusions || {}).sort((a,b)=>Number(b[1])-Number(a[1]));
      return { key, seen, correct, wrong, accuracy, ema:Number(row.emaMs || 0), confusion:confusions[0] || null };
    });
  }

  function reliableWeak() {
    const practiced = rows().filter(r => r.seen >= MIN_SAMPLE);
    if (!practiced.length) return null;
    return practiced.sort((a,b) => a.accuracy-b.accuracy || b.wrong-a.wrong || b.ema-a.ema)[0];
  }

  function apply() {
    const card = document.querySelector('.v205-history-insights article.weak');
    if (!card) return;
    const strong = card.querySelector('strong');
    const small = card.querySelector('small');
    const button = document.querySelector('.v205-weak-button');
    const insightCards = document.querySelectorAll('.v205-history-insights article');
    const confusionCard = insightCards[2] || null;
    const weak = reliableWeak();

    if (!weak) {
      if (strong && strong.textContent !== '判定保留') strong.textContent = '判定保留';
      if (small && small.textContent !== '3回答以上の音程がまだありません') small.textContent = '3回答以上の音程がまだありません';
      if (button && !button.hidden) button.hidden = true;
      if (confusionCard) {
        const cStrong = confusionCard.querySelector('strong');
        const cSmall = confusionCard.querySelector('small');
        if (cStrong && cStrong.textContent !== '—') cStrong.textContent = '—';
        if (cSmall && cSmall.textContent !== '十分なデータが集まると表示します') cSmall.textContent = '十分なデータが集まると表示します';
      }
      return;
    }

    const title = `${weak.key} / ${NAMES[weak.key]}`;
    const detail = `正答率 ${weak.accuracy}%・${weak.seen}回答`;
    if (strong && strong.textContent !== title) strong.textContent = title;
    if (small && small.textContent !== detail) small.textContent = detail;
    if (button) {
      button.hidden = false;
      if (button.dataset.v205PracticeInterval !== weak.key) button.dataset.v205PracticeInterval = weak.key;
    }
    if (confusionCard) {
      const cStrong = confusionCard.querySelector('strong');
      const cSmall = confusionCard.querySelector('small');
      const cTitle = weak.confusion ? `${weak.key} → ${weak.confusion[0]}` : '—';
      const cDetail = weak.confusion ? `${weak.confusion[1]}回混同` : '明確な混同は未検出';
      if (cStrong && cStrong.textContent !== cTitle) cStrong.textContent = cTitle;
      if (cSmall && cSmall.textContent !== cDetail) cSmall.textContent = cDetail;
    }
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
