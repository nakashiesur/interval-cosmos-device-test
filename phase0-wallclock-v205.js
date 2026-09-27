(() => {
  // The v2.0.4 core intentionally caps each gameLoop delta at 250ms.
  // Browsers pause requestAnimationFrame in background tabs, so a single resumed
  // frame would otherwise consume only 250ms no matter how long the tab was hidden.
  //
  // Keep the stable core untouched: only named `gameLoop` rAF callbacks are caught
  // up in 250ms wall-time slices. Assignment gameplay is not affected (it already
  // uses Date.now() deadlines), nor are starfield/result/hold animations.
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame?.bind(window);
  let insideCatchup = false;
  let lastGameWall = 0;
  let lastGamePerf = 0;
  let lastGameScheduleWall = 0;
  let suppressedId = -1;
  const MAX_CATCHUP_STEPS = 720; // 180 sec; safely beyond normal/hyper session length.
  const NEW_SESSION_GAP_MS = 500;

  function isCoreGameLoop(callback) {
    return typeof callback === 'function' && callback.name === 'gameLoop';
  }

  function isUnlimitedVisible() {
    return document.querySelector('#timerText')?.textContent?.trim() === '∞';
  }

  function resetBaseline() {
    lastGameWall = 0;
    lastGamePerf = 0;
  }

  window.requestAnimationFrame = function(callback) {
    if (!isCoreGameLoop(callback)) return nativeRAF(callback);

    // Calls scheduled by the synthetic catch-up invocations must not create
    // hundreds of real browser rAF registrations. The final real invocation below
    // schedules exactly one next frame.
    if (insideCatchup) return suppressedId--;

    const scheduledAt = Date.now();
    // During a running game, gameLoop schedules its next frame every ~16ms.
    // If no gameLoop registration happened for a while, this is a fresh game
    // session after a result/menu screen, not a resumed background frame.
    // A background-resume callback was registered BEFORE the tab became hidden,
    // so it reaches the native callback below without passing this reset again.
    if (lastGameScheduleWall && scheduledAt - lastGameScheduleWall > NEW_SESSION_GAP_MS) {
      resetBaseline();
    }
    lastGameScheduleWall = scheduledAt;

    return nativeRAF(perfNow => {
      const wallNow = Date.now();
      const previousWall = lastGameWall;
      const previousPerf = lastGamePerf;
      lastGameWall = wallNow;
      lastGamePerf = perfNow;

      const elapsedWall = previousWall ? Math.max(0, wallNow - previousWall) : 0;
      const needsCatchup = previousWall && elapsedWall > 350 && !isUnlimitedVisible();

      if (needsCatchup) {
        // gameLoop itself caps dt to .25s. Feed it enough synthetic frames to
        // account for real elapsed time before the final browser frame executes.
        const steps = Math.min(MAX_CATCHUP_STEPS, Math.floor(elapsedWall / 250));
        insideCatchup = true;
        try {
          for (let i = 1; i < steps; i += 1) {
            const synthetic = previousPerf + i * 250;
            callback(synthetic);
          }
        } finally {
          insideCatchup = false;
        }
      }

      callback(perfNow);
    });
  };

  if (nativeCAF) {
    window.cancelAnimationFrame = function(id) {
      // Synthetic IDs were never registered with the browser.
      if (Number(id) < 0) return;
      nativeCAF(id);
    };
  }

  // Focus/visibility can occur while the user is on a result/menu screen. Clear
  // stale timing there, but do not clear a live timed session before its resumed
  // frame consumes the hidden elapsed time.
  function resetBaselineIfIdle() {
    const timer = document.querySelector('#timerText');
    if (!timer || timer.textContent.trim() === '∞') resetBaseline();
  }
  window.addEventListener('focus', resetBaselineIfIdle);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resetBaselineIfIdle();
  });

  window.IntervalCosmosWallClockV205 = {
    active: true,
    maxCatchupSeconds: MAX_CATCHUP_STEPS * 0.25,
  };
})();
