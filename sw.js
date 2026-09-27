const CACHE = 'interval-cosmos-v2-0-5-alpha10-67';
const ASSETS = [
  './guest-sessions-v205.js', './phase10-device-fixes-v205.css',
  './assets/art/v1/frames/normal.svg',
  './assets/art/v1/frames/normal-still.svg',
  './assets/art/v1/frames/bronze.svg',
  './assets/art/v1/frames/bronze-still.svg',
  './assets/art/v1/frames/silver.svg',
  './assets/art/v1/frames/silver-still.svg',
  './assets/art/v1/frames/gold.svg',
  './assets/art/v1/frames/gold-still.svg',
  './assets/art/v1/frames/platinum.svg',
  './assets/art/v1/frames/platinum-still.svg',
  './assets/art/v1/frames/cosmic.svg',
  './assets/art/v1/frames/cosmic-still.svg',
  './assets/art/v1/frames/aurora.svg',
  './assets/art/v1/frames/aurora-still.svg',

  './assets/art/v1/achievements/first_signal.svg',
  './assets/art/v1/achievements/sessions_5.svg',
  './assets/art/v1/achievements/sessions_20.svg',
  './assets/art/v1/achievements/sessions_50.svg',
  './assets/art/v1/achievements/sessions_100.svg',
  './assets/art/v1/achievements/perfect_5.svg',
  './assets/art/v1/achievements/perfect_10.svg',
  './assets/art/v1/achievements/perfect_20.svg',
  './assets/art/v1/achievements/combo_5.svg',
  './assets/art/v1/achievements/combo_10.svg',
  './assets/art/v1/achievements/combo_20.svg',
  './assets/art/v1/achievements/combo_30.svg',
  './assets/art/v1/achievements/text_10.svg',
  './assets/art/v1/achievements/keys_10.svg',
  './assets/art/v1/achievements/hyper_first.svg',
  './assets/art/v1/achievements/ear_first.svg',
  './assets/art/v1/achievements/all_modes.svg',
  './assets/art/v1/achievements/interval_all_seen.svg',
  './assets/art/v1/achievements/interval_80.svg',
  './assets/art/v1/achievements/interval_90.svg',
  './assets/art/v1/achievements/streak_3.svg',
  './assets/art/v1/achievements/streak_7.svg',
  './assets/art/v1/achievements/streak_14.svg',
  './assets/art/v1/achievements/public_record.svg',
  './assets/art/v1/achievements/rank_top10.svg',
  './assets/art/v1/achievements/rank_podium.svg',
  './assets/art/v1/achievements/rank_first.svg',
  './assets/art/v1/achievements/hidden_ear_perfect.svg',
  './assets/art/v1/achievements/hidden_all_mode_perfect.svg',
  './assets/art/v1/achievements/hidden_combo_50.svg',
  './assets/art/v1/achievements/hidden_singularity.svg',

  './phase11-art-v205.js', './phase11-art-v205.css',
  './assets/art/v1/avatars/aria.svg', './assets/art/v1/avatars/aster.svg', './assets/art/v1/avatars/auris.svg', './assets/art/v1/avatars/bloom.svg', './assets/art/v1/avatars/charm.svg', './assets/art/v1/avatars/comet.svg', './assets/art/v1/avatars/echo.svg', './assets/art/v1/avatars/flora.svg', './assets/art/v1/avatars/gem.svg', './assets/art/v1/avatars/letter.svg', './assets/art/v1/avatars/lumen.svg', './assets/art/v1/avatars/luna.svg', './assets/art/v1/avatars/lyra.svg', './assets/art/v1/avatars/nebula.svg', './assets/art/v1/avatars/nova.svg', './assets/art/v1/avatars/orbit.svg', './assets/art/v1/avatars/parfait.svg', './assets/art/v1/avatars/prism.svg', './assets/art/v1/avatars/pulse.svg', './assets/art/v1/avatars/quasar.svg', './assets/art/v1/avatars/ribbon.svg', './assets/art/v1/avatars/sonata.svg', './assets/art/v1/avatars/teacher.svg', './assets/art/v1/avatars/vector.svg', './assets/art/v1/avatars/wave.svg', './assets/art/v1/courses/child_culture.svg', './assets/art/v1/courses/composition.svg', './assets/art/v1/courses/electronic_organ.svg', './assets/art/v1/courses/music_education.svg', './assets/art/v1/courses/music_therapy.svg', './assets/art/v1/courses/orchestral.svg', './assets/art/v1/courses/piano.svg', './assets/art/v1/courses/rock_pops.svg', './assets/art/v1/courses/sound_design.svg', './assets/art/v1/courses/vocal_musical.svg', './assets/art/v1/courses/voice_actor.svg',
  './phase11-frames-v205.css', './assets/art/v1/frames/supernova.svg', './assets/art/v1/frames/supernova-still.svg', './assets/art/v1/frames/event_horizon.svg', './assets/art/v1/frames/event_horizon-still.svg',
  './offline-outbox-v205.js', './offline-sync-ui-v205.js', './offline-sync-v205.css',
  './phase10-cosmos-folders-v205.js', './phase10-cosmos-folders-v205.css',
  './', './index.html', './styles.css', './account-v205.css', './phase2-recovery-v205.css', './phase3-v205.css', './phase4-v205.css', './phase4-hotfix-v205.css', './phase5-v205.css', './phase6-assignments-v205.css', './phase6-multimode-v205.css', './phase6-game-layout-v205.css', './phase7-admin-dashboard-v205.css', './phase8-admin-player-management-v205.css', './phase8-pc-controls-v205.css', './phase8-config-polish-v205.css', './phase10-ui-foundation-v205.css', './phase10-header-polish-v205.css', './phase10-practice-polish-v205.css', './phase10-result-polish-v205.css', './phase10-cosmos-polish-v205.css', './phase10-history-polish-v205.css', './phase10-history-folders-v205.css', './phase10-assignment-polish-v205.css',
  './learning-sync-v205.js', './account-gate.js', './supabase-singleton-v205.js', './phase9-staff-registration-v205.js', './phase2-recovery-v205-fixed.js', './runtime-v205.js', './phase3-ranking-hotfix-v205.js', './phase3-v205.js', './phase4-hotfix-v205.js', './phase4-v205.js', './phase4-analysis-hotfix-v205.js', './phase5-progression-v205.js', './phase5-unlock-copy-hotfix-v205.js', './phase5-scroll-retention-v205.js', './phase6-admin-policy-v205.js', './phase6-multimode-v205.js', './phase6-assignments-v205.js', './phase7-admin-dashboard-v205.js', './phase7-admin-home-dock-v205.js', './phase8-admin-player-management-v205.js', './phase8-pc-controls-v205.js', './phase8-config-polish-v205.js', './phase0-wallclock-v205.js', './phase10-ui-foundation-v205.js', './phase10-history-folders-v205.js', './app.js', './cloud.js',
  './nakashima-logo.png', './icon.svg', './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('interval-cosmos-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.pathname.endsWith('/cloud-config.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true })));
    return;
  }

  const appRoot = new URL('./', self.location.href);
  const appNavigation = url.origin === appRoot.origin &&
    (url.pathname === appRoot.pathname || url.pathname === new URL('index.html', appRoot).pathname);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (appNavigation && response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy)));
          }
          return response;
        })
        .catch(() => appNavigation ? caches.match('./index.html') : Response.error())
    );
    return;
  }

  const localAsset = url.origin === self.location.origin;

  if (localAsset && url.search) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (localAsset && response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }))
  );
});
